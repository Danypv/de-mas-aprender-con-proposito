import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
import {execFileSync} from 'node:child_process';
import {identifyTopics} from './topics.mjs';
import {buildRelated,relatedInventory,relatedSelections,relatedBlock} from './related.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-related-'));
const write=(file,text)=>{const f=path.join(root,file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text)};
const base={title:'Publicación',author:'Autora',date:'2026-10-17',summary:'Resumen breve para pensar.',status:'published'};
const save=(folder,file,data)=>write(`content/${folder}/${file}.md`,matter.stringify('Contenido propio.',data));
const url=slug=>`/blog/${slug}/`;
const selected=slug=>relatedSelections(relatedInventory(root)).get(url(slug));
const page=route=>path.join(root,decodeURIComponent(route.slice(1)),'index.html');
const frame='Cabecera y artículo sin cambios.<!-- RELATED_START --><!-- RELATED_END -->Pie sin cambios.';
const generate=()=>{for(const item of relatedInventory(root))if(!fs.existsSync(page(item.url)))write(path.relative(root,page(item.url)),frame);return buildRelated(root)};
try{
  assert(identifyTopics({title:'ChatGPT en la educación',summary:'Una pregunta ética.'}).includes('inteligencia-artificial'));
  assert(identifyTopics({title:'Conocer el cerebro',categories:['Ciencia y salud']}).includes('neurociencia'));
  assert.deepEqual(identifyTopics({topics:null,title:'Cine'}),['cine']);
  assert.deepEqual(identifyTopics({topics:['teologia'],title:'ChatGPT'}),['teologia'],'La elección editorial prevalece');
  assert.throws(()=>identifyTopics({topics:['desconocido']}),/temas válidos/);
  save('posts','origen',{...base,slug:'origen',categories:['Ética'],topics:['inteligencia-artificial','neurociencia','etica']});
  assert.deepEqual(selected('origen'),[]);generate();assert(!fs.readFileSync(page(url('origen')),'utf8').includes('Para seguir pensando'));
  save('readings','resena',{...base,title:'Reseña <especial> & juicio',slug:'resena',date:'2026-10-30',type:'full',collections:['filosofia'],topics:['inteligencia-artificial','etica']});
  save('videos','video',{...base,slug:'video',categories:['Ciencia y salud'],format:'conversation',source_url:'https://youtu.be/WisWde4lZdQ',topics:['neurociencia','salud']});
  const series={title:'Conversaciones',slug:'serie',presenter:'Presentadora',summary:'Una serie.',status:'published',topics:['cine']};
  save('podcast-series','serie',series);
  save('podcast-episodes','audio',{...base,title:'Un episodio sobre el cerebro',slug:'audio',series:'serie',audio_url:'https://example.org/audio.mp3',topics:['neurociencia'],date:'2026-10-16'});
  save('posts','privado',{...base,slug:'privado',status:'draft',categories:['Ética'],topics:['inteligencia-artificial','neurociencia','etica'],date:'2026-12-31'});
  save('posts','ajeno',{...base,slug:'ajeno',categories:['Cine'],topics:['cine'],date:'2026-12-31'});
  let inventory=relatedInventory(root),selection=selected('origen');
  assert.equal(selection.length,2);assert(selection[0].url.includes('/lecturas/textos/resena/'));assert(selection[1].url.includes('/videos/video/'));
  assert(!selection.some(item=>item.url===url('origen')||item.url===url('privado')||item.url===url('ajeno')));
  assert(inventory.some(item=>item.section==='Podcast'));
  const html=relatedBlock(selection);assert(html.includes('Reseña &lt;especial&gt; &amp; juicio'));assert(html.includes('data-pagefind-ignore="all"'));
  generate();const first=fs.readFileSync(page(url('origen')),'utf8');generate();assert.equal(fs.readFileSync(page(url('origen')),'utf8'),first,'Salida estable');
  assert.equal(first.replace(/<!-- RELATED_START -->[\s\S]*?<!-- RELATED_END -->/,''),frame.replace(/<!-- RELATED_START -->[\s\S]*?<!-- RELATED_END -->/,''),'No cambia el artículo ni el pie');
  save('posts','nueva',{...base,slug:'nueva',title:'Una novedad pertinente',categories:['IA'],topics:['inteligencia-artificial','etica'],date:'2026-11-01'});
  assert.equal(selected('origen')[0].url,url('nueva'),'La novedad de afinidad equivalente se prioriza');generate();assert(fs.readFileSync(page(url('origen')),'utf8').includes('/blog/nueva/'));
  assert.equal(new Set(selected('origen').map(item=>item.url)).size,2,'La publicación más afín y más reciente no se repite');
  save('posts','reciente',{...base,slug:'reciente',categories:['Ética'],topics:['etica'],date:'2026-11-02'});
  assert.deepEqual(selected('origen').map(item=>item.url),[url('nueva'),url('reciente')],'La segunda tarjeta reserva espacio a la novedad aunque comparta menos temas');
  assert.deepEqual(relatedSelections([...relatedInventory(root)].reverse()).get(url('origen')).map(item=>item.url),[url('nueva'),url('reciente')],'El orden del inventario no cambia las recomendaciones');
  fs.unlinkSync(path.join(root,'content/posts/reciente.md'));
  save('posts','nueva',{...base,slug:'nueva',categories:['Cine'],topics:['cine'],date:'2026-11-01'});generate();assert(!fs.readFileSync(page(url('origen')),'utf8').includes('/blog/nueva/'),'Reasignar temas retira la relación');
  fs.unlinkSync(path.join(root,'content/readings/resena.md'));generate();selection=selected('origen');assert(selection.every(item=>!item.url.includes('/resena/')));assert(!fs.readFileSync(page(url('origen')),'utf8').includes('/resena/'));
  save('podcast-episodes','audio',{...base,title:'Un episodio',slug:'audio-nuevo',series:'serie',audio_url:'https://example.org/audio.mp3',topics:[],date:'2026-11-01'});
  inventory=relatedInventory(root);assert.deepEqual(inventory.find(item=>item.section==='Podcast').topics,['cine'],'Herencia de los temas de la serie');
  assert(relatedSelections(inventory).get(url('ajeno')).some(item=>item.url==='/podcast/episodios/audio-nuevo/'),'Podcast participa con su dirección actual');
  const video=inventory.find(item=>item.section==='Video');assert(relatedSelections(inventory).get(video.url).some(item=>item.url===url('origen')),'Relaciones en ambas direcciones entre secciones');
  for(const folder of ['videos','podcast-episodes'])for(const file of fs.readdirSync(path.join(root,'content',folder)))fs.unlinkSync(path.join(root,'content',folder,file));
  generate();assert.deepEqual(selected('origen'),[]);assert(!fs.readFileSync(page(url('origen')),'utf8').includes('Para seguir pensando'),'Sin afinidad se oculta el bloque');
  console.log('Recomendaciones verificadas: cuatro secciones, afinidad, novedades, privacidad, temas opcionales y heredados, cambios, retiradas, estabilidad y conservación del contenido.');
}finally{fs.rmSync(root,{recursive:true,force:true})}

// Run the publication pipeline with the real templates, including a podcast
// episode that inherits its topics. These pages never leave the temporary copy.
const source=process.cwd();
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'demas-related-templates-'));
try{
  for(const folder of ['scripts','templates'])fs.cpSync(path.join(source,folder),path.join(fixture,folder),{recursive:true});
  fs.symlinkSync(path.join(source,'node_modules'),path.join(fixture,'node_modules'),'dir');
  fs.mkdirSync(path.join(fixture,'blog'));
  for(const file of ['index.html','blog/index.html'])fs.copyFileSync(path.join(source,file),path.join(fixture,file));
  const save=(folder,name,data)=>{
    const directory=path.join(fixture,'content',folder);fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,name+'.md'),matter.stringify('Contenido propio de la prueba de integración.',data));
  };
  const shared={...base,topics:['filosofia','etica']};
  save('posts','articulo',{...shared,slug:'articulo',categories:['Filosofía']});
  save('readings','resena',{...shared,slug:'resena',date:'2026-10-18',type:'full',collections:['filosofia']});
  save('videos','video',{...shared,slug:'video',date:'2026-10-19',topics:['filosofia'],categories:['Filosofía'],format:'conversation',source_url:'https://youtu.be/WisWde4lZdQ'});
  save('podcast-series','serie',{title:'Serie de prueba',slug:'serie',presenter:'Autora',summary:'Una serie.',status:'published',topics:shared.topics});
  save('podcast-episodes','episodio',{...base,slug:'episodio',series:'serie',date:'2026-10-20',audio_url:'https://example.org/audio.mp3'});
  const run=builder=>execFileSync(process.execPath,['scripts/build-'+builder+'.mjs'],{cwd:fixture,stdio:'pipe'});
  const build=()=>{for(const builder of ['content','readings','videos','podcasts','latest'])run(builder)};
  const file=route=>path.join(fixture,route.slice(1),'index.html');
  const html=route=>fs.readFileSync(file(route),'utf8');
  const links=route=>[...html(route).match(/<!-- RELATED_START -->([\s\S]*?)<!-- RELATED_END -->/)[1].matchAll(/class="relacionado" href="([^"]+)"/g)].map(match=>match[1]);
  const routes=['/blog/articulo/','/lecturas/textos/resena/','/videos/video/','/podcast/episodios/episodio/'];
  const outside=value=>value.replace(/<!-- RELATED_START -->[\s\S]*?<!-- RELATED_END -->/,'');
  build();
  assert.deepEqual(links(routes[0]),[routes[3],routes[2]],'El blog conserva la mayor afinidad y da paso al video más nuevo que la reseña');
  assert.deepEqual(links(routes[3]),[routes[1],routes[2]],'El episodio hereda los temas y recomienda otras secciones');
  for(const route of routes){
    const page=html(route),targets=links(route);
    assert(page.includes('href="/assets/relacionados.css"'),`${route}: estilos de recomendaciones`);
    assert.equal((page.match(/id="relacionados-titulo"/g)||[]).length,1,`${route}: un solo bloque`);
    assert.equal(targets.length,2);assert.equal(new Set(targets).size,2);
    for(const target of targets){assert.notEqual(target,route);assert(fs.existsSync(file(target)),`${route}: destino existente ${target}`)}
  }
  const before=new Map(routes.map(route=>[route,html(route)]));
  build();
  for(const route of routes)assert.equal(html(route),before.get(route),`${route}: generación estable con las plantillas reales`);
  // Validate all destinations and markers before writing any recommendation.
  fs.unlinkSync(file(routes[3]));
  assert.throws(()=>buildRelated(fixture),/Genera primero/);
  for(const route of routes.slice(0,3))assert.equal(html(route),before.get(route),'Un destino ausente no altera otros bloques');
  fs.writeFileSync(file(routes[3]),before.get(routes[3]));
  fs.writeFileSync(file(routes[3]),outside(before.get(routes[3])));
  assert.throws(()=>buildRelated(fixture),/Falta el espacio de recomendaciones/);
  for(const route of routes.slice(0,3))assert.equal(html(route),before.get(route),'Un marcador ausente no altera otros bloques');
  fs.writeFileSync(file(routes[3]),before.get(routes[3]));
  // Match the CMS withdrawal: remove both the source and its generated page.
  fs.unlinkSync(path.join(fixture,'content/podcast-episodes/episodio.md'));
  fs.unlinkSync(file(routes[3]));
  build();
  for(const route of routes.slice(0,3)){
    assert(!links(route).includes(routes[3]),'Retirar el episodio elimina las recomendaciones hacia él');
    assert.equal(outside(html(route)),outside(before.get(route)),'Solo cambia el bloque de recomendaciones');
    for(const target of links(route))assert(fs.existsSync(file(target)));
  }
  console.log('Integración verificada con las cuatro plantillas reales: enlaces, herencia, novedades, generación estable, retirada de episodios y validación de destinos y marcadores.');
}finally{fs.rmSync(fixture,{recursive:true,force:true})}
