import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { collections, readReadings } from './readings.mjs';
import { readPodcasts } from './podcasts.mjs';
import { readVideos } from './videos.mjs';

const root = process.cwd();
const origin = 'https://somosdemas.com';
const routes = new Set(['/', '/blog/', '/lecturas/', '/podcast/', '/videos/']);
const add = (prefix, slug) => {
  if (typeof slug !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(slug)) throw Error(`Sitemap: identificador no válido en ${prefix}`);
  routes.add(`/${prefix}/${encodeURIComponent(slug)}/`);
};
for (const collection of collections) add('lecturas', collection.slug);

// Content sources, rather than a recursive HTML scan, exclude stale output,
// private drafts, templates and the old nested copy of the site.
const posts = path.join(root, 'content/posts');
const seen = new Set();
if (fs.existsSync(posts)) {
  for (const file of fs.readdirSync(posts).filter(file => file.endsWith('.md'))) {
    const { data } = matter.read(path.join(posts, file));
    if (data.status !== 'published') continue;
    if (seen.has(data.slug)) throw Error(`${file}: identificador repetido en el sitemap`);
    seen.add(data.slug);
    add('blog', data.slug);
  }
}
for (const reading of readReadings(root).filter(item => item.status === 'published')) add('lecturas/textos', reading.slug);
for (const video of readVideos(root).filter(item => item.status === 'published')) add('videos', video.slug);
const { series, episodes } = readPodcasts(root);
for (const item of series.filter(item => item.status === 'published')) add('podcast/series', item.slug);
for (const item of episodes.filter(item => item.status === 'published')) add('podcast/episodios', item.slug);

const urls = [...routes].sort().map(route => {
  const output = path.join(root, decodeURIComponent(route.slice(1)), 'index.html');
  if (!fs.existsSync(output)) throw Error(`Sitemap: genera primero la página ${route}`);
  return new URL(route, origin).href;
});
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n')
  + '\n</urlset>\n';
if (urls.length > 50000 || Buffer.byteLength(xml, 'utf8') > 50 * 1024 * 1024) throw Error('El sitemap necesita dividirse antes de publicar.');
fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log(`Sitemap generado con ${urls.length} direcciones públicas.`);
