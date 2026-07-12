/* =========================================================================
   VIS · Team (shared) dashboards client
   Talks to the backend /api/dashboards store so saved dashboards are shared
   across the whole team (server-side), not just one browser. Only active when
   a backend is present; otherwise the Workspace falls back to local History.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var available = false, storage = 'memory', cache = [];

  function api(path, opts) {
    opts = opts || {}; opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(path, opts).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function init() {
    return api('/api/dashboards').then(function (j) {
      available = !!(j && j.ok); storage = (j && j.storage) || 'memory';
      if (j && j.items) cache = j.items;
      return available;
    }).catch(function () { available = false; return false; });
  }
  function isAvailable() { return available; }
  function storageMode() { return storage; }

  function list() { return api('/api/dashboards').then(function (j) { cache = (j && j.items) || []; storage = (j && j.storage) || storage; return cache; }); }
  function save(entry) { return api('/api/dashboards', { method: 'POST', body: JSON.stringify(entry) }); }
  function remove(id) { return api('/api/dashboards?id=' + encodeURIComponent(id), { method: 'DELETE' }); }
  function get(id) { return cache.find(function (e) { return e.id === id; }); }

  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function card(e) {
    var kpiPeek = (e.kpis || []).slice(0, 3).map(function (k) {
      return '<div class="hist-kpi"><span class="hist-kpi-v">' + esc(k.formatted || '') + '</span><span class="hist-kpi-l">' + esc(k.label || '') + '</span></div>';
    }).join('');
    return '<div class="hist-card" data-team="' + e.id + '">' +
      '<div class="hist-top"><div class="hist-ic" data-ic="dashboard"></div>' +
      '<div class="hist-meta"><div class="hist-title">' + esc(e.title || 'Untitled') + '</div>' +
      '<div class="hist-sub">' + (e.rows || 0) + ' rows · ' + (e.cols || 0) + ' fields · ' + esc(e.author || 'Team') + ' · ' + timeAgo(e.createdAt) + '</div></div>' +
      '<button class="hist-del" data-team-del="' + e.id + '" title="Delete" aria-label="Delete"><span data-ic="trash"></span></button></div>' +
      (kpiPeek ? '<div class="hist-kpis">' + kpiPeek + '</div>' : '') +
      '<div class="hist-actions"><button class="btn btn-primary btn-sm" data-team-open="' + e.id + '"><span data-ic="play"></span>Open</button>' +
      '<span class="hist-tag">TEAM · ' + esc((e.format || 'csv').toUpperCase()) + '</span></div></div>';
  }

  function renderInto(el) {
    if (!el) return;
    el.innerHTML = '<div class="empty-state" style="grid-column:span 12"><div class="empty-ic" data-ic="history"></div><h3>Loading team dashboards…</h3></div>';
    VIS.hydrateIcons(el);
    list().then(function (items) {
      if (!items.length) {
        el.innerHTML = '<div class="empty-state" style="grid-column:span 12">' +
          '<div class="empty-ic" data-ic="dashboard"></div><h3>No team dashboards yet</h3>' +
          '<p>Generate a dashboard and click <strong>Save to team</strong> to share it with everyone.' +
          (storage === 'memory' ? '<br/><small>Note: this server stores them in memory (they reset on restart). Add a persistent store — see README.</small>' : '') + '</p>' +
          '<button class="btn btn-primary" data-route="studio"><span data-ic="spark"></span>Open Studio</button></div>';
        VIS.hydrateIcons(el); return;
      }
      el.innerHTML = items.map(card).join('');
      VIS.hydrateIcons(el);
    });
  }

  window.VIS.team = { init: init, isAvailable: isAvailable, storageMode: storageMode, list: list, save: save, remove: remove, get: get, renderInto: renderInto };
})();
