/* =========================================================================
   VIS · AI provider integration (optional)
   Connects to a user-supplied OpenAI-compatible chat-completions endpoint to
   generate a richer executive summary, findings and recommendations.
   Config is stored locally (localStorage) and never leaves the browser except
   to the endpoint the user configures. Falls back to the heuristic engine.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var KEY = 'vis.ai.config';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function setConfig(cfg) { localStorage.setItem(KEY, JSON.stringify(cfg)); }
  function isEnabled() { var c = getConfig(); return !!(c.enabled && c.endpoint); }

  // Build a compact, model-friendly description of the analysis.
  function buildPrompt(analysis) {
    var lines = [];
    lines.push('You are an executive business analyst. Given the dataset summary below, respond ONLY with strict minified JSON matching this schema:');
    lines.push('{"summary": string (2-3 sentences), "insights": [{"type":"pos|neg|warn|info","text":string}] (3-5 items), "recommendations": [string] (3-4 items)}');
    lines.push('Do not include markdown, code fences, or any text outside the JSON.');
    lines.push('');
    lines.push('DATASET: ' + (analysis.title || 'Business data'));
    lines.push('Rows: ' + analysis.meta.rows + ', Fields: ' + analysis.meta.cols);
    if (analysis.dateCol) lines.push('Time dimension: ' + analysis.dateCol.name + ' (' + analysis.dateCol.values.join(', ') + ')');
    lines.push('MEASURES:');
    analysis.measures.slice(0, 8).forEach(function (m) {
      lines.push('- ' + m.name + ' [' + (m.sub || 'number') + ']: first=' + m.first + ', last=' + m.last +
        ', total=' + Math.round(m.total) + ', avg=' + Math.round(m.avg) + ', min=' + m.min + ', max=' + m.max +
        (m.change != null ? ', change=' + Math.round(m.change) + '%' : ''));
    });
    if (analysis.categories.length) {
      var cat = analysis.categories[0];
      lines.push('Segments (' + cat.name + '): ' + cat.values.slice(0, 12).join(', '));
    }
    return lines.join('\n');
  }

  function enhance(analysis) {
    var cfg = getConfig();
    if (!cfg.enabled || !cfg.endpoint) return Promise.resolve(null);

    var body = {
      model: cfg.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a precise executive analyst that outputs only valid JSON.' },
        { role: 'user', content: buildPrompt(analysis) }
      ],
      temperature: 0.4,
      max_tokens: 700
    };
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;

    var url = cfg.endpoint;
    // convenience: allow base URL, append the standard path
    if (!/\/(chat\/completions|completions|responses)\b/.test(url)) {
      url = url.replace(/\/+$/, '') + '/v1/chat/completions';
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 30000);

    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: controller.signal })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var content = data && data.choices && data.choices[0] &&
          (data.choices[0].message ? data.choices[0].message.content : data.choices[0].text);
        if (!content) return null;
        return parseModelJSON(content);
      })
      .catch(function (err) { clearTimeout(timer); console.warn('[VIS AI] enhancement failed:', err.message); return null; });
  }

  function parseModelJSON(content) {
    var txt = String(content).trim().replace(/^```(json)?/i, '').replace(/```$/,'').trim();
    var start = txt.indexOf('{'); var end = txt.lastIndexOf('}');
    if (start !== -1 && end !== -1) txt = txt.slice(start, end + 1);
    try {
      var obj = JSON.parse(txt);
      var out = {};
      if (typeof obj.summary === 'string') out.summary = obj.summary;
      if (Array.isArray(obj.insights)) out.insights = obj.insights.map(function (i) {
        var type = (i.type || 'info').toLowerCase();
        var icon = type === 'pos' ? 'trendUp' : type === 'neg' ? 'trendDown' : type === 'warn' ? 'alert' : 'insight';
        return { type: ['pos','neg','warn','info'].indexOf(type) !== -1 ? type : 'info', icon: icon, text: String(i.text) };
      }).slice(0, 6);
      if (Array.isArray(obj.recommendations)) out.recommendations = obj.recommendations.map(String).slice(0, 5);
      return out;
    } catch (e) { console.warn('[VIS AI] could not parse model JSON'); return null; }
  }

  window.VIS.ai = {
    getConfig: getConfig, setConfig: setConfig, isEnabled: isEnabled, enhance: enhance
  };
})();
