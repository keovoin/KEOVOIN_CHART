/* =========================================================================
   VIS · Vercel serverless entry (single function for ALL /api/* routes)
   vercel.json rewrites every /api/(.*) request here; the shared handler routes
   by the original req.url. This avoids the bracket catch-all filename, which on
   Vercel only matched single-segment paths (so /api/admin/login, /api/ai/proxy
   returned 404). Env: VIS_ADMIN_TOKEN, VIS_AI_ENDPOINT, VIS_AI_KEY, VIS_AI_MODEL,
   KV_REST_API_URL, KV_REST_API_TOKEN.
   ========================================================================= */
'use strict';
const handler = require('../server/handler');
module.exports = (req, res) => handler(req, res);
