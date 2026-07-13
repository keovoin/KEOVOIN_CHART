/* =========================================================================
   VIS · AI integration (team-aware)

   Two modes, auto-detected:
     1. BACKEND mode — when served by the VIS team server, all AI calls go
        through /api/ai/proxy and the API key stays on the server. The admin
        manages credentials in the admin portal. (Preferred for teams.)
     2. BROWSER mode — when hosted as a static site with no backend, users can
        optionally store their own OpenAI-compatible endpoint + key locally.

   The heuristic engine remains the offline fallback if neither is available.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var KEY = 'vis.ai.config';
  var backend = { checked: false, available: false, model: '', branding: null };

  /* ---- local (browser-mode) config ---- */
  function getConfig() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function setConfig(cfg) { localStorage.setItem(KEY, JSON.stringify(cfg)); }

  /* ---- detect backend ---- */
  function init() {
    return fetch('/api/config', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        backend.checked = true;
        if (j && j.ok) {
          backend.available = !!(j.ai && j.ai.available);
          backend.model = (j.ai && j.ai.model) || '';
          backend.branding = j.branding || null;
          backend.build = j.build || '';
          backend.present = true;
        }
        return { backendPresent: !!backend.present, aiAvailable: backend.available, branding: backend.branding, build: backend.build };
      })
      .catch(function () { backend.checked = true; return { backendPresent: false, aiAvailable: false, branding: null }; });
  }

  function backendPresent() { return !!backend.present; }
  function isEnabled() {
    if (backend.available) return true;
    var c = getConfig();
    return !!(c.enabled && c.endpoint && c.apiKey);
  }

  /* ---- unified completion (used by enhance + chat) ---- */
  function complete(messages, opts) {
    opts = opts || {};
    var body = { messages: messages, temperature: opts.temperature != null ? opts.temperature : 0.4, max_tokens: opts.max_tokens || 700 };

    if (backend.available) {
      if (opts.model) body.model = opts.model;
      var ctrlB = new AbortController(); var tB = setTimeout(function () { ctrlB.abort(); }, 35000);
      return fetch('/api/ai/proxy', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrlB.signal })
        .then(function (r) { clearTimeout(tB); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(extractContent)
        .catch(function (e) { clearTimeout(tB); console.warn('[VIS AI backend]', e.message); return null; });
    }

    // browser mode — direct to provider with the locally stored key
    var cfg = getConfig();
    if (!cfg.enabled || !cfg.endpoint) return Promise.resolve(null);
    var url = String(cfg.endpoint || '').trim();
    if (/\/(chat\/completions|completions|responses)\b/.test(url)) { /* full path */ }
    else if (/\/v\d+\/?$/.test(url)) url = url.replace(/\/+$/, '') + '/chat/completions';
    else url = url.replace(/\/+$/, '') + '/v1/chat/completions';
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
    body.model = opts.model || cfg.model || 'gpt-4o-mini';
    var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, 35000);
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(extractContent)
      .catch(function (e) { clearTimeout(t); console.warn('[VIS AI browser]', e.message); return null; });
  }

  // Remove reasoning wrappers that GLM / DeepSeek / Nemotron etc. emit.
  function stripThink(s) {
    var out = String(s)
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<\|?reasoning\|?>[\s\S]*?<\/?\|?reasoning\|?>/gi, '')
      .trim();
    return out || String(s); // if stripping left nothing, keep original
  }
  function extractContent(data) {
    var ch = data && data.choices && data.choices[0];
    var c = ch && (ch.message ? (ch.message.content || ch.message.reasoning_content) : ch.text);
    return c ? stripThink(c) : null;
  }

  /* ---- enhance the analysis narrative ---- */
  function buildPrompt(analysis) {
    var lines = [];
    lines.push('You are an executive business analyst. Given the dataset summary below, respond ONLY with strict minified JSON matching:');
    lines.push('{"headline": string (<=6 words, punchy title), "tagline": string (<=14 words, one-line takeaway), "summary": string (2-3 sentences), "insights": [{"type":"pos|neg|warn|info","text":string}] (3-5), "recommendations": [string] (3-4)}');
    lines.push('Polished, executive tone. No markdown, no code fences, no text outside the JSON.');
    lines.push('');
    lines.push('DATASET: ' + (analysis.title || 'Business data') + ' — ' + analysis.meta.rows + ' rows, ' + analysis.meta.cols + ' fields.');
    if (analysis.dateCol) lines.push('Time dimension: ' + analysis.dateCol.name + ' (' + analysis.dateCol.values.join(', ') + ')');
    lines.push('MEASURES:');
    analysis.measures.slice(0, 8).forEach(function (m) {
      lines.push('- ' + m.name + ' [' + (m.sub || 'number') + ']: first=' + m.first + ', last=' + m.last + ', total=' + Math.round(m.total) + ', avg=' + Math.round(m.avg) + ', min=' + m.min + ', max=' + m.max + (m.change != null ? ', change=' + Math.round(m.change) + '%' : ''));
    });
    if (analysis.categories.length) lines.push('Segments (' + analysis.categories[0].name + '): ' + analysis.categories[0].values.slice(0, 12).join(', '));
    return lines.join('\n');
  }

  function enhance(analysis) {
    if (!isEnabled()) return Promise.resolve(null);
    var messages = [
      { role: 'system', content: 'You are a precise executive analyst. Respond with ONLY minified JSON matching the requested schema. Do NOT include reasoning, thinking, explanations, markdown, or any text before or after the JSON. Start your reply with { and end with }.' },
      { role: 'user', content: buildPrompt(analysis) }
    ];
    return complete(messages, { temperature: 0.3, max_tokens: 2000 }).then(function (content) {
      if (!content) return null;
      var parsed = parseModelJSON(content);
      if (parsed && (parsed.summary || (parsed.insights && parsed.insights.length) || (parsed.recommendations && parsed.recommendations.length))) return parsed;
      // Salvage: model returned prose (or reasoning) instead of clean JSON — still use it
      // as the executive summary so AI visibly contributes rather than fully falling back.
      var prose = stripThink(content)
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[{}\[\]"`]/g, ' ')
        .replace(/\b(summary|insights|recommendations|headline|tagline|type|text|pos|neg|warn|info)\b\s*:/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (prose.length > 60) return { summary: prose.slice(0, 700), aiPartial: true };
      return null;
    });
  }

  // Find the first balanced {...} object in arbitrary text (handles reasoning
  // models that surround the JSON with prose / <think> blocks).
  function extractJSONObject(txt) {
    try { return JSON.parse(txt); } catch (e) {}
    var start = txt.indexOf('{');
    if (start < 0) return null;
    var depth = 0, inStr = false, esc = false;
    for (var i = start; i < txt.length; i++) {
      var ch = txt[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
      else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(txt.slice(start, i + 1)); } catch (e) { return null; } } }
    }
    return null;
  }

  function parseModelJSON(content) {
    var txt = stripThink(content).replace(/^```(json)?/i, '').replace(/```\s*$/, '').trim();
    try {
      var obj = extractJSONObject(txt); if (!obj) throw new Error('no json'); var out = {};
      if (typeof obj.headline === 'string') out.headline = obj.headline.trim();
      if (typeof obj.tagline === 'string') out.tagline = obj.tagline.trim();
      if (typeof obj.summary === 'string') out.summary = obj.summary;
      if (Array.isArray(obj.insights)) out.insights = obj.insights.map(function (i) {
        var type = (i.type || 'info').toLowerCase();
        var icon = type === 'pos' ? 'trendUp' : type === 'neg' ? 'trendDown' : type === 'warn' ? 'alert' : 'insight';
        return { type: ['pos', 'neg', 'warn', 'info'].indexOf(type) !== -1 ? type : 'info', icon: icon, text: String(i.text) };
      }).slice(0, 6);
      if (Array.isArray(obj.recommendations)) out.recommendations = obj.recommendations.map(String).slice(0, 5);
      return out;
    } catch (e) { console.warn('[VIS AI] could not parse model JSON'); return null; }
  }

  window.VIS.ai = {
    init: init, getConfig: getConfig, setConfig: setConfig,
    isEnabled: isEnabled, backendPresent: backendPresent, backendAvailable: function () { return backend.available; },
    complete: complete, enhance: enhance
  };
})();
