'use strict';
const http = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const RELEASE = process.env.LIFTOFF_COMMIT || 'dev';

// Liftoff injects INTERNAL_<SOURCE>_URL for a service-link edge. The source
// service here is named "api", so the variable is INTERNAL_API_URL.
const API_URL = process.env.INTERNAL_API_URL || '';

const page = readFileSync(join(__dirname, 'public', 'index.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'web', release: RELEASE }));
  }

  // Proves the service link resolves: the browser never talks to the API
  // directly, the web tier proxies over the internal URL.
  if (url.pathname === '/link-check') {
    if (!API_URL) {
      res.writeHead(503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'INTERNAL_API_URL is not injected' }));
    }
    try {
      const upstream = await fetch(`${API_URL}/health`);
      const body = await upstream.json();
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, internalUrl: API_URL, upstream: body }));
    } catch (error) {
      res.writeHead(502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, internalUrl: API_URL, error: error.message }));
    }
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page.replace('__RELEASE__', RELEASE).replace('__API__', API_URL || '(not injected)'));
});

server.listen(PORT, '0.0.0.0', () => console.log(`pulsechat-web on ${PORT} (release ${RELEASE}) api=${API_URL}`));
