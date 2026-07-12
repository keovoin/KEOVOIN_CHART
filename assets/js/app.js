/* =========================================================================
   VIS · App controller
   Routing, theme/mode, samples, generate flow, AI enhance, export.
   ========================================================================= */
(function () {
  var VIS = window.VIS;
  var STORE = 'vis.prefs';

  var THEMES = [
    ['apple', 'Apple'], ['stripe', 'Stripe'], ['linear', 'Linear'], ['notion', 'Notion'],
    ['vercel', 'Vercel'], ['material', 'Material 3'], ['fluent', 'Fluent'],
    ['executive-white', 'Executive White'], ['executive-dark', 'Executive Dark'],
    ['finance', 'Finance'], ['cyber', 'Cyber'], ['luxury', 'Luxury'], ['glass', 'Glass'], ['corporate', 'Corporate']
  ];

  var state = { analysis: null, lastText: '' };
  VIS.settings = { maxKpi: 5, sigma: 2, anim: true };

  /* ---------- prefs ---------- */
  function loadPrefs() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) {}
    return p;
  }
  function savePrefs(p) { localStorage.setItem(STORE, JSON.stringify(p)); }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- routing ---------- */
  function route(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.getAttribute('data-view') === name); });
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.toggle('active', n.getAttribute('data-route') === name); });
    var titles = { home: 'Home', studio: 'Studio', dashboard: 'Dashboard', templates: 'Templates', settings: 'Settings' };
    document.getElementById('topbarTitle').textContent = titles[name] || 'VIS';
    closeSidebar();
    if (name === 'dashboard') setTimeout(function () { VIS.charts.resizeAll(); }, 60);
    window.scrollTo({ top: 0 });
  }

  /* ---------- theme / mode ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    ['themeSelect', 'themeSelect2'].forEach(function (id) { var s = document.getElementById(id); if (s) s.value = theme; });
    var p = loadPrefs(); p.theme = theme; savePrefs(p);
    if (state.analysis) reRenderCharts();
  }
  function applyMode(mode) {
    document.documentElement.setAttribute('data-mode', mode);
    var icon = document.querySelector('#modeToggle [data-ic]');
    if (icon) { icon.setAttribute('data-ic', mode === 'dark' ? 'sun' : 'moon'); icon.removeAttribute('data-hydrated'); VIS.hydrateIcons(icon.parentElement); }
    document.querySelectorAll('#modeGroup button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-mode') === mode); });
    var p = loadPrefs(); p.mode = mode; savePrefs(p);
    if (state.analysis) reRenderCharts();
  }
  function reRenderCharts() {
    // Rebuild dashboard to repaint charts with new theme colors.
    if (state.analysis) VIS.render(state.analysis, document.getElementById('dashboard'));
  }

  /* ---------- detect hint ---------- */
  function updateDetect() {
    var text = document.getElementById('dataInput').value;
    var hint = document.getElementById('detectHint');
    if (!text.trim()) { hint.className = 'detect'; hint.innerHTML = '<span class="dot"></span>No data yet'; return; }
    try {
      var table = VIS.engine.parse(text);
      if (!table.columns.length || !table.rows.length) { hint.className = 'detect err'; hint.innerHTML = '<span class="dot"></span>Could not detect a table'; return; }
      hint.className = 'detect ok';
      hint.innerHTML = '<span class="dot"></span>Detected <b>' + table.format.toUpperCase() + '</b> · ' + table.columns.length + ' columns · ' + table.rows.length + ' rows';
    } catch (e) { hint.className = 'detect err'; hint.innerHTML = '<span class="dot"></span>Parse error'; }
  }

  /* ---------- generate ---------- */
  function generate(text, title) {
    text = text != null ? text : document.getElementById('dataInput').value;
    if (!text.trim()) { toast('Paste some data first'); route('studio'); return; }
    var table = VIS.engine.parse(text);
    if (!table.columns.length || !table.rows.length) { toast('Could not detect a valid table'); return; }

    state.lastText = text;
    var analysis = VIS.engine.analyze(table, { sigma: VIS.settings.sigma, maxKpi: VIS.settings.maxKpi });
    if (title) analysis.title = title;
    state.analysis = analysis;

    if (title) document.getElementById('dashTitle').value = title;
    var meta = analysis.meta;
    document.getElementById('dashMeta').textContent =
      meta.rows + ' rows · ' + meta.cols + ' fields · ' + meta.measures + ' measures · ' + meta.format.toUpperCase() +
      ' · ' + meta.generatedAt.toLocaleString();

    VIS.render(analysis, document.getElementById('dashboard'));
    route('dashboard');
    toast('Dashboard generated');

    // Optional AI enhancement (async, non-blocking)
    if (VIS.ai && VIS.ai.isEnabled()) {
      toast('Enhancing with AI…');
      VIS.ai.enhance(analysis).then(function (res) {
        if (!res) { toast('AI unavailable — using built-in analysis'); return; }
        if (res.summary) analysis.summary = res.summary;
        if (res.insights && res.insights.length) analysis.insights = res.insights;
        if (res.recommendations && res.recommendations.length) analysis.recommendations = res.recommendations;
        analysis.aiEnhanced = true;
        VIS.render(analysis, document.getElementById('dashboard'));
        toast('AI insights applied');
      });
    }
  }

  /* ---------- samples ---------- */
  function loadSample(key) {
    var s = VIS.samples[key];
    if (!s) return;
    document.getElementById('dataInput').value = s.data;
    updateDetect();
    generate(s.data, s.title);
  }

  /* ---------- templates UI ---------- */
  function renderTemplates() {
    var grid = document.getElementById('templateGrid');
    var row = document.getElementById('homeTemplates');
    var html = VIS.templates.map(function (t) {
      return '<button class="tpl" data-action="load-sample" data-sample="' + t.key + '">' +
        '<div class="tpl-top"><div class="tpl-ic" style="background:linear-gradient(135deg,' + t.color + ',' + shade(t.color) + ')"><span data-ic="' + t.icon + '"></span></div>' +
        '<h3>' + t.name + '</h3></div>' +
        '<div class="tpl-desc">' + t.desc + '</div>' +
        '<div class="tpl-tags">' + t.tags.map(function (x) { return '<span class="tpl-tag">' + x + '</span>'; }).join('') + '</div>' +
        '</button>';
    }).join('');
    if (grid) grid.innerHTML = html;
    if (row) row.innerHTML = VIS.templates.slice(0, 4).map(function (t) {
      return '<button class="tpl" data-action="load-sample" data-sample="' + t.key + '">' +
        '<div class="tpl-top"><div class="tpl-ic" style="background:linear-gradient(135deg,' + t.color + ',' + shade(t.color) + ')"><span data-ic="' + t.icon + '"></span></div>' +
        '<h3>' + t.name + '</h3></div><div class="tpl-desc">' + t.desc + '</div></button>';
    }).join('');
    VIS.hydrateIcons(grid); VIS.hydrateIcons(row);
  }
  function shade(hex) {
    try { var n = parseInt(hex.slice(1), 16); var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      r = Math.round(r * 0.7); g = Math.round(g * 0.7); b = Math.round(b * 0.7);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); } catch (e) { return hex; }
  }

  /* ---------- export ---------- */
  function exportPNG() {
    var node = document.getElementById('dashboard');
    if (!state.analysis) { toast('Nothing to export'); return; }
    if (typeof htmlToImage === 'undefined') { toast('Export library not loaded'); return; }
    toast('Rendering PNG…');
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true })
      .then(function (dataUrl) { downloadURI(dataUrl, filename('png')); toast('PNG downloaded'); })
      .catch(function (e) { console.error(e); toast('PNG export failed'); });
  }
  function exportPDF() {
    var node = document.getElementById('dashboard');
    if (!state.analysis) { toast('Nothing to export'); return; }
    if (typeof htmlToImage === 'undefined' || !window.jspdf) { toast('Export libraries not loaded'); return; }
    toast('Building PDF…');
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true }).then(function (dataUrl) {
      var img = new Image();
      img.onload = function () {
        var jsPDF = window.jspdf.jsPDF;
        var orientation = img.width >= img.height ? 'l' : 'p';
        var pdf = new jsPDF({ orientation: orientation, unit: 'pt', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        var margin = 24;
        var iw = pw - margin * 2;
        var ih = iw * (img.height / img.width);
        var title = document.getElementById('dashTitle').value || 'Dashboard';
        pdf.setFontSize(16); pdf.text(title, margin, margin + 4);
        var y = margin + 18;
        if (ih <= ph - y - margin) {
          pdf.addImage(dataUrl, 'PNG', margin, y, iw, ih);
        } else {
          // paginate tall image
          var pageContentH = ph - margin * 2;
          var ratio = iw / img.width;
          var sliceHpx = pageContentH / ratio;
          var rendered = 0, first = true;
          while (rendered < img.height) {
            var canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = Math.min(sliceHpx, img.height - rendered);
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, rendered, img.width, canvas.height, 0, 0, img.width, canvas.height);
            var slice = canvas.toDataURL('image/png');
            if (!first) pdf.addPage();
            pdf.addImage(slice, 'PNG', margin, margin, iw, canvas.height * ratio);
            rendered += canvas.height; first = false;
          }
        }
        pdf.save(filename('pdf'));
        toast('PDF downloaded');
      };
      img.src = dataUrl;
    }).catch(function (e) { console.error(e); toast('PDF export failed'); });
  }
  function exportJSON() {
    if (!state.analysis) { toast('Nothing to export'); return; }
    var a = state.analysis;
    var payload = {
      title: document.getElementById('dashTitle').value,
      generatedAt: a.meta.generatedAt,
      summary: a.summary,
      kpis: a.kpis.map(function (k) { return { label: k.label, value: k.value, formatted: k.formatted, delta: k.delta }; }),
      insights: a.insights.map(function (i) { return { type: i.type, text: i.text.replace(/<[^>]+>/g, '') }; }),
      recommendations: a.recommendations,
      data: a.table.rows
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadURI(URL.createObjectURL(blob), filename('json'));
    toast('JSON downloaded');
  }
  function filename(ext) {
    var t = (document.getElementById('dashTitle').value || 'vis-dashboard').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return t + '-' + new Date().toISOString().slice(0, 10) + '.' + ext;
  }
  function downloadURI(uri, name) {
    var a = document.createElement('a'); a.href = uri; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- sidebar (mobile) ---------- */
  function openSidebar() { document.getElementById('sidebar').classList.add('open'); backdrop().classList.add('show'); }
  function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); var b = document.querySelector('.backdrop'); if (b) b.classList.remove('show'); }
  function backdrop() {
    var b = document.querySelector('.backdrop');
    if (!b) { b = document.createElement('div'); b.className = 'backdrop'; b.addEventListener('click', closeSidebar); document.body.appendChild(b); }
    return b;
  }

  /* ---------- AI settings UI (injected into Settings) ---------- */
  function injectAISettings() {
    var grid = document.querySelector('[data-view="settings"] .settings-grid');
    if (!grid) return;
    var cfg = VIS.ai.getConfig();
    var card = document.createElement('div');
    card.className = 'setting-card';
    card.innerHTML =
      '<h3>AI Provider <span class="card-badge" style="margin-left:6px">Optional</span></h3>' +
      '<p class="about" style="margin-bottom:10px">Connect your hosted, OpenAI-compatible model to generate richer narratives. Stored locally in this browser.</p>' +
      '<div class="setting-row toggle-row"><label>Enable AI enhancement</label><input id="aiEnabled" type="checkbox" ' + (cfg.enabled ? 'checked' : '') + '></div>' +
      '<div class="setting-row"><label>Endpoint URL</label><input id="aiEndpoint" class="input" style="width:200px" placeholder="https://your-host/v1/chat/completions" value="' + (cfg.endpoint || '') + '"></div>' +
      '<div class="setting-row"><label>API key</label><input id="aiKey" class="input" style="width:200px" type="password" placeholder="sk-…" value="' + (cfg.apiKey || '') + '"></div>' +
      '<div class="setting-row"><label>Model</label><input id="aiModel" class="input" style="width:200px" placeholder="gpt-4o-mini" value="' + (cfg.model || '') + '"></div>' +
      '<div class="setting-row" style="justify-content:flex-end;gap:8px"><button class="btn btn-ghost btn-sm" id="aiTest">Test</button><button class="btn btn-primary btn-sm" id="aiSave">Save</button></div>';
    grid.appendChild(card);

    document.getElementById('aiSave').addEventListener('click', function () {
      VIS.ai.setConfig({
        enabled: document.getElementById('aiEnabled').checked,
        endpoint: document.getElementById('aiEndpoint').value.trim(),
        apiKey: document.getElementById('aiKey').value.trim(),
        model: document.getElementById('aiModel').value.trim()
      });
      toast('AI settings saved');
    });
    document.getElementById('aiTest').addEventListener('click', function () {
      VIS.ai.setConfig({
        enabled: true,
        endpoint: document.getElementById('aiEndpoint').value.trim(),
        apiKey: document.getElementById('aiKey').value.trim(),
        model: document.getElementById('aiModel').value.trim()
      });
      toast('Testing connection…');
      var probe = { title: 'Test', meta: { rows: 2, cols: 2 }, measures: [{ name: 'Revenue', sub: 'currency', first: 100, last: 120, total: 220, avg: 110, min: 100, max: 120, change: 20 }], categories: [], dateCol: null };
      VIS.ai.enhance(probe).then(function (r) { toast(r ? 'Connection OK — AI ready' : 'Connection failed — check settings'); });
    });
  }

  /* ---------- event wiring ---------- */
  function wire() {
    // global click delegation for [data-route] and [data-action]
    document.addEventListener('click', function (e) {
      var routeEl = e.target.closest('[data-route]');
      if (routeEl) { route(routeEl.getAttribute('data-route')); return; }
      var actEl = e.target.closest('[data-action]');
      if (actEl) {
        var act = actEl.getAttribute('data-action');
        if (act === 'load-sample') loadSample(actEl.getAttribute('data-sample'));
        return;
      }
      var exp = e.target.closest('[data-export]');
      if (exp) {
        var kind = exp.getAttribute('data-export');
        document.getElementById('exportDrop').classList.remove('open');
        if (kind === 'png') exportPNG();
        else if (kind === 'pdf') exportPDF();
        else if (kind === 'print') window.print();
        else if (kind === 'json') exportJSON();
        return;
      }
      // close export dropdown when clicking outside
      if (!e.target.closest('.export-menu')) document.getElementById('exportDrop').classList.remove('open');
    });

    document.getElementById('generateBtn').addEventListener('click', function () { generate(); });
    document.getElementById('regenBtn').addEventListener('click', function () { if (state.lastText) generate(state.lastText, document.getElementById('dashTitle').value); });
    document.getElementById('clearBtn').addEventListener('click', function () { document.getElementById('dataInput').value = ''; updateDetect(); });
    document.getElementById('dataInput').addEventListener('input', debounce(updateDetect, 200));
    document.getElementById('exportBtn').addEventListener('click', function (e) { e.stopPropagation(); document.getElementById('exportDrop').classList.toggle('open'); });

    document.getElementById('themeSelect').addEventListener('change', function () { applyTheme(this.value); });
    var t2 = document.getElementById('themeSelect2'); if (t2) t2.addEventListener('change', function () { applyTheme(this.value); });
    document.getElementById('modeToggle').addEventListener('click', function () {
      applyMode(document.documentElement.getAttribute('data-mode') === 'dark' ? 'light' : 'dark');
    });
    document.querySelectorAll('#modeGroup button').forEach(function (b) { b.addEventListener('click', function () { applyMode(b.getAttribute('data-mode')); }); });
    document.getElementById('menuToggle').addEventListener('click', openSidebar);

    // settings engine controls
    var mk = document.getElementById('setMaxKpi'), sg = document.getElementById('setSigma'), an = document.getElementById('setAnim');
    if (mk) mk.addEventListener('change', function () { VIS.settings.maxKpi = clamp(+this.value, 2, 8); persistSettings(); });
    if (sg) sg.addEventListener('change', function () { VIS.settings.sigma = clamp(+this.value, 1, 4); persistSettings(); });
    if (an) an.addEventListener('change', function () { VIS.settings.anim = this.checked; persistSettings(); });

    // keyboard: Cmd/Ctrl+Enter to generate from studio
    document.getElementById('dataInput').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    });
  }

  function persistSettings() { var p = loadPrefs(); p.engine = VIS.settings; savePrefs(p); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, isNaN(n) ? a : n)); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); var a = arguments, self = this; t = setTimeout(function () { fn.apply(self, a); }, ms); }; }

  /* ---------- init ---------- */
  function init() {
    // populate theme selects
    var optHtml = THEMES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');
    ['themeSelect', 'themeSelect2'].forEach(function (id) { var s = document.getElementById(id); if (s) s.innerHTML = optHtml; });

    var prefs = loadPrefs();
    applyTheme(prefs.theme || 'executive-white');
    applyMode(prefs.mode || 'light');
    if (prefs.engine) {
      VIS.settings = Object.assign(VIS.settings, prefs.engine);
      var mk = document.getElementById('setMaxKpi'), sg = document.getElementById('setSigma'), an = document.getElementById('setAnim');
      if (mk) mk.value = VIS.settings.maxKpi; if (sg) sg.value = VIS.settings.sigma; if (an) an.checked = VIS.settings.anim;
    }

    renderTemplates();
    injectAISettings();
    VIS.hydrateIcons(document);
    wire();
    updateDetect();
    route('home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // expose for debugging
  VIS.app = { generate: generate, route: route, loadSample: loadSample };
})();
