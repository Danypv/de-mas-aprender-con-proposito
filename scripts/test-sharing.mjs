import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import { citationBlock } from './citation.mjs';

const root = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'demas-sharing-'));
const title = 'Café & «razón» <juicio> "$&" 🧠';
try {
  for (const folder of ['scripts', 'templates']) fs.cpSync(path.join(root, folder), path.join(fixture, folder), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(fixture, 'blog'));
  fs.copyFileSync(path.join(root, 'blog/index.html'), path.join(fixture, 'blog/index.html'));
  for (const folder of ['posts', 'readings', 'essays', 'videos', 'podcast-series', 'podcast-episodes']) fs.mkdirSync(path.join(fixture, 'content', folder), { recursive: true });
  const base = { title, slug: 'prueba', author: 'Daniel Pérez Valencia', date: '2026-10-31', summary: 'Una publicación para compartir.', status: 'published' };
  const save = (folder, data) => fs.writeFileSync(path.join(fixture, 'content', folder, 'prueba.md'), matter.stringify('Cierre de la publicación.', data));
  save('posts', { ...base, categories: ['Ética'] });
  save('readings', { ...base, type: 'full', collections: ['filosofia'], source_url: 'https://example.org/fuente' });
  save('essays', { ...base, author: 'Ana de la Torre', citation_author: 'de la Torre, A.', categories: ['filosofia'] });
  save('videos', { ...base, format: 'conference', categories: ['Ética'], source_url: 'https://youtu.be/WisWde4lZdQ' });
  save('podcast-series', { title: 'Serie', slug: 'serie', presenter: 'DE+', summary: 'Una serie.', status: 'published' });
  save('podcast-episodes', { ...base, series: 'serie', audio_url: 'https://example.org/audio.mp3' });

  for (const builder of ['content', 'readings', 'essays', 'videos', 'podcasts']) execFileSync(process.execPath, [`scripts/build-${builder}.mjs`], { cwd: fixture, stdio: 'pipe' });
  const escapedTitle = 'Café &amp; «razón» &lt;juicio&gt; &quot;$&amp;&quot; 🧠';
  const pages = [
    ['/blog/prueba/', `Pérez Valencia, D. (2026, 31 de octubre). ${escapedTitle}. <em>DE+</em>.`],
    ['/lecturas/textos/prueba/', `Pérez Valencia, D. (2026, 31 de octubre). <em>${escapedTitle}</em>. DE+.`],
    ['/ensayos/prueba/', `de la Torre, A. (2026, 31 de octubre). <em>${escapedTitle}</em>. DE+.`],
    ['/videos/prueba/', null],
    ['/podcast/episodios/prueba/', null],
  ];
  for (const [pagePath, expectedCitation] of pages) {
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
    const citation = html.match(/<details class="citar-publicacion">[\s\S]*?<\/details>/)?.[0];
    if (expectedCitation) {
      assert(citation?.includes('<summary>Cómo citar esta publicación</summary>'));
      assert(citation.includes('Referencia en APA 7'));
      assert(citation.includes(`${expectedCitation} <a href="${url}">${url}</a>`));
      assert(citation.includes('data-copiar-referencia hidden>Copiar referencia'));
      assert(html.includes(`${block[0]}${citation}`), 'La cita va debajo de compartir');
      assert(html.includes(`rel="canonical" href="${url}"`));
    } else {
      assert(!html.includes('citar-publicacion'), 'La citación se limita a las secciones de texto');
    }
  }
  const series = fs.readFileSync(path.join(fixture, 'podcast/series/serie/index.html'), 'utf8');
  assert(!series.includes('citar-publicacion'));
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

const review = {
  author: 'Ana Peña', title: 'Reseña', date: new Date('2026-11-03'),
  publication_type: 'book', source_title: 'La obra & su historia', source_author: 'B. Pérez',
};
const reviewPath = '/lecturas/textos/prueba/';
const reviewHtml = citationBlock(review, reviewPath, 'reading');
assert(reviewHtml.includes('Peña, A. (2026, 3 de noviembre). Reseña [Reseña del libro <em>La obra &amp; su historia</em>, de B. Pérez]. <em>DE+</em>.'));
assert(!citationBlock({ ...review, source_author: '' }, reviewPath, 'reading').includes('[Reseña'));
assert.equal(citationBlock({ ...review, hide_citation: true }, reviewPath, 'reading'), '');

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

const citationScript = fs.readFileSync(path.join(root, 'assets/citar-publicacion.js'), 'utf8');
for (const mode of ['formatted', 'plain', 'denied']) {
  let click, copied, selected;
  const button = { hidden: true, addEventListener(event, handler) { assert.equal(event, 'click'); click = handler; } };
  const reference = { innerHTML: '<em>Un ensayo</em>. DE+.', textContent: 'Un ensayo. DE+.' };
  const status = { textContent: '' };
  const elements = { '.cita-referencia': reference, '[data-copiar-referencia]': button, '.cita-estado': status };
  const document = {
    querySelector: () => ({ querySelector: selector => elements[selector] }),
    createRange: () => ({ selectNodeContents(node) { selected = node; } }),
  };
  const clipboard = {
    async write([item]) {
      if (mode !== 'formatted') throw Error('Formato no disponible');
      assert.equal(await item.data['text/html'].text(), reference.innerHTML);
      copied = await item.data['text/plain'].text();
    },
    async writeText(text) {
      if (mode === 'denied') throw Error('Permiso denegado');
      copied = text;
    },
  };
  const selection = { removeAllRanges() {}, addRange() {} };
  class ClipboardItem { constructor(data) { this.data = data; } }
  vm.runInNewContext(citationScript, { document, window: { getSelection: () => selection }, navigator: { clipboard }, ClipboardItem, Blob });
  assert.equal(button.hidden, false);
  await click();
  if (mode === 'denied') {
    assert.equal(selected, reference);
    assert.match(status.textContent, /Puedes copiar/);
  } else {
    assert.equal(copied, reference.textContent);
    assert.equal(status.textContent, 'Referencia copiada.');
  }
}
console.log('Compartir y citación verificados: enlaces, referencias APA 7, alcance de las plantillas y copia con formato y alternativas.');
