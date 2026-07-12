/* =========================================================================
   VIS · Node server (Render / Fly.io / any Node host / local)
   Thin wrapper around the shared request handler in ./handler.js.
   Run:  node server/server.js
   ========================================================================= */
'use strict';

const http = require('http');
const handler = require('./handler');

const PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

http.createServer(handler).listen(PORT, HOST, () => {
  const config = handler.getConfig();
  console.log('\n  VIS team server running');
  console.log('  → http://localhost:' + PORT + '        (app)');
  console.log('  → http://localhost:' + PORT + '/admin  (admin portal)');
  console.log('  admin token: ' + (process.env.VIS_ADMIN_TOKEN ? '(from VIS_ADMIN_TOKEN env)' : config.adminToken));
  if (!process.env.VIS_ADMIN_TOKEN && config.adminToken === 'vis-admin') {
    console.log('  ⚠  Using the default admin token "vis-admin" — change it in /admin or set VIS_ADMIN_TOKEN.');
  }
  console.log('  AI configured: ' + (config.ai.enabled && config.ai.apiKey ? 'yes (' + (config.ai.model || 'default model') + ')' : 'no — set it in /admin or via env vars') + '\n');
});
