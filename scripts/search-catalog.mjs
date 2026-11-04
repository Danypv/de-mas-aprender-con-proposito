import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { collections, readReadings } from './readings.mjs';
import { readVideos } from './videos.mjs';
import { readPodcasts } from './podcasts.mjs';
import { episodeAuthor } from './authors.mjs';
import {readEssays,categoryLabels} from './essays.mjs';
import { contentPath, origin } from './structured-data.mjs';
import { referencesBlock } from './references.mjs';

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const textOnly = value => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const published = items => items.filter(item => item.status === 'published');
const markdown = new MarkdownIt({ html:false, typographer:true });
const section = (html, id) => html.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1];
const intro = html => html.match(/<section\b[^>]*class="introduccion"[^>]*>([\s\S]*?)<\/section>/)?.[1];

export function searchDocuments(root = process.cwd()) {
  const sources = new Map();
  const add = (url, item, label, kind = 'publication') => {
    if (sources.has(url)) throw Error(`Búsqueda: dirección repetida ${url}`);
    sources.set(url, { url, title: item.title, summary: item.summary || '', author: item.author || item.presenter || '', date: item.date ? new Date(item.date).toISOString().slice(0,10) : '', keywords: [...(item.categories || []), ...(item.collections || []).map(key => collections.find(c => c.slug === key)?.title || key), item.source_name || ''].join(' · '), seriesBody:kind === 'series' ? item.body : '', seriesReferences:kind === 'series' ? item.references : '', section: label, kind });
  };
  const posts = path.join(root, 'content/posts');
  if (fs.existsSync(posts)) for (const file of fs.readdirSync(posts).filter(file => file.endsWith('.md'))) {
    const { data } = matter.read(path.join(posts, file));
    if (data.status === 'published') add(contentPath('/blog/', data.slug), data, 'Blog');
  }
  for (const item of published(readReadings(root))) add(contentPath('/lecturas/textos/', item.slug), item, 'Lecturas selectas');
  for (const item of published(readEssays(root))) add(contentPath('/ensayos/', item.slug), {...item,categories:categoryLabels(item)}, 'Ensayos');
  for (const item of published(readVideos(root))) add(contentPath('/videos/', item.slug), item, 'Videos');
  const podcasts = readPodcasts(root);
  for (const item of published(podcasts.series)) add(contentPath('/podcast/series/', item.slug), item, 'Podcast', 'series');
  for (const item of published(podcasts.episodes)) {
    const author = episodeAuthor(item, podcasts.series.find(series => series.slug === item.series));
    add(contentPath('/podcast/episodios/', item.slug), { ...item, author: author.name }, 'Podcast');
  }
  const publications = [...sources.keys()];
  add('/', { title: 'DE+ · Aprender con propósito' }, 'Proyecto', 'page');
  add('/blog/', { title: 'Blog' }, 'Blog', 'catalog');
  if(fs.existsSync(path.join(root,'ensayos/index.html'))) add('/ensayos/', {title:'Ensayos',summary:'Textos que desarrollan ideas y abren preguntas.'}, 'Ensayos', 'catalog');
  add('/lecturas/', { title: 'Lecturas selectas' }, 'Lecturas selectas', 'catalog');
  add('/videos/', { title: 'Videos' }, 'Videos', 'catalog');
  add('/podcast/', { title: 'Podcast' }, 'Podcast', 'catalog');
  for (const collection of collections) add(contentPath('/lecturas/', collection.slug), collection, 'Lecturas selectas', 'catalog');

  // The sitemap and the content inventory must agree before publishing.
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const routes = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => {
    const url = new URL(match[1].replaceAll('&amp;', '&'));
    if (url.origin !== origin) throw Error('Búsqueda: el sitemap contiene una dirección ajena al sitio');
    return url.pathname;
  }));
  for (const url of sources.keys()) if (!routes.has(url)) throw Error(`Búsqueda: falta ${url} en el sitemap`);
  for (const url of routes) if (!sources.has(url)) throw Error(`Búsqueda: falta clasificar la página pública ${url}`);

  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const about = section(home, 'sobre');
  if (!about) throw Error('Búsqueda: no se encuentra la presentación de Sobre DE+');
  add('/#sobre', { title: 'Sobre DE+', summary: 'El proyecto DE+ y sus creadores.' }, 'Proyecto', 'page');
  const documents = [];
  for (const record of sources.values()) {
    const route = record.url.split('#')[0];
    const file = path.join(root, decodeURIComponent(route.slice(1)), 'index.html');
    if (!fs.existsSync(file)) throw Error(`Búsqueda: genera primero ${route}`);
    const html = fs.readFileSync(file, 'utf8');
    let body;
    if (record.url === '/#sobre') body = `<h1>${escape(record.title)}</h1>${about}`;
    else if (record.url === '/') body = section(home, 'inicio');
    else if (record.kind === 'catalog') body = intro(html);
    else if (record.kind === 'series') body = `${intro(html) || ''}<p>${escape(record.author)}</p>${markdown.render(record.seriesBody || '')}${referencesBlock(record.seriesReferences)}`;
    else {
      body = html.match(/<main\b[^>]*id="contenido"[^>]*>([\s\S]*?)<\/main>/)?.[1];
    }
    if (!body?.trim()) throw Error(`Búsqueda: no se encuentra el contenido de ${record.url}`);
    body = body.replace(/<section class="compartir"/g, '<section data-pagefind-ignore="all" class="compartir"')
      .replace(/<h1\b/g, '<h1 data-pagefind-weight="8"')
      .replace(/<p class="ruta"/g, '<p data-pagefind-ignore="all" class="ruta"')
      .replace(/<div class="acciones"/g, '<div data-pagefind-ignore="all" class="acciones"');
    const meta = { title: record.title, section: record.section, description: record.summary, author: record.author, date: record.date, kind: record.kind, keywords: record.keywords };
    const head = Object.entries(meta).map(([key,value]) => `<meta data-pagefind-meta="${key}[content]" content="${escape(value)}">`).join('');
    const content = `<html lang="es"><head>${head}<meta data-pagefind-filter="section[content]" content="${escape(record.section)}"></head><body><main data-pagefind-body>${body}</main></body></html>`;
    documents.push({ ...record, content, text: textOnly(body) });
  }
  return { documents, publications };
}
