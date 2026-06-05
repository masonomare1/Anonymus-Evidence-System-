// assets/ui.js — render helpers used by index.html and verify.html
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
// Escape any dynamic/model-provided string before putting it in innerHTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Animated pipeline that mirrors the architecture (intake → analysis → scoring)
window.renderPipeline = async function (phase, items, verdict) {
  const root = document.getElementById('pipeline');
  if (phase === 'intake') {
    root.innerHTML = `<h2 class="display text-3xl font-bold mb-6">Capturing evidence…</h2><ul id="custody" class="space-y-2"></ul>`;
    const ul = root.querySelector('#custody');
    for (const it of items) {
      const li = el(`<li class="reveal rounded-lg px-4 py-3" style="background:#fff;border:1px solid var(--line)">
        <div class="flex justify-between"><span class="text-sm font-medium">${esc(it.name || it.label)} · ${esc(it.type)}</span>
        <span class="text-xs" style="color:var(--gold)">hashing…</span></div></li>`);
      ul.appendChild(li); requestAnimationFrame(() => li.classList.add('in'));
      await wait(280);
      li.querySelector('span:last-child').textContent = '✓ hashed + timestamped';
    }
    await wait(300);
  }
  if (phase === 'analyzing') {
    root.insertAdjacentHTML('beforeend',
      `<p class="mt-6 text-sm" style="color:var(--muted)">Cross-checking consistency, corroboration & plausibility…</p>
       <div class="mt-3 h-1 w-full overflow-hidden rounded" style="background:var(--line)">
       <div style="width:40%;height:100%;background:var(--burgundy);animation:slide 1s linear infinite"></div></div>
       <style>@keyframes slide{0%{margin-left:-40%}100%{margin-left:100%}}</style>`);
  }
  if (phase === 'scoring' && verdict) {
    const pct = Math.max(0, Math.min(100, verdict.confidenceScore || 0));
    root.insertAdjacentHTML('beforeend', `<div class="mt-8 text-center"><div id="score" class="display text-5xl font-bold">0</div>
      <div class="text-sm" style="color:var(--muted)">confidence · ${esc(verdict.overallReliability)}</div></div>`);
    const node = root.querySelector('#score');
    for (let i = 0; i <= pct; i += 2) { node.textContent = i; await wait(16); }
    node.textContent = pct;
    await wait(500);
  }
};

function evidenceRow(row) {
  const a = row.assessment || {};
  return `<div class="rounded-lg p-4 mb-2" style="background:var(--paper);border:1px solid var(--line)">
    <div class="flex justify-between"><strong>${esc(row.label)}</strong><span class="text-xs px-2 py-1 rounded" style="background:#fff;border:1px solid var(--line)">${esc(row.reliability)}</span></div>
    <div class="text-xs mt-1" style="color:var(--muted)">type: ${esc(row.type)} · sha256: ${esc((row.integrity?.sha256 || '').slice(0, 16))}… · ${esc(row.integrity?.status || '')}</div>
    <ul class="text-sm mt-2 space-y-1">
      <li><strong>Consistency:</strong> ${esc(a.consistency)}</li>
      <li><strong>Corroboration:</strong> ${esc(a.corroboration)}</li>
      <li><strong>Plausibility:</strong> ${esc(a.plausibility)}</li>
    </ul></div>`;
}

window.renderCertificate = function (sel, v) {
  const host = document.querySelector(sel);
  const cross = v.crossEvidence || {};
  host.innerHTML = `
    <div class="rounded-2xl p-8" style="background:#fff;border:1px solid var(--line)">
      <div class="flex items-start justify-between">
        <div><p class="uppercase tracking-widest text-xs accent">Objection Certificate</p>
          <h3 class="display text-2xl font-bold mt-1">${esc(v.scenarioType)}</h3>
          <p class="text-xs mt-1" style="color:var(--muted)">${esc(v.certificateId)} · issued ${esc(v.issuedAt)}</p></div>
        <div class="seal text-center rounded-full px-4 py-3" style="border:2px solid var(--gold);color:var(--burgundy)">
          <div class="display text-2xl font-bold">${esc(v.confidenceScore)}</div><div class="text-[10px]">CONFIDENCE</div></div>
      </div>
      <p class="mt-4 inline-block px-3 py-1 rounded-full text-sm" style="background:var(--paper);border:1px solid var(--line)">Reliability: <strong>${esc(v.overallReliability)}</strong></p>
      <p class="mt-4">${esc(v.summary)}</p>
      <h4 class="font-semibold mt-6 mb-2">Evidence breakdown</h4>
      ${(v.evidenceBreakdown || []).map(evidenceRow).join('')}
      <h4 class="font-semibold mt-6 mb-2">Cross-evidence findings</h4>
      <ul class="text-sm space-y-1"><li><strong>Consistency:</strong> ${esc(cross.consistency)}</li>
        <li><strong>Corroboration:</strong> ${esc(cross.corroboration)}</li>
        <li><strong>Plausibility:</strong> ${esc(cross.plausibility)}</li></ul>
      <h4 class="font-semibold mt-6 mb-2">Attribution (copy-paste ready)</h4>
      <blockquote class="rounded-lg p-4 italic" style="background:var(--paper);border-left:3px solid var(--burgundy)">${esc(v.attribution.short)}</blockquote>
      <button data-copy-attribution class="mt-3 px-4 py-2 rounded-lg text-white" style="background:var(--burgundy)">Copy attribution</button>
      <h4 class="font-semibold mt-6 mb-2">Limitations</h4>
      <ul class="text-sm list-disc pl-5" style="color:var(--muted)">${(v.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </div>`;
  host.querySelector('[data-copy-attribution]')?.addEventListener('click', () => window.copyText(v.attribution.short));
  requestAnimationFrame(() => host.querySelector('.seal')?.classList.add('in'));
};

window.copyText = async function (text) {
  try { await navigator.clipboard.writeText(text); } catch {}
  const t = document.getElementById('toast');
  if (!t) return; t.textContent = 'Attribution copied'; t.classList.add('in');
  setTimeout(() => t.classList.remove('in'), 1500);
};

// sample certificate for the marketing page
window.renderSampleCertificate = function () {
  window.renderCertificate('#example-cert', {
    certificateId: 'OBJ-2026-7F3A9C', issuedAt: '2026-06-05T12:00:00.000Z',
    scenarioType: 'Academic Misconduct Allegation', overallReliability: 'High', confidenceScore: 84,
    summary: 'The package is internally consistent and well corroborated; claims of data fabrication appear in multiple independent items.',
    evidenceBreakdown: [{ label: 'Evidence A', type: 'intake_notes',
      integrity: { sha256: '2cf24dba5fb0a30e', status: 'verified-from-intake' },
      assessment: { consistency: 'Aligns with the email chain.', corroboration: 'Corroborated by Evidence C and D.', plausibility: 'Consistent with genuine reporting notes.' },
      reliability: 'High' }],
    crossEvidence: { consistency: 'No material contradictions.', corroboration: 'Three independent items align.', plausibility: 'High.', contradictions: [] },
    attribution: { short: '"The internal review process was bypassed entirely," said a source verified via Objection\'s independent certification process.', extended: 'A source whose evidence package was independently verified by Objection (reliability: High) stated that…' },
    limitations: ['Does not verify the real-world identity of the anonymous source.', 'Establishes integrity from the point of intake, not cryptographic origin.'],
  });
};
