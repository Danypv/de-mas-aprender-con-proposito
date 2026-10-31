(() => {
  'use strict';

  document.querySelectorAll('.compartir').forEach(block => {
    const button = block.querySelector('[data-copiar-enlace]');
    const status = block.querySelector('.compartir-estado');
    const manual = block.querySelector('.compartir-enlace');
    const url = block.dataset.url;
    if (!button || !status || !manual || !url) return;

    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = '';
      manual.hidden = true;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url);
        status.textContent = 'Enlace copiado.';
      } catch {
        const field = document.createElement('textarea');
        field.className = 'compartir-copia-temporal';
        field.value = url;
        field.setAttribute('readonly', '');
        field.setAttribute('aria-hidden', 'true');
        block.append(field);
        let copied = false;
        try {
          field.focus({ preventScroll: true });
          field.select();
          field.setSelectionRange(0, url.length);
          copied = typeof document.execCommand === 'function' && document.execCommand('copy');
        } catch { /* A selectable field provides the final fallback. */ }
        field.remove();
        if (copied) {
          status.textContent = 'Enlace copiado.';
        } else {
          manual.hidden = false;
          status.textContent = 'Selecciona y copia el enlace.';
          manual.focus({ preventScroll: true });
          manual.select();
          manual.setSelectionRange(0, url.length);
        }
      } finally {
        button.disabled = false;
        if (manual.hidden) button.focus({ preventScroll: true });
      }
    });
  });
})();
