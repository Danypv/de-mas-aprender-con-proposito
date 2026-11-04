import fs from 'node:fs';
import path from 'node:path';
import { searchDocuments } from './search-catalog.mjs';

const root = path.resolve(process.argv[2] || process.cwd());
const manifest = JSON.parse(fs.readFileSync(path.join(root,'assets/busqueda/manifest.json'),'utf8'));
const { documents, publications } = searchDocuments(root);
const expected = documents.map(item=>item.url).sort();
const actual = manifest.entries.map(item=>item.url).sort();
if (JSON.stringify(expected)!==JSON.stringify(actual) || manifest.count!==expected.length || manifest.publicationCount!==publications.length) throw Error('El buscador no incluye todas las páginas públicas');
if (!/^\/assets\/busqueda\/[a-f0-9]{16}\/pagefind\.js$/.test(manifest.bundle)) throw Error('Ruta del buscador no válida');
const entry = JSON.parse(fs.readFileSync(path.join(root,path.dirname(manifest.bundle),'pagefind-entry.json'),'utf8'));
if (entry.languages?.es?.page_count!==expected.length) throw Error('El índice no coincide con el catálogo de publicaciones');
const files = new Set(documents.map(item=>path.join(root,decodeURIComponent(item.url.split('#')[0].slice(1)),'index.html')));
for (const file of files) {
  const html=fs.readFileSync(file,'utf8');
  if (!html.includes('href="/assets/buscar.css"') || !html.includes('src="/assets/buscar.js" type="module"')) throw Error(`Falta el acceso al buscador en ${file}`);
}
for (const name of ['post','essay','essays','reading','video','episode','collection','podcast','videos']) {
  const html=fs.readFileSync(path.join(root,'templates',name+'.html'),'utf8');
  if (!html.includes('src="/assets/buscar.js" type="module"')) throw Error(`La plantilla ${name} no incluye el buscador`);
}
console.log(`Búsqueda verificada: ${publications.length} publicaciones y series, ${expected.length} páginas y todas sus plantillas.`);
