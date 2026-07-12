/* =========================================================================
   VIS · Team backend  (Node.js standard library only — zero dependencies)

   Responsibilities:
     - Serve the static frontend from /public
     - Keep the AI provider API key SERVER-SIDE and proxy requests to it, so it
       is never shipped to teammates' browsers
     - Provide an admin API (token-protected) to manage the key + customization
     - Expose a safe, key-free /api/config for the frontend

   Run:  node server/server.js      (PORT and VIS_ADMIN_TOKEN via env)
   ========================================================================= */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const EXAMPLE_PATH = path.join(__dirname, 'config.example.json');

const PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

/* ----------------------------- config ----------------------------- */
function loadConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    try { cfg = JSON.parse(fs.readFileSync(EXAMPLE_PATH, 'utf8')); }
    catch (e2) { cfg = {}; }
  }
  cfg.ai = cfg.ai || { enabled: false, endpoint: '', apiKey: '', model: 'gpt-4o-mini' };
  cfg.branding = cfg.branding || { title: 'VIS · Visual Intelligence Studio', defaultTheme: 'executive-white', defaultMode: 'light' };
  // env overrides (env wins so secrets can stay out of the file)
  if (process.env.VIS_AI_ENDPOINT) cfg.ai.endpoint = process.env.VIS_AI_ENDPOINT;
  if (process.env.VIS_AI_KEY) cfg.ai.apiKey = process.env.VIS_AI_KEY;
  if (process.env.VIS_AI_MODEL) cfg.ai.model = process.env.VIS_AI_MODEL;
  cfg.adminToken = process.env.VIS_ADMIN_TOKEN || cfg.adminToken || 'vis-admin';
  return cfg;
}
function saveConfig(cfg) {
  const toSave = JSON.parse(JSON.stringify(cfg));
  // don't persist the env-provided admin token if it came from env
  if (process.env.VIS_ADMIN_TOKEN) delete toSave.adminToken;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2));
}
let config = loadConfig();

/* ----------------------------- sessions ----------------------------- */
const sessions = new Map(); // sid -> expiresAt
const SESSION_TTL = 1000 * 60 * 60 * 8; // 8h
function newSession() {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, Date.now() + SESSION_TTL);
  return sid;
}
function validSession(sid) {
  if (!sid || !sessions.has(sid)) return false;
  if (sessions.get(sid) < Date.now()) { sessions.delete(sid); return false; }
  return true;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function isAdmin(req) { return validSession(parseCookies(req).vis_admin); }

/* ----------------------------- helpers ----------------------------- */
function sendJSON(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = ''; let size = 0;
    req.on('data', c => { size += c.length; if (size > 5e6) { req.destroy(); return; } data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '••••';
  return k.slice(0, 3) + '••••••' + k.slice(-4);
}
function publicConfig() {
  return {
    ok: true,
    ai: { available: !!(config.ai.enabled && config.ai.endpoint && config.ai.apiKey), model: config.ai.model || '' },
    branding: config.branding
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json'
};

/* ----------------------------- AI proxy ----------------------------- */
function aiProxy(req, res, body) {
  if (!config.ai.enabled || !config.ai.endpoint || !config.ai.apiKey) {
    return sendJSON(res, 503, { error: 'AI is not configured. An admin can set it up in the admin portal.' });
  }
  if (!body || !Array.isArray(body.messages)) return sendJSON(res, 400, { error: 'messages[] required' });

  let endpoint = config.ai.endpoint;
  if (!/\/(chat\/completions|completions|responses)\b/.test(endpoint)) {
    endpoint = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
  }
  let target;
  try { target = new URL(endpoint); } catch (e) { return sendJSON(res, 500, { error: 'Invalid endpoint configured' }); }

  const payload = JSON.stringify({
    model: body.model || config.ai.model || 'gpt-4o-mini',
    messages: body.messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
    max_tokens: body.max_tokens || 700
  });

  const lib = target.protocol === 'http:' ? http : https;
  const opts = {
    method: 'POST',
    hostname: target.hostname,
    port: target.port || (target.protocol === 'http:' ? 80 : 443),
    path: target.pathname + target.search,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': 'Bearer ' + config.ai.apiKey
    },
    timeout: 30000
  };
  const preq = lib.request(opts, (pres) => {
    let data = '';
    pres.on('data', c => data += c);
    pres.on('end', () => {
      res.writeHead(pres.statusCode || 502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(data || '{}');
    });
  });
  preq.on('timeout', () => { preq.destroy(); sendJSON(res, 504, { error: 'AI provider timed out' }); });
  preq.on('error', (e) => sendJSON(res, 502, { error: 'AI provider error: ' + e.message }));
  preq.write(payload);
  preq.end();
}

/* ----------------------------- static ----------------------------- */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' ) rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA-ish fallback to index for unknown non-asset routes
      if (!path.extname(rel)) { return streamFile(res, path.join(PUBLIC_DIR, 'index.html')); }
      res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
    }
    streamFile(res, filePath);
  });
}
function streamFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const cache = /\.(js|css|svg|png|jpg|woff2?|ico)$/.test(ext) ? 'public, max-age=3600' : 'no-cache';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
  fs.createReadStream(filePath).on('error', () => { res.end(); }).pipe(res);
}

/* ----------------------------- router ----------------------------- */
const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = parsed.pathname;

  // ----- API -----
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/health' && req.method === 'GET') return sendJSON(res, 200, { ok: true, uptime: process.uptime() });

      if (pathname === '/api/config' && req.method === 'GET') return sendJSON(res, 200, publicConfig());

      if (pathname === '/api/ai/proxy' && req.method === 'POST') {
        const body = await readBody(req);
        return aiProxy(req, res, body);
      }

      if (pathname === '/api/admin/login' && req.method === 'POST') {
        const body = await readBody(req) || {};
        if (!body.token || body.token !== config.adminToken) return sendJSON(res, 401, { error: 'Invalid admin token' });
        const sid = newSession();
        return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': `vis_admin=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}` });
      }
      if (pathname === '/api/admin/logout' && req.method === 'POST') {
        const sid = parseCookies(req).vis_admin; if (sid) sessions.delete(sid);
        return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': 'vis_admin=; HttpOnly; Path=/; Max-Age=0' });
      }

      if (pathname === '/api/admin/config') {
        if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Not authenticated' });
        if (req.method === 'GET') {
          return sendJSON(res, 200, {
            ok: true,
            ai: { enabled: !!config.ai.enabled, endpoint: config.ai.endpoint || '', model: config.ai.model || '', hasKey: !!config.ai.apiKey, keyMasked: maskKey(config.ai.apiKey) },
            branding: config.branding,
            adminTokenFromEnv: !!process.env.VIS_ADMIN_TOKEN
          });
        }
        if (req.method === 'POST') {
          const body = await readBody(req) || {};
          if (body.ai) {
            if (typeof body.ai.enabled === 'boolean') config.ai.enabled = body.ai.enabled;
            if (typeof body.ai.endpoint === 'string') config.ai.endpoint = body.ai.endpoint.trim();
            if (typeof body.ai.model === 'string') config.ai.model = body.ai.model.trim();
            // only overwrite key when a non-empty value is provided
            if (typeof body.ai.apiKey === 'string' && body.ai.apiKey.trim() && body.ai.apiKey.indexOf('•') === -1) config.ai.apiKey = body.ai.apiKey.trim();
            if (body.ai.clearKey === true) config.ai.apiKey = '';
          }
          if (body.branding) {
            config.branding.title = (body.branding.title || config.branding.title);
            config.branding.defaultTheme = (body.branding.defaultTheme || config.branding.defaultTheme);
            config.branding.defaultMode = (body.branding.defaultMode || config.branding.defaultMode);
          }
          if (typeof body.newAdminToken === 'string' && body.newAdminToken.trim() && !process.env.VIS_ADMIN_TOKEN) {
            config.adminToken = body.newAdminToken.trim();
          }
          saveConfig(config);
          return sendJSON(res, 200, { ok: true });
        }
      }

      return sendJSON(res, 404, { error: 'Unknown endpoint' });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Server error: ' + e.message });
    }
  }

  // ----- static -----
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log('\n  VIS team server running');
  console.log('  → http://localhost:' + PORT + '        (app)');
  console.log('  → http://localhost:' + PORT + '/admin  (admin portal)');
  const usingDefault = !process.env.VIS_ADMIN_TOKEN && (!config.adminToken || config.adminToken === 'vis-admin');
  console.log('  admin token: ' + (process.env.VIS_ADMIN_TOKEN ? '(from VIS_ADMIN_TOKEN env)' : config.adminToken));
  if (usingDefault) console.log('  ⚠  Using the default admin token "vis-admin" — change it in the admin portal or set VIS_ADMIN_TOKEN.');
  console.log('  AI configured: ' + (config.ai.enabled && config.ai.apiKey ? 'yes (' + (config.ai.model || 'default model') + ')' : 'no — set it up in /admin') + '\n');
});

module.exports = { server, loadConfig, maskKey };
