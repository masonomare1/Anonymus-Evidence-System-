// lib/analyze.js
import { sha256, buildCustodyEntry } from './integrity.js';
import { buildVerificationPrompt } from './prompt.js';
import { validateVerdict, redact, fallbackVerdict, ITEM_RELIABILITY } from './schema.js';

const MAX_AUDIO_BYTES = 4_000_000; // ~4MB — Vercel body limit headroom

function tryParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function getVerdict(messages, complete) {
  let raw = await complete(messages);
  let parsed = tryParse(raw);
  if (parsed && validateVerdict(parsed).length === 0) return parsed;
  // one repair retry
  const repair = messages.concat([
    { role: 'system', content: 'Your previous output was not valid JSON for the required schema. Return ONLY the corrected JSON object.' },
  ]);
  raw = await complete(repair);
  parsed = tryParse(raw);
  if (parsed && validateVerdict(parsed).length === 0) return parsed;
  return null;
}

export async function analyze(input, deps) {
  const { scenarioType, bannedTerms = [], items = [] } = input;
  const { complete, transcribe, now, id } = deps;
  const ingestedAt = now();

  // 1. resolve content (transcribe audio when needed) + compute integrity
  const custody = {};
  for (const it of items) {
    let content = it.content || '';
    let hashInput = content;
    if (it.audioBase64) {
      const bytes = Buffer.from(it.audioBase64, 'base64');
      hashInput = bytes;
      if (!content) {
        content = bytes.length > MAX_AUDIO_BYTES
          ? '[audio not transcribed: file exceeds size limit]'
          : await transcribe(bytes);
      }
      it.content = content;
    } else if (it.precomputedSha256) {
      hashInput = null; // use provided hash (e.g. demo audio whose bytes are not shipped)
    }
    const hash = it.precomputedSha256 || sha256(hashInput ?? content);
    custody[it.label] = buildCustodyEntry({ label: it.label, type: it.type, hash, ingestedAt });
  }

  // 2. analyze
  const messages = buildVerificationPrompt({ scenarioType, items, bannedTerms });
  let verdict = await getVerdict(messages, complete);
  if (!verdict) verdict = fallbackVerdict({ reason: 'model returned invalid output', scenarioType });

  // 3. Attach server-owned fields. NEVER trust the model for label/type/integrity/order:
  //    the model tends to rewrite labels (e.g. "Evidence A (intake_notes)") and types,
  //    which would break a label-keyed integrity merge. Anchor each row to the INPUT item
  //    by index and take ONLY assessment + reliability from the model.
  const modelRows = Array.isArray(verdict.evidenceBreakdown) ? verdict.evidenceBreakdown : [];
  verdict.certificateId = id();
  verdict.issuedAt = ingestedAt;
  verdict.scenarioType = verdict.scenarioType || scenarioType;
  verdict.evidenceBreakdown = items.map((it, i) => {
    const a = (modelRows[i] && modelRows[i].assessment) || {};
    return {
      label: it.label,
      type: it.type,
      integrity: custody[it.label] || { sha256: '', ingestedAt, status: 'verified-from-intake' },
      assessment: {
        consistency: a.consistency || 'Not assessed.',
        corroboration: a.corroboration || 'Not assessed.',
        plausibility: a.plausibility || 'Not assessed.',
      },
      reliability: ITEM_RELIABILITY.includes(modelRows[i] && modelRows[i].reliability)
        ? modelRows[i].reliability
        : 'Moderate',
    };
  });

  // 4. redact and return
  return redact(verdict, bannedTerms);
}
