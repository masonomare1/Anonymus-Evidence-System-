// assets/app.js — Alpine component: intake + fetch + state machine
function verifier() {
  return {
    state: 'idle', drag: false, items: [], errorMsg: '', notice: '',
    scenarioType: 'Unknown', bannedTerms: [],

    async loadDemo() {
      const demo = await (await fetch('/evidence/demo.json')).json();
      this.scenarioType = demo.scenarioType;
      this.bannedTerms = demo.bannedTerms || [];
      this.items = demo.items;
    },

    onPick(e) { this.addFiles([...e.target.files]); },
    onDrop(e) { this.drag = false; this.addFiles([...e.dataTransfer.files]); },

    async addFiles(files) {
      const MAX_AUDIO = 3_500_000; // serverless body-limit headroom (base64 inflates ~33%)
      const skipped = [];
      for (const f of files) {
        const lower = f.name.toLowerCase();
        const isAudio = /\.mp3$/.test(lower) || f.type.startsWith('audio/');
        const isText = /\.(txt|md|csv|log|json)$/.test(lower) || f.type.startsWith('text/');
        if (!isAudio && !isText) { skipped.push(`${f.name} (only .txt and .mp3 are supported)`); continue; }
        if (isAudio && f.size > MAX_AUDIO) { skipped.push(`${f.name} (audio too large for live upload)`); continue; }
        const item = { name: f.name, label: 'Evidence ' + String.fromCharCode(65 + this.items.length),
                       type: isAudio ? 'audio' : guessType(f.name) };
        if (isAudio) item.audioBase64 = await toBase64(f);
        else item.content = await f.text();
        this.items.push(item);
      }
      this.notice = skipped.length
        ? `Skipped: ${skipped.join('; ')}. This prototype reads .txt and .mp3 directly. To run the full academic-misconduct package (which includes .docx, .pdf and the audio recording), click “Load demo package”.`
        : '';
    },

    async run() {
      try {
        this.state = 'intake';
        await window.renderPipeline('intake', this.items);
        const res = await fetch('/api/verify', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenarioType: this.scenarioType, bannedTerms: this.bannedTerms, items: this.items }),
        });
        this.state = 'analyzing'; await window.renderPipeline('analyzing', this.items);
        if (!res.ok) throw new Error('Verification service error (' + res.status + ')');
        const verdict = await res.json();
        this.state = 'scoring'; await window.renderPipeline('scoring', this.items, verdict);
        this.state = 'done'; window.renderCertificate('#certificate', verdict);
      } catch (err) { this.errorMsg = err.message; this.state = 'error'; }
    },

    reset() { this.state = 'idle'; this.items = []; this.errorMsg = ''; this.notice = ''; },
  };
}
function guessType(name) {
  if (/email|chain|correspond/i.test(name)) return 'correspondence';
  if (/data|memo|comparison/i.test(name)) return 'data_analysis';
  if (/personal|notes/i.test(name) && !/intake/i.test(name)) return 'personal_notes';
  return 'intake_notes';
}
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject; r.readAsDataURL(file);
  });
}
