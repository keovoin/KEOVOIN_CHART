/* =========================================================================
   VIS · Chart layer (ECharts config builders)
   Reads CSS variables so charts match the active theme + light/dark mode.
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var instances = [];

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function palette() {
    var raw = cssVar('--chart-palette', '#0071e3,#34c759,#ff9500');
    return raw.split(',').map(function (s) { return s.trim(); });
  }
  function themeColors() {
    return {
      text: cssVar('--text', '#0b1220'),
      text2: cssVar('--text-2', '#475569'),
      text3: cssVar('--text-3', '#94a3b8'),
      line: cssVar('--line', 'rgba(0,0,0,.08)'),
      accent: cssVar('--accent', '#0071e3'),
      accent2: cssVar('--accent-2', '#34c759'),
      surface: cssVar('--surface', '#fff')
    };
  }
  function fmt(n, sub) { return window.VIS.engine.fmtNumber(n, sub); }

  function baseGrid() { return { left: 8, right: 16, top: 24, bottom: 8, containLabel: true }; }

  function tooltip(c) {
    return {
      trigger: 'axis',
      backgroundColor: c.surface,
      borderColor: c.line,
      borderWidth: 1,
      textStyle: { color: c.text, fontSize: 12, fontFamily: 'Inter' },
      extraCssText: 'border-radius:12px;box-shadow:0 12px 32px -12px rgba(0,0,0,.3);padding:10px 12px;'
    };
  }

  function axisLabel(c) { return { color: c.text3, fontSize: 11, fontFamily: 'Inter' }; }
  function splitLine(c) { return { lineStyle: { color: c.line, type: 'dashed' } }; }

  // Data-value label (respects the Settings "Data labels" toggle; on by default)
  function labelsOn() { return !(window.VIS && window.VIS.settings && window.VIS.settings.labels === false); }
  function valLabel(c, sub, position, color) {
    return {
      show: labelsOn(), position: position || 'top',
      color: color || c.text2, fontSize: 10, fontWeight: 600, fontFamily: 'Inter',
      formatter: function (p) { return fmt(p.value, sub); }
    };
  }

  var Builders = {
    area: function (spec, c, pal, anim) {
      return {
        color: pal, grid: baseGrid(), tooltip: tooltip(c),
        xAxis: { type: 'category', data: spec.x, boundaryGap: false, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: axisLabel(c) },
        yAxis: { type: 'value', splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return fmt(v, spec.series[0].sub); } }, axisLabel(c)) },
        series: spec.series.map(function (s, i) {
          return {
            name: s.name, type: 'line', smooth: true, showSymbol: false, data: s.data,
            lineStyle: { width: 3 },
            label: valLabel(c, s.sub, 'top'), labelLayout: { hideOverlap: true },
            areaStyle: { opacity: 0.18, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: pal[i % pal.length] }, { offset: 1, color: 'transparent' }]) },
            animationDuration: anim ? 900 : 0
          };
        })
      };
    },

    line: function (spec, c, pal, anim) {
      return {
        color: pal, grid: baseGrid(), tooltip: tooltip(c),
        legend: { top: 0, right: 0, textStyle: { color: c.text2, fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
        xAxis: { type: 'category', data: spec.x, boundaryGap: false, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: axisLabel(c) },
        yAxis: { type: 'value', splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return fmt(v); } }, axisLabel(c)) },
        series: spec.series.map(function (s) {
          return { name: s.name, type: 'line', smooth: true, showSymbol: false, symbolSize: 6, data: s.data, lineStyle: { width: 2.5 }, label: valLabel(c, s.sub, 'top'), labelLayout: { hideOverlap: true }, emphasis: { focus: 'series' }, animationDuration: anim ? 900 : 0 };
        })
      };
    },

    bar: function (spec, c, pal, anim) {
      return {
        color: pal, grid: baseGrid(), tooltip: Object.assign(tooltip(c), { trigger: 'axis', axisPointer: { type: 'shadow' } }),
        xAxis: { type: 'category', data: spec.x, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: Object.assign({ interval: 0, rotate: spec.x.length > 6 ? 30 : 0 }, axisLabel(c)) },
        yAxis: { type: 'value', splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return fmt(v, spec.series[0].sub); } }, axisLabel(c)) },
        series: spec.series.map(function (s) {
          return { name: s.name, type: 'bar', data: s.data, barMaxWidth: 44, label: valLabel(c, s.sub, 'top'), labelLayout: { hideOverlap: true }, itemStyle: { borderRadius: [8, 8, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: pal[0] }, { offset: 1, color: pal[1] || pal[0] }]) }, animationDuration: anim ? 800 : 0 };
        })
      };
    },

    hbar: function (spec, c, pal, anim) {
      var pairs = spec.x.map(function (label, i) { return [label, spec.series[0].data[i]]; }).sort(function (a, b) { return a[1] - b[1]; });
      return {
        color: pal, grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true }, tooltip: Object.assign(tooltip(c), { axisPointer: { type: 'shadow' } }),
        xAxis: { type: 'value', splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return fmt(v, spec.series[0].sub); } }, axisLabel(c)) },
        yAxis: { type: 'category', data: pairs.map(function (p) { return p[0]; }), axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: axisLabel(c) },
        series: [{ type: 'bar', data: pairs.map(function (p) { return p[1]; }), barMaxWidth: 22, label: valLabel(c, spec.series[0].sub, 'right'), itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: pal[1] || pal[0] }, { offset: 1, color: pal[0] }]) }, animationDuration: anim ? 800 : 0 }]
      };
    },

    donut: function (spec, c, pal, anim) {
      var data = spec.labels.map(function (l, i) { return { name: l, value: Math.abs(spec.data[i]) || 0 }; });
      return {
        color: pal, tooltip: { trigger: 'item', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return p.name + ': <b>' + fmt(p.value, spec.sub) + '</b> (' + p.percent + '%)'; } },
        legend: { bottom: 0, left: 'center', textStyle: { color: c.text2, fontSize: 11 }, icon: 'circle', itemWidth: 9, itemHeight: 9 },
        series: [{
          type: 'pie', radius: ['52%', '74%'], center: ['50%', '44%'], avoidLabelOverlap: true,
          itemStyle: { borderColor: c.surface, borderWidth: 3, borderRadius: 6 },
          label: { show: labelsOn(), formatter: '{d}%', fontSize: 11, fontWeight: 600, color: c.text2 },
          labelLine: { show: labelsOn(), length: 8, length2: 8 },
          emphasis: { scale: true, scaleSize: 6, label: { show: true, formatter: '{b}\n{d}%', fontSize: 15, fontWeight: 700, color: c.text } },
          data: data, animationType: 'scale', animationDuration: anim ? 800 : 0
        }]
      };
    },

    scatter: function (spec, c, pal, anim) {
      return {
        color: pal, grid: baseGrid(), tooltip: { trigger: 'item', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return (p.data[2] || '') + '<br/>' + spec.xName + ': <b>' + fmt(p.data[0]) + '</b><br/>' + spec.yName + ': <b>' + fmt(p.data[1]) + '</b>'; } },
        xAxis: { type: 'value', name: spec.xName, nameTextStyle: { color: c.text3, fontSize: 11 }, splitLine: splitLine(c), axisLabel: axisLabel(c) },
        yAxis: { type: 'value', name: spec.yName, nameTextStyle: { color: c.text3, fontSize: 11 }, splitLine: splitLine(c), axisLabel: axisLabel(c) },
        series: [{ type: 'scatter', symbolSize: 14, data: spec.points, itemStyle: { color: pal[0], opacity: 0.75, borderColor: '#fff', borderWidth: 1 }, animationDuration: anim ? 700 : 0 }]
      };
    },

    radar: function (spec, c, pal, anim) {
      return {
        color: pal, tooltip: { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;' },
        legend: { bottom: 0, textStyle: { color: c.text2, fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
        radar: { indicator: spec.indicators, center: ['50%', '46%'], radius: '62%', axisName: { color: c.text2, fontSize: 11 }, splitLine: { lineStyle: { color: c.line } }, splitArea: { areaStyle: { color: ['transparent'] } }, axisLine: { lineStyle: { color: c.line } } },
        series: [{ type: 'radar', data: spec.series.map(function (s) { return { name: s.name, value: s.data, areaStyle: { opacity: 0.1 }, lineStyle: { width: 2 } }; }), animationDuration: anim ? 800 : 0 }]
      };
    },

    spark: function (spec, c, pal, anim) {
      var data = spec.series[0].data;
      var up = data.length > 1 && data[data.length - 1] >= data[0];
      var color = up ? c.accent : (cssVar('--neg', '#dc2626'));
      return {
        grid: { left: 2, right: 2, top: 4, bottom: 2 },
        xAxis: { type: 'category', show: false, boundaryGap: false, data: spec.series[0].data.map(function (_, i) { return i; }) },
        yAxis: { type: 'value', show: false, scale: true },
        tooltip: { show: false },
        series: [{
          type: 'line', data: data, smooth: true, showSymbol: false,
          lineStyle: { width: 2, color: color },
          areaStyle: { opacity: 0.16, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: color }, { offset: 1, color: 'transparent' }]) },
          animationDuration: anim ? 800 : 0
        }]
      };
    },

    gauge: function (spec, c, pal, anim) {
      return {
        series: [{
          type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: spec.max || 100, radius: '92%', center: ['50%', '58%'],
          progress: { show: true, width: 14, roundCap: true, itemStyle: { color: pal[0] } },
          axisLine: { lineStyle: { width: 14, color: [[1, c.line]] } },
          axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
          anchor: { show: false }, title: { show: false },
          detail: { valueAnimation: true, offsetCenter: [0, 0], fontSize: 30, fontWeight: 800, color: c.text, formatter: function (v) { return Math.round(v) + (spec.sub === 'percent' ? '%' : ''); } },
          data: [{ value: spec.value }], animationDuration: anim ? 1200 : 0
        }]
      };
    },

    funnel: function (spec, c, pal, anim) {
      var data = spec.labels.map(function (l, i) { return { name: l, value: Math.abs(spec.data[i]) || 0 }; });
      return {
        color: pal,
        tooltip: { trigger: 'item', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return p.name + ': <b>' + fmt(p.value, spec.sub) + '</b>'; } },
        series: [{
          type: 'funnel', left: '6%', right: '6%', top: 12, bottom: 12, minSize: '24%', maxSize: '100%',
          sort: 'descending', gap: 3, funnelAlign: 'center',
          label: { show: true, position: 'inside', color: '#fff', fontSize: 12, fontWeight: 600, formatter: '{b}' },
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          emphasis: { label: { fontSize: 14 } }, data: data, animationDuration: anim ? 800 : 0
        }]
      };
    },

    sankey: function (spec, c, pal, anim) {
      return {
        color: pal,
        tooltip: { trigger: 'item', triggerOn: 'mousemove', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;' },
        series: [{
          type: 'sankey', left: 8, right: 8, top: 12, bottom: 12,
          data: spec.nodes, links: spec.links, nodeGap: 12, nodeWidth: 14,
          emphasis: { focus: 'adjacency' },
          label: { color: c.text2, fontSize: 11, fontFamily: 'Inter' },
          lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
          itemStyle: { borderWidth: 0 }, animationDuration: anim ? 900 : 0
        }]
      };
    },

    gantt: function (spec, c, pal, anim) {
      // spec.tasks: [{name, start, end}] on a numeric timeline; invisible offset + duration bar
      var names = spec.tasks.map(function (t) { return t.name; });
      var base = spec.tasks.map(function (t) { return t.start; });
      var dur = spec.tasks.map(function (t) { return Math.max(0, t.end - t.start); });
      return {
        grid: { left: 8, right: 24, top: 10, bottom: 8, containLabel: true },
        tooltip: { trigger: 'item', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { if (p.seriesIndex === 0) return ''; var t = spec.tasks[p.dataIndex]; return '<b>' + t.name + '</b><br/>' + (spec.unit || '') + t.start + ' → ' + (spec.unit || '') + t.end; } },
        xAxis: { type: 'value', min: spec.min, max: spec.max, splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return (spec.unit || '') + v; } }, axisLabel(c)) },
        yAxis: { type: 'category', data: names, inverse: true, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: axisLabel(c) },
        series: [
          { type: 'bar', stack: 'g', itemStyle: { color: 'transparent' }, data: base, silent: true },
          { type: 'bar', stack: 'g', barMaxWidth: 20, data: dur, itemStyle: { borderRadius: 5, color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: pal[0] }, { offset: 1, color: pal[1] || pal[0] }]) }, animationDuration: anim ? 800 : 0 }
        ]
      };
    },

    stacked: function (spec, c, pal, anim) {
      return {
        color: pal, grid: baseGrid(), tooltip: Object.assign(tooltip(c), { axisPointer: { type: 'shadow' } }),
        legend: { top: 0, right: 0, textStyle: { color: c.text2, fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
        xAxis: { type: 'category', data: spec.x, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: Object.assign({ interval: 0, rotate: spec.x.length > 6 ? 30 : 0 }, axisLabel(c)) },
        yAxis: { type: 'value', splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return fmt(v); } }, axisLabel(c)) },
        series: spec.series.map(function (s, i) {
          return { name: s.name, type: 'bar', stack: 'total', data: s.data, barMaxWidth: 46, label: valLabel(c, s.sub, 'inside', '#fff'), labelLayout: { hideOverlap: true }, itemStyle: { borderRadius: i === spec.series.length - 1 ? [6, 6, 0, 0] : 0, color: pal[i % pal.length] }, emphasis: { focus: 'series' }, animationDuration: anim ? 800 : 0 };
        })
      };
    },

    waterfall: function (spec, c, pal, anim) {
      // spec.x labels, spec.values deltas; builds an invisible base + colored bars
      var running = 0, base = [], vals = [], colors = [];
      spec.values.forEach(function (v) {
        if (v >= 0) { base.push(running); vals.push(v); colors.push(pal[1] || c.accent2); }
        else { base.push(running + v); vals.push(-v); colors.push(cssVar('--neg', '#dc2626')); }
        running += v;
      });
      // final total bar
      var x = spec.x.concat(['Total']);
      base.push(0); vals.push(running); colors.push(c.accent);
      return {
        grid: baseGrid(), tooltip: Object.assign(tooltip(c), { axisPointer: { type: 'shadow' }, formatter: function (p) { var i = p[1].dataIndex; return x[i] + ': <b>' + fmt(i < spec.values.length ? spec.values[i] : running, spec.sub) + '</b>'; } }),
        xAxis: { type: 'category', data: x, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: Object.assign({ interval: 0, rotate: x.length > 6 ? 30 : 0 }, axisLabel(c)) },
        yAxis: { type: 'value', splitLine: splitLine(c), axisLabel: Object.assign({ formatter: function (v) { return fmt(v, spec.sub); } }, axisLabel(c)) },
        series: [
          { type: 'bar', stack: 'w', itemStyle: { color: 'transparent' }, data: base, silent: true },
          { type: 'bar', stack: 'w', barMaxWidth: 44, label: valLabel(c, spec.sub, 'top'), labelLayout: { hideOverlap: true }, data: vals.map(function (v, i) { return { value: v, itemStyle: { color: colors[i], borderRadius: 4 } }; }), animationDuration: anim ? 800 : 0 }
        ]
      };
    },

    treemap: function (spec, c, pal, anim) {
      var data = spec.labels.map(function (l, i) { return { name: l, value: Math.abs(spec.data[i]) || 0 }; });
      return {
        tooltip: { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return p.name + ': <b>' + fmt(p.value, spec.sub) + '</b>'; } },
        series: [{
          type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, width: '100%', height: '100%', top: 6, left: 0, right: 0, bottom: 6,
          itemStyle: { borderColor: c.surface, borderWidth: 3, gapWidth: 3, borderRadius: 6 },
          label: { show: true, formatter: function (p) { return labelsOn() ? (p.name + '\n' + fmt(p.value, spec.sub)) : p.name; }, color: '#fff', fontSize: 12, fontWeight: 600 },
          color: pal, data: data, animationDuration: anim ? 800 : 0
        }]
      };
    },

    heatmap: function (spec, c, pal, anim) {
      // spec.xLabels, spec.yLabels, spec.points [[xIdx,yIdx,value]]
      var vals = spec.points.map(function (p) { return p[2]; });
      var maxV = vals.length ? Math.max.apply(null, vals) : 1;
      var minV = vals.length ? Math.min.apply(null, vals) : 0;
      return {
        grid: { left: 8, right: 8, top: 8, bottom: 60, containLabel: true },
        tooltip: { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return spec.yLabels[p.data[1]] + ' · ' + spec.xLabels[p.data[0]] + ': <b>' + fmt(p.data[2], spec.sub) + '</b>'; } },
        xAxis: { type: 'category', data: spec.xLabels, splitArea: { show: true }, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: Object.assign({ rotate: spec.xLabels.length > 6 ? 30 : 0 }, axisLabel(c)) },
        yAxis: { type: 'category', data: spec.yLabels, splitArea: { show: true }, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false }, axisLabel: axisLabel(c) },
        visualMap: { min: minV, max: maxV, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: c.text3, fontSize: 10 }, inRange: { color: [cssVar('--surface-2', '#f1f5f9'), pal[0]] } },
        series: [{ type: 'heatmap', data: spec.points, label: { show: false }, itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 4 }, animationDuration: anim ? 700 : 0 }]
      };
    },

    bubble: function (spec, c, pal, anim) {
      var sizes = spec.points.map(function (p) { return p[2]; });
      var maxS = sizes.length ? Math.max.apply(null, sizes) : 1;
      return {
        color: pal, grid: baseGrid(),
        tooltip: { trigger: 'item', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return (p.data[3] || '') + '<br/>' + spec.xName + ': <b>' + fmt(p.data[0]) + '</b><br/>' + spec.yName + ': <b>' + fmt(p.data[1]) + '</b><br/>' + spec.sizeName + ': <b>' + fmt(p.data[2]) + '</b>'; } },
        xAxis: { type: 'value', name: spec.xName, nameTextStyle: { color: c.text3, fontSize: 11 }, splitLine: splitLine(c), axisLabel: axisLabel(c) },
        yAxis: { type: 'value', name: spec.yName, nameTextStyle: { color: c.text3, fontSize: 11 }, splitLine: splitLine(c), axisLabel: axisLabel(c) },
        series: [{ type: 'scatter', symbolSize: function (d) { return 12 + (d[2] / maxS) * 44; }, data: spec.points, itemStyle: { color: pal[0], opacity: 0.6, borderColor: '#fff', borderWidth: 1 }, animationDuration: anim ? 800 : 0 }]
      };
    },

    riskmatrix: function (spec, c, pal, anim) {
      // points: [x(prob), y(impact), label, severity]
      return {
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        tooltip: { trigger: 'item', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'border-radius:12px;padding:10px 12px;', formatter: function (p) { return '<b>' + (p.data[2] || '') + '</b><br/>' + spec.xName + ': ' + p.data[0] + '<br/>' + spec.yName + ': ' + p.data[1]; } },
        xAxis: { type: 'value', name: spec.xName, min: 0, max: spec.xMax, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: c.text3, fontSize: 11 }, splitLine: splitLine(c), axisLabel: axisLabel(c) },
        yAxis: { type: 'value', name: spec.yName, min: 0, max: spec.yMax, nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: c.text3, fontSize: 11 }, splitLine: splitLine(c), axisLabel: axisLabel(c) },
        visualMap: { show: false, dimension: 3, min: 2, max: (spec.xMax + spec.yMax), inRange: { color: ['#16a34a', '#eab308', '#dc2626'] } },
        series: [{
          type: 'scatter', symbolSize: 24, data: spec.points,
          label: { show: true, formatter: function (p) { return p.data[2]; }, position: 'right', fontSize: 10, color: c.text2 },
          itemStyle: { opacity: 0.9, borderColor: c.surface, borderWidth: 1.5 },
          animationDuration: anim ? 700 : 0
        }]
      };
    }
  };

  function build(spec, node) {
    if (typeof echarts === 'undefined') { node.innerHTML = '<div style="padding:20px;color:var(--text-3);font-size:13px">Chart library failed to load (offline?).</div>'; return null; }
    var c = themeColors();
    var pal = palette();
    var anim = window.VIS.settings ? window.VIS.settings.anim : true;
    var builder = Builders[spec.kind] || Builders.bar;
    var option = builder(spec, c, pal, anim);
    var chart = echarts.init(node, null, { renderer: 'canvas' });
    chart.setOption(option);
    instances.push(chart);
    return chart;
  }

  function resizeAll() { instances.forEach(function (ch) { try { ch.resize(); } catch (e) {} }); }
  function disposeAll() { instances.forEach(function (ch) { try { ch.dispose(); } catch (e) {} }); instances = []; }

  window.addEventListener('resize', function () { clearTimeout(window.__visRz); window.__visRz = setTimeout(resizeAll, 120); });

  // Copy a chart instance to the clipboard as a PNG image (fallback: download).
  function copyChart(chart, title, btn) {
    if (!chart || typeof chart.getDataURL !== 'function') { window.VIS.toast && window.VIS.toast('Chart not ready yet'); return; }
    var bg = cssVar('--surface', '#ffffff');
    var url;
    try { url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: bg }); }
    catch (e) { window.VIS.toast && window.VIS.toast('Could not render image'); return; }
    var name = (title || 'chart').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.png';
    function download() { var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); window.VIS.toast && window.VIS.toast('Copy unsupported here — downloaded PNG instead'); }
    if (navigator.clipboard && window.ClipboardItem) {
      fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
        return navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      }).then(function () {
        window.VIS.toast && window.VIS.toast('Chart copied — paste it anywhere');
        if (btn) { btn.classList.add('copied'); setTimeout(function () { btn.classList.remove('copied'); }, 1200); }
      }).catch(function () { download(); });
    } else { download(); }
  }

  window.VIS.charts = { build: build, resizeAll: resizeAll, disposeAll: disposeAll, copyChart: copyChart, Builders: Builders };
})();
