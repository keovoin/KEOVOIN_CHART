/* =========================================================================
   VIS · Slide Design Engine (stages 2-3 of the Kimi-style pipeline)

   Takes an AI plan or analysis and produces a SLIDE DECK SPECIFICATION:
   each slide gets a semantic layout type (metric-grid, timeline, chevron,
   comparison, donut-hero, text-panel, etc.) and themed visual properties
   (background shape, accent panel, colour coordinates).

   The specification is consumed by:
   - present.js  → HTML presentation (in-app)
   - app.js/exportPPT → native editable .pptx (pptxgenjs)

   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};

  /* ---- layout types & rules ---- */
  var LAYOUTS = {
    cover:        { bg: 'accent-full', panel: null },
    'metric-grid': { bg: 'white', panel: 'accent-left-bar' },
    'trend-chart': { bg: 'white', panel: 'accent-top-band' },
    'bar-chart':   { bg: 'white', panel: 'accent-top-band' },
    'donut-hero':  { bg: 'white', panel: 'accent-circle' },
    'comparison':  { bg: 'white', panel: 'accent-top-band' },
    timeline:      { bg: 'light-tint', panel: 'accent-left-strip' },
    chevron:       { bg: 'light-tint', panel: null },
    'text-panel':  { bg: 'white', panel: 'accent-side' },
    findings:      { bg: 'white', panel: 'accent-top-band' },
    recommendations: { bg: 'white', panel: 'accent-top-band' },
    closing:       { bg: 'accent-full', panel: null }
  };

  // Map a chart kind to a slide layout.
  function chartLayout(kind) {
    switch (kind) {
      case 'line': case 'area': return 'trend-chart';
      case 'bar': case 'hbar': case 'stacked': case 'waterfall': return 'bar-chart';
      case 'donut': return 'donut-hero';
      case 'radar': case 'scatter': case 'bubble': return 'comparison';
      case 'funnel': return 'chevron';
      case 'gantt': case 'sankey': return 'timeline';
      default: return 'bar-chart';
    }
  }

  /* ---- build the slide deck spec from an analysis ---- */
  function design(analysis) {
    var slides = [];
    var title = (analysis.headline || analysis.title || 'Executive Dashboard');
    var tagline = analysis.tagline || '';

    // 1. Cover
    slides.push({ layout: 'cover', title: title, subtitle: tagline, meta: analysis.meta.rows + ' records · ' + analysis.meta.measures + ' measures · ' + new Date(analysis.meta.generatedAt).toLocaleDateString(), aiLabel: analysis.aiEnhanced ? 'AI-Polished' : null });

    // 2. Metric grid (KPIs)
    if (analysis.kpis && analysis.kpis.length) {
      slides.push({ layout: 'metric-grid', heading: 'Key Metrics', kpis: analysis.kpis.slice(0, 6) });
    }

    // 3. Chart slides (semantic layout per chart type)
    (analysis.charts || []).forEach(function (spec) {
      slides.push({ layout: chartLayout(spec.kind), heading: spec.title, chart: spec });
    });

    // 4. Executive summary (text panel)
    if (analysis.summary) {
      slides.push({ layout: 'text-panel', heading: 'Executive Summary', body: String(analysis.summary).replace(/<[^>]+>/g, ''), aiLabel: analysis.aiEnhanced ? 'AI' : null });
    }

    // 5. Key findings
    if (analysis.insights && analysis.insights.length) {
      slides.push({ layout: 'findings', heading: 'Key Findings', items: analysis.insights.slice(0, 5) });
    }

    // 6. Recommendations
    if (analysis.recommendations && analysis.recommendations.length) {
      slides.push({ layout: 'recommendations', heading: 'Recommendations', items: analysis.recommendations.slice(0, 5) });
    }

    // 7. Closing
    slides.push({ layout: 'closing', title: 'Thank You', subtitle: 'Questions & Discussion' });

    return { slides: slides, theme: getThemeVars(), aiPlanned: !!analysis.aiPlanned };
  }

  /* ---- theme variables for the slide deck (pulled from live CSS) ---- */
  function getThemeVars() {
    var root = document.documentElement;
    function v(name, fb) { return (getComputedStyle(root).getPropertyValue(name) || fb || '').trim(); }
    function hex(name, fb) {
      var val = v(name, fb);
      if (val.charAt(0) === '#') { val = val.slice(1); if (val.length === 3) val = val.replace(/(.)/g, '$1$1'); return val.toUpperCase(); }
      var m = val.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (m) return [m[1], m[2], m[3]].map(function (n) { var h = (+n).toString(16); return h.length < 2 ? '0' + h : h; }).join('').toUpperCase();
      return fb.replace('#', '');
    }
    return {
      accent: hex('--accent', '#1E3A8A'),
      accent2: hex('--accent-2', '#0E7490'),
      text: hex('--text', '#0B1220'),
      muted: hex('--text-2', '#475569'),
      subtle: hex('--text-3', '#64748B'),
      bg: hex('--bg', '#F5F6F8'),
      surface: hex('--surface', '#FFFFFF'),
      surface2: hex('--surface-2', '#FBFBFD'),
      pos: hex('--pos', '#16A34A'),
      neg: hex('--neg', '#DC2626'),
      warn: hex('--warn', '#D97706'),
      radius: v('--radius', '20px'),
      fontSans: v('--font-sans', 'Inter, sans-serif').split(',')[0].replace(/['"]/g, '').trim(),
      fontDisplay: v('--font-display', v('--font-sans', 'Inter')).split(',')[0].replace(/['"]/g, '').trim(),
      palette: v('--chart-palette', '#0071e3,#34c759,#ff9500').split(',').map(function (c) { return c.trim().replace('#', '').toUpperCase(); })
    };
  }

  /* ---- compile the spec into a native .pptx (pptxgenjs) ---- */
  function compilePPTX(deck, pptx) {
    var T = deck.theme;
    pptx.defineLayout({ name: 'VIS', width: 13.33, height: 7.5 });
    pptx.layout = 'VIS';
    var page = 0;
    function footer(s) { page++; s.addText([{ text: 'VIS', options: { bold: true, color: T.accent } }, { text: '  ·  Created by Keovoin', options: { color: '94A3B8' } }], { x: 0.5, y: 7.08, w: 8, h: 0.32, fontSize: 9 }); s.addText(String(page), { x: 12.4, y: 7.08, w: 0.5, h: 0.32, fontSize: 9, color: '94A3B8', align: 'right' }); }
    function band(s, text) { s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.95, fill: { color: T.accent }, line: { type: 'none' } }); s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.95, w: 13.33, h: 0.06, fill: { color: T.accent2 }, line: { type: 'none' } }); s.addText(text, { x: 0.6, y: 0.18, w: 12, h: 0.6, fontSize: 22, bold: true, color: 'FFFFFF', valign: 'middle' }); }
    function tint(s) { s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: T.surface2 }, line: { type: 'none' } }); }

    deck.slides.forEach(function (sl) {
      var s = pptx.addSlide();
      switch (sl.layout) {
        case 'cover':
          s.background = { color: T.accent };
          try { s.addShape(pptx.ShapeType.ellipse, { x: 9.6, y: -1.6, w: 5.2, h: 5.2, fill: { color: T.accent2, transparency: 55 }, line: { type: 'none' } }); } catch (e) {}
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.9, w: 13.33, h: 0.6, fill: { color: T.accent2 }, line: { type: 'none' } });
          if (sl.aiLabel) s.addText(sl.aiLabel.toUpperCase(), { x: 0.9, y: 2.1, w: 11, fontSize: 12, bold: true, color: 'FFFFFF', charSpacing: 3, transparency: 15 });
          s.addText(sl.title, { x: 0.9, y: 2.5, w: 11.4, h: 1.7, fontSize: 42, bold: true, color: 'FFFFFF' });
          if (sl.subtitle) s.addText(sl.subtitle, { x: 0.9, y: 4.35, w: 10.8, fontSize: 18, color: 'FFFFFF', transparency: 8 });
          s.addText(sl.meta || '', { x: 0.9, y: 5.4, fontSize: 12, color: 'FFFFFF', transparency: 30 });
          s.addText('Created by Keovoin', { x: 0.9, y: 6.95, w: 6, fontSize: 12, color: 'FFFFFF', bold: true, valign: 'middle' });
          break;

        case 'metric-grid':
          s.background = { color: T.surface };
          band(s, sl.heading);
          (sl.kpis || []).forEach(function (k, i) {
            var col = i % 3, row = Math.floor(i / 3);
            var x = 0.6 + col * 4.15, y = 1.5 + row * 2.55;
            s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: 3.85, h: 2.2, fill: { color: T.surface2 }, line: { type: 'none' }, rectRadius: 0.12 });
            s.addShape(pptx.ShapeType.rect, { x: x, y: y, w: 0.13, h: 2.2, fill: { color: T.accent }, line: { type: 'none' } });
            s.addText(String(k.label).toUpperCase(), { x: x + 0.3, y: y + 0.22, w: 3.4, fontSize: 11, color: T.muted, bold: true, charSpacing: 1 });
            s.addText(k.formatted, { x: x + 0.3, y: y + 0.62, w: 3.4, h: 0.9, fontSize: 30, bold: true, color: T.accent, valign: 'middle' });
            if (k.delta != null) s.addText((k.delta >= 0 ? '▲ ' : '▼ ') + VIS.engine.fmtSigned(k.delta), { x: x + 0.3, y: y + 1.6, w: 3.4, fontSize: 12, bold: true, color: k.delta >= 0 ? T.pos : T.neg });
          });
          footer(s);
          break;

        case 'trend-chart': case 'bar-chart': case 'comparison': case 'donut-hero': case 'timeline': case 'chevron':
          s.background = { color: T.surface };
          band(s, sl.heading);
          if (sl.chart) {
            try {
              var m = mapChartToPptx(pptx, sl.chart, T);
              if (m) s.addChart(m.type, m.data, Object.assign({}, m.opts, { x: 0.6, y: 1.3, w: 12.1, h: 5.4, chartColors: T.palette }));
            } catch (e) { console.warn('[slides pptx]', e); }
          }
          footer(s);
          break;

        case 'text-panel':
          s.background = { color: T.surface };
          s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.3, h: 7.5, fill: { color: T.accent }, line: { type: 'none' } });
          s.addShape(pptx.ShapeType.rect, { x: 4.3, y: 0, w: 0.08, h: 7.5, fill: { color: T.accent2 }, line: { type: 'none' } });
          s.addText(sl.heading.toUpperCase().replace(/ /g, '\n'), { x: 0.5, y: 0.8, w: 3.4, fontSize: 26, bold: true, color: 'FFFFFF', charSpacing: 1, lineSpacingMultiple: 1.05 });
          if (sl.aiLabel) s.addText(sl.aiLabel, { x: 0.5, y: 3.0, w: 3.4, fontSize: 12, bold: true, color: 'FFFFFF', transparency: 25 });
          s.addText(sl.body || '', { x: 4.8, y: 0.8, w: 7.9, h: 5.6, fontSize: 16, color: T.text, lineSpacingMultiple: 1.35, valign: 'top' });
          footer(s);
          break;

        case 'findings':
          s.background = { color: T.surface };
          band(s, sl.heading);
          (sl.items || []).forEach(function (ins, i) {
            var y = 1.5 + i * 1.05;
            var col = ins.type === 'pos' ? T.pos : ins.type === 'neg' ? T.neg : ins.type === 'warn' ? T.warn : T.accent;
            s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: y, w: 0.22, h: 0.7, fill: { color: col }, line: { type: 'none' }, rectRadius: 0.1 });
            s.addText(String(ins.text).replace(/<[^>]+>/g, ''), { x: 1.15, y: y, w: 11.3, h: 0.7, fontSize: 14, color: T.text, valign: 'middle' });
          });
          footer(s);
          break;

        case 'recommendations':
          s.background = { color: T.surface };
          band(s, sl.heading);
          (sl.items || []).forEach(function (r, i) {
            var y = 1.5 + i * 0.95;
            s.addShape(pptx.ShapeType.ellipse, { x: 0.7, y: y, w: 0.55, h: 0.55, fill: { color: T.accent }, line: { type: 'none' } });
            s.addText(String(i + 1), { x: 0.7, y: y, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
            s.addText(String(r), { x: 1.5, y: y - 0.05, w: 11, h: 0.7, fontSize: 15, color: T.text, valign: 'middle' });
          });
          footer(s);
          break;

        case 'closing':
          s.background = { color: T.accent };
          s.addText(sl.title || 'Thank You', { x: 0.9, y: 2.9, w: 11, fontSize: 46, bold: true, color: 'FFFFFF' });
          s.addText((sl.subtitle || '') + '\n\nGenerated by VIS · Created by Keovoin', { x: 0.9, y: 4.2, w: 11, fontSize: 14, color: 'FFFFFF', transparency: 20 });
          break;
      }
    });
    return pptx;
  }

  // Map VIS chart spec → pptxgenjs native chart (same logic as before, but uses theme palette).
  function mapChartToPptx(pptx, spec, T) {
    var base = { showLegend: false, legendPos: 'b', showValue: false };
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
      default: return null;
    }
  }

  window.VIS.slides = { design: design, compilePPTX: compilePPTX, LAYOUTS: LAYOUTS, getThemeVars: getThemeVars };
})();
