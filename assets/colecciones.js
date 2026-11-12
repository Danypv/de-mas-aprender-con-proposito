(() => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('#lecturas .coleccion-visual img').forEach(image => {
    const update = () => {
      const missing = image.complete && image.naturalWidth === 0;
      image.hidden = missing;
      image.parentElement.classList.toggle('sin-imagen', missing);
      if (missing) image.parentElement.setAttribute('aria-hidden', 'true');
      else image.parentElement.removeAttribute('aria-hidden');
    };
    image.addEventListener('load', update);
    image.addEventListener('error', update);
    update();
  });
})();
