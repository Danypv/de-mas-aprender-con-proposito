(function (host) {
  'use strict';
  const normalize = (value, count) => count > 0 ? ((value % count) + count) % count : 0;
  function positionFor(item, current, count) {
    if (!count) return 'away';
    const distance = normalize(item - current, count);
    if (distance === 0) return 'current';
    if (distance === 1) return 'right';
    if (distance === count - 1) return 'left';
    return 'away';
  }
  function imageState(image) {
    if (!image || !image.getAttribute('src')) return 'missing';
    if (!image.complete) return 'loading';
    return image.naturalWidth > 0 ? 'ready' : 'missing';
  }
  class DeckState {
    constructor(count, reduced) {
      this.count = Math.max(0, count);
      this.index = 0;
      this.userPaused = false;
      this.reduced = Boolean(reduced);
      this.hovered = false;
      this.focused = false;
      this.visible = true;
      this.interacting = false;
    }
    get canAutoplay() {
      return this.count > 1 && !this.userPaused && !this.reduced && !this.hovered && !this.focused && !this.interacting && this.visible;
    }
    show(index, manual) {
      this.index = normalize(index, this.count);
      return this.index;
    }
    step(direction, manual) { return this.show(this.index + direction, manual); }
    togglePlay() { if (!this.reduced) this.userPaused = !this.userPaused; }
  }
  function initialize(root) {
    if (root.dataset.ready === 'true') return;
    const cards = Array.from(root.querySelectorAll('[data-slide]'));
    const stage = root.querySelector('[data-stage]');
    const previous = root.querySelector('[data-prev]');
    const next = root.querySelector('[data-next]');
    const play = root.querySelector('[data-pause]');
    const count = root.closest('.novedades').querySelector('[data-count]');
    const status = root.querySelector('[data-status]');
    const progress = root.querySelector('[data-progress]');
    const dots = Array.from(root.querySelectorAll('[data-dot]'));
    if (!cards.length || !stage || !previous || !next || !play) return;
    root.dataset.ready = 'true';
    const motion = host.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = host.matchMedia('(hover: hover) and (pointer: fine)');
    const state = new DeckState(cards.length, motion.matches);
    let timer = null;
    let pointer = null;
    let suppressClickUntil = 0;
    const interval = Number(root.dataset.interval) || 7000;
    const visuals = cards.map(card => card.querySelector('.novedad-visual'));
    const actualImageStates = visuals.map(visual => imageState(visual && visual.querySelector('img')));
    function stopTimer() { if (timer !== null) { host.clearInterval(timer); timer = null; } }
    function schedule() {
      stopTimer();
      if (state.canAutoplay) timer = host.setInterval(() => show(state.index + 1, false), interval);
    }
    function paintImages() {
      visuals.forEach((visual, i) => {
        if (!visual) return;
        const value = actualImageStates[i];
        visual.dataset.imageState = value;
        const image = visual.querySelector('img');
        if (image) image.hidden = value === 'missing';
      });
    }
    function paint(manual) {
      cards.forEach((card, i) => {
        const active = i === state.index;
        card.dataset.position = positionFor(i, state.index, cards.length);
        card.setAttribute('aria-hidden', String(!active));
        card.inert = !active;
      });
      dots.forEach((dot, i) => {
        if (i === state.index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      if (count) count.textContent = (state.index + 1) + ' / ' + cards.length;
      if (progress) {
        progress.style.width = (100 / cards.length) + '%';
        progress.style.transform = 'translateX(' + (state.index * 100) + '%)';
      }
      previous.disabled = next.disabled = cards.length < 2;
      play.disabled = state.reduced || cards.length < 2;
      play.textContent = state.reduced ? 'Pausado' : state.userPaused ? 'Reproducir' : 'Pausar';
      play.setAttribute('aria-pressed', String(state.userPaused || state.reduced));
      play.setAttribute('aria-label', state.reduced ? 'Avance automático desactivado por movimiento reducido' : state.userPaused ? 'Reproducir el avance automático' : 'Pausar el avance automático');
      if (manual && status) status.textContent = 'Publicación ' + (state.index + 1) + ' de ' + cards.length + ': ' + cards[state.index].querySelector('h3').textContent;
      paintImages();
    }
    function show(index, manual) {
      state.show(index, manual);
      paint(manual);
      schedule();
    }
    previous.addEventListener('click', () => show(state.index - 1, true));
    next.addEventListener('click', () => show(state.index + 1, true));
    dots.forEach((dot, i) => dot.addEventListener('click', () => show(i, true)));
    play.addEventListener('click', () => { state.togglePlay(); paint(false); schedule(); });
    stage.addEventListener('mouseenter', () => { if (hover.matches) { state.hovered = true; stopTimer(); } });
    stage.addEventListener('mouseleave', () => { state.hovered = false; schedule(); });
    root.addEventListener('focusin', event => { state.focused = Boolean(event.target.closest('[data-slide]')); schedule(); });
    root.addEventListener('focusout', event => { state.focused = Boolean(event.relatedTarget && root.contains(event.relatedTarget) && event.relatedTarget.closest('[data-slide]')); schedule(); });
    root.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const fromCard = Boolean(event.target.closest('[data-slide]'));
      show(state.index + (event.key === 'ArrowRight' ? 1 : -1), true);
      if (fromCard) cards[state.index].querySelector('.enlace').focus({preventScroll: true});
    });
    stage.addEventListener('pointerdown', event => {
      if (event.isPrimary === false || (event.button && event.button !== 0)) return;
      pointer = {x: event.clientX, y: event.clientY, id: event.pointerId, dragged: false};
      state.interacting = true;
      stopTimer();
    });
    stage.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.dragged && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        pointer.dragged = true;
        if (stage.setPointerCapture) {
          try { stage.setPointerCapture(event.pointerId); } catch { /* The pointer may already have ended. */ }
        }
      }
    });
    function finishPointer(event, cancelled) {
      if (!pointer || (event.pointerId !== undefined && event.pointerId !== pointer.id)) return;
      const gesture = pointer;
      pointer = null;
      state.interacting = false;
      if (stage.hasPointerCapture && stage.hasPointerCapture(gesture.id)) stage.releasePointerCapture(gesture.id);
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!cancelled && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressClickUntil = performance.now() + 400;
        show(state.index + (dx < 0 ? 1 : -1), true);
      } else {
        if (gesture.dragged) suppressClickUntil = performance.now() + 400;
        schedule();
      }
    }
    host.addEventListener('pointerup', event => finishPointer(event, false));
    host.addEventListener('pointercancel', event => finishPointer(event, true));
    host.addEventListener('blur', () => { pointer = null; state.interacting = false; schedule(); });
    stage.addEventListener('dragstart', event => event.preventDefault());
    stage.addEventListener('click', event => {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.target.closest('a,button')) return;
      const bounds = cards[state.index].getBoundingClientRect();
      if (event.clientX < bounds.left) show(state.index - 1, true);
      else if (event.clientX > bounds.right) show(state.index + 1, true);
    }, true);
    document.addEventListener('visibilitychange', () => { state.visible = !document.hidden; schedule(); });
    motion.addEventListener('change', () => { state.reduced = motion.matches; paint(false); schedule(); });
    if ('IntersectionObserver' in host) new host.IntersectionObserver(entries => { state.visible = entries[0].isIntersecting && !document.hidden; schedule(); }, {threshold: .1}).observe(root);
    visuals.forEach((visual, i) => {
      const image = visual && visual.querySelector('img');
      if (!image) return;
      image.addEventListener('load', () => { actualImageStates[i] = 'ready'; paintImages(); });
      image.addEventListener('error', () => { actualImageStates[i] = 'missing'; paintImages(); });
    });
    state.visible = !document.hidden;
    paint(false);
    schedule();
  }
  function bootstrap() { document.querySelectorAll('[data-deck]').forEach(initialize); }
  if (typeof module === 'object' && module.exports) module.exports = {DeckState, positionFor, imageState};
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, {once: true});
  else bootstrap();
})(typeof window === 'undefined' ? globalThis : window);
