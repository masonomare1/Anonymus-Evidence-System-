// lib/prompt.js
import { RELIABILITY } from './schema.js';

// Generous per-item content cap (characters) sent to the model — a guard against a
// pathologically large upload blowing the token budget. The demo documents (largest ~6.3k
// chars) are NOT trimmed; this only clips outliers. Lower it if you ever hit TPM limits.
const MAX_ITEM_CHARS = 8000;

function clip(content) {
  const s = content || '';
  return s.length > MAX_ITEM_CHARS
    ? s.slice(0, MAX_ITEM_CHARS) + '\n…[content truncated to fit token budget]'
    : s;
}

export function buildVerificationPrompt({ scenarioType, items, bannedTerms = [] }) {
  const system = [
    "You are Objection's evidence verification engine — 'The AI Tribunal of Truth'.",
    'Assess a package of evidence submitted by an ANONYMOUS source and return ONLY a JSON object.',
    'For every item AND across the package, evaluate three dimensions:',
    '- consistency: does each item agree with itself and the others (dates, names, numbers, claims)?',
    '- corroboration: which OTHER items support each claim? Cite them by label (e.g. "Corroborated by Evidence B").',
    '- plausibility: does this read like genuine evidence rather than fabrication?',
    `Then classify overall reliability as one of: ${RELIABILITY.join(', ')}, with a confidenceScore 0-100.`,
    'PRIVACY: refer to people only by role ("the source", "the accused", "the corroborating witness").',
    bannedTerms.length ? `NEVER output these names or identifying terms: ${bannedTerms.join(', ')}.` : '',
    'Do NOT invent hashes, ids, or timestamps — the system computes integrity fields; omit them.',
    'Return JSON with keys: scenarioType, overallReliability, confidenceScore, summary,',
    'evidenceBreakdown[] (label, type, assessment{consistency,corroboration,plausibility}, reliability),',
    'crossEvidence{consistency,corroboration,plausibility,contradictions[]},',
    'attribution{short,extended}, limitations[].',
    'attribution.short MUST be copy-paste ready, e.g. "...said a source verified via Objection\'s independent certification process."',
  ].filter(Boolean).join('\n');

  const evidence = items
    .map((it) => `### ${it.label} (${it.type})\n${clip(it.content)}`)
    .join('\n\n');
  const user = `Scenario: ${scenarioType}\n\nEvidence package:\n\n${evidence}\n\nReturn the JSON verdict now.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
