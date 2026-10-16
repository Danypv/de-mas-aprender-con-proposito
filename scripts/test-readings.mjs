import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import { readReadings } from './readings.mjs';

const project=process.cwd();
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'demas-readings-'));
try {
  for(const dir of ['scripts','templates']) fs.cpSync(path.join(project,dir),path.join(fixture,dir),{recursive:true});
  fs.symlinkSync(path.join(project,'node_modules'),path.join(fixture,'node_modules'),'dir');
  const posts=path.join(fixture,'content/readings');fs.mkdirSync(posts,{recursive:true});
  const base={title:'Una lectura <especial> $&',slug:'lectura-completa',author:'Autora de prueba',date:'2026-10-16',summary:'Resumen & contexto',status:'published',type:'full',collections:['filosofia','historia-y-cultura']};
  const save=(name,data,body='Un texto para la prueba.')=>fs.writeFileSync(path.join(posts,name),matter.stringify(body,data));
  save('full.md',base);
  save('link.md',{...base,slug:'recomendacion',type:'link',collections:['ciencia-y-salud'],source_url:'https://example.org/lectura'},'');
  save('draft.md',{...base,slug:'borrador-privado',status:'draft'});
  const build=()=>execFileSync(process.execPath,['scripts/build-readings.mjs'],{cwd:fixture,stdio:'pipe'});
  build();
  const page=relative=>fs.readFileSync(path.join(fixture,relative),'utf8');
  assert(page('lecturas/filosofia/index.html').includes('/lecturas/textos/lectura-completa/'));
  assert(page('lecturas/historia-y-cultura/index.html').includes('/lecturas/textos/lectura-completa/'));
  assert(!page('lecturas/filosofia/index.html').includes('/lecturas/textos/recomendacion/'));
  assert(!fs.existsSync(path.join(fixture,'lecturas/textos/borrador-privado')));
  assert(page('lecturas/etica-e-inteligencia-artificial/index.html').includes('Esta colección está en preparación'));
  assert(page('lecturas/textos/recomendacion/index.html').includes('href="https://example.org/lectura"'));
  assert(page('lecturas/textos/lectura-completa/index.html').includes('Una lectura &lt;especial&gt; $&'));
  assert(!page('lecturas/textos/lectura-completa/index.html').match(/\{\{[A-Z_]+\}\}/));
  const first=page('lecturas/index.html');build();assert.equal(page('lecturas/index.html'),first);
  save('bad.md',{...base,slug:'../escape'});assert.throws(()=>readReadings(fixture));fs.unlinkSync(path.join(posts,'bad.md'));
  save('bad.md',{...base,slug:'invalid-link',type:'link',source_url:'javascript:alert(1)'});assert.throws(()=>readReadings(fixture));
  console.log('Pruebas correctas: colecciones múltiples, exclusión de borradores, fuentes, HTML escapado, páginas vacías, generación estable y validación de rutas/enlaces.');
} finally { fs.rmSync(fixture,{recursive:true,force:true}); }
