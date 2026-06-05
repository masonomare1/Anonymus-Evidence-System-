// Local dev server — serves the static site AND runs /api/verify (mimics Vercel locally).
// Run: node --env-file=.env.local scripts/dev-server.mjs   then open http://localhost:3000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';
import handler from '../api/verify.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && (req.url || '').startsWith('/api/verify')) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      let statusCode = 200, payload;
      const vRes = { status(c) { statusCode = c; return this; }, json(o) { payload = o; return this; } };
      await handler({ method: 'POST', body }, vRes);
      return send(res, statusCode, JSON.stringify(payload), 'application/json');
    }

    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(normalize(ROOT))) return send(res, 403, 'Forbidden');
    try {
      const data = await readFile(filePath);
      return send(res, 200, data, TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream');
    } catch {
      return send(res, 404, 'Not found');
    }
  } catch (e) {
    return send(res, 500, 'Server error: ' + e.message);
  }
});

server.listen(PORT, () => console.log(`Dev server on http://localhost:${PORT}`));
