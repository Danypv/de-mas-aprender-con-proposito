import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { collections, readReadings, escapeHtml as e, formatDate, typeLabel } from './readings.mjs';

const root = process.cwd();
const readings = readReadings(root).filter(reading => reading.status === 'published');
const markdown = new MarkdownIt({html:false,typographer:true});
const template = fs.readFileSync(path.join(root,'templates/collection.html'),'utf8');
const articleTemplate = fs.readFileSync(path.join(root,'templates/reading.html'),'utf8');
const fill = (source, values) => source.replace(/\{\{([A-Z_]+)\}\}/g, (match,key) => Object.hasOwn(values,key) ? String(values[key]) : match);
const write = (relative, text) => { const target=path.join(root,relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,text); };
const cards = list => list.map(reading => `<article class="entrada${reading.featured ? ' destacada' : ''}" data-categories="${e(JSON.stringify([typeLabel(reading.type)]))}">
  <div class="meta">${reading.featured ? '<span class="distintivo">Lectura destacada</span>' : ''}${e(typeLabel(reading.type))}<span class="fecha">${formatDate(reading.date)}</span>${reading.type==='full' ? `<span class="fecha">${Math.max(1,Math.ceil(reading.body.trim().split(/\s+/u).length/220))} min de lectura</span>` : ''}</div>
  <div>${reading.cover ? `<img class="imagen-entrada" src="${e(reading.cover)}" alt="${e(reading.cover_alt)}" loading="lazy" decoding="async">` : ''}<h3><a href="/lecturas/textos/${reading.slug}/">${e(reading.title)}</a></h3><p class="resumen">${e(reading.summary)}</p><p class="firma">${e(reading.author)}</p><p class="firma">${reading.collections.map(key => e(collections.find(c=>c.slug===key).title)).join(' · ')}</p></div>
  <a class="leer" href="/lecturas/textos/${reading.slug}/">${reading.type==='full' ? 'Leer texto' : 'Ver recomendación'} <span class="flecha" aria-hidden="true">→</span></a>
</article>`).join('\n');
const collectionNav = active => `<nav class="colecciones-nav" aria-label="Colecciones de lectura"><a href="/lecturas/"${active==='' ? ' aria-current="page"' : ''}>Todas las lecturas</a>${collections.map(c=>`<a href="/lecturas/${c.slug}/"${active===c.slug ? ' aria-current="page"' : ''}>${e(c.title)}</a>`).join('')}</nav>`;
for (const collection of [{slug:'',title:'Leer, pensar y conversar.',summary:'Textos escogidos para ampliar la mirada.'},...collections]) {
  const selected = collection.slug ? readings.filter(r=>r.collections.includes(collection.slug)) : readings;
  const page=fill(template, {
    COLLECTION_TITLE:e(collection.title), COLLECTION_SUMMARY:e(collection.summary),
    COLLECTION_NAV:collectionNav(collection.slug), COUNT:`${selected.length} ${selected.length===1 ? 'lectura' : 'lecturas'}`,
    CARDS:cards(selected), EMPTY:selected.length ? '' : '<p class="vacio">Esta colección está en preparación. Aquí encontrarás las lecturas seleccionadas cuando se publiquen.</p>',
    FILTER_HIDDEN:selected.length ? '' : 'hidden',
  });
  write(`lecturas/${collection.slug ? collection.slug+'/' : ''}index.html`,page);
}
for (const reading of readings) {
  const source = reading.source_url ? `<aside class="fuente-lectura"><p>${reading.source_name ? e(reading.source_name) : 'Fuente de la lectura'}</p><a class="enlace" href="${e(reading.source_url)}" target="_blank" rel="noopener noreferrer">${reading.type==='link' ? 'Leer en la fuente original' : 'Consultar la fuente'} <span aria-hidden="true">↗</span></a><p class="nota-fuente">Se abre en una nueva pestaña.</p></aside>` : '';
  const body=markdown.render(reading.body.trim()).replace('<p>','<p class="apertura">');
  write(`lecturas/textos/${reading.slug}/index.html`,fill(articleTemplate,{
    PAGE_TITLE:`${e(reading.browser_title || reading.title)} · DE+`, META_DESCRIPTION:e(reading.summary), OG_TITLE:`${e(reading.title)} · DE+`,
    TITLE:e(reading.title), AUTHOR:e(reading.author), DATE:formatDate(reading.date), SUMMARY:e(reading.summary),
    CATEGORIES:reading.collections.map(key=>e(collections.find(c=>c.slug===key).title)).join(' · '),
    READING_META:reading.type==='full' ? `${Math.max(1,Math.ceil(reading.body.trim().split(/\s+/u).length/220))} min de lectura` : 'Lectura recomendada',
    COVER:reading.cover ? `<figure class="portada-articulo"><img src="${e(reading.cover)}" alt="${e(reading.cover_alt)}" decoding="async">${reading.cover_caption ? `<figcaption>${e(reading.cover_caption)}</figcaption>` : ''}</figure>` : '',
    BODY:body, SOURCE:source,
  }));
}
console.log(`${readings.length} lectura(s) publicada(s); seis colecciones e índice generados.`);
