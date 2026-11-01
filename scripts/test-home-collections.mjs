import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import {collections} from './readings.mjs';
import {updateHomeCollections} from './home-collections.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-collections-'));
try{
  const dir=path.join(root,'content/readings');fs.mkdirSync(dir,{recursive:true});
  const home=fs.readFileSync('index.html','utf8');
  const base={title:'Lectura de prueba',slug:'lectura',author:'Autora',date:'2026-10-31',summary:'Una lectura.',type:'full',status:'published',collections:['educacion','cine']};
  const save=data=>fs.writeFileSync(path.join(dir,'prueba.md'),matter.stringify('Texto para pensar.',data));
  const count=(html,slug)=>html.match(new RegExp(`href="lecturas/${slug}/"[\\s\\S]*?<strong>(\\d+)</strong>`))?.[1];
  const outside=value=>value.replace(/<!-- COLLECTIONS_START -->[\s\S]*?<!-- COLLECTIONS_END -->/,'');
  let result=updateHomeCollections(home,root);
  assert.equal(collections.length,8);assert.equal(count(result,'educacion'),'0');assert.equal(count(result,'cine'),'0');
  save(base);result=updateHomeCollections(home,root);
  assert.equal(count(result,'educacion'),'1');assert.equal(count(result,'cine'),'1');
  assert(result.includes('Todas las lecturas <span>1</span>'),'El total cuenta una publicación una vez');
  assert.equal(outside(result),outside(home),'Solo cambia la franja de Lecturas selectas');
  assert.equal(updateHomeCollections(result,root),result,'Generación estable');
  save({...base,status:'draft'});result=updateHomeCollections(home,root);assert.equal(count(result,'educacion'),'0');
  save({...base,collections:['cine']});result=updateHomeCollections(home,root);assert.equal(count(result,'educacion'),'0');assert.equal(count(result,'cine'),'1');
  fs.unlinkSync(path.join(dir,'prueba.md'));result=updateHomeCollections(home,root);assert.equal(count(result,'cine'),'0');
  console.log('Colecciones verificadas: Educación y Cine, cero inicial, publicación, múltiples colecciones, borradores, reasignación y retirada.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
