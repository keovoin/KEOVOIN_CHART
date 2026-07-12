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
  VIS.settings = { maxKpi: 5, sigma: 2, anim: true, labels: true };

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
  VIS.toast = toast;

  /* ---------- routing ---------- */
  function route(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.getAttribute('data-view') === name); });
    document.querySelectorAll('.nav-item').forEach(function (n) {
      var on = n.getAttribute('data-route') === name;
      n.classList.toggle('active', on);
      if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
    });
    var titles = { home: 'Home', studio: 'Studio', dashboard: 'Dashboard', infographic: 'Infographic', presentation: 'Presentation', templates: 'Templates', workspace: 'Workspace', history: 'History', settings: 'Settings' };
    document.getElementById('topbarTitle').textContent = titles[name] || 'VIS';
    closeSidebar();

    if (name === 'dashboard') setTimeout(function () { VIS.charts.resizeAll(); }, 60);
    else if (name === 'presentation') buildPresentation();
    else if (name === 'infographic') buildInfographic();
    else if (name === 'history') VIS.history.renderInto(document.getElementById('historyList'), 'list');
    else if (name === 'workspace') {
      if (VIS.team && VIS.team.isAvailable()) VIS.team.renderInto(document.getElementById('workspaceGrid'));
      else VIS.history.renderInto(document.getElementById('workspaceGrid'), 'gallery');
    }
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
    var table;
    try { table = VIS.engine.parse(text); } catch (e) { console.error(e); toast('Could not read that data — check the format'); route('studio'); return; }
    if (!table.columns.length || !table.rows.length) { toast('Could not detect a valid table — need a header row and at least one data row'); route('studio'); return; }
    if (!table.columns.some(function (c) { return c && c.trim(); })) { toast('No column headers found'); route('studio'); return; }

    state.lastText = text;
    var analysis;
    try {
      analysis = VIS.engine.analyze(table, { sigma: VIS.settings.sigma, maxKpi: VIS.settings.maxKpi });
    } catch (e) {
      console.error('[VIS] analysis failed', e);
      showDashError('We couldn\u2019t analyze that dataset. Try cleaner column headers or a simpler table.');
      route('dashboard');
      return;
    }
    if (title) analysis.title = title;
    state.analysis = analysis;

    if (title) document.getElementById('dashTitle').value = title;
    var meta = analysis.meta;
    document.getElementById('dashMeta').textContent =
      meta.rows + ' rows · ' + meta.cols + ' fields · ' + meta.measures + ' measures · ' + meta.format.toUpperCase() +
      ' · ' + meta.generatedAt.toLocaleString();

    VIS.editor && VIS.editor.reset();
    VIS.render(analysis, document.getElementById('dashboard'));
    VIS.editor && VIS.editor.initBoardDnd();
    route('dashboard');
    toast('Dashboard generated');

    // save to history
    try {
      VIS.history.save({
        title: (title || document.getElementById('dashTitle').value || 'Untitled'),
        dataText: text, theme: document.documentElement.getAttribute('data-theme'),
        format: meta.format, rows: meta.rows, cols: meta.cols,
        kpis: analysis.kpis.slice(0, 3).map(function (k) { return { label: k.label, formatted: k.formatted }; })
      });
    } catch (e) {}

    // AI polish (async, non-blocking) — applied across ALL views
    state.aiPending = false;
    if (VIS.ai && VIS.ai.isEnabled()) {
      state.aiPending = true;
      setPolishing(true);
      state.enhancePromise = VIS.ai.enhance(analysis).then(function (res) {
        state.aiPending = false; setPolishing(false);
        if (!res) { toast('AI unavailable — using built-in analysis'); return; }
        if (res.headline) analysis.headline = res.headline;
        if (res.tagline) analysis.tagline = res.tagline;
        if (res.summary) analysis.summary = res.summary;
        if (res.insights && res.insights.length) analysis.insights = res.insights;
        if (res.recommendations && res.recommendations.length) analysis.recommendations = res.recommendations;
        analysis.aiEnhanced = true;
        refreshActiveDataView();   // repaint whichever of dashboard/infographic/presentation is showing
        toast('Polished with AI');
      }).catch(function () { state.aiPending = false; setPolishing(false); });
    }
  }

  /* Rebuild whichever data-driven view is currently active so AI polish shows everywhere. */
  function refreshActiveDataView() {
    if (!state.analysis) return;
    var active = document.querySelector('.view.active');
    var name = active && active.getAttribute('data-view');
    if (name === 'infographic') buildInfographic();
    else if (name === 'presentation') buildPresentation();
    else { VIS.editor && VIS.editor.reset(); VIS.render(state.analysis, document.getElementById('dashboard')); VIS.editor && VIS.editor.initBoardDnd(); }
  }

  /* Subtle "polishing with AI" indicator on the topbar. */
  function setPolishing(on) {
    var bar = document.getElementById('topbarTitle');
    if (!bar) return;
    var existing = document.getElementById('polishBadge');
    if (on) {
      if (!existing) {
        var b = document.createElement('span');
        b.id = 'polishBadge'; b.className = 'polish-badge';
        b.innerHTML = '<span class="polish-dot"></span>Polishing with AI…';
        bar.parentNode.insertBefore(b, bar.nextSibling);
      }
    } else if (existing) { existing.remove(); }
  }

  /* Friendly error card when a dataset can't be analyzed. */
  function showDashError(msg) {
    var d = document.getElementById('dashboard');
    if (!d) return;
    VIS.charts && VIS.charts.disposeAll && VIS.charts.disposeAll();
    d.innerHTML = '<div class="dash-error"><div class="empty-ic" data-ic="alert"></div>' +
      '<h3>Something went wrong</h3><p>' + msg + '</p>' +
      '<button class="btn btn-primary" data-route="studio"><span data-ic="edit"></span>Back to Studio</button></div>';
    VIS.hydrateIcons(d);
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

  /* ---------- presentation / infographic ---------- */
  function buildPresentation() {
    var mount = document.getElementById('presentation');
    if (!state.analysis) return; // keep empty state
    VIS.present.build(state.analysis, mount);
  }
  function buildInfographic() {
    var mount = document.getElementById('infographic');
    if (!state.analysis) return;
    VIS.infographic.build(state.analysis, mount);
  }

  /* ---------- reduce / restore charts (used by AI chat) ---------- */
  function reduceCharts() {
    if (!state.analysis || state.analysis.charts.length <= 2) return false;
    var reduced = Object.assign({}, state.analysis, { charts: state.analysis.charts.slice(0, 2) });
    VIS.editor && VIS.editor.reset();
    VIS.render(reduced, document.getElementById('dashboard'));
    VIS.editor && VIS.editor.initBoardDnd();
    route('dashboard');
    return true;
  }
  function regenerateView() {
    if (!state.analysis) return;
    VIS.editor && VIS.editor.reset();
    VIS.render(state.analysis, document.getElementById('dashboard'));
    VIS.editor && VIS.editor.initBoardDnd();
    route('dashboard');
  }

  /* ---------- extra exports: SVG / HTML / PPTX ---------- */
  function exportSVG() {
    var node = document.getElementById('dashboard');
    if (!state.analysis) { toast('Nothing to export'); return; }
    if (typeof htmlToImage === 'undefined') { toast('Export library not loaded'); return; }
    toast('Rendering SVG…');
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    htmlToImage.toSvg(node, { backgroundColor: bg, cacheBust: true })
      .then(function (dataUrl) { downloadURI(dataUrl, filename('svg')); toast('SVG downloaded'); })
      .catch(function (e) { console.error(e); toast('SVG export failed'); });
  }
  function exportHTML() {
    var node = document.getElementById('dashboard');
    if (!state.analysis) { toast('Nothing to export'); return; }
    if (typeof htmlToImage === 'undefined') { toast('Export library not loaded'); return; }
    toast('Packaging HTML…');
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    var title = document.getElementById('dashTitle').value || 'VIS Dashboard';
    htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true }).then(function (dataUrl) {
      var a = state.analysis;
      var data = {
        title: title, generatedAt: a.meta.generatedAt, summary: a.summary,
        kpis: a.kpis.map(function (k) { return { label: k.label, formatted: k.formatted, delta: k.delta }; }),
        insights: a.insights.map(function (i) { return { type: i.type, text: i.text.replace(/<[^>]+>/g, '') }; }),
        recommendations: a.recommendations, data: a.table.rows
      };
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escAttr(title) +
        '</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>body{margin:0;background:' + bg + ';font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0b1220}' +
        '.wrap{max-width:1200px;margin:0 auto;padding:28px}h1{font-weight:800;letter-spacing:-.02em}' +
        'img{width:100%;height:auto;border-radius:16px;box-shadow:0 20px 50px -20px rgba(0,0,0,.25)}' +
        'footer{margin-top:20px;color:#94a3b8;font-size:13px}</style></head><body><div class="wrap">' +
        '<h1>' + escHtml(title) + '</h1><img alt="dashboard" src="' + dataUrl + '"/>' +
        '<footer>Generated by VIS · Visual Intelligence Studio · ' + new Date(a.meta.generatedAt).toLocaleString() + '</footer>' +
        '<script type="application/json" id="vis-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '<\/script>' +
        '</div></body></html>';
      var blob = new Blob([html], { type: 'text/html' });
      downloadURI(URL.createObjectURL(blob), filename('html'));
      toast('HTML downloaded');
    }).catch(function (e) { console.error(e); toast('HTML export failed'); });
  }
  function pptPalette() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--chart-palette').trim();
    return raw.split(',').map(function (s) { return s.trim().replace('#', ''); }).filter(Boolean);
  }
  // Map a VIS chart spec to a NATIVE (editable) pptxgenjs chart. Returns null if
  // the type has no native PowerPoint equivalent (those stay in PNG/PDF export).
  function pptMapChart(pptx, spec) {
    var pal = pptPalette();
    var base = { x: 0.6, y: 1.2, w: 12.1, h: 5.5, chartColors: pal, showLegend: false, legendPos: 'b', showValue: false };
    switch (spec.kind) {
      case 'line': case 'area':
        return { type: pptx.ChartType.line, data: spec.series.map(function (s) { return { name: s.name, labels: spec.x, values: s.data }; }), opts: Object.assign({}, base, { lineSmooth: true, showLegend: spec.series.length > 1 }) };
      case 'bar':
        return { type: pptx.ChartType.bar, data: [{ name: spec.series[0].name, labels: spec.x, values: spec.series[0].data }], opts: Object.assign({}, base, { barDir: 'col' }) };
      case 'hbar': case 'funnel':
        return { type: pptx.ChartType.bar, data: [{ name: (spec.series && spec.series[0].name) || 'Value', labels: spec.x || spec.labels, values: (spec.series && spec.series[0].data) || spec.data }], opts: Object.assign({}, base, { barDir: 'bar' }) };
      case 'stacked':
        return { type: pptx.ChartType.bar, data: spec.series.map(function (s) { return { name: s.name, labels: spec.x, values: s.data }; }), opts: Object.assign({}, base, { barDir: 'col', barGrouping: 'stacked', showLegend: true }) };
      case 'donut':
        return { type: pptx.ChartType.doughnut, data: [{ name: spec.title, labels: spec.labels, values: spec.data.map(function (v) { return Math.abs(v) || 0; }) }], opts: Object.assign({}, base, { showLegend: true, holeSize: 60 }) };
      case 'radar':
        return { type: pptx.ChartType.radar, data: spec.series.map(function (s) { return { name: s.name, labels: spec.indicators.map(function (i) { return i.name; }), values: s.data }; }), opts: Object.assign({}, base, { showLegend: true }) };
      default: return null; // sankey/gantt/treemap/heatmap/gauge/bubble/scatter/waterfall/riskmatrix
    }
  }

  function exportPPT() {
    if (!state.analysis) { toast('Nothing to export'); return; }
    if (typeof PptxGenJS === 'undefined') { toast('PowerPoint library not loaded'); return; }
    toast('Building editable PowerPoint…');
    var a = state.analysis;
    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'VIS', width: 13.33, height: 7.5 });
    pptx.layout = 'VIS';
    var title = document.getElementById('dashTitle').value || a.title || 'Executive Dashboard';

    // Slide 1 — title (uses AI headline/tagline when available)
    var s1 = pptx.addSlide(); s1.background = { color: 'FFFFFF' };
    s1.addText((a.aiEnhanced ? 'AI-POLISHED BRIEFING' : 'VISUAL INTELLIGENCE STUDIO'), { x: 0.8, y: 2.2, fontSize: 12, color: '8892A6', bold: true, charSpacing: 2 });
    s1.addText(a.headline || title, { x: 0.8, y: 2.6, w: 11.7, fontSize: 40, bold: true, color: '0B1220' });
    if (a.tagline) s1.addText(a.tagline, { x: 0.8, y: 3.7, w: 11.7, fontSize: 18, color: '334155' });
    s1.addText(a.meta.rows + ' records · ' + a.meta.measures + ' measures · ' + new Date(a.meta.generatedAt).toLocaleDateString(), { x: 0.8, y: 4.5, fontSize: 13, color: '64748B' });

    // Slide 2 — KPIs (editable text boxes)
    var s2 = pptx.addSlide();
    s2.addText('Key Metrics', { x: 0.6, y: 0.4, fontSize: 24, bold: true, color: '0B1220' });
    a.kpis.slice(0, 6).forEach(function (k, i) {
      var col = i % 3, row = Math.floor(i / 3);
      var x = 0.6 + col * 4.2, y = 1.4 + row * 2.6;
      s2.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: 3.9, h: 2.3, fill: { color: 'F4F6FA' }, line: { color: 'E2E8F0' }, rectRadius: 0.12 });
      s2.addText(k.label, { x: x + 0.25, y: y + 0.25, w: 3.4, fontSize: 12, color: '64748B', bold: true });
      s2.addText(k.formatted, { x: x + 0.25, y: y + 0.7, w: 3.4, fontSize: 30, bold: true, color: '0B1220' });
      if (k.delta != null) s2.addText((k.delta >= 0 ? '▲ ' : '▼ ') + VIS.engine.fmtSigned(k.delta), { x: x + 0.25, y: y + 1.55, fontSize: 13, color: k.delta >= 0 ? '16A34A' : 'DC2626', bold: true });
    });

    // One slide per chart that has a NATIVE (editable) PowerPoint equivalent
    var native = 0;
    a.charts.forEach(function (spec) {
      var m = pptMapChart(pptx, spec);
      if (!m) return;
      var s = pptx.addSlide();
      s.addText(spec.title, { x: 0.6, y: 0.4, fontSize: 22, bold: true, color: '0B1220' });
      try { s.addChart(m.type, m.data, m.opts); native++; } catch (e) { console.warn('[VIS pptx]', spec.kind, e); }
    });

    // Summary + recommendations (editable text)
    var s4 = pptx.addSlide();
    s4.addText('Executive Summary', { x: 0.6, y: 0.4, fontSize: 24, bold: true, color: '0B1220' });
    s4.addText((a.summary || '').replace(/<[^>]+>/g, ''), { x: 0.6, y: 1.3, w: 12.1, h: 2.8, fontSize: 18, color: '334155', lineSpacingMultiple: 1.3 });
    if (a.recommendations && a.recommendations.length) {
      s4.addText('Recommendations', { x: 0.6, y: 4.3, fontSize: 16, bold: true, color: '0B1220' });
      s4.addText(a.recommendations.map(function (r) { return { text: r, options: { bullet: true } }; }), { x: 0.8, y: 4.8, w: 12, fontSize: 14, color: '334155' });
    }

    pptx.writeFile({ fileName: filename('pptx') }).then(function () {
      toast('Editable PowerPoint downloaded' + (native ? ' · ' + native + ' native charts' : ''));
    }).catch(function (e) { console.error(e); toast('PowerPoint export failed'); });
  }
  function escHtml(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function doExport(kind) {
    if (kind === 'png') exportPNG();
    else if (kind === 'svg') exportSVG();
    else if (kind === 'pdf') exportPDF();
    else if (kind === 'ppt') exportPPT();
    else if (kind === 'html') exportHTML();
    else if (kind === 'print') window.print();
    else if (kind === 'json') exportJSON();
  }

  function exportInfographic() {
    var node = document.getElementById('infoPoster');
    if (!node) { toast('Nothing to export'); return; }
    if (typeof htmlToImage === 'undefined') { toast('Export library not loaded'); return; }
    toast('Rendering PNG…');
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
    htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true })
      .then(function (dataUrl) { downloadURI(dataUrl, filename('infographic.png')); toast('Infographic downloaded'); })
      .catch(function (e) { console.error(e); toast('Export failed'); });
  }

  /* ---------- history ---------- */
  function openHistory(id) {
    var e = VIS.history.get(id);
    if (!e) { toast('Entry not found'); return; }
    if (e.theme) applyTheme(e.theme);
    document.getElementById('dataInput').value = e.dataText;
    generate(e.dataText, e.title);
  }
  function openTeamDashboard(id) {
    var e = VIS.team.get(id);
    if (!e) { toast('Entry not found'); return; }
    if (e.theme) applyTheme(e.theme);
    document.getElementById('dataInput').value = e.dataText;
    generate(e.dataText, e.title);
  }
  function saveToTeam() {
    if (!state.analysis) { toast('Generate a dashboard first'); return; }
    var a = state.analysis;
    toast('Saving to team…');
    VIS.team.save({
      title: document.getElementById('dashTitle').value || a.title || 'Untitled',
      dataText: state.lastText,
      theme: document.documentElement.getAttribute('data-theme'),
      format: a.meta.format, rows: a.meta.rows, cols: a.meta.cols,
      kpis: a.kpis.slice(0, 4).map(function (k) { return { label: k.label, formatted: k.formatted }; })
    }).then(function (r) {
      if (r && r.ok) toast(r.persisted === false ? 'Saved to team (in-memory — add a store for persistence)' : 'Saved to team workspace');
      else toast((r && r.error) || 'Could not save to team');
    }).catch(function () { toast('Could not reach the server'); });
  }
  function refreshHistoryViews() {
    if (document.querySelector('[data-view="history"]').classList.contains('active')) VIS.history.renderInto(document.getElementById('historyList'), 'list');
    if (document.querySelector('[data-view="workspace"]').classList.contains('active')) VIS.history.renderInto(document.getElementById('workspaceGrid'), 'gallery');
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

    // Team/backend mode: credentials are managed centrally by an admin.
    if (VIS.ai.backendPresent && VIS.ai.backendPresent()) {
      var on = VIS.ai.backendAvailable();
      var tcard = document.createElement('div');
      tcard.className = 'setting-card';
      tcard.innerHTML =
        '<h3>AI Provider <span class="card-badge" style="margin-left:6px">Team</span></h3>' +
        '<p class="about" style="margin-bottom:12px">AI is managed centrally for your team. The API key is stored securely on the server and is never exposed in the browser.</p>' +
        '<div class="setting-row"><label>Status</label><span class="status-chip ' + (on ? 'on' : 'off') + '">' + (on ? 'Active' : 'Not configured') + '</span></div>' +
        '<div class="setting-row" style="justify-content:flex-end"><a class="btn btn-ghost btn-sm" href="admin.html"><span data-ic="settings"></span>Open admin portal</a></div>';
      grid.appendChild(tcard);
      VIS.hydrateIcons(tcard);
      return;
    }

    // Static/browser mode: user can store their own key locally.
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
        doExport(kind);
        return;
      }
      // history open / delete
      var hOpen = e.target.closest('[data-hist-open]');
      if (hOpen) { openHistory(hOpen.getAttribute('data-hist-open')); return; }
      var hDel = e.target.closest('[data-hist-del]');
      if (hDel) { VIS.history.remove(hDel.getAttribute('data-hist-del')); refreshHistoryViews(); return; }
      // team (shared) dashboards
      var tOpen = e.target.closest('[data-team-open]');
      if (tOpen) { openTeamDashboard(tOpen.getAttribute('data-team-open')); return; }
      var tDel = e.target.closest('[data-team-del]');
      if (tDel) { VIS.team.remove(tDel.getAttribute('data-team-del')).then(function () { VIS.team.renderInto(document.getElementById('workspaceGrid')); }); return; }

      // close export dropdown when clicking outside
      if (!e.target.closest('.export-menu')) document.getElementById('exportDrop').classList.remove('open');
    });

    // editor toggle + undo/redo
    var editToggle = document.getElementById('editToggle');
    if (editToggle) editToggle.addEventListener('click', function () {
      var on = VIS.editor.toggle();
      editToggle.classList.toggle('btn-primary', on); editToggle.classList.toggle('btn-ghost', !on);
      document.getElementById('editControls').style.display = on ? 'flex' : 'none';
      toast(on ? 'Edit mode on — drag, resize, duplicate or delete cards' : 'Edit mode off');
    });
    var edU = document.getElementById('edUndo'), edR = document.getElementById('edRedo');
    if (edU) edU.addEventListener('click', function () { VIS.editor.undo(); });
    if (edR) edR.addEventListener('click', function () { VIS.editor.redo(); });

    // present + infographic actions
    var presentBtn = document.getElementById('presentBtn');
    if (presentBtn) presentBtn.addEventListener('click', function () { route('presentation'); });
    var saveTeamBtn = document.getElementById('saveTeamBtn');
    if (saveTeamBtn) saveTeamBtn.addEventListener('click', saveToTeam);
    var presExport = document.getElementById('presExport');
    if (presExport) presExport.addEventListener('click', function () { VIS.present.exportPDF(); });
    var presRebuild = document.getElementById('presRebuild');
    if (presRebuild) presRebuild.addEventListener('click', buildPresentation);
    var infoExport = document.getElementById('infoExport');
    if (infoExport) infoExport.addEventListener('click', exportInfographic);
    var infoRegen = document.getElementById('infoRegen');
    if (infoRegen) infoRegen.addEventListener('click', buildInfographic);
    var clearHist = document.getElementById('clearHistory');
    if (clearHist) clearHist.addEventListener('click', function () { VIS.history.clear(); refreshHistoryViews(); toast('History cleared'); });

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
    var lb = document.getElementById('setLabels');
    if (lb) lb.addEventListener('change', function () { VIS.settings.labels = this.checked; persistSettings(); refreshActiveDataView(); });

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
    VIS.hydrateIcons(document);
    wire();
    updateDetect();
    if (VIS.chat) VIS.chat.init();
    route('home');

    // Detect the team backend, then apply central branding + AI settings card.
    VIS.ai.init().then(function (info) {
      applyBranding(info.branding, prefs);
      injectAISettings();
      var bt = document.getElementById('buildTag');
      if (bt) bt.textContent = info.build ? ('Build ' + info.build) : 'Static preview · no backend';
      console.log('%cVIS ' + (info.build ? 'Build ' + info.build : 'static (no backend detected)'), 'color:#0071e3;font-weight:700');
    }).catch(function () { injectAISettings(); var bt = document.getElementById('buildTag'); if (bt) bt.textContent = 'Static preview · no backend'; });

    // Detect the shared team dashboard store; reveal "Save to team" when available.
    if (VIS.team) VIS.team.init().then(function (ok) {
      var btn = document.getElementById('saveTeamBtn');
      if (btn) btn.style.display = ok ? '' : 'none';
    });
  }

  /* ---------- team branding (from backend) ---------- */
  function applyBranding(branding, prefs) {
    if (!branding) return;
    if (branding.title) {
      document.title = branding.title;
      var bn = document.querySelector('.brand-name');
      // keep the short "VIS" mark, but update document title + tooltip
      if (bn) bn.setAttribute('title', branding.title);
    }
    // Apply team defaults only when the user hasn't chosen their own.
    if (!prefs.theme && branding.defaultTheme) applyTheme(branding.defaultTheme);
    if (!prefs.mode && branding.defaultMode) applyMode(branding.defaultMode);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Public hooks (used by the AI chat panel and for debugging)
  VIS.app = {
    generate: generate,
    route: route,
    loadSample: loadSample,
    setTheme: applyTheme,
    setMode: applyMode,
    getAnalysis: function () { return state.analysis; },
    getSummary: function () { return state.analysis ? state.analysis.summary.replace(/<[^>]+>/g, '') : null; },
    reduceCharts: reduceCharts,
    regenerate: regenerateView,
    makePresentation: function () { if (!state.analysis) return false; route('presentation'); return true; },
    makeInfographic: function () { if (!state.analysis) return false; route('infographic'); return true; },
    doExport: doExport
  };
})();
