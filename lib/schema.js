// lib/schema.js
export const RELIABILITY = ['High', 'Moderate', 'Low', 'Insufficient'];
export const ITEM_RELIABILITY = ['High', 'Moderate', 'Low'];
export const EVIDENCE_TYPES = ['intake_notes', 'correspondence', 'audio', 'data_analysis', 'personal_notes'];

const isStr = (x) => typeof x === 'string' && x.length > 0;

export function validateVerdict(v) {
  const e = [];
  if (!v || typeof v !== 'object') return ['verdict is not an object'];
  if (!RELIABILITY.includes(v.overallReliability)) e.push(`overallReliability invalid: ${v.overallReliability}`);
  if (typeof v.confidenceScore !== 'number' || v.confidenceScore < 0 || v.confidenceScore > 100)
    e.push(`confidenceScore out of range: ${v.confidenceScore}`);
  if (!isStr(v.summary)) e.push('summary missing');
  if (!Array.isArray(v.evidenceBreakdown) || v.evidenceBreakdown.length === 0) e.push('evidenceBreakdown empty');
  else v.evidenceBreakdown.forEach((it, i) => {
    if (!isStr(it.label)) e.push(`evidenceBreakdown[${i}].label missing`);
    if (!it.assessment || !isStr(it.assessment.consistency) || !isStr(it.assessment.corroboration) || !isStr(it.assessment.plausibility))
      e.push(`evidenceBreakdown[${i}].assessment incomplete`);
    if (!ITEM_RELIABILITY.includes(it.reliability)) e.push(`evidenceBreakdown[${i}].reliability invalid`);
  });
  if (!v.crossEvidence || !isStr(v.crossEvidence.consistency) || !isStr(v.crossEvidence.corroboration) || !isStr(v.crossEvidence.plausibility))
    e.push('crossEvidence incomplete');
  if (!v.attribution || !isStr(v.attribution.short) || !isStr(v.attribution.extended)) e.push('attribution incomplete');
  if (!Array.isArray(v.limitations) || v.limitations.length === 0) e.push('limitations empty');
  return e;
}

function redactString(s, terms) {
  let out = s;
  for (const t of terms) {
    if (!t) continue;
    out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[redacted]');
  }
  return out;
}

export function redact(value, terms = []) {
  if (!terms.length) return value;
  if (typeof value === 'string') return redactString(value, terms);
  if (Array.isArray(value)) return value.map((x) => redact(x, terms));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(value)) o[k] = redact(val, terms);
    return o;
  }
  return value;
}

export function fallbackVerdict({ reason = 'analysis unavailable', scenarioType = 'Unknown' } = {}) {
  return {
    certificateId: '', issuedAt: '', scenarioType,
    overallReliability: 'Insufficient', confidenceScore: 0,
    summary: `Automated verification could not be completed (${reason}). No reliability claim is made.`,
    evidenceBreakdown: [{
      label: 'Evidence', type: 'intake_notes',
      integrity: { sha256: '', ingestedAt: '', status: 'verified-from-intake' },
      assessment: { consistency: 'Not assessed.', corroboration: 'Not assessed.', plausibility: 'Not assessed.' },
      reliability: 'Low',
    }],
    crossEvidence: { consistency: 'Not assessed.', corroboration: 'Not assessed.', plausibility: 'Not assessed.', contradictions: [] },
    attribution: {
      short: 'Verification could not be completed for this submission.',
      extended: 'Objection was unable to complete automated verification for this submission; no reliability determination was made.',
    },
    limitations: [
      'Does not verify the real-world identity of the anonymous source.',
      'Establishes integrity from the point of intake, not cryptographic origin.',
    ],
  };
}
