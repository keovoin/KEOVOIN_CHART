/* =========================================================================
   VIS · Vercel serverless entry
   Catch-all function for /api/* — delegates to the shared handler.
   Vercel serves the static frontend from /public directly; this function only
   handles API routes. Configure the AI key via Vercel Environment Variables
   (VIS_AI_ENDPOINT, VIS_AI_KEY, VIS_AI_MODEL, VIS_ADMIN_TOKEN) — the key stays
   server-side and is never exposed to the browser.
   ========================================================================= */
'use strict';
const handler = require('../server/handler');
module.exports = (req, res) => handler(req, res);
