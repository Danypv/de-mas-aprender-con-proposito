import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import * as pagefind from 'pagefind';
import { searchDocuments } from './search-catalog.mjs';

const root = path.resolve(process.argv[2] || process.cwd());
const { documents, publications } = searchDocuments(root);
const engineVersion = JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.resolve('pagefind')),'utf8')).version;
const revision = createHash('sha256').update(JSON.stringify([1,engineVersion,documents.map(item => [item.url,item.content])])).digest('hex').slice(0,16);
const output = path.join(root, 'assets/busqueda');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fileList = directory => fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory() ? fileList(path.join(directory,entry.name)) : [path.join(directory,entry.name)]);
// Pagefind filter serialization can differ between identical builds. Reuse an
// intact content-addressed bundle instead of replacing cached index fragments.
try {
  const previous=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
  if (previous.version===1 && previous.revision===revision && previous.bundle===`/assets/busqueda/${revision}/pagefind.js` && previous.count===documents.length && previous.publicationCount===publications.length && JSON.stringify(previous.entries?.map(item=>item.url))===JSON.stringify(documents.map(item=>item.url)) && previous.files?.length && previous.files.every(file=>!file.path.split('/').includes('..') && !path.isAbsolute(file.path) && fs.existsSync(path.join(output,revision,file.path)) && digest(path.join(output,revision,file.path))===file.sha256)) {
    console.log(`Buscador actualizado: ${documents.length} páginas; el contenido no cambió y se conserva el índice verificado.`);
    process.exit(0);
  }
} catch { /* A missing or damaged bundle is rebuilt below. */ }
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'demas-search-'));
const fail = errors => { if (errors?.length) throw Error(errors.join('\n')); };
try {
  const created = await pagefind.createIndex({ forceLanguage: 'es', writePlayground: false });
  fail(created.errors);
  if (!created.index) throw Error('No se pudo crear el índice de búsqueda');
  const indexed = new Set();
  for (const record of documents) {
    const result = await created.index.addHTMLFile({ url: record.url, content: record.content });
    fail(result.errors);
    if (!result.file || result.file.url !== record.url || !result.file.uniqueWords) throw Error(`Búsqueda incompleta: ${record.url}`);
    indexed.add(record.url);
  }
  for (const url of publications) if (!indexed.has(url)) throw Error(`La publicación ${url} quedó fuera del buscador`);
  if (indexed.size !== documents.length) throw Error('La cobertura del buscador no coincide con las páginas públicas');
  const saved = await created.index.writeFiles({ outputPath: staging });
  fail(saved.errors);
  // Our interface uses the search API; the optional stock interfaces are not shipped.
  for (const file of fs.readdirSync(staging)) if (/^pagefind-(?:(?:component|modular)-)?ui\.(?:js|css)$/.test(file)) fs.unlinkSync(path.join(staging,file));
  fs.mkdirSync(output, { recursive: true });
  const bundleDir = path.join(output, revision);
  fs.rmSync(bundleDir, { recursive: true, force: true });
  fs.cpSync(staging, bundleDir, { recursive: true });
  const manifest = { version: 1, revision, bundle: `/assets/busqueda/${revision}/pagefind.js`, count: indexed.size, publicationCount: publications.length, entries: documents.map(({url,title,section,kind}) => ({url,title,section,kind})), files:fileList(bundleDir).sort().map(file=>({path:path.relative(bundleDir,file).split(path.sep).join('/'),sha256:digest(file)})) };
  fs.writeFileSync(path.join(output,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
  for (const file of fs.readdirSync(output, { withFileTypes: true })) if (file.isDirectory() && file.name !== revision) fs.rmSync(path.join(output,file.name), { recursive: true });
  console.log(`Buscador generado: ${indexed.size} páginas, con ${publications.length} publicaciones y series; cobertura completa.`);
} finally {
  await pagefind.close();
  fs.rmSync(staging, { recursive: true, force: true });
}
