/* =========================================================================
   VIS · History + Workspace
   Persists generated dashboards to localStorage; renders History (list) and
   Workspace (gallery). Reopen restores the exact data + title + theme.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var KEY = 'vis.history';
  var MAX = 60;

  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {} }

  function save(entry) {
    var list = read();
    // de-dupe: same title + same data replaces the previous one (bump to top)
    list = list.filter(function (e) { return !(e.title === entry.title && e.dataText === entry.dataText); });
    entry.id = 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    entry.createdAt = Date.now();
    list.unshift(entry);
    write(list);
    return entry.id;
  }
  function list() { return read(); }
  function get(id) { return read().find(function (e) { return e.id === id; }); }
  function remove(id) { write(read().filter(function (e) { return e.id !== id; })); }
  function clear() { write([]); }

  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  var ICON_BY_FORMAT = { csv: 'code', tsv: 'code', json: 'code', markdown: 'templates' };

  function card(e, variant) {
    var kpiPeek = (e.kpis || []).slice(0, 3).map(function (k) {
      return '<div class="hist-kpi"><span class="hist-kpi-v">' + k.formatted + '</span><span class="hist-kpi-l">' + escapeHtml(k.label) + '</span></div>';
    }).join('');
    return '<div class="hist-card ' + (variant || '') + '" data-hist="' + e.id + '">' +
      '<div class="hist-top">' +
        '<div class="hist-ic" data-ic="dashboard"></div>' +
        '<div class="hist-meta"><div class="hist-title">' + escapeHtml(e.title || 'Untitled') + '</div>' +
        '<div class="hist-sub">' + (e.rows || 0) + ' rows · ' + (e.cols || 0) + ' fields · ' + timeAgo(e.createdAt) + '</div></div>' +
        '<button class="hist-del" data-hist-del="' + e.id + '" title="Delete" aria-label="Delete"><span data-ic="trash"></span></button>' +
      '</div>' +
      (kpiPeek ? '<div class="hist-kpis">' + kpiPeek + '</div>' : '') +
      '<div class="hist-actions"><button class="btn btn-primary btn-sm" data-hist-open="' + e.id + '"><span data-ic="play"></span>Open</button>' +
      '<span class="hist-tag">' + (e.format || 'csv').toUpperCase() + '</span></div>' +
    '</div>';
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function renderInto(el, variant) {
    var items = read();
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="empty-state" style="grid-column:span 12">' +
        '<div class="empty-ic" data-ic="history"></div><h3>Nothing saved yet</h3>' +
        '<p>Dashboards you generate are saved here automatically.</p>' +
        '<button class="btn btn-primary" data-route="studio"><span data-ic="spark"></span>Open Studio</button></div>';
      VIS.hydrateIcons(el);
      return;
    }
    el.innerHTML = items.map(function (e) { return card(e, variant); }).join('');
    VIS.hydrateIcons(el);
  }

  window.VIS.history = {
    save: save, list: list, get: get, remove: remove, clear: clear, renderInto: renderInto
  };
})();
