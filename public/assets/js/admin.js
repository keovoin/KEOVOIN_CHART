/* =========================================================================
   VIS · Admin portal client
   Talks to the backend admin API (same-origin cookie session).
   ========================================================================= */
(function () {
  var THEMES = [
    ['apple', 'Apple'], ['stripe', 'Stripe'], ['linear', 'Linear'], ['notion', 'Notion'],
    ['vercel', 'Vercel'], ['material', 'Material 3'], ['fluent', 'Fluent'],
    ['executive-white', 'Executive White'], ['executive-dark', 'Executive Dark'],
    ['finance', 'Finance'], ['cyber', 'Cyber'], ['luxury', 'Luxury'], ['glass', 'Glass'], ['corporate', 'Corporate']
  ];

  function $(id) { return document.getElementById(id); }
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(path, opts).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }).catch(function () { return { status: r.status, body: {} }; }); });
  }
  function msg(el, text, kind) { el.textContent = text; el.className = 'msg ' + (kind || 'ok'); if (text) setTimeout(function () { if (el.textContent === text) el.className = 'msg'; }, 4000); }

  function showAdmin() { $('loginView').classList.add('hidden'); $('adminView').classList.remove('hidden'); loadConfig(); }
  function showLogin() { $('adminView').classList.add('hidden'); $('loginView').classList.remove('hidden'); }

  /* ---- login ---- */
  function login() {
    var token = $('tokenInput').value.trim();
    if (!token) return msg($('loginMsg'), 'Enter the admin token.', 'err');
    api('/api/admin/login', { method: 'POST', body: JSON.stringify({ token: token }) }).then(function (r) {
      if (r.status === 200) { $('tokenInput').value = ''; showAdmin(); }
      else msg($('loginMsg'), r.body.error || 'Sign-in failed.', 'err');
    }).catch(function () { msg($('loginMsg'), 'Cannot reach the server. Is the backend running?', 'err'); });
  }

  /* ---- load current config ---- */
  function loadConfig() {
    api('/api/admin/config').then(function (r) {
      if (r.status !== 200) { showLogin(); return; }
      var c = r.body;
      $('aiEnabled').checked = !!c.ai.enabled;
      $('aiEndpoint').value = c.ai.endpoint || '';
      $('aiModel').value = c.ai.model || '';
      var keyMsg = c.ai.hasKey ? ('A key is stored (' + c.ai.keyMasked + '). Leave the field blank to keep it.') : 'No key stored yet.';
      if (c.persistent === false) {
        keyMsg += ' ⚠ This host has a read-only filesystem (e.g. Vercel), so changes here apply live but reset on restart. For a permanent setup, configure VIS_AI_ENDPOINT / VIS_AI_KEY / VIS_AI_MODEL as environment variables in your hosting dashboard.';
      }
      $('keyNote').textContent = keyMsg;
      updateStatus(c.ai.enabled && c.ai.hasKey);
      $('brTitle').value = (c.branding && c.branding.title) || '';
      buildThemeOptions();
      $('brTheme').value = (c.branding && c.branding.defaultTheme) || 'executive-white';
      $('brMode').value = (c.branding && c.branding.defaultMode) || 'light';
      $('tokenNote').textContent = c.adminTokenFromEnv ? 'The admin token is set via the VIS_ADMIN_TOKEN environment variable and cannot be changed here.' : '';
      $('newToken').disabled = !!c.adminTokenFromEnv; $('saveTokenBtn').disabled = !!c.adminTokenFromEnv;
    });
  }
  function updateStatus(on) {
    var el = $('aiStatus');
    el.className = 'status-pill ' + (on ? 'on' : 'off');
    el.innerHTML = '<span class="dot"></span>' + (on ? 'Active' : 'Disabled');
  }
  function buildThemeOptions() {
    if ($('brTheme').options.length) return;
    $('brTheme').innerHTML = THEMES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');
  }

  /* ---- save AI ---- */
  function saveAi() {
    var payload = { ai: { enabled: $('aiEnabled').checked, endpoint: $('aiEndpoint').value.trim(), model: $('aiModel').value.trim(), apiKey: $('aiKey').value.trim() } };
    api('/api/admin/config', { method: 'POST', body: JSON.stringify(payload) }).then(function (r) {
      if (r.status === 200) { $('aiKey').value = ''; msg($('adminMsg'), 'AI settings saved.'); loadConfig(); }
      else msg($('adminMsg'), r.body.error || 'Save failed.', 'err');
    });
  }
  function clearKey() {
    api('/api/admin/config', { method: 'POST', body: JSON.stringify({ ai: { clearKey: true } }) }).then(function () { msg($('adminMsg'), 'API key cleared.'); loadConfig(); });
  }
  function testConnection() {
    msg($('adminMsg'), 'Testing…', 'ok');
    // Save first so the proxy uses the latest values, then probe.
    var payload = { ai: { enabled: true, endpoint: $('aiEndpoint').value.trim(), model: $('aiModel').value.trim(), apiKey: $('aiKey').value.trim() } };
    api('/api/admin/config', { method: 'POST', body: JSON.stringify(payload) }).then(function () {
      $('aiKey').value = '';
      return api('/api/ai/proxy', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 5 }) });
    }).then(function (r) {
      if (r.status === 200 && r.body && r.body.choices) msg($('adminMsg'), 'Connection OK — the model responded.');
      else msg($('adminMsg'), (r.body && r.body.error) || 'Connection failed (HTTP ' + r.status + ').', 'err');
      loadConfig();
    });
  }

  /* ---- save branding ---- */
  function saveBrand() {
    var payload = { branding: { title: $('brTitle').value.trim(), defaultTheme: $('brTheme').value, defaultMode: $('brMode').value } };
    api('/api/admin/config', { method: 'POST', body: JSON.stringify(payload) }).then(function (r) {
      if (r.status === 200) msg($('adminMsg'), 'Team defaults saved.'); else msg($('adminMsg'), 'Save failed.', 'err');
    });
  }

  /* ---- token ---- */
  function saveToken() {
    var t = $('newToken').value.trim();
    if (!t) return msg($('adminMsg'), 'Enter a new token.', 'err');
    api('/api/admin/config', { method: 'POST', body: JSON.stringify({ newAdminToken: t }) }).then(function (r) {
      if (r.status === 200) { $('newToken').value = ''; msg($('adminMsg'), 'Admin token updated.'); } else msg($('adminMsg'), 'Update failed.', 'err');
    });
  }

  function logout() { api('/api/admin/logout', { method: 'POST' }).then(showLogin); }

  /* ---- init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    $('loginBtn').addEventListener('click', login);
    $('tokenInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
    $('logoutBtn').addEventListener('click', logout);
    $('saveAiBtn').addEventListener('click', saveAi);
    $('clearKeyBtn').addEventListener('click', clearKey);
    $('testBtn').addEventListener('click', testConnection);
    $('saveBrandBtn').addEventListener('click', saveBrand);
    $('saveTokenBtn').addEventListener('click', saveToken);
    // If already authenticated, jump straight in.
    api('/api/admin/config').then(function (r) { if (r.status === 200) showAdmin(); else showLogin(); }).catch(showLogin);
  });
})();
