// scripts/build-demo.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGroqClient } from '../lib/groq.js';

const SRC = new URL('../_evidence_src/', import.meta.url);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const MAP = {
  'journalist_intake_notes.txt': { label: 'Evidence A', type: 'intake_notes' },
  'email_chain_vasquez_hargrove.txt': { label: 'Evidence B', type: 'correspondence' },
  'recorded_conversation_march_19.mp3': { label: 'Evidence C', type: 'audio' },
  'data_comparison_memo.txt': { label: 'Evidence D', type: 'data_analysis' },
  'vasquez_personal_notes.txt': { label: 'Evidence E', type: 'personal_notes' },
};

const files = await readdir(SRC);
const client = createGroqClient();
const items = [];

for (const name of files) {
  const meta = MAP[name];
  if (!meta) continue;
  const buf = await readFile(new URL(name, SRC));
  if (meta.type === 'audio') {
    const text = await client.transcribe(buf);
    items.push({ ...meta, name, content: text, precomputedSha256: sha256(buf), transcribed: true });
  } else {
    items.push({ ...meta, name, content: buf.toString('utf8') });
  }
}

items.sort((a, b) => a.label.localeCompare(b.label));
const demo = {
  scenarioType: 'Academic Misconduct Allegation',
  bannedTerms: ['Vasquez', 'Elena', 'David Chen'],
  items,
};
await writeFile(new URL('../evidence/demo.json', import.meta.url), JSON.stringify(demo, null, 2));
console.log(`Wrote evidence/demo.json with ${items.length} items.`);
