import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sharedFooter} from './footer.mjs';

const root=path.resolve(process.argv[2]||process.cwd());
const origin='https://somosdemas.com';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/busqueda/manifest.json'),'utf8'));
const routes=[...new Set(manifest.entries.map(item=>item.url.split('#')[0]))];
const load=route=>fs.readFileSync(path.join(root,decodeURIComponent(route.slice(1)),'index.html'),'utf8');
for(const route of routes){
  const html=load(route),head=html.split('</head>')[0];
  assert(/<html\s[^>]*lang="es"/.test(html),`${route}: idioma`);
  const descriptions=[...head.matchAll(/<meta (?:name="description"|property="og:description") content="([^"]*)"/g)].map(m=>m[1]);
  assert.equal(descriptions.length,2,`${route}: descripciones`);assert.equal(descriptions[0],descriptions[1],`${route}: descripciones distintas`);
  const canonicals=[...head.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonicals.length,1,`${route}: canónico único`);assert.equal(canonicals[0][1],origin+route,`${route}: canónico correcto`);
  assert(head.includes(`property="og:url" content="${origin+route}"`),`${route}: URL social`);
  assert(head.includes('href="/assets/marca/favicon.svg?'),`${route}: favicon`);
  assert(!html.includes('Daniel Perez Valencia')&&!html.includes('¿Como pueden'),`${route}: ortografía`);
  for(const [,href]of html.matchAll(/\bhref="([^"]+)"/g)){
    const url=new URL(href.replaceAll('&amp;','&'),origin+route);
    if(url.origin!==origin)continue;
    const relative=decodeURIComponent(url.pathname.slice(1));
    const target=path.join(root,relative,url.pathname.endsWith('/')?'index.html':'');
    assert(fs.existsSync(target),`${route}: enlace roto ${href}`);
    if(url.hash&&target.endsWith('.html'))assert(fs.readFileSync(target,'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`${route}: ancla rota ${href}`);
  }
}
const home=load('/');
const footer=sharedFooter(root);
for(const route of routes)assert(load(route).includes(footer),route+': pie compartido distinto o ausente');
const title=home.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g,'');
assert.equal(title,'Aprender con propósito.');
const slides=[...home.matchAll(/\bdata-slide(?:\s|>)/g)].length;
if(slides)assert(home.includes(`data-count aria-live="off">1 / ${slides}</span>`),'Contador inicial incoherente');
else assert(!home.includes('data-carousel'),'No debe aparecer un carrusel sin publicaciones');
assert.equal([...home.matchAll(/\bdata-dot="\d+"/g)].length,slides);
const error=fs.readFileSync(path.join(root,'404.html'),'utf8');
assert(error.includes('name="robots" content="noindex, follow"'));
assert(error.includes('Página no encontrada')&&error.includes('src="/assets/buscar.js"'));
assert(!error.includes('rel="canonical"'),'El error 404 no debe señalar la portada como canónica');
assert(!manifest.entries.some(item=>item.url.includes('404.html')));
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
assert.equal((sitemap.match(/<loc>/g)||[]).length,routes.length);
for(const route of routes)assert(sitemap.includes(`<loc>${origin+route}</loc>`));
console.log(`Sitio verificado: ${routes.length} páginas, metadatos, idioma, iconos, enlaces, anclas, titular, contador, sitemap y página 404.`);
