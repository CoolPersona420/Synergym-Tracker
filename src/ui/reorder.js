/* Drag to reorder, as in a phone's list editor: press the grip ([data-grip]) of a row ([data-ro]) in a list
   ([data-ro-list]) and move it. The row lifts and follows the finger; the others slide out of its way as it passes;
   near the top or bottom of the screen the page scrolls along. Letting go calls onMove(list, from, to), which
   changes the order and draws the page again; the rows then glide from where they were to where they are
   (keyed by data-ro). Pointer events, so a mouse works as a finger does. Escape or a cancelled touch puts it back. */
export function reorderDrag({ onMove, enabled = () => true, buzz = () => {}, reduced = false }) {
  let d = null;
  const rowsOf = list => [...list.querySelectorAll('[data-ro]')].filter(r => r.closest('[data-ro-list]') === list);
  const place = () => {
    const sd = scrollY - d.sy;
    if (d.grid) {
      /* rows side by side (a computer's two columns): the nearest slot wins, and the others move into their new slots */
      const cx = d.r0.left + d.r0.width / 2 + d.dx, cy = d.r0.top + d.r0.height / 2 + d.dy + sd;
      let to = 0, best = Infinity; d.rects.forEach((r, i) => { const dd = (r.left + r.width / 2 - cx) ** 2 + (r.top + r.height / 2 - cy) ** 2; if (dd < best) { best = dd; to = i; } });
      if (to !== d.to) { d.to = to; buzz(6); }
      const order = d.rows.map((_, i) => i).filter(i => i !== d.from); order.splice(d.to, 0, d.from);
      order.forEach((i, slot) => { if (i === d.from) return; const a = d.rects[i], b = d.rects[slot]; d.rows[i].style.transform = slot === i ? '' : `translate(${b.left - a.left}px,${b.top - a.top}px)`; });
      d.row.style.transform = `translate(${d.dx}px,${d.dy + sd}px) scale(1.02)`;
      return;
    }
    /* one column: where the lifted row's middle is, against the others' middles as they were */
    const mid = d.r0.top + d.r0.height / 2 + d.dy + sd;
    let to = 0; for (let i = 0; i < d.mids.length; i++) if (i !== d.from && mid > d.mids[i]) to++;
    if (to !== d.to) { d.to = to; buzz(6); }
    d.rows.forEach((r, i) => {
      if (i === d.from) return;
      const shift = d.from < d.to && i > d.from && i <= d.to ? -d.step : d.from > d.to && i >= d.to && i < d.from ? d.step : 0;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
    d.row.style.transform = `translateY(${d.dy + sd}px) scale(1.02)`;
  };
  const scroll = () => {
    if (!d) return;
    const edge = 72, y = d.y, v = y < edge ? -(edge - y) / 5 : y > innerHeight - edge ? (y - (innerHeight - edge)) / 5 : 0;
    if (v) { scrollBy(0, v); place(); }
    d.raf = requestAnimationFrame(scroll);
  };
  const end = commit => {
    if (!d) return; const g = d; d = null;
    cancelAnimationFrame(g.raf);
    document.documentElement.classList.remove('ro-dragging');
    /* where everything is drawn right now, to glide from */
    const before = new Map(g.rows.map(r => { const b = r.getBoundingClientRect(); return [r.dataset.ro, { top: b.top, left: b.left }]; }));
    g.row.classList.remove('ro-lift');
    for (const r of g.rows) { r.style.transition = 'none'; r.style.transform = ''; }
    if (commit && g.to !== g.from) onMove(g.list.dataset.roList, g.from, g.to);
    /* the page may have been drawn again: find each row by its key and let it glide into place */
    requestAnimationFrame(() => {
      for (const [k, top] of before) {
        const el = document.querySelector(`[data-ro="${CSS.escape(k)}"]`); if (!el) continue;
        const now = el.getBoundingClientRect(), dx = top.left - now.left, dy = top.top - now.top; el.style.transition = 'none';
        if ((!dx && !dy) || reduced) { el.style.transform = ''; continue; }
        el.style.transform = `translate(${dx}px,${dy}px)`;
        requestAnimationFrame(() => { el.style.transition = 'transform .42s var(--spring)'; el.style.transform = ''; el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true }); });
      }
    });
  };
  document.addEventListener('pointerdown', e => {
    const grip = e.target.closest('[data-grip]'); if (!grip || (e.pointerType === 'mouse' && e.button !== 0) || !enabled()) return;
    const row = grip.closest('[data-ro]'), list = row && row.closest('[data-ro-list]'); if (!list) return;
    const rows = rowsOf(list), from = rows.indexOf(row); if (from < 0 || rows.length < 2) return;
    e.preventDefault();
    const rects = rows.map(r => r.getBoundingClientRect());
    /* how far a row moves to make room: the lifted row's height and the gap after it */
    const gap = rows.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    d = { list, rows, row, from, to: from, r0: rects[from], rects, mids: rects.map(r => r.top + r.height / 2), step: rects[from].height + gap,
      grid: rects.some(r => Math.abs(r.left - rects[0].left) > 24),
      x0: e.clientX, dx: 0, y0: e.clientY, y: e.clientY, dy: 0, sy: scrollY, id: e.pointerId, raf: 0 };
    try { grip.setPointerCapture(e.pointerId); } catch {}
    document.documentElement.classList.add('ro-dragging');
    row.classList.add('ro-lift');
    for (const r of rows) r.style.transition = r === row ? 'none' : 'transform .25s var(--ease)';
    buzz(10); place(); d.raf = requestAnimationFrame(scroll);
  });
  document.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; e.preventDefault(); d.y = e.clientY; d.dy = e.clientY - d.y0; d.dx = d.grid ? e.clientX - d.x0 : 0; place(); }, { passive: false });
  document.addEventListener('pointerup', e => { if (d && e.pointerId === d.id) end(true); });
  document.addEventListener('pointercancel', e => { if (d && e.pointerId === d.id) end(false); });
  document.addEventListener('keydown', e => { if (d && e.key === 'Escape') end(false); });
}
