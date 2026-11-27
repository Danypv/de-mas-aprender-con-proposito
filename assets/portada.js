(() => {
  const stage = document.querySelector('#inicio [data-portada]');
  if (!stage) return;
  const root = stage.closest('#inicio');
  const slides = [...stage.querySelectorAll('[data-portada-foto]')];
  if (!slides.length) return;
  const button = root.querySelector('[data-portada-pausa]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  const interval = Math.max(5000, Math.min(60000, Number(stage.dataset.intervalo) || 10000));
  let current = 0, timer = null, paused = false, focused = false, hovered = false, visible = true, busy = false;
  const running = () => slides.length > 1 && !paused && !focused && !hovered && !reduced.matches && !document.hidden && visible;

  // Cover can need a much wider bitmap than the phone viewport. Account for
  // the frame's height and each photo's aspect ratio before choosing srcset.
  function sizeImages() {
    const box = root.getBoundingClientRect();
    for (const slide of slides) for (const node of slide.querySelectorAll('[data-aspecto]')) {
      const sizes = Math.ceil(Math.max(box.width, box.height * Number(node.dataset.aspecto))) + 'px';
      if (node.getAttribute('sizes') !== sizes) node.setAttribute('sizes', sizes);
    }
  }
  sizeImages();
  if ('ResizeObserver' in window) new window.ResizeObserver(sizeImages).observe(root);
  else window.addEventListener('resize', sizeImages);

  function load(slide) {
    if (slide.dataset.failed === 'true') return Promise.resolve(false);
    const image = slide.querySelector('img');
    return new Promise(resolve => {
      let timeout, done = false;
      const finish = success => {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
        if (!success) slide.dataset.failed = 'true';
        resolve(success);
      };
      const loaded = () => finish(image.naturalWidth > 0);
      const failed = () => finish(false);
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
      timeout = window.setTimeout(failed, 15000);
      for (const node of slide.querySelectorAll('[data-srcset]')) {
        node.setAttribute('srcset', node.dataset.srcset);
        node.removeAttribute('data-srcset');
      }
      if (image.dataset.src) { image.setAttribute('src', image.dataset.src); image.removeAttribute('data-src'); }
      if (image.complete && image.naturalWidth > 0) loaded();
    });
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = null;
    if (button) {
      button.hidden = slides.length < 2;
      button.disabled = reduced.matches;
      button.setAttribute('aria-pressed', String(paused || reduced.matches));
      button.textContent = reduced.matches ? 'Imágenes estáticas' : paused ? 'Reanudar imágenes' : 'Pausar imágenes';
    }
    if (running() && !busy) timer = window.setTimeout(advance, interval);
  }

  async function advance() {
    timer = null;
    if (!running() || busy) return;
    busy = true;
    try {
      for (let step = 1; step < slides.length; step++) {
        const next = (current + step) % slides.length;
        if (!(await load(slides[next]))) continue;
        if (!running()) return;
        slides[next].dataset.activa = 'true';
        slides[current].dataset.activa = 'false';
        current = next;
        break;
      }
    } finally { busy = false; schedule(); }
  }

  // A network failure never replaces the current image with an empty slide.
  const first = slides[0].querySelector('img');
  const fallback = () => {
    if (first.dataset.fallback) return;
    first.dataset.fallback = 'true';
    for (const source of slides[0].querySelectorAll('source')) source.removeAttribute('srcset');
    first.removeAttribute('srcset');
    first.setAttribute('src', window.matchMedia('(max-width: 780px)').matches ? '/assets/imagenes/portada-cariatides-movil.webp' : '/assets/imagenes/portada-cariatides.webp');
  };
  first.addEventListener('error', fallback);
  if (first.complete && !first.naturalWidth) fallback();
  button?.addEventListener('click', () => { paused = !paused; schedule(); });
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  root.addEventListener('mouseenter', () => { if (hoverMedia.matches) { hovered = true; schedule(); } });
  root.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  root.addEventListener('focusin', event => { if (event.target !== button) { focused = true; schedule(); } });
  root.addEventListener('focusout', event => { focused = !!event.relatedTarget && event.relatedTarget !== button && root.contains(event.relatedTarget); schedule(); });
  if ('IntersectionObserver' in window) new window.IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: 0 }).observe(root);
  schedule();
})();
