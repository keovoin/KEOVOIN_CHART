/* =========================================================================
   VIS · Data Engine
   Parse (CSV / TSV / JSON / markdown table) -> analyze -> structured model.
   Runs entirely in the browser. No dependencies.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};

  /* ----------------------------- Parsing ----------------------------- */

  function detectFormat(text) {
    var t = text.trim();
    if (!t) return 'empty';
    if ((t[0] === '{' || t[0] === '[')) {
      try { JSON.parse(t); return 'json'; } catch (e) { /* not json */ }
    }
    var firstLine = t.split(/\r?\n/)[0] || '';
    if (/\|/.test(firstLine) && /\|/.test(t.split(/\r?\n/)[1] || '')) return 'markdown';
    if (firstLine.indexOf('\t') !== -1) return 'tsv';
    return 'csv';
  }

  // RFC-ish line splitter that respects quotes. delim '\t' | ',' | ';' | 'SPACES'.
  function splitDelimited(line, delim) {
    if (delim === 'SPACES') return line.trim().split(/\s{2,}|\t/).map(function (s) { return s.trim(); });
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === delim) { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out.map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
  }

  // Pick the delimiter from the first several lines (Excel paste = tabs).
  function chooseDelim(text) {
    var sample = text.split(/\r?\n/).slice(0, 12).join('\n');
    if (sample.indexOf('\t') !== -1) return '\t';
    var commas = (sample.match(/,/g) || []).length;
    var semis = (sample.match(/;/g) || []).length;
    if (semis > commas && semis > 0) return ';';
    if (commas > 0) return ',';
    if (/\S {2,}\S/.test(sample)) return 'SPACES';
    return ',';
  }

  function parseDelimited(text, delim) {
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l) { return l.trim().length; });
    if (!lines.length) return { columns: [], rows: [] };

    // Header = first line that yields >= 2 non-empty cells (skips title/preamble lines).
    var headerIdx = 0, best = 0;
    for (var k = 0; k < Math.min(lines.length, 8); k++) {
      var n = splitDelimited(lines[k], delim).filter(function (c) { return c !== ''; }).length;
      if (n > best) { best = n; headerIdx = k; }
      if (n >= 2 && k === headerIdx) break;
    }
    var rawHeaders = splitDelimited(lines[headerIdx], delim);
    var seen = {};
    var headers = rawHeaders.map(function (h, i) {
      var name = (h && h.trim()) ? h.trim() : ('Column ' + (i + 1));
      if (seen[name] != null) { seen[name]++; name = name + ' (' + seen[name] + ')'; } else seen[name] = 0;
      return name;
    });

    var rows = [];
    for (var i = headerIdx + 1; i < lines.length; i++) {
      var cells = splitDelimited(lines[i], delim);
      if (!cells.some(function (c) { return c !== ''; })) continue; // skip blank rows
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = cells[j] !== undefined ? cells[j] : '';
      rows.push(obj);
    }
    return { columns: headers, rows: rows };
  }

  // Drop columns that are entirely empty (common with trailing tabs from Excel).
  function cleanTable(table) {
    if (!table.columns.length) return table;
    var keep = table.columns.filter(function (c) {
      return table.rows.some(function (r) { return String(r[c] == null ? '' : r[c]).trim() !== ''; });
    });
    if (keep.length && keep.length < table.columns.length) {
      table.columns = keep;
      table.rows = table.rows.map(function (r) { var o = {}; keep.forEach(function (c) { o[c] = r[c]; }); return o; });
    }
    return table;
  }

  function parseMarkdown(text) {
    var lines = text.replace(/\r\n/g, '\n').split('\n').filter(function (l) { return l.trim().length; });
    lines = lines.filter(function (l) { return !/^\s*\|?[\s:|-]+\|?\s*$/.test(l) || !/-/.test(l); });
    // Rebuild: drop separator rows made only of - : |
    var clean = [];
    lines.forEach(function (l) {
      if (/^\s*\|?[\s:|-]+\|?\s*$/.test(l) && /-/.test(l)) return;
      clean.push(l);
    });
    var toCells = function (l) {
      return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (s) { return s.trim(); });
    };
    if (!clean.length) return { columns: [], rows: [] };
    var headers = toCells(clean[0]);
    var rows = [];
    for (var i = 1; i < clean.length; i++) {
      var cells = toCells(clean[i]);
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = cells[j] !== undefined ? cells[j] : '';
      rows.push(obj);
    }
    return { columns: headers, rows: rows };
  }

  function parseJSON(text) {
    var data = JSON.parse(text);
    if (!Array.isArray(data)) {
      // object of arrays or single object
      if (data && typeof data === 'object') {
        var arrKey = Object.keys(data).find(function (k) { return Array.isArray(data[k]); });
        if (arrKey) data = data[arrKey];
        else data = [data];
      }
    }
    if (!Array.isArray(data) || !data.length) return { columns: [], rows: [] };
    var cols = [];
    data.forEach(function (r) {
      if (r && typeof r === 'object') Object.keys(r).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); });
    });
    var rows = data.map(function (r) {
      var o = {};
      cols.forEach(function (c) { o[c] = r[c] === undefined || r[c] === null ? '' : (typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]); });
      return o;
    });
    return { columns: cols, rows: rows };
  }

  function parse(text) {
    var fmt = detectFormat(text);
    var table;
    if (fmt === 'json') table = parseJSON(text);
    else if (fmt === 'markdown') table = parseMarkdown(text);
    else if (fmt === 'empty') table = { columns: [], rows: [] };
    else {
      var d = chooseDelim(text);
      table = parseDelimited(text, d);
      fmt = d === '\t' ? 'tsv' : d === 'SPACES' ? 'text' : (d === ';' ? 'csv' : 'csv');
    }
    table = cleanTable(table);
    table.format = fmt;
    return table;
  }

  /* ----------------------------- Type detection ----------------------------- */

  var MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  function cleanNumber(v) {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined) return NaN;
    var s = String(v).trim();
    if (!s) return NaN;
    var neg = /^\(.*\)$/.test(s); // (123) accounting negative
    s = s.replace(/[()]/g, '');
    s = s.replace(/[$€£¥₹,%\s]/g, '');
    s = s.replace(/[kKmMbB]$/, function (m) { return ''; }); // keep raw; suffix handled below
    var suffix = String(v).trim().slice(-1).toLowerCase();
    var n = parseFloat(s);
    if (isNaN(n)) return NaN;
    if (suffix === 'k') n *= 1e3;
    else if (suffix === 'm') n *= 1e6;
    else if (suffix === 'b') n *= 1e9;
    return neg ? -n : n;
  }

  function looksDate(v) {
    var s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (MONTHS.indexOf(s.slice(0, 3)) !== -1) return true;
    if (/^q[1-4]$/.test(s)) return true;
    if (/^(19|20)\d{2}$/.test(s)) return true;
    if (/^\d{4}-\d{1,2}(-\d{1,2})?$/.test(s)) return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
    if (/^\d{1,2}-[a-z]{3}-\d{2,4}$/i.test(s)) return true;  // 01-Jul-2026
    if (/^[a-z]{3,9}\s+\d{1,2},?\s+\d{4}$/i.test(s)) return true;  // July 1, 2026
    if (/^\d{1,2}\s+[a-z]{3,9}\s+\d{4}$/i.test(s)) return true;  // 1 July 2026
    if (/^week\s*\d+$/i.test(s) || /^w\d+$/i.test(s)) return true;
    return false;
  }

  function detectColumnType(values) {
    var nonEmpty = values.filter(function (v) { return String(v).trim() !== ''; });
    if (!nonEmpty.length) return { type: 'empty' };
    var dateHits = 0, numHits = 0, pctHits = 0, curHits = 0;
    nonEmpty.forEach(function (v) {
      var s = String(v).trim();
      if (/%/.test(s)) pctHits++;
      if (/[$€£¥₹]/.test(s)) curHits++;
      if (looksDate(v)) dateHits++;
      if (!isNaN(cleanNumber(v))) numHits++;
    });
    var n = nonEmpty.length;
    if (dateHits / n > 0.7) return { type: 'date' };
    if (numHits / n > 0.75) {
      if (pctHits / n > 0.5) return { type: 'number', sub: 'percent' };
      if (curHits / n > 0.5) return { type: 'number', sub: 'currency' };
      // heuristic: large magnitudes -> currency-ish when named revenue etc handled later
      return { type: 'number', sub: 'number' };
    }
    var uniq = {};
    nonEmpty.forEach(function (v) { uniq[String(v)] = 1; });
    return { type: 'category', cardinality: Object.keys(uniq).length };
  }

  /* ----------------------------- Stats helpers ----------------------------- */
  function sum(a){var s=0;for(var i=0;i<a.length;i++)s+=a[i];return s;}
  function mean(a){return a.length?sum(a)/a.length:0;}
  function stdev(a){if(a.length<2)return 0;var m=mean(a);return Math.sqrt(mean(a.map(function(x){return (x-m)*(x-m);})));}
  function pctChange(from,to){if(from===0)return to===0?0:null;return (to-from)/Math.abs(from)*100;}

  /* ----------------------------- Number formatting ----------------------------- */
  function fmtNumber(n, sub) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (sub === 'percent') return round(n, n < 10 ? 1 : 0) + '%';
    var abs = Math.abs(n);
    var prefix = sub === 'currency' ? '$' : '';
    if (abs >= 1e9) return prefix + round(n / 1e9, 2) + 'B';
    if (abs >= 1e6) return prefix + round(n / 1e6, 2) + 'M';
    if (abs >= 1e3) return prefix + round(n / 1e3, abs >= 1e4 ? 1 : 2) + 'K';
    return prefix + round(n, abs < 10 && n % 1 !== 0 ? 2 : 0).toLocaleString();
  }
  function round(n, d) { var p = Math.pow(10, d || 0); return Math.round(n * p) / p; }
  function fmtSigned(n) { if (n === null || isNaN(n)) return '—'; return (n >= 0 ? '+' : '') + round(n, 1) + '%'; }

  /* ----------------------------- Analyze ----------------------------- */

  function analyze(table, opts) {
    opts = opts || {};
    var sigma = opts.sigma || 2;
    var maxKpi = opts.maxKpi || 5;

    var cols = table.columns.map(function (name) {
      var values = table.rows.map(function (r) { return r[name]; });
      var t = detectColumnType(values);
      // name-based hints
      var low = name.toLowerCase();
      if (t.type === 'number') {
        if (/(rate|margin|%|percent|share|ratio|util)/.test(low) && t.sub === 'number') t.sub = 'percent';
        if (/(revenue|sales|cost|expense|profit|budget|price|cash|amount|\$|usd)/.test(low) && t.sub === 'number') t.sub = 'currency';
      }
      return { name: name, type: t.type, sub: t.sub, cardinality: t.cardinality, values: values };
    });

    var dateCol = cols.find(function (c) { return c.type === 'date'; });
    var measures = cols.filter(function (c) { return c.type === 'number'; });
    var categories = cols.filter(function (c) { return c.type === 'category'; });
    var primaryDim = dateCol || categories[0] || cols[0];

    // numeric series per measure
    measures.forEach(function (m) {
      m.nums = m.values.map(cleanNumber);
      var valid = m.nums.filter(function (x) { return !isNaN(x); });
      m.total = sum(valid);
      m.avg = mean(valid);
      m.min = valid.length ? Math.min.apply(null, valid) : null;
      m.max = valid.length ? Math.max.apply(null, valid) : null;
      m.first = valid.length ? valid[0] : null;
      m.last = valid.length ? valid[valid.length - 1] : null;
      m.change = valid.length > 1 ? pctChange(valid[0], valid[valid.length - 1]) : null;
      m.stdev = stdev(valid);
      m.isTimeSeries = !!dateCol;
    });

    /* ---- KPIs ---- */
    var kpis = measures.slice(0, maxKpi).map(function (m, i) {
      var display, aggLabel;
      if (m.sub === 'percent') { display = m.last != null ? m.last : m.avg; aggLabel = 'latest'; }
      else if (dateCol && !/(total|count|cumulative)/i.test(m.name)) { display = m.last; aggLabel = 'latest'; }
      else { display = m.total; aggLabel = 'total'; }
      // previous-period delta
      var delta = null;
      var validNums = m.nums.filter(function (x) { return !isNaN(x); });
      if (dateCol && validNums.length > 1) delta = pctChange(validNums[validNums.length - 2], validNums[validNums.length - 1]);
      else if (validNums.length > 1) delta = m.change;
      return {
        label: m.name, value: display, sub: m.sub, aggLabel: aggLabel,
        formatted: fmtNumber(display, m.sub), delta: delta,
        icon: pickKpiIcon(m.name, m.sub), spark: validNums, showSpark: !!dateCol,
        hero: i === 0
      };
    });

    /* ---- Chart recommendations ---- */
    var charts = recommendCharts(cols, dateCol, measures, categories, primaryDim, table.rows);

    /* ---- Insights ---- */
    var insights = buildInsights(cols, dateCol, measures, categories, primaryDim, table.rows, sigma);

    /* ---- Executive summary + recommendations (heuristic) ---- */
    var narrative = buildNarrative(cols, dateCol, measures, categories, insights);

    return {
      table: table,
      columns: cols,
      dateCol: dateCol,
      primaryDim: primaryDim,
      measures: measures,
      categories: categories,
      kpis: kpis,
      charts: charts,
      insights: insights,
      summary: narrative.summary,
      recommendations: narrative.recommendations,
      meta: {
        rows: table.rows.length,
        cols: cols.length,
        format: table.format,
        measures: measures.length,
        generatedAt: new Date()
      }
    };
  }

  function pickKpiIcon(name, sub) {
    var low = name.toLowerCase();
    if (/(revenue|sales|profit|cash|budget|cost|expense|price|\$)/.test(low)) return 'money';
    if (/(customer|user|headcount|employee|people|team|hire)/.test(low)) return 'users';
    if (sub === 'percent' || /(rate|margin|nps|score|util)/.test(low)) return 'percent';
    if (/(deal|order|unit|volume|count|qty)/.test(low)) return 'box';
    if (/(risk|issue|defect|attrition|churn)/.test(low)) return 'alert';
    return 'chart';
  }

  function recommendCharts(cols, dateCol, measures, categories, primaryDim, rows) {
    var charts = [];
    var labels = primaryDim ? primaryDim.values.map(String) : [];

    // 1. Trend (time series) — area/line of top measures
    if (dateCol && measures.length) {
      charts.push({
        kind: measures.length > 1 ? 'line' : 'area',
        title: measures.length > 1 ? 'Trends over time' : (measures[0].name + ' trend'),
        role: 'trend', size: 'col-8', icon: 'trendUp',
        x: dateCol.values.map(String),
        series: measures.slice(0, 4).map(function (m) { return { name: m.name, data: m.nums, sub: m.sub }; })
      });
    }

    // 2. Category comparison — bar / horizontal bar
    if (!dateCol && categories.length && measures.length) {
      var many = rows.length > 7;
      var longLabels = labels.some(function (l) { return l.length > 12; });
      var m0 = measures[0];
      charts.push({
        kind: (many || longLabels) ? 'hbar' : 'bar',
        title: m0.name + ' by ' + primaryDim.name,
        role: 'comparison', size: 'col-8', icon: 'chart',
        x: labels, series: [{ name: m0.name, data: m0.nums, sub: m0.sub }]
      });
    }

    // 3. Composition — donut for a percent measure or share of first measure
    var pctMeasure = measures.find(function (m) { return m.sub === 'percent'; });
    if (categories.length && measures.length && !dateCol) {
      var shareM = measures[0];
      charts.push({
        kind: 'donut',
        title: 'Share of ' + shareM.name,
        role: 'composition', size: 'col-4', icon: 'percent',
        labels: labels, data: shareM.nums, sub: shareM.sub
      });
    } else if (dateCol && measures.length >= 2) {
      // composition of latest period across measures
      charts.push({
        kind: 'donut',
        title: 'Latest period mix',
        role: 'composition', size: 'col-4', icon: 'percent',
        labels: measures.slice(0, 5).map(function (m) { return m.name; }),
        data: measures.slice(0, 5).map(function (m) { return Math.abs(m.last || 0); })
      });
    }

    // 4. Relationship — scatter for exactly two independent measures
    if (measures.length === 2 && rows.length >= 5 && !dateCol) {
      charts.push({
        kind: 'scatter',
        title: measures[0].name + ' vs ' + measures[1].name,
        role: 'relationship', size: 'col-6', icon: 'target',
        xName: measures[0].name, yName: measures[1].name,
        points: rows.map(function (r, i) { return [measures[0].nums[i], measures[1].nums[i], String(labels[i] || '')]; })
          .filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); })
      });
    }

    // 5. Radar — multi-measure profile per category (small category count)
    if (measures.length >= 3 && categories.length && rows.length <= 8 && !dateCol) {
      charts.push({
        kind: 'radar',
        title: 'Multi-metric profile',
        role: 'profile', size: 'col-6', icon: 'target',
        indicators: measures.slice(0, 6).map(function (m) { return { name: m.name, max: (m.max || 1) * 1.15 }; }),
        series: labels.slice(0, 5).map(function (lab, i) {
          return { name: lab, data: measures.slice(0, 6).map(function (m) { return m.nums[i]; }) };
        })
      });
    }

    // 6. Stacked composition over time — additive measures across periods
    if (dateCol) {
      var additive = measures.filter(function (m) { return m.sub !== 'percent' && !/(total|nps|score|rate|margin)/i.test(m.name); });
      if (additive.length >= 2 && additive.length <= 5 && rows.length <= 16) {
        charts.push({
          kind: 'stacked',
          title: 'Composition over time',
          role: 'stacked', size: 'col-6', icon: 'chart',
          x: dateCol.values.map(String),
          series: additive.slice(0, 5).map(function (m) { return { name: m.name, data: m.nums, sub: m.sub }; })
        });
      }
    }

    // 7. Waterfall — period-over-period change for a finance-like measure
    if (dateCol && measures.length && rows.length >= 3 && rows.length <= 14) {
      var flowM = measures.find(function (m) { return /(profit|net|cash|flow|revenue|balance)/i.test(m.name) && m.sub !== 'percent'; });
      if (flowM) {
        var deltas = [];
        for (var wi = 1; wi < flowM.nums.length; wi++) deltas.push(round(flowM.nums[wi] - flowM.nums[wi - 1], 2));
        if (deltas.length >= 2) {
          charts.push({
            kind: 'waterfall',
            title: flowM.name + ' — period changes',
            role: 'waterfall', size: 'col-6', icon: 'trendUp',
            x: dateCol.values.slice(1).map(String),
            values: deltas, sub: flowM.sub
          });
        }
      }
    }

    // 8. Treemap — many categories, hierarchical share (alt to donut)
    if (!dateCol && categories.length && measures.length && rows.length > 6) {
      charts.push({
        kind: 'treemap',
        title: primaryDim.name + ' breakdown',
        role: 'hierarchy', size: 'col-6', icon: 'layout',
        labels: labels, data: measures[0].nums, sub: measures[0].sub
      });
    }

    // 9. Bubble — 3-measure relationship (x, y, size)
    if (!dateCol && measures.length >= 3 && rows.length >= 5) {
      charts.push({
        kind: 'bubble',
        title: measures[0].name + ' vs ' + measures[1].name + ' (size: ' + measures[2].name + ')',
        role: 'relationship', size: 'col-6', icon: 'target',
        xName: measures[0].name, yName: measures[1].name, sizeName: measures[2].name,
        points: rows.map(function (r, i) { return [measures[0].nums[i], measures[1].nums[i], Math.abs(measures[2].nums[i]) || 0, String(labels[i] || '')]; })
          .filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); })
      });
    }

    // 10. Funnel — stage/step data or a strictly-decreasing measure
    if (!dateCol && categories.length && measures.length) {
      // Require stage-like semantics (a descending ranking is NOT a funnel).
      var funnelName = /stage|step|funnel|phase|pipeline|conversion/i.test(primaryDim.name) ||
        /stage|step|funnel/i.test(measures[0].name);
      if (funnelName) {
        charts.unshift({
          kind: 'funnel', title: measures[0].name + ' by ' + primaryDim.name,
          role: 'funnel', size: 'col-6', icon: 'target',
          labels: primaryDim.values.map(String), data: measures[0].nums, sub: measures[0].sub
        });
      }
    }

    // 11. Sankey — source / target / value columns present
    var srcCol = cols.find(function (c) { return c.type === 'category' && /source|from|origin/i.test(c.name); });
    var tgtCol = cols.find(function (c) { return c.type === 'category' && /target|dest|to\b|toward/i.test(c.name); });
    if (srcCol && tgtCol && srcCol !== tgtCol && measures.length) {
      var vCol = measures[0], nodeSet = {}, links = [];
      rows.forEach(function (r, i) {
        var s = String(srcCol.values[i]), t = String(tgtCol.values[i]), v = vCol.nums[i];
        if (!s || !t || s === t || isNaN(v)) return;
        nodeSet[s] = 1; nodeSet[t] = 1; links.push({ source: s, target: t, value: Math.abs(v) });
      });
      var nodes = Object.keys(nodeSet).map(function (n) { return { name: n }; });
      if (nodes.length && links.length) {
        charts.unshift({ kind: 'sankey', title: srcCol.name + ' \u2192 ' + tgtCol.name, role: 'flow', size: 'col-8', icon: 'layout', nodes: nodes, links: links });
      }
    }

    // 12. Gantt — task + start + end columns present
    var startCol = cols.find(function (c) { return c.type === 'number' && /start|begin/i.test(c.name); });
    var endCol = cols.find(function (c) { return c.type === 'number' && /(end|finish|due|complete)/i.test(c.name); });
    if (startCol && endCol && categories.length) {
      var taskCol = categories[0];
      var tasks = rows.map(function (r, i) { return { name: String(taskCol.values[i]), start: startCol.nums[i], end: endCol.nums[i] }; })
        .filter(function (t) { return !isNaN(t.start) && !isNaN(t.end); });
      if (tasks.length) {
        var mn = Math.min.apply(null, tasks.map(function (t) { return t.start; }));
        var mx = Math.max.apply(null, tasks.map(function (t) { return t.end; }));
        charts.unshift({ kind: 'gantt', title: 'Timeline', role: 'timeline', size: 'col-8', icon: 'calendar', tasks: tasks, min: mn, max: mx });
      }
    }

    // 13. Risk matrix — probability/likelihood vs impact/severity
    var probCol = measures.find(function (m) { return /probab|likelihood|likely/i.test(m.name); });
    var impCol = measures.find(function (m) { return /impact|severity|conseq/i.test(m.name); });
    if (probCol && impCol && !dateCol) {
      var labelCol = categories[0] || primaryDim;
      var pts = rows.map(function (r, i) {
        return [probCol.nums[i], impCol.nums[i], String(labelCol.values[i] || ''), (probCol.nums[i] || 0) + (impCol.nums[i] || 0)];
      }).filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
      if (pts.length) {
        var xMax = Math.max(10, Math.ceil(Math.max.apply(null, pts.map(function (p) { return p[0]; }))));
        var yMax = Math.max(10, Math.ceil(Math.max.apply(null, pts.map(function (p) { return p[1]; }))));
        charts.unshift({ kind: 'riskmatrix', title: 'Risk matrix', role: 'risk', size: 'col-6', icon: 'alert', points: pts, xName: probCol.name, yName: impCol.name, xMax: xMax, yMax: yMax });
      }
    }

    // Cap to keep the dashboard focused; the trend/comparison chart always leads.
    return charts.slice(0, 6);
  }

  function buildInsights(cols, dateCol, measures, categories, primaryDim, rows, sigma) {
    var out = [];
    var labels = primaryDim ? primaryDim.values.map(String) : [];

    measures.slice(0, 4).forEach(function (m) {
      // Trend insight
      if (dateCol && m.change != null) {
        var dir = m.change >= 0;
        out.push({
          type: dir ? (m.change > 1 ? 'pos' : 'info') : 'neg',
          icon: dir ? 'trendUp' : 'trendDown',
          text: '<b>' + m.name + '</b> ' + (dir ? 'grew' : 'declined') + ' <b>' + fmtSigned(m.change) +
                '</b> from ' + labels[0] + ' to ' + labels[labels.length - 1] + '.'
        });
      }
      // Leader insight (categorical)
      if (!dateCol && m.nums.length) {
        var maxIdx = m.nums.indexOf(Math.max.apply(null, m.nums.filter(function (x) { return !isNaN(x); })));
        if (maxIdx >= 0) {
          var share = m.total ? (m.nums[maxIdx] / m.total * 100) : 0;
          out.push({
            type: 'info', icon: 'star',
            text: '<b>' + labels[maxIdx] + '</b> leads <b>' + m.name + '</b> with ' +
                  fmtNumber(m.nums[maxIdx], m.sub) + (m.sub !== 'percent' ? ' (' + round(share, 0) + '% of total)' : '') + '.'
          });
        }
      }
      // Anomaly insight
      if (m.stdev > 0 && m.nums.length > 3) {
        for (var i = 0; i < m.nums.length; i++) {
          var z = (m.nums[i] - m.avg) / m.stdev;
          if (Math.abs(z) >= sigma) {
            out.push({
              type: z > 0 ? 'warn' : 'neg', icon: 'alert',
              text: 'Outlier detected: <b>' + labels[i] + '</b> ' + m.name + ' of ' + fmtNumber(m.nums[i], m.sub) +
                    ' is ' + round(Math.abs(z), 1) + 'σ ' + (z > 0 ? 'above' : 'below') + ' average.'
            });
            break; // one anomaly per measure keeps it clean
          }
        }
      }
    });

    // Concentration insight
    if (!dateCol && measures.length && rows.length >= 3) {
      var m = measures[0];
      var sorted = m.nums.map(function (v, i) { return [v, labels[i]]; }).sort(function (a, b) { return b[0] - a[0]; });
      var topN = Math.max(1, Math.ceil(sorted.length * 0.3));
      var topSum = 0; for (var k = 0; k < topN; k++) topSum += sorted[k][0];
      var conc = m.total ? topSum / m.total * 100 : 0;
      if (conc > 55) out.push({
        type: 'warn', icon: 'alert',
        text: 'Concentration risk: the top ' + topN + ' account for <b>' + round(conc, 0) + '%</b> of ' + m.name + '.'
      });
    }

    if (!out.length) out.push({ type: 'info', icon: 'insight', text: 'Data loaded with ' + rows.length + ' records across ' + cols.length + ' fields.' });
    return out.slice(0, 6);
  }

  function buildNarrative(cols, dateCol, measures, categories, insights) {
    var parts = [];
    if (dateCol && measures.length) {
      var m = measures[0];
      var trendWord = m.change == null ? 'held steady' : (m.change >= 0 ? 'increased' : 'decreased');
      parts.push('Over the observed period, <b>' + m.name + '</b> ' + trendWord +
        (m.change != null ? ' by <b>' + fmtSigned(m.change) + '</b>' : '') +
        ', reaching ' + fmtNumber(m.last, m.sub) + ' in the latest period.');
      if (measures[1]) {
        var m2 = measures[1];
        parts.push('<b>' + m2.name + '</b> currently stands at ' + fmtNumber(m2.last, m2.sub) +
          (m2.change != null ? ' (' + fmtSigned(m2.change) + ' vs. start).' : '.'));
      }
    } else if (categories.length && measures.length) {
      var mm = measures[0];
      var idx = mm.nums.indexOf(Math.max.apply(null, mm.nums.filter(function (x) { return !isNaN(x); })));
      var labels = (dateCol || categories[0]).values.map(String);
      parts.push('Across ' + cols.filter(function(c){return c.type==='category';})[0].values.length +
        ' ' + categories[0].name.toLowerCase() + ' segments, <b>' + labels[idx] + '</b> is the strongest performer for <b>' +
        mm.name + '</b> at ' + fmtNumber(mm.nums[idx], mm.sub) + '.');
      parts.push('Total <b>' + mm.name + '</b> across all segments is ' + fmtNumber(mm.total, mm.sub) + '.');
    } else {
      parts.push('The dataset contains ' + measures.length + ' quantitative measures ready for analysis.');
    }

    var negatives = insights.filter(function (i) { return i.type === 'neg' || i.type === 'warn'; });
    if (negatives.length) parts.push('Areas needing attention were flagged — see key findings below.');

    // recommendations
    var recs = [];
    measures.slice(0, 3).forEach(function (m) {
      if (dateCol && m.change != null) {
        if (m.change < 0) recs.push('Investigate the decline in ' + m.name + ' and define a recovery plan for the next period.');
        else if (m.change > 20) recs.push('Sustain the momentum in ' + m.name + ' by reinforcing the drivers behind recent growth.');
      }
    });
    var conc = insights.find(function (i) { return /Concentration/.test(i.text); });
    if (conc) recs.push('Diversify to reduce concentration risk highlighted in the key findings.');
    var anomaly = insights.find(function (i) { return /Outlier/.test(i.text); });
    if (anomaly) recs.push('Validate the flagged outlier — confirm whether it reflects a data issue or a real event.');
    if (recs.length < 3) recs.push('Set explicit targets for each KPI and review progress on a regular cadence.');
    if (recs.length < 3) recs.push('Share this dashboard with stakeholders to align on priorities and next steps.');

    return { summary: parts.join(' '), recommendations: recs.slice(0, 4) };
  }

  /* ----------------------------- AI plan support ----------------------------- */

  // Compact description of the data for the AI to design a dashboard from.
  function describe(table) {
    var cols = table.columns.map(function (name) {
      var values = table.rows.map(function (r) { return r[name]; });
      var t = detectColumnType(values);
      var low = name.toLowerCase();
      if (t.type === 'number') {
        if (/(rate|margin|%|percent|share|ratio|util)/.test(low) && t.sub === 'number') t.sub = 'percent';
        if (/(revenue|sales|cost|expense|profit|budget|price|cash|amount|\$|usd)/.test(low) && t.sub === 'number') t.sub = 'currency';
      }
      var d = { name: name, type: t.type, sub: t.sub };
      if (t.type === 'number') {
        var nums = values.map(cleanNumber).filter(function (x) { return !isNaN(x); });
        d.min = nums.length ? Math.min.apply(null, nums) : null;
        d.max = nums.length ? Math.max.apply(null, nums) : null;
        d.sample = nums.slice(0, 3);
      } else {
        d.sample = values.slice(0, 4).map(String);
        var uniq = {}; values.forEach(function (v) { if (String(v).trim()) uniq[String(v)] = 1; });
        d.distinct = Object.keys(uniq).length;
      }
      return d;
    });
    return { rows: table.rows.length, columns: cols };
  }

  // Build the analysis object from an AI-designed PLAN. The AI chooses structure
  // (which KPIs / charts / columns); we compute the real numbers from the data.
  function buildFromPlan(table, plan, opts) {
    var base = analyze(table, opts);                 // heuristic base = fallback + column metadata
    var byName = {}; base.columns.forEach(function (c) { byName[c.name] = c; });
    var lower = {}; base.columns.forEach(function (c) { lower[c.name.toLowerCase()] = c; });
    function col(name) { if (name == null) return null; return byName[name] || lower[String(name).toLowerCase().trim()] || null; }
    function nums(c) { return c.nums || (c.nums = c.values.map(cleanNumber)); }

    // KPIs — AI may provide direct values OR column+agg references
    var kpis = [];
    (plan.kpis || []).forEach(function (k) {
      // Direct value from AI (for multi-section/messy data where columns don't map cleanly)
      if (k.value !== undefined && k.value !== null && !k.column) {
        var val = typeof k.value === 'number' ? k.value : cleanNumber(String(k.value));
        var sub = k.sub || (/%/.test(String(k.value)) ? 'percent' : /\$/.test(String(k.value)) ? 'currency' : 'number');
        kpis.push({ label: k.label || 'Metric', value: isNaN(val) ? k.value : val, sub: sub, aggLabel: '', formatted: isNaN(val) ? String(k.value) : fmtNumber(val, sub), delta: k.delta || null, icon: pickKpiIcon(k.label || '', sub), spark: [], showSpark: false, hero: kpis.length === 0 });
        return;
      }
      // Column reference
      var c = col(k.column); if (!c || c.type !== 'number') return;
      var agg = String(k.agg || 'sum').toLowerCase();
      var valid = nums(c).filter(function (x) { return !isNaN(x); });
      if (!valid.length) return;
      var val;
      if (agg === 'avg' || agg === 'average' || agg === 'mean') val = mean(valid);
      else if (agg === 'last' || agg === 'latest') val = valid[valid.length - 1];
      else if (agg === 'min') val = Math.min.apply(null, valid);
      else if (agg === 'max') val = Math.max.apply(null, valid);
      else if (agg === 'count') val = valid.length;
      else val = sum(valid);
      var delta = null;
      if ((agg === 'last' || agg === 'latest') && valid.length > 1) delta = pctChange(valid[valid.length - 2], valid[valid.length - 1]);
      else if (base.dateCol && valid.length > 1) delta = pctChange(valid[0], valid[valid.length - 1]);
      kpis.push({ label: k.label || c.name, value: val, sub: c.sub, aggLabel: agg, formatted: fmtNumber(val, c.sub), delta: delta, icon: pickKpiIcon(c.name, c.sub), spark: valid, showSpark: !!base.dateCol, hero: kpis.length === 0 });
    });
    if (!kpis.length) kpis = base.kpis;

    // Charts
    var charts = [];
    (plan.charts || []).forEach(function (ch) {
      var dim = col(ch.dimension);
      var ms = (ch.measures || []).map(col).filter(function (m) { return m && m.type === 'number'; });
      if (!ms.length) return;
      var kind = String(ch.kind || 'bar').toLowerCase();
      var labels = dim ? dim.values.map(String) : ms[0].values.map(function (_, i) { return String(i + 1); });
      var title = ch.title || (ms[0].name + (dim ? ' by ' + dim.name : ''));
      if (kind === 'donut' || kind === 'pie') {
        charts.push({ kind: 'donut', title: title, role: 'composition', size: 'col-4', icon: 'percent', labels: labels, data: nums(ms[0]), sub: ms[0].sub });
      } else if (kind === 'scatter' && ms.length >= 2) {
        var pts = table.rows.map(function (r, i) { return [nums(ms[0])[i], nums(ms[1])[i], String(labels[i] || '')]; }).filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]); });
        charts.push({ kind: 'scatter', title: title, role: 'relationship', size: 'col-6', icon: 'target', xName: ms[0].name, yName: ms[1].name, points: pts });
      } else if (kind === 'radar') {
        charts.push({ kind: 'radar', title: title, role: 'profile', size: 'col-6', icon: 'target', indicators: ms.map(function (m) { return { name: m.name, max: (m.max || Math.max.apply(null, nums(m).filter(function (x) { return !isNaN(x); })) || 1) * 1.15 }; }), series: labels.slice(0, 5).map(function (lab, i) { return { name: lab, data: ms.map(function (m) { return nums(m)[i]; }) }; }) });
      } else if (kind === 'hbar') {
        charts.push({ kind: 'hbar', title: title, role: 'comparison', size: 'col-8', icon: 'chart', x: labels, series: [{ name: ms[0].name, data: nums(ms[0]), sub: ms[0].sub }] });
      } else if (kind === 'stacked') {
        charts.push({ kind: 'stacked', title: title, role: 'stacked', size: 'col-6', icon: 'chart', x: labels, series: ms.map(function (m) { return { name: m.name, data: nums(m), sub: m.sub }; }) });
      } else if (kind === 'line' || kind === 'area') {
        charts.push({ kind: ms.length > 1 ? 'line' : 'area', title: title, role: 'trend', size: 'col-8', icon: 'trendUp', x: labels, series: ms.slice(0, 4).map(function (m) { return { name: m.name, data: nums(m), sub: m.sub }; }) });
      } else {
        charts.push({ kind: 'bar', title: title, role: 'comparison', size: 'col-8', icon: 'chart', x: labels, series: [{ name: ms[0].name, data: nums(ms[0]), sub: ms[0].sub }] });
      }
    });
    if (!charts.length) charts = base.charts;
    charts = charts.slice(0, 6);

    var insights = (Array.isArray(plan.insights) && plan.insights.length) ? plan.insights.map(function (i) {
      var type = String(i.type || 'info').toLowerCase();
      var icon = type === 'pos' ? 'trendUp' : type === 'neg' ? 'trendDown' : type === 'warn' ? 'alert' : 'insight';
      return { type: ['pos', 'neg', 'warn', 'info'].indexOf(type) !== -1 ? type : 'info', icon: icon, text: String(i.text) };
    }).slice(0, 6) : base.insights;
    var recommendations = (Array.isArray(plan.recommendations) && plan.recommendations.length) ? plan.recommendations.map(String).slice(0, 5) : base.recommendations;
    var summary = (typeof plan.summary === 'string' && plan.summary.trim()) ? plan.summary : base.summary;

    return Object.assign({}, base, {
      kpis: kpis, charts: charts, insights: insights, recommendations: recommendations, summary: summary,
      headline: plan.headline || base.headline, tagline: plan.tagline || base.tagline,
      title: plan.title || base.title, aiEnhanced: true, aiPlanned: true
    });
  }

  /* ----------------------------- Export ----------------------------- */
  window.VIS.engine = {
    parse: parse,
    detectFormat: detectFormat,
    analyze: analyze,
    describe: describe,
    buildFromPlan: buildFromPlan,
    fmtNumber: fmtNumber,
    fmtSigned: fmtSigned,
    cleanNumber: cleanNumber
  };
})();
