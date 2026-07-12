/* =========================================================================
   VIS · Renderer
   Turns an analysis object into the Bento dashboard DOM.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var eng = null;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmt(n, sub) { return VIS.engine.fmtNumber(n, sub); }

  function cardHead(title, icon, badge) {
    var h = el('div', 'card-head');
    h.appendChild(el('div', 'card-title', '<span class="t-ic" data-ic="' + (icon || 'chart') + '"></span>' + title));
    if (badge) h.appendChild(el('div', 'card-badge', badge));
    return h;
  }

  /* ---------- KPI cards ---------- */
  function renderKpi(kpi, idx) {
    var span = kpi.hero ? 'col-4' : (idx < 3 ? 'col-4' : 'col-3');
    var card = el('div', 'card kpi ' + (kpi.hero ? 'kpi-hero col-6' : 'col-3'));
    card.style.animationDelay = (idx * 40) + 'ms';

    var top = el('div', 'kpi-label', '<span class="kpi-ic" data-ic="' + kpi.icon + '"></span>' + kpi.label);
    card.appendChild(top);
    card.appendChild(el('div', 'kpi-value', kpi.formatted));

    var foot = el('div', 'kpi-foot');
    if (kpi.delta != null) {
      var dir = kpi.delta > 0.05 ? 'up' : (kpi.delta < -0.05 ? 'down' : 'flat');
      var arrow = dir === 'up' ? '&#9650;' : (dir === 'down' ? '&#9660;' : '&#8226;');
      foot.appendChild(el('span', 'delta ' + dir, arrow + ' ' + VIS.engine.fmtSigned(kpi.delta)));
    }
    foot.appendChild(el('span', 'kpi-sub', kpi.aggLabel));
    card.appendChild(foot);

    // sparkline for time-series kpis only
    if (kpi.showSpark && kpi.spark && kpi.spark.length > 2) {
      var sp = el('div', 'kpi-spark');
      card.appendChild(sp);
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        VIS.charts.build({ kind: 'spark', series: [{ name: kpi.label, data: kpi.spark, sub: kpi.sub }] }, sp);
      }); });
    }
    return card;
  }

  /* ---------- Chart cards ---------- */
  function renderChart(spec) {
    var card = el('div', 'card chart-card ' + (spec.size || 'col-6') + (spec.role === 'trend' ? ' tall' : ''));
    card._spec = spec; // used by the editor for duplicate/delete rebuilds

    var head = el('div', 'card-head');
    head.appendChild(el('div', 'card-title', '<span class="t-ic" data-ic="' + (spec.icon || 'chart') + '"></span>' + spec.title));
    var actions = el('div', 'card-head-actions');
    actions.appendChild(el('span', 'card-badge', spec.kind.toUpperCase()));
    var copyBtn = el('button', 'card-copy', '<span data-ic="copy"></span>');
    copyBtn.setAttribute('title', 'Copy chart as image'); copyBtn.setAttribute('aria-label', 'Copy chart as image');
    copyBtn.addEventListener('click', function (e) { e.stopPropagation(); VIS.charts.copyChart(card._chart, spec.title, copyBtn); });
    actions.appendChild(copyBtn);
    head.appendChild(actions);
    card.appendChild(head);

    var chartNode = el('div', 'chart');
    card.appendChild(chartNode);
    // defer so the node has dimensions, keep the instance for copy/export
    requestAnimationFrame(function () { requestAnimationFrame(function () { card._chart = VIS.charts.build(spec, chartNode); }); });
    return card;
  }

  /* ---------- Summary ---------- */
  function renderSummary(analysis) {
    var card = el('div', 'card summary col-8');
    card.appendChild(cardHead('Executive Summary', 'insight', analysis.aiEnhanced ? 'AI' : 'AUTO'));
    card.appendChild(el('p', 'lead', analysis.summary));
    return card;
  }

  /* ---------- Insights ---------- */
  function renderInsights(analysis) {
    var card = el('div', 'card col-4');
    card.appendChild(cardHead('Key Findings', 'target'));
    var list = el('div', 'insight-list');
    analysis.insights.forEach(function (ins) {
      var row = el('div', 'insight ' + ins.type);
      row.appendChild(el('div', 'insight-ic', '<span data-ic="' + ins.icon + '"></span>'));
      row.appendChild(el('div', 'insight-body', ins.text));
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- Recommendations ---------- */
  function renderRecs(analysis) {
    var card = el('div', 'card col-6');
    card.appendChild(cardHead('Recommendations', 'check', analysis.aiEnhanced ? 'AI' : 'AUTO'));
    var list = el('div', 'rec-list');
    analysis.recommendations.forEach(function (r) {
      var row = el('div', 'rec');
      row.appendChild(el('span', null, r));
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- Ranking (top categories) ---------- */
  function renderRanking(analysis) {
    if (analysis.dateCol || !analysis.measures.length || !analysis.categories.length) return null;
    var m = analysis.measures[0];
    var labels = analysis.primaryDim.values.map(String);
    var pairs = m.nums.map(function (v, i) { return { name: labels[i], v: v }; })
      .filter(function (p) { return !isNaN(p.v); })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
    var max = pairs.length ? pairs[0].v : 1;

    var card = el('div', 'card col-6');
    card.appendChild(cardHead('Top ' + m.name, 'star'));
    var list = el('div', 'rank-list');
    pairs.forEach(function (p, i) {
      var row = el('div', 'rank');
      row.appendChild(el('div', 'rank-i', '#' + (i + 1)));
      var wrap = el('div', 'rank-bar-wrap');
      wrap.appendChild(el('div', 'rank-name', '<span>' + p.name + '</span><span class="v">' + fmt(p.v, m.sub) + '</span>'));
      var bar = el('div', 'rank-bar');
      var fill = el('div', 'rank-fill');
      fill.style.width = '0%';
      bar.appendChild(fill);
      wrap.appendChild(bar);
      row.appendChild(wrap);
      list.appendChild(row);
      setTimeout(function () { fill.style.width = Math.max(4, (p.v / max) * 100) + '%'; }, 60 + i * 60);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- Progress rings (percentage measures) ---------- */
  function renderProgressRings(analysis) {
    var pct = analysis.measures.filter(function (m) { return m.sub === 'percent'; }).slice(0, 4);
    if (!pct.length) return null;
    var card = el('div', 'card col-6');
    card.appendChild(cardHead('Progress', 'target'));
    var wrap = el('div', 'ring-row');
    pct.forEach(function (m) {
      var raw = (analysis.dateCol && m.last != null) ? m.last : m.avg;
      var v = Math.max(0, Math.min(100, Math.round(raw)));
      var ring = el('div', 'ring-item',
        '<div class="ring" style="--p:' + v + '"><div class="ring-hole">' + v + '%</div></div>' +
        '<div class="ring-label">' + m.name + '</div>');
      wrap.appendChild(ring);
    });
    card.appendChild(wrap);
    return card;
  }

  /* ---------- Data table ---------- */
  function renderTable(analysis) {
    var card = el('div', 'card table-card col-12');
    card.appendChild(cardHead('Source Data', 'code', analysis.meta.rows + ' rows'));
    var scroll = el('div', 'tbl-scroll');
    var tbl = el('table', 'data');
    var thead = el('thead');
    var trh = el('tr');
    analysis.columns.forEach(function (c) { trh.appendChild(el('th', null, c.name)); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody = el('tbody');
    analysis.table.rows.slice(0, 100).forEach(function (r) {
      var tr = el('tr');
      analysis.columns.forEach(function (c) {
        var val = r[c.name];
        var isNum = c.type === 'number';
        var td = el('td', isNum ? 'num' : null, isNum ? fmt(VIS.engine.cleanNumber(val), c.sub) : String(val));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    scroll.appendChild(tbl);
    card.appendChild(scroll);
    return card;
  }

  /* ---------- Master render ---------- */
  function render(analysis, mount) {
    VIS.charts.disposeAll();
    mount.innerHTML = '';

    // 1. KPI row
    analysis.kpis.forEach(function (k, i) { mount.appendChild(renderKpi(k, i)); });

    // 2. Summary + insights
    mount.appendChild(renderSummary(analysis));
    mount.appendChild(renderInsights(analysis));

    // 3. Charts
    analysis.charts.forEach(function (spec) { mount.appendChild(renderChart(spec)); });

    // 4a. Progress rings (percentage measures)
    var rings = renderProgressRings(analysis);
    if (rings) mount.appendChild(rings);

    // 4b. Ranking / leaderboard (categorical)
    var rank = renderRanking(analysis);
    if (rank) mount.appendChild(rank);

    // 5. Recommendations
    mount.appendChild(renderRecs(analysis));

    // 6. Data table
    mount.appendChild(renderTable(analysis));

    VIS.hydrateIcons(mount);
  }

  window.VIS.render = render;
})();
