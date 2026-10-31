import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const root = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'demas-sharing-'));
const title = 'Café & «razón» <juicio> "$&" 🧠';
try {
  for (const folder of ['scripts', 'templates']) fs.cpSync(path.join(root, folder), path.join(fixture, folder), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(fixture, 'blog'));
  fs.copyFileSync(path.join(root, 'blog/index.html'), path.join(fixture, 'blog/index.html'));
  for (const folder of ['posts', 'readings', 'videos', 'podcast-series', 'podcast-episodes']) fs.mkdirSync(path.join(fixture, 'content', folder), { recursive: true });
  const base = { title, slug: 'prueba', author: 'DE+', date: '2026-10-31', summary: 'Una publicación para compartir.', status: 'published' };
  const save = (folder, data) => fs.writeFileSync(path.join(fixture, 'content', folder, 'prueba.md'), matter.stringify('Cierre de la publicación.', data));
  save('posts', { ...base, categories: ['Ética'] });
  save('readings', { ...base, type: 'full', collections: ['filosofia'], source_url: 'https://example.org/fuente' });
  save('videos', { ...base, format: 'conference', categories: ['Ética'], source_url: 'https://youtu.be/WisWde4lZdQ' });
  save('podcast-series', { title: 'Serie', slug: 'serie', presenter: 'DE+', summary: 'Una serie.', status: 'published' });
  save('podcast-episodes', { ...base, series: 'serie', audio_url: 'https://example.org/audio.mp3' });

  for (const builder of ['content', 'readings', 'videos', 'podcasts']) execFileSync(process.execPath, [`scripts/build-${builder}.mjs`], { cwd: fixture, stdio: 'pipe' });
  for (const pagePath of ['/blog/prueba/', '/lecturas/textos/prueba/', '/videos/prueba/', '/podcast/episodios/prueba/']) {
    const html = fs.readFileSync(path.join(fixture, pagePath.slice(1), 'index.html'), 'utf8');
    const url = 'https://somosdemas.com' + pagePath;
    const block = html.match(/<section class="compartir"[\s\S]*?<\/section>/g);
    assert.equal(block?.length, 1, `${pagePath}: una sola sección para compartir`);
    assert(html.includes('href="/assets/compartir.css"'));
    assert(html.includes('src="/assets/compartir.js" defer'));
    assert(html.indexOf(block[0]) < html.indexOf('</article></main>'));
    assert(block[0].includes(`data-url="${url}"`));
    assert(block[0].includes('data-copiar-enlace hidden'));
    const links = [...block[0].matchAll(/data-red="([^"]+)" href="([^"]+)" target="_blank" rel="noopener noreferrer"/g)];
    assert.equal(links.length, 4);
    for (const [, network, href] of links) {
      const intent = new URL(href.replaceAll('&amp;', '&'));
      if (network === 'whatsapp') {
        assert.equal(intent.origin + intent.pathname, 'https://wa.me/');
        assert.equal(intent.searchParams.get('text'), title + '\n' + url);
      } else {
        const endpoints = { facebook: 'https://www.facebook.com/sharer/sharer.php', x: 'https://twitter.com/intent/tweet', linkedin: 'https://www.linkedin.com/sharing/share-offsite/' };
        assert.equal(intent.origin + intent.pathname, endpoints[network]);
        assert.equal(intent.searchParams.get(network === 'facebook' ? 'u' : 'url'), url);
        if (network === 'x') assert.equal(intent.searchParams.get('text'), title);
      }
    }
    assert(!block[0].includes('<juicio>'), 'El título no se inserta como HTML');
    assert(!/\{\{[A-Z_]+\}\}/.test(html));
  }
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

// Exercise clipboard success, legacy copying, and the selectable-link fallback.
const script = fs.readFileSync(path.join(root, 'assets/compartir.js'), 'utf8');
const url = 'https://somosdemas.com/blog/prueba/';
async function copyCase(mode) {
  let click;
  let copied;
  let temporaryRemoved = false;
  const element = () => ({ hidden: true, disabled: false, focus() { assert(!this.disabled); this.focused = true; }, select() { this.selected = true; }, setSelectionRange() {} });
  const button = { ...element(), addEventListener(event, handler) { assert.equal(event, 'click'); click = handler; } };
  const status = { textContent: '' };
  const manual = element();
  const block = { dataset: { url }, querySelector(selector) { return ({ '[data-copiar-enlace]': button, '.compartir-estado': status, '.compartir-enlace': manual })[selector]; }, append(field) { assert.equal(field.value, url); } };
  const document = {
    querySelectorAll() { return [block]; },
    createElement() { return { ...element(), setAttribute() {}, remove() { temporaryRemoved = true; } }; },
    execCommand(command) { assert.equal(command, 'copy'); return mode === 'legacy'; },
  };
  const navigator = mode === 'modern' ? { clipboard: { async writeText(text) { copied = text; } } } : mode === 'denied' ? { clipboard: { async writeText() { throw Error('Permission denied'); } } } : {};
  vm.runInNewContext(script, { document, navigator });
  assert.equal(button.hidden, false);
  await click();
  assert.equal(button.disabled, false);
  if (mode === 'modern' || mode === 'legacy') {
    assert.equal(status.textContent, 'Enlace copiado.');
    assert.equal(manual.hidden, true);
    assert.equal(button.focused, true);
    if (mode === 'modern') assert.equal(copied, url);
  } else {
    assert.equal(manual.hidden, false);
    assert.equal(manual.selected, true);
    assert.equal(manual.focused, true);
    assert.equal(status.textContent, 'Selecciona y copia el enlace.');
  }
  if (mode !== 'modern') assert.equal(temporaryRemoved, true);
}
for (const mode of ['modern', 'legacy', 'denied', 'unavailable']) await copyCase(mode);
console.log('Compartir verificado en las cuatro secciones: destinos correctos, títulos con caracteres especiales y copia con sus alternativas.');
