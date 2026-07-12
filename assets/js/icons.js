/* VIS · Icon set (inline SVG, no dependency). Lucide-style strokes. */
(function () {
  var S = function (p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  };
  var ICONS = {
    home: S('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
    studio: S('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 8l4 4-4 4"/><path d="M14 16h2"/>'),
    dashboard: S('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    templates: S('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>'),
    settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.2a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.8 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.4V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.8a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.3z"/>'),
    menu: S('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    moon: S('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'),
    sun: S('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>'),
    spark: S('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8l1.6 2.4L16 12l-2.4 1.6L12 16l-1.6-2.4L8 12l2.4-1.6z"/>'),
    play: S('<path d="M6 4l14 8-14 8z"/>'),
    brain: S('<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 5 1V4a1 1 0 0 0-1-1z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-5 1"/>'),
    chart: S('<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>'),
    layout: S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
    insight: S('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>'),
    palette: S('<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.3 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
    export: S('<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>'),
    trash: S('<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>'),
    edit: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    refresh: S('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    image: S('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    pdf: S('<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v5h5"/><path d="M8 13h1.5a1.5 1.5 0 0 1 0 3H8v-3zM8 16v2"/>'),
    print: S('<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M8 17h8v4H8z"/>'),
    code: S('<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>'),
    trendUp: S('<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>'),
    trendDown: S('<path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/>'),
    alert: S('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    check: S('<path d="M20 6L9 17l-5-5"/>'),
    target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
    money: S('<circle cx="12" cy="12" r="9"/><path d="M15 9.5a2.5 2.5 0 0 0-2.5-1.5h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1A2.5 2.5 0 0 1 9 14.5M12 6.5v11"/>'),
    users: S('<circle cx="9" cy="8" r="3.2"/><path d="M2.5 21a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21.5 21a5.5 5.5 0 0 0-3.5-5"/>'),
    box: S('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
    calendar: S('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    flag: S('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    star: S('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9 6.8 19.2l1-5.9L3.5 9.2l5.9-.9z"/>'),
    percent: S('<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>'),
    ai: S('<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="M9 15h6"/><path d="M12 2v2M12 20v2"/>'),
    briefcase: S('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>')
  };

  window.VIS = window.VIS || {};
  window.VIS.icon = function (name) { return ICONS[name] || ICONS.box; };

  // Hydrate any element carrying a data-ic attribute.
  window.VIS.hydrateIcons = function (root) {
    (root || document).querySelectorAll('[data-ic]').forEach(function (el) {
      var n = el.getAttribute('data-ic');
      if (n && !el.getAttribute('data-hydrated')) {
        el.innerHTML = window.VIS.icon(n);
        el.setAttribute('data-hydrated', '1');
      }
    });
  };
})();
