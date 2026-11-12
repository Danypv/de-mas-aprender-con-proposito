import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import matter from 'gray-matter';
import {collections} from './readings.mjs';
import {updateHomeCollections} from './home-collections.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-collections-'));
try{
  const dir=path.join(root,'content/readings');fs.mkdirSync(dir,{recursive:true});
  const home=fs.readFileSync('index.html','utf8');
  const base={title:'Lectura de prueba',slug:'lectura',author:'Autora',date:'2026-10-31',summary:'Una lectura.',type:'full',status:'published',collections:['educacion','cine']};
  const save=(name,data={})=>fs.writeFileSync(path.join(dir,name+'.md'),matter.stringify('Texto para pensar.',{...base,...data}));
  const block=value=>value.match(/<!-- COLLECTIONS_START -->([\s\S]*?)<!-- COLLECTIONS_END -->/)?.[1]||'';
  const outside=value=>value.replace(/<!-- COLLECTIONS_START -->[\s\S]*?<!-- COLLECTIONS_END -->/,'');
  const card=(value,slug)=>block(value).match(new RegExp('<a class="lectura-coleccion" data-collection="'+slug+'"[\\s\\S]*?</a>'))?.[0]||'';
  const pending=(value,slug)=>block(value).includes('class="coleccion-proxima" data-collection="'+slug+'"');
  const count=(value,slug)=>Number(card(value,slug).match(/<strong>(\d+)<\/strong>/)?.[1]||0);
  const cover=(value,slug)=>card(value,slug).match(/<img src="([^"]+)"/)?.[1]||'';
  const build=()=>updateHomeCollections(home,root);

  let result=build();
  assert.equal(collections.length,8);
  assert.equal((block(result).match(/class="coleccion-proxima"/g)||[]).length,8);
  assert(!block(result).includes('class="lectura-coleccion"'));
  assert(!block(result).includes('<nav'),'No se genera una navegación vacía');
  assert.equal(updateHomeCollections('Sin punto de inserción',root),'Sin punto de inserción');
  for(const collection of collections)assert(pending(result,collection.slug));

  save('prueba');result=build();
  for(const slug of ['educacion','cine']){
    assert.equal(count(result,slug),1);assert(!pending(result,slug));
    assert(card(result,slug).includes('href="lecturas/'+slug+'/"'));
    assert(card(result,slug).includes('Lectura de prueba'));
    assert(card(result,slug).includes('coleccion-visual sin-imagen'));
    assert(card(result,slug).includes('aria-describedby="coleccion-'+slug+'-lectura"'));
  }
  assert(block(result).includes('Todas las lecturas <span>1</span>'),'Una lectura en varias colecciones cuenta una sola vez en el total');
  assert.equal(outside(result),outside(home),'Solo cambia la franja de Lecturas selectas');
  assert.equal(updateHomeCollections(result,root),result,'La generación es estable');

  save('destacada',{slug:'destacada',title:'Destacada antigua',featured:true,date:'2026-10-01',collections:['educacion']});
  save('reciente',{slug:'reciente',title:'Una lectura <nueva> & $&',date:'2026-11-02',collections:['educacion']});
  result=build();assert.equal(count(result,'educacion'),3);
  assert(card(result,'educacion').includes('Una lectura &lt;nueva&gt; &amp; $&'));
  assert(!card(result,'educacion').includes('Destacada antigua'),'La fecha prevalece sobre el campo destacado');

  const image='/assets/imagenes/blog/portada.jpg';
  fs.mkdirSync(path.join(root,'assets/imagenes/blog'),{recursive:true});
  fs.writeFileSync(path.join(root,image),'portada inicial');
  const newest={slug:'reciente',title:'Título actualizado',date:'2026-11-02',collections:['educacion'],cover:image,cover_alt:'Una portada "nueva"',publication_type:'book'};
  save('reciente',newest);result=build();const initial=cover(result,'educacion');
  assert(initial.startsWith(image+'?v='));
  assert(card(result,'educacion').includes('Título actualizado'));
  assert(card(result,'educacion').includes('alt="Una portada &quot;nueva&quot;"'));
  assert(card(result,'educacion').includes('coleccion-visual--libro'));
  fs.writeFileSync(path.join(root,image),'otra imagen con el mismo nombre');
  result=build();assert.notEqual(cover(result,'educacion'),initial,'La misma ruta con otros bytes renueva la portada');
  save('reciente',{...newest,cover:'',cover_alt:''});
  result=build();assert(!cover(result,'educacion'));assert(card(result,'educacion').includes('sin-imagen'));

  save('reciente',{...newest,status:'draft'});result=build();
  assert.equal(count(result,'educacion'),2);assert(card(result,'educacion').includes('Lectura de prueba'));
  assert(!block(result).includes('Título actualizado'),'Un borrador nuevo no se muestra');
  save('prueba',{collections:['cine']});result=build();
  assert.equal(count(result,'educacion'),1);assert(card(result,'educacion').includes('Destacada antigua'));
  fs.unlinkSync(path.join(dir,'destacada.md'));result=build();
  assert(pending(result,'educacion'));assert(!card(result,'educacion'));
  assert.equal(count(result,'cine'),1);
  fs.unlinkSync(path.join(dir,'prueba.md'));result=build();
  assert(pending(result,'cine'));assert(!card(result,'cine'));
  fs.unlinkSync(path.join(dir,'reciente.md'));

  // Every configured collection opens with its first publication and closes with its last.
  save('todas',{collections:collections.map(item=>item.slug)});result=build();
  for(const collection of collections){assert.equal(count(result,collection.slug),1);assert(!pending(result,collection.slug));}
  assert(!block(result).includes('proximas-colecciones'),'La lista de próximas colecciones desaparece cuando todas tienen contenido');
  assert(block(result).includes('Todas las lecturas <span>1</span>'));
  fs.unlinkSync(path.join(dir,'todas.md'));result=build();
  for(const collection of collections)assert(pending(result,collection.slug));

  // A failed network image uses the same placeholder and can recover after loading.
  const images=[];
  const fixture=(complete,naturalWidth)=>{
    const classes=new Set(),attrs=new Map(),listeners={};
    const image={complete,naturalWidth,hidden:false,parentElement:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name)},addEventListener:(name,fn)=>listeners[name]=fn};
    images.push(image);return {image,classes,attrs,listeners};
  };
  const waiting=fixture(false,0),broken=fixture(true,0),loaded=fixture(true,128);
  vm.runInNewContext(fs.readFileSync('assets/colecciones.js','utf8'),{document:{querySelectorAll:()=>images}});
  assert.equal(waiting.image.hidden,false);assert.equal(loaded.image.hidden,false);
  assert(broken.image.hidden&&broken.classes.has('sin-imagen'));
  broken.image.naturalWidth=128;broken.listeners.load();assert(!broken.image.hidden&&!broken.classes.has('sin-imagen'));assert(!broken.attrs.has('aria-hidden'));
  waiting.image.complete=true;waiting.listeners.error();assert(waiting.image.hidden&&waiting.classes.has('sin-imagen'));
  console.log('Colecciones verificadas: activación de las ocho categorías, última lectura por fecha, títulos y portadas actualizados, imagen sustituida con el mismo nombre, privacidad, reasignación, eliminación y regreso a Próximamente.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
