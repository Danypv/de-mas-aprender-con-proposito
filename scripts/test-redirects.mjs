import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
import {buildRedirects} from './redirects.mjs';
import {collections,readReadings} from './readings.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-redirects-'));
const write=(p,text)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
try{
  for(const c of collections)write(`lecturas/${c.slug}/index.html`,'Página publicada');
  const record={title:'Lectura',author:'Autora',summary:'Resumen',date:'2026-10-31',slug:'actual',status:'published',type:'full',collections:['etica-e-inteligencia-artificial'],previous_slugs:['primero','segundo']};
  const save=d=>write('content/readings/lectura.md',matter.stringify('Texto.',d));
  save(record);write('lecturas/textos/actual/index.html','Actual');
  assert.deepEqual(readReadings(root)[0].collections,['ciencia-y-tecnologia'],'Los identificadores históricos siguen siendo válidos');
  assert.equal(buildRedirects(root),5);
  for(const c of collections.filter(c=>c.previousSlugs)){
    const html=read(`lecturas/${c.previousSlugs[0]}/index.html`);
    assert(html.includes(`content="0;url=/lecturas/${c.slug}/"`));
    assert(html.includes(`rel="canonical" href="https://somosdemas.com/lecturas/${c.slug}/"`));
  }
  assert(read('lecturas/textos/primero/index.html').includes('/lecturas/textos/actual/'));
  const manifest=read('assets/redirecciones.json');buildRedirects(root);assert.equal(read('assets/redirecciones.json'),manifest);
  save({...record,slug:'primero',previous_slugs:['segundo','actual']});write('lecturas/textos/primero/index.html','Texto recuperado');
  buildRedirects(root);assert.equal(read('lecturas/textos/primero/index.html'),'Texto recuperado');
  assert(read('lecturas/textos/segundo/index.html').includes('/lecturas/textos/primero/'),'Los alias van al destino final');
  write('content/readings/otra.md',matter.stringify('Otra.',{...record,slug:'segunda-publicacion',previous_slugs:['segundo']}));write('lecturas/textos/segunda-publicacion/index.html','Otra');
  assert.throws(()=>buildRedirects(root),/repetida/);fs.unlinkSync(path.join(root,'content/readings/otra.md'));
  save({...record,previous_slugs:['../fuera']});assert.throws(()=>buildRedirects(root),/historial/);
  save({...record,previous_slugs:['segunda-publicacion']});write('content/readings/otra.md',matter.stringify('Otra.',{...record,slug:'segunda-publicacion',previous_slugs:[]}));
  assert.throws(()=>buildRedirects(root),/sustituiría/);fs.unlinkSync(path.join(root,'content/readings/otra.md'));
  fs.unlinkSync(path.join(root,'content/readings/lectura.md'));buildRedirects(root);
  assert(!fs.existsSync(path.join(root,'lecturas/textos/actual/index.html')),'Al retirar el contenido se retiran sus alias generados');
  assert(!fs.existsSync(path.join(root,'lecturas/textos/segundo/index.html')));
  console.log('Redirecciones verificadas: categorías, compatibilidad, destino final, retorno a URL anterior, conflictos, rutas inseguras y retirada.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
