/* =========================================================================
   VIS · AI Chat panel
   A floating assistant. Understands natural commands locally (themes, mode,
   charts, presentation, infographic, export, summarize) and, when an AI model
   is configured, answers free-form questions about the current data.
   Talks to the app through the VIS.app.* hooks.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};

  var THEME_WORDS = {
    apple: 'apple', stripe: 'stripe', linear: 'linear', notion: 'notion', vercel: 'vercel',
    material: 'material', fluent: 'fluent', microsoft: 'fluent',
    finance: 'finance', banking: 'finance', bank: 'finance',
    cyber: 'cyber', neon: 'cyber', luxury: 'luxury', premium: 'luxury', gold: 'luxury',
    glass: 'glass', glassmorphism: 'glass', corporate: 'corporate', executive: 'executive-white'
  };

  var msgs = [];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function push(role, text) {
    msgs.push({ role: role, text: text });
    var list = document.getElementById('chatMsgs');
    if (!list) return;
    var m = el('div', 'chat-msg ' + role);
    if (role === 'ai') m.appendChild(el('div', 'chat-ava', '<span data-ic="ai"></span>'));
    m.appendChild(el('div', 'chat-bubble', text));
    list.appendChild(m);
    VIS.hydrateIcons(m);
    list.scrollTop = list.scrollHeight;
  }

  var SUGGESTIONS = ['Make it look like Apple', 'Use banking theme', 'Dark mode', 'Reduce charts', 'Summarize', 'Make a presentation', 'Generate infographic'];

  function ensurePanel() {
    if (document.getElementById('chatPanel')) return;

    var fab = el('button', 'chat-fab', '<span data-ic="chat"></span>');
    fab.id = 'chatFab'; fab.title = 'AI assistant';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);

    var panel = el('div', 'chat-panel');
    panel.id = 'chatPanel';
    panel.innerHTML =
      '<div class="chat-head"><div class="chat-head-l"><span class="chat-head-ic" data-ic="ai"></span>' +
        '<div><div class="chat-name">VIS Assistant</div><div class="chat-status" id="chatStatus">Ready</div></div></div>' +
        '<button class="icon-btn chat-close" id="chatClose"><span data-ic="close"></span></button></div>' +
      '<div class="chat-msgs" id="chatMsgs"></div>' +
      '<div class="chat-suggest" id="chatSuggest">' + SUGGESTIONS.map(function (s) { return '<button class="chat-chip">' + s + '</button>'; }).join('') + '</div>' +
      '<div class="chat-input-row"><input id="chatInput" class="chat-input" placeholder="Ask or tell me what to change…" autocomplete="off" />' +
      '<button class="chat-send" id="chatSend"><span data-ic="send"></span></button></div>';
    document.body.appendChild(panel);

    document.getElementById('chatClose').addEventListener('click', toggle);
    document.getElementById('chatSend').addEventListener('click', submit);
    document.getElementById('chatInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    document.querySelectorAll('#chatSuggest .chat-chip').forEach(function (b) {
      b.addEventListener('click', function () { document.getElementById('chatInput').value = b.textContent; submit(); });
    });

    VIS.hydrateIcons(panel); VIS.hydrateIcons(fab);

    push('ai', "Hi! I'm your VIS assistant. Tell me to restyle the dashboard (e.g. \u201Cmake it look like Apple\u201D), switch to dark mode, reduce charts, build a presentation, or ask about your data.");
  }

  function toggle() {
    ensurePanel();
    var p = document.getElementById('chatPanel');
    var open = p.classList.toggle('open');
    document.getElementById('chatFab').classList.toggle('hidden', open);
    if (open) setTimeout(function () { document.getElementById('chatInput').focus(); }, 60);
  }

  function status(t) { var s = document.getElementById('chatStatus'); if (s) s.textContent = t; }

  function submit() {
    var input = document.getElementById('chatInput');
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    push('user', text);
    handle(text);
  }

  /* ---------- command interpreter ---------- */
  function handle(text) {
    var t = text.toLowerCase();
    var app = VIS.app || {};

    // dark / light mode
    if (/\b(dark)\b/.test(t) && /mode|theme|switch|make|turn/.test(t)) { app.setMode && app.setMode('dark'); return reply('Switched to dark mode.'); }
    if (/\b(light)\b/.test(t) && /mode|theme|switch|make|turn/.test(t)) { app.setMode && app.setMode('light'); return reply('Switched to light mode.'); }
    if (/^dark$/.test(t)) { app.setMode && app.setMode('dark'); return reply('Dark mode on.'); }
    if (/^light$/.test(t)) { app.setMode && app.setMode('light'); return reply('Light mode on.'); }

    // theme
    var themeKey = null;
    Object.keys(THEME_WORDS).forEach(function (w) { if (new RegExp('\\b' + w + '\\b').test(t)) themeKey = THEME_WORDS[w]; });
    if (themeKey && /(look|like|theme|style|make|use|switch|more)/.test(t)) {
      if (themeKey === 'executive-white' && document.documentElement.getAttribute('data-mode') === 'dark') themeKey = 'executive-dark';
      app.setTheme && app.setTheme(themeKey);
      return reply('Applied the ' + prettyTheme(themeKey) + ' theme.');
    }

    // reduce / fewer charts
    if (/(reduce|fewer|less|minimal|simplify).*(chart|visual|graph)|(chart|visual).*(reduce|fewer|less)/.test(t) || /reduce charts/.test(t)) {
      if (app.reduceCharts && app.reduceCharts()) return reply('Trimmed the dashboard to the most important charts.');
      return reply('There are no extra charts to remove.');
    }
    // more charts / restore
    if (/(more|add|show all|restore).*(chart|visual|graph)/.test(t)) {
      app.regenerate && app.regenerate();
      return reply('Restored the full set of charts.');
    }

    // summarize
    if (/summar/.test(t)) {
      var s = app.getSummary && app.getSummary();
      return reply(s || 'Generate a dashboard first, then I can summarize it.');
    }

    // presentation
    if (/(presentation|slides|slide deck|deck)/.test(t)) {
      if (app.makePresentation && app.makePresentation()) return reply('Built a presentation from your dashboard — opening it now.');
      return reply('Generate a dashboard first and I\u2019ll turn it into slides.');
    }

    // infographic
    if (/(infographic|poster|one[- ]?pager|shareable)/.test(t)) {
      if (app.makeInfographic && app.makeInfographic()) return reply('Created an infographic view — opening it now.');
      return reply('Generate a dashboard first and I\u2019ll create an infographic.');
    }

    // export
    if (/export|download|save as|pdf|png/.test(t)) {
      var fmt = /pdf/.test(t) ? 'pdf' : /png|image/.test(t) ? 'png' : /json/.test(t) ? 'json' : null;
      if (app.doExport && fmt) { app.doExport(fmt); return reply('Exporting as ' + fmt.toUpperCase() + '…'); }
      app.route && app.route('dashboard');
      return reply('Open the Export menu on the dashboard, or say \u201Cexport as PDF/PNG\u201D.');
    }

    // regenerate
    if (/(regenerate|rebuild|refresh|redo)/.test(t)) { app.regenerate && app.regenerate(); return reply('Regenerated the dashboard.'); }

    // help
    if (/^(help|what can you do|commands|\?)$/.test(t) || /what can you/.test(t)) {
      return reply('I can: change the <b>theme</b> (Apple, Stripe, Finance, Glass…), toggle <b>dark/light</b>, <b>reduce charts</b>, <b>summarize</b>, build a <b>presentation</b> or <b>infographic</b>, and <b>export</b>. If you\u2019ve connected an AI model in Settings, I can also answer questions about your data.');
    }

    // free-form -> AI model (if configured) about the data
    if (VIS.ai && VIS.ai.isEnabled() && app.getAnalysis && app.getAnalysis()) {
      status('Thinking…');
      askModel(text, app.getAnalysis()).then(function (ans) {
        status('Ready');
        reply(ans || "I couldn't reach the AI model. Try a command like \u201Cmake it look like Apple\u201D or \u201Csummarize\u201D.");
      });
      return;
    }

    // no AI configured
    reply('I understood that as a question about your data. Connect your AI model in <b>Settings \u2192 AI Provider</b> and I\u2019ll answer those too. Meanwhile I can restyle, summarize, reduce charts, or build a presentation.');
  }

  function reply(html) { push('ai', html); }

  function prettyTheme(key) {
    return ({ 'executive-white': 'Executive White', 'executive-dark': 'Executive Dark' })[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  /* ---------- free-form question via configured model (backend or browser) ---------- */
  function askModel(question, analysis) {
    var ctx = [];
    ctx.push('DATASET: ' + (analysis.title || 'data') + ' (' + analysis.meta.rows + ' rows).');
    if (analysis.dateCol) ctx.push('Time: ' + analysis.dateCol.name + ' = ' + analysis.dateCol.values.join(', '));
    analysis.measures.slice(0, 8).forEach(function (m) {
      ctx.push(m.name + ': first=' + m.first + ', last=' + m.last + ', total=' + Math.round(m.total) + ', avg=' + Math.round(m.avg) + (m.change != null ? ', change=' + Math.round(m.change) + '%' : ''));
    });
    if (analysis.categories.length) ctx.push('Segments: ' + analysis.categories[0].values.slice(0, 12).join(', '));

    var messages = [
      { role: 'system', content: 'You are a concise executive data analyst. Answer in 1-3 short sentences using ONLY the provided figures. No markdown.' },
      { role: 'user', content: 'Data context:\n' + ctx.join('\n') + '\n\nQuestion: ' + question }
    ];
    return VIS.ai.complete(messages, { temperature: 0.3, max_tokens: 900 })
      .then(function (c) { return c ? String(c).trim() : null; });
  }

  window.VIS.chat = { init: ensurePanel, toggle: toggle };
})();
