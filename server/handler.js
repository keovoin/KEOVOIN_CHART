/* =========================================================================
   VIS · Request handler (Node.js standard library only — zero dependencies)

   Shared by:
     - server/server.js  → a long-running http server (Render / Fly / local)
     - api/[...path].js   → a Vercel serverless function

   Keeps the AI API key SERVER-SIDE, proxies AI calls, serves the admin API,
   and exposes a safe key-free /api/config. Config comes from server/config.json
   (when the filesystem is writable) and/or environment variables (which always
   win — the recommended way to configure secrets on serverless hosts).
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

// Build marker — lets you confirm which version a deployment is actually serving.
const BUILD = 'v13 · 2026-07-12';

// Serverless platforms (e.g. Vercel) have a read-only filesystem.
let PERSISTENT = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;

/* ----------------------------- config ----------------------------- */
function loadConfig() {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch (e) {
    try { cfg = JSON.parse(fs.readFileSync(EXAMPLE_PATH, 'utf8')); }
    catch (e2) { cfg = {}; }
  }
  cfg.ai = cfg.ai || { enabled: false, endpoint: '', apiKey: '', model: 'gpt-4o-mini' };
  cfg.branding = cfg.branding || { title: 'VIS · Visual Intelligence Studio', defaultTheme: 'executive-white', defaultMode: 'light' };
  // env overrides (env wins so secrets can stay out of the file / survive restarts)
  if (process.env.VIS_AI_ENDPOINT) cfg.ai.endpoint = process.env.VIS_AI_ENDPOINT;
  if (process.env.VIS_AI_KEY) cfg.ai.apiKey = process.env.VIS_AI_KEY;
  if (process.env.VIS_AI_MODEL) cfg.ai.model = process.env.VIS_AI_MODEL;
  if (process.env.VIS_AI_ENABLED) cfg.ai.enabled = process.env.VIS_AI_ENABLED !== 'false';
  else if (process.env.VIS_AI_KEY && process.env.VIS_AI_ENDPOINT) cfg.ai.enabled = true;
  cfg.adminToken = process.env.VIS_ADMIN_TOKEN || cfg.adminToken || 'vis-admin';
  return cfg;
}
function saveConfig(cfg) {
  const toSave = JSON.parse(JSON.stringify(cfg));
  if (process.env.VIS_ADMIN_TOKEN) delete toSave.adminToken;
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2)); return true; }
  catch (e) { PERSISTENT = false; return false; } // read-only FS (serverless) — keep changes in memory only
}
let config = loadConfig();

/* ----------------------------- team dashboards store -----------------------------
   Persistence, in priority order:
     1. Vercel KV / Upstash Redis REST (KV_REST_API_URL + KV_REST_API_TOKEN) —
        works on serverless (Vercel) where the filesystem is read-only
     2. Local JSON file (persistent hosts: Render / Fly / self-hosted)
     3. In-memory (last resort; resets on restart)
   -------------------------------------------------------------------------------- */
const DASH_PATH = path.join(__dirname, 'dashboards.json');
const KV_URL = process.env.KV_REST_API_URL || process.env.VIS_KV_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.VIS_KV_TOKEN || '';
const KV_ON = !!(KV_URL && KV_TOKEN);
let dashMem = [];

function dashMode() { return KV_ON ? 'kv' : (PERSISTENT ? 'file' : 'memory'); }

function kvReq(method, keypath, body) {
  return new Promise(function (resolve, reject) {
    var u; try { u = new URL(KV_URL.replace(/\/+$/, '') + keypath); } catch (e) { return reject(e); }
    var lib = u.protocol === 'http:' ? http : https;
    var data = body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    var opts = { method: method, hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: u.pathname + u.search, headers: { 'Authorization': 'Bearer ' + KV_TOKEN }, timeout: 10000 };
    if (data) { opts.headers['Content-Type'] = 'text/plain'; opts.headers['Content-Length'] = Buffer.byteLength(data); }
    var r = lib.request(opts, function (pr) { var d = ''; pr.on('data', function (c) { d += c; }); pr.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } }); });
    r.on('timeout', function () { r.destroy(); reject(new Error('KV timeout')); });
    r.on('error', reject);
    if (data) r.write(data); r.end();
  });
}
function dashList() {
  if (KV_ON) return kvReq('GET', '/get/vis:dashboards').then(function (res) { var v = res && res.result; return v ? (typeof v === 'string' ? JSON.parse(v) : v) : []; }).catch(function () { return []; });
  if (PERSISTENT) { try { return Promise.resolve(JSON.parse(fs.readFileSync(DASH_PATH, 'utf8'))); } catch (e) { return Promise.resolve([]); } }
  return Promise.resolve(dashMem);
}
function dashPersist(list) {
  list = list.slice(0, 100);
  if (KV_ON) return kvReq('POST', '/set/vis:dashboards', JSON.stringify(list)).then(function () { return true; }).catch(function () { return false; });
  if (PERSISTENT) { try { fs.writeFileSync(DASH_PATH, JSON.stringify(list)); return Promise.resolve(true); } catch (e) { return Promise.resolve(false); } }
  dashMem = list; return Promise.resolve(true);
}

/* ----------------------------- sessions (stateless, signed cookie) -----------------------------
   Serverless (Vercel) runs each request on a possibly-different instance, so an
   in-memory session store breaks: you log in on one instance and the next
   request lands on another with no memory of it. We instead issue an HMAC-signed
   token that any instance can verify with the shared secret — no server state. */
const SESSION_TTL = 1000 * 60 * 60 * 8; // 8h
function sessionSecret() { return String(process.env.VIS_SESSION_SECRET || process.env.VIS_ADMIN_TOKEN || config.adminToken || 'vis') + '::vis-session-v1'; }
function sign(payload) { return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('hex'); }
function makeToken() { const payload = String(Date.now() + SESSION_TTL); return payload + '.' + sign(payload); }
function validToken(tok) {
  if (!tok || tok.indexOf('.') === -1) return false;
  const i = tok.lastIndexOf('.'); const payload = tok.slice(0, i); const sig = tok.slice(i + 1);
  let expected; try { expected = sign(payload); } catch (e) { return false; }
  if (sig.length !== expected.length) return false;
  let ok = true; for (let k = 0; k < expected.length; k++) if (sig[k] !== expected[k]) ok = false; // constant-time-ish
  if (!ok) return false;
  const exp = parseInt(payload, 10);
  return !!exp && exp > Date.now();
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
// Admin token supplied via header (X-Admin-Token or Authorization: Bearer) — the
// primary, cookie-independent auth path (robust on serverless / Vercel).
function headerAdminToken(req) {
  var h = req.headers['x-admin-token'] || '';
  if (!h && req.headers['authorization']) { var m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization']); if (m) h = m[1]; }
  return String(h || '').trim();
}
function isAdmin(req) {
  var hdr = headerAdminToken(req);
  if (hdr && hdr === String(config.adminToken == null ? '' : config.adminToken).trim()) return true;
  return validToken(parseCookies(req).vis_admin); // fallback: signed cookie
}

/* ----------------------------- helpers ----------------------------- */
function sendJSON(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
function readBody(req) {
  // Serverless platforms (Vercel) often pre-parse the body onto req.body and
  // consume the stream, so we must handle object / string / Buffer up front.
  if (req.body !== undefined && req.body !== null) {
    var b = req.body;
    if (Buffer.isBuffer(b)) { try { return Promise.resolve(JSON.parse(b.toString('utf8') || '{}')); } catch (e) { return Promise.resolve({}); } }
    if (typeof b === 'string') { try { return Promise.resolve(b ? JSON.parse(b) : {}); } catch (e) { return Promise.resolve({}); } }
    if (typeof b === 'object') return Promise.resolve(b);
  }
  return new Promise((resolve) => {
    let data = ''; let size = 0; let done = false;
    var finish = function (v) { if (!done) { done = true; resolve(v); } };
    req.on('data', c => { size += c.length; if (size > 5e6) { req.destroy(); return; } data += c; });
    req.on('end', () => { try { finish(data ? JSON.parse(data) : {}); } catch (e) { finish({}); } });
    req.on('error', () => finish({}));
    setTimeout(function () { try { finish(data ? JSON.parse(data) : {}); } catch (e) { finish({}); } }, 8000);
  });
}
function maskKey(k) { if (!k) return ''; if (k.length <= 8) return '••••'; return k.slice(0, 3) + '••••••' + k.slice(-4); }
function publicConfig() {
  return {
    ok: true,
    build: BUILD,
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
    return sendJSON(res, 503, { error: 'AI is not configured. An admin can set it up in the admin portal (or via environment variables on serverless hosts).' });
  }
  if (!body || !Array.isArray(body.messages)) return sendJSON(res, 400, { error: 'messages[] required' });

  let endpoint = config.ai.endpoint;
  if (!/\/(chat\/completions|completions|responses)\b/.test(endpoint)) endpoint = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
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
    method: 'POST', hostname: target.hostname, port: target.port || (target.protocol === 'http:' ? 80 : 443),
    path: target.pathname + target.search,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'Authorization': 'Bearer ' + config.ai.apiKey },
    timeout: 30000
  };
  const preq = lib.request(opts, (pres) => {
    let data = '';
    pres.on('data', c => data += c);
    pres.on('end', () => { res.writeHead(pres.statusCode || 502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(data || '{}'); });
  });
  preq.on('timeout', () => { preq.destroy(); sendJSON(res, 504, { error: 'AI provider timed out' }); });
  preq.on('error', (e) => sendJSON(res, 502, { error: 'AI provider error: ' + e.message }));
  preq.write(payload); preq.end();
}

/* ----------------------------- static (Node host only) ----------------------------- */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (!path.extname(rel)) return streamFile(res, path.join(PUBLIC_DIR, 'index.html'));
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

/* ----------------------------- request handler ----------------------------- */
async function handleRequest(req, res) {
  const parsed = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/health' && req.method === 'GET') return sendJSON(res, 200, { ok: true, build: BUILD, uptime: process.uptime(), persistent: PERSISTENT, aiConfigured: !!(config.ai.enabled && config.ai.endpoint && config.ai.apiKey), kv: KV_ON });
      if (pathname === '/api/config' && req.method === 'GET') return sendJSON(res, 200, publicConfig());
      if (pathname === '/api/ai/proxy' && req.method === 'POST') { const body = await readBody(req); return aiProxy(req, res, body); }

      // ----- shared team dashboards -----
      if (pathname === '/api/dashboards' && req.method === 'GET') {
        const items = await dashList();
        return sendJSON(res, 200, { ok: true, items: items, storage: dashMode() });
      }
      if (pathname === '/api/dashboards' && req.method === 'POST') {
        const body = await readBody(req) || {};
        if (!body.title || !body.dataText) return sendJSON(res, 400, { error: 'title and dataText are required' });
        const list = await dashList();
        const entry = {
          id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: String(body.title).slice(0, 120),
          dataText: String(body.dataText).slice(0, 200000),
          theme: (body.theme || '').slice(0, 40),
          format: (body.format || '').slice(0, 12),
          rows: body.rows | 0, cols: body.cols | 0,
          kpis: Array.isArray(body.kpis) ? body.kpis.slice(0, 4) : [],
          author: (body.author || 'Team').slice(0, 60),
          createdAt: Date.now()
        };
        // de-dupe identical title+data
        const deduped = list.filter(function (e) { return !(e.title === entry.title && e.dataText === entry.dataText); });
        deduped.unshift(entry);
        const saved = await dashPersist(deduped);
        return sendJSON(res, 200, { ok: true, id: entry.id, persisted: saved, storage: dashMode() });
      }
      if (pathname === '/api/dashboards' && req.method === 'DELETE') {
        const id = parsed.searchParams.get('id');
        let list = await dashList();
        list = list.filter(function (e) { return e.id !== id; });
        await dashPersist(list);
        return sendJSON(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/login' && req.method === 'POST') {
        // Read the token from a header first (always delivered, even if the
        // serverless platform doesn't hand us the request body); fall back to body.
        var given = headerAdminToken(req);
        if (!given) { const body = await readBody(req) || {}; given = String(body.token == null ? '' : body.token).trim(); }
        const expected = String(config.adminToken == null ? '' : config.adminToken).trim();
        if (!given) return sendJSON(res, 400, { error: 'No token received by the server' });
        if (given !== expected) return sendJSON(res, 401, { error: 'Invalid admin token' });
        return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': `vis_admin=${makeToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}` });
      }
      if (pathname === '/api/admin/logout' && req.method === 'POST') {
        return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': 'vis_admin=; HttpOnly; Path=/; Max-Age=0' });
      }

      if (pathname === '/api/admin/config') {
        if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Not authenticated' });
        if (req.method === 'GET') {
          return sendJSON(res, 200, {
            ok: true,
            ai: { enabled: !!config.ai.enabled, endpoint: config.ai.endpoint || '', model: config.ai.model || '', hasKey: !!config.ai.apiKey, keyMasked: maskKey(config.ai.apiKey) },
            branding: config.branding,
            adminTokenFromEnv: !!process.env.VIS_ADMIN_TOKEN,
            persistent: PERSISTENT
          });
        }
        if (req.method === 'POST') {
          const body = await readBody(req) || {};
          if (body.ai) {
            if (typeof body.ai.enabled === 'boolean') config.ai.enabled = body.ai.enabled;
            if (typeof body.ai.endpoint === 'string') config.ai.endpoint = body.ai.endpoint.trim();
            if (typeof body.ai.model === 'string') config.ai.model = body.ai.model.trim();
            if (typeof body.ai.apiKey === 'string' && body.ai.apiKey.trim() && body.ai.apiKey.indexOf('•') === -1) config.ai.apiKey = body.ai.apiKey.trim();
            if (body.ai.clearKey === true) config.ai.apiKey = '';
          }
          if (body.branding) {
            config.branding.title = (body.branding.title || config.branding.title);
            config.branding.defaultTheme = (body.branding.defaultTheme || config.branding.defaultTheme);
            config.branding.defaultMode = (body.branding.defaultMode || config.branding.defaultMode);
          }
          if (typeof body.newAdminToken === 'string' && body.newAdminToken.trim() && !process.env.VIS_ADMIN_TOKEN) config.adminToken = body.newAdminToken.trim();
          const persisted = saveConfig(config);
          return sendJSON(res, 200, { ok: true, persisted: persisted });
        }
      }
      return sendJSON(res, 404, { error: 'Unknown endpoint' });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Server error: ' + e.message });
    }
  }

  // Static (used on a Node host; on Vercel the platform serves /public directly)
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end('Method not allowed');
}

module.exports = handleRequest;
module.exports.handleRequest = handleRequest;
module.exports.loadConfig = loadConfig;
module.exports.getConfig = () => config;
module.exports.isPersistent = () => PERSISTENT;
