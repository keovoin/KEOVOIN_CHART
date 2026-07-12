/* =========================================================================
   VIS · In-place dashboard editor
   Edit mode adds per-card controls: drag to reorder, resize width, duplicate,
   delete. Undo/redo via a command stack (keeps live chart canvases intact).
   ========================================================================= */
(function () {
  window.VIS = window.VIS || {};
  var WIDTHS = [3, 4, 6, 8, 12];
  var active = false;
  var undoStack = [], redoStack = [];
  var dragEl = null;

  function board() { return document.getElementById('dashboard'); }
  function cards() { return Array.prototype.slice.call(board().querySelectorAll(':scope > .card')); }
  function colOf(card) { var m = (card.className.match(/col-(\d+)/) || [])[1]; return m ? +m : 6; }
  function setCol(card, n) { card.className = card.className.replace(/col-\d+/, 'col-' + n); if (!/col-\d+/.test(card.className)) card.classList.add('col-' + n); resize(card); }
  function resize(card) { setTimeout(function () { VIS.charts && VIS.charts.resizeAll(); }, 60); }

  function pushCmd(cmd) { undoStack.push(cmd); redoStack.length = 0; updateButtons(); }

  function enable() {
    if (active) return; active = true;
    board().classList.add('editing');
    cards().forEach(decorate);
    updateButtons();
  }
  function disable() {
    if (!active) return; active = false;
    board().classList.remove('editing');
    board().querySelectorAll('.card-edit-bar').forEach(function (b) { b.remove(); });
    cards().forEach(function (c) { c.removeAttribute('draggable'); });
  }
  function toggle() { active ? disable() : enable(); return active; }

  function decorate(card) {
    if (card.querySelector('.card-edit-bar')) return;
    card.setAttribute('draggable', 'true');
    var bar = document.createElement('div');
    bar.className = 'card-edit-bar';
    bar.innerHTML =
      '<span class="ce-grip" data-ic="grip" title="Drag to move"></span>' +
      '<span class="ce-spacer"></span>' +
      '<button class="ce-btn" data-ce="shrink" title="Narrower"><span data-ic="minus"></span></button>' +
      '<button class="ce-btn" data-ce="grow" title="Wider"><span data-ic="plus"></span></button>' +
      '<button class="ce-btn" data-ce="dup" title="Duplicate"><span data-ic="copy"></span></button>' +
      '<button class="ce-btn danger" data-ce="del" title="Delete"><span data-ic="trash"></span></button>';
    card.insertBefore(bar, card.firstChild);
    VIS.hydrateIcons(bar);

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-ce]'); if (!btn) return;
      e.stopPropagation();
      var act = btn.getAttribute('data-ce');
      if (act === 'grow') widthStep(card, +1);
      else if (act === 'shrink') widthStep(card, -1);
      else if (act === 'dup') duplicate(card);
      else if (act === 'del') del(card);
    });

    // drag events
    card.addEventListener('dragstart', function (e) { if (!active) return; dragEl = card; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} });
    card.addEventListener('dragend', function () { card.classList.remove('dragging'); dragEl = null; });
  }

  function widthStep(card, dir) {
    var cur = colOf(card);
    var idx = WIDTHS.indexOf(cur);
    if (idx === -1) { // snap to nearest
      idx = 0; for (var i = 0; i < WIDTHS.length; i++) if (Math.abs(WIDTHS[i] - cur) < Math.abs(WIDTHS[idx] - cur)) idx = i;
    }
    var ni = Math.max(0, Math.min(WIDTHS.length - 1, idx + dir));
    if (WIDTHS[ni] === cur) return;
    var oldN = cur, newN = WIDTHS[ni];
    setCol(card, newN);
    pushCmd({ undo: function () { setCol(card, oldN); }, redo: function () { setCol(card, newN); } });
  }

  function duplicate(card) {
    var clone = card.cloneNode(true);
    // strip the edit bar copied into clone; re-decorate fresh
    var b = clone.querySelector('.card-edit-bar'); if (b) b.remove();
    card.parentNode.insertBefore(clone, card.nextSibling);
    // rebuild chart if this card had one
    if (card._spec) {
      clone._spec = card._spec;
      var node = clone.querySelector('.chart');
      if (node) { node.innerHTML = ''; node.removeAttribute('_echarts_instance_'); requestAnimationFrame(function () { VIS.charts.build(card._spec, node); }); }
    }
    if (active) decorate(clone);
    pushCmd({
      undo: function () { if (clone.parentNode) clone.parentNode.removeChild(clone); },
      redo: function () { card.parentNode.insertBefore(clone, card.nextSibling); if (card._spec) { var n = clone.querySelector('.chart'); if (n) { n.innerHTML = ''; VIS.charts.build(card._spec, n); } } if (active) decorate(clone); }
    });
    VIS.toast && VIS.toast('Card duplicated');
  }

  function del(card) {
    var parent = card.parentNode, nextSib = card.nextSibling;
    parent.removeChild(card);
    pushCmd({
      undo: function () { parent.insertBefore(card, nextSib); if (card._spec) { var n = card.querySelector('.chart'); if (n) { n.innerHTML = ''; VIS.charts.build(card._spec, n); } } },
      redo: function () { if (card.parentNode) card.parentNode.removeChild(card); }
    });
    VIS.toast && VIS.toast('Card removed');
  }

  // reorder on drag over the board
  function initBoardDnd() {
    var b = board(); if (!b || b._dndInit) return; b._dndInit = true;
    b.addEventListener('dragover', function (e) {
      if (!active || !dragEl) return;
      e.preventDefault();
      var after = afterElement(b, e.clientX, e.clientY);
      var before = dragEl.previousSibling;
      if (after == null) b.appendChild(dragEl);
      else if (after !== dragEl) b.insertBefore(dragEl, after);
    });
    b.addEventListener('drop', function (e) {
      if (!active || !dragEl) return; e.preventDefault();
      resize(dragEl);
      // reorder undo is coarse: snapshot order
    });
  }

  function afterElement(container, x, y) {
    var els = Array.prototype.slice.call(container.querySelectorAll(':scope > .card:not(.dragging)'));
    var closest = { dist: -Infinity, el: null };
    els.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offX = x - (box.left + box.width / 2);
      var offY = y - (box.top + box.height / 2);
      var off = offY * 10000 + offX; // row-major ordering
      if (off < 0 && off > closest.dist) closest = { dist: off, el: child };
    });
    return closest.el;
  }

  function undo() { var c = undoStack.pop(); if (!c) return; c.undo(); redoStack.push(c); updateButtons(); }
  function redo() { var c = redoStack.pop(); if (!c) return; c.redo(); undoStack.push(c); updateButtons(); }

  function updateButtons() {
    var u = document.getElementById('edUndo'), r = document.getElementById('edRedo');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
  }

  function reset() { undoStack.length = 0; redoStack.length = 0; if (active) disable(); updateButtons(); }

  window.VIS.editor = { toggle: toggle, enable: enable, disable: disable, undo: undo, redo: redo, reset: reset, initBoardDnd: initBoardDnd, isActive: function () { return active; } };
})();
