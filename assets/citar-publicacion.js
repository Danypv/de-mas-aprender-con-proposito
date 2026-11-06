(() => {
  'use strict';

  const block = document.querySelector('.citar-publicacion');
  if (!block) return;
  const reference = block.querySelector('.cita-referencia');
  const button = block.querySelector('[data-copiar-referencia]');
  const status = block.querySelector('.cita-estado');
  button.hidden = false;

  button.addEventListener('click', async () => {
    status.textContent = '';
    const text = reference.textContent.trim();
    try {
      const clipboard = navigator.clipboard;
      if (clipboard?.write && typeof ClipboardItem === 'function') {
        try {
          await clipboard.write([new ClipboardItem({
            'text/html': new Blob([reference.innerHTML], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          })]);
        } catch {
          await clipboard.writeText(text);
        }
      } else {
        await clipboard.writeText(text);
      }
      status.textContent = 'Referencia copiada.';
    } catch {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(reference);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      status.textContent = 'Puedes copiar la referencia con tu navegador.';
    }
  });
})();
