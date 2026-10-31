import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import { expandSearchQuery } from '../assets/buscar-consultas.js';

const root=process.cwd();
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'demas-global-search-'));
const original={fetch:globalThis.fetch,document:globalThis.document,location:globalThis.location};
let engine;
try {
  for (const dir of ['scripts','templates']) fs.cpSync(path.join(root,dir),path.join(fixture,dir),{recursive:true});
  fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'dir');
  fs.mkdirSync(path.join(fixture,'blog'));
  fs.copyFileSync(path.join(root,'index.html'),path.join(fixture,'index.html'));
  fs.copyFileSync(path.join(root,'blog/index.html'),path.join(fixture,'blog/index.html'));
  for (const folder of ['posts','readings','videos','podcast-series','podcast-episodes']) fs.mkdirSync(path.join(fixture,'content',folder),{recursive:true});
  const base={title:'Juicio y filosofía',slug:'prueba',author:'Autora Boreal',date:'2026-10-31',summary:'Una investigación para conversar.',status:'published'};
  const save=(folder,data,body='En el centro del texto aparece juiciocompartido.')=>fs.writeFileSync(path.join(fixture,'content',folder,'prueba.md'),matter.stringify(body,data));
  const post={...base,title:'Atención con <etiquetas> & criterio',categories:['Ética']};
  save('posts',post,'La inteligencia artificial requiere juicio. En el centro aparece juiciocompartido y cromaticaantigua.');
  save('readings',{...base,title:'Leer filosofía',type:'full',collections:['filosofia'],source_url:'https://example.org/fuente',source_name:'Cuadernos Boreales'},'La inteligencia artificial y juiciocompartido invitan a la lectura.');
  save('videos',{...base,title:'Un video para pensar',categories:['Educación'],format:'conference',source_url:'https://youtu.be/WisWde4lZdQ',transcript:'El término transcripcionvisual aparece en el video.'});
  save('podcast-series',{title:'Conversaciones',slug:'serie',presenter:'Voz Austral',summary:'Una serie de DE+.',status:'published'},'La presentación contiene presentacionaustral.');
  save('podcast-episodes',{...base,title:'El episodio del juicio',series:'serie',audio_url:'https://example.org/audio.mp3',transcript:'La palabra transcripcionaudio aparece en el episodio.'});
  fs.writeFileSync(path.join(fixture,'content/posts/privado.md'),matter.stringify('secretoborrador',{...base,slug:'privado',categories:['Ética'],status:'draft'}));
  const run=script=>execFileSync(process.execPath,[`scripts/${script}.mjs`],{cwd:fixture,stdio:'pipe'});
  const build=()=>{ for(const step of ['build-content','build-readings','build-videos','build-podcasts','build-latest','build-sitemap','build-search','check-search']) run(step); };
  const manifest=()=>JSON.parse(fs.readFileSync(path.join(fixture,'assets/busqueda/manifest.json'),'utf8'));

  globalThis.document={currentScript:null,querySelector:()=>({getAttribute:()=> 'es'})};
  globalThis.location=new URL('https://somosdemas.com/');
  globalThis.fetch=async input=>{
    const url=new URL(input,globalThis.location);
    assert.equal(url.origin,'https://somosdemas.com');
    const file=path.resolve(fixture,'.'+decodeURIComponent(url.pathname));
    assert(file.startsWith(fixture+path.sep));
    return new Response(fs.readFileSync(file),{status:200,headers:{'content-type':'application/octet-stream'}});
  };
  const load=async()=>{
    if(engine) await engine.destroy();
    const file=manifest();
    engine=await import(pathToFileURL(path.join(fixture,file.bundle)));
    await engine.options({basePath:'https://somosdemas.com'+file.bundle.replace('pagefind.js',''),noWorker:true});
  };
  const find=async(term,section)=>{
    const result=await engine.search(expandSearchQuery(term),section?{filters:{section}}:{});
    return Promise.all(result.results.map(item=>item.data()));
  };
  build();
  assert.equal(manifest().publicationCount,5,'Las cuatro secciones y la serie entran en el índice');
  assert.equal(manifest().count,17);
  await load();
  assert.equal((await find('juiciocompartido')).length,4,'Se busca en el texto completo');
  for(const section of ['Blog','Lecturas selectas','Videos','Podcast']) {
    const results=await find('juiciocompartido',section);
    assert.equal(results.length,1);
    assert.equal(results[0].meta.section,section);
  }
  assert((await find('filosofia')).some(item=>item.url==='/lecturas/textos/prueba/'),'Búsqueda sin tildes');
  assert.equal((await find('IA')).length,2,'Equivalencia entre IA e inteligencia artificial');
  assert.equal((await find('transcripcionvisual'))[0].url,'/videos/prueba/');
  assert.equal((await find('transcripcionaudio'))[0].url,'/podcast/episodios/prueba/');
  assert.equal((await find('presentacionaustral'))[0].url,'/podcast/series/serie/');
  assert.equal((await find('Elizabeth'))[0].url,'/#sobre','También se busca en Sobre DE+');
  assert((await find('Cuadernos Boreales')).some(item=>item.url==='/lecturas/textos/prueba/'));
  assert.equal((await find('"secretoborrador"')).length,0,'Un borrador no se indexa; la coincidencia exacta evita sugerencias por prefijo');
  assert.equal((await find('"Facebook"')).length,0,'Los botones de compartir quedan fuera del texto de búsqueda');
  const unsafe=(await find('etiquetas'))[0];
  assert.equal(unsafe.meta.title,post.title,'El título conserva sus caracteres');
  const stable=manifest().revision;
  run('build-search');
  assert.equal(manifest().revision,stable,'Generación estable');

  save('posts',{...post,title:'Un título actualizado'},'La inteligencia artificial y juiciocompartido. Ahora aparece cromaticanueva.');
  build(); await load();
  assert.notEqual(manifest().revision,stable,'Las ediciones renuevan el índice');
  assert.equal((await find('"cromaticaantigua"')).length,0);
  assert.equal((await find('cromaticanueva'))[0].meta.title,'Un título actualizado');
  fs.unlinkSync(path.join(fixture,'content/videos/prueba.md'));
  save('posts',{...post,status:'draft'},'La inteligencia artificial y juiciocompartido. cromaticanueva.');
  build(); await load();
  assert(fs.existsSync(path.join(fixture,'videos/prueba/index.html')),'La prueba conserva una página antigua a propósito');
  assert.equal((await find('"transcripcionvisual"')).length,0,'Los archivos antiguos no vuelven a entrar en el buscador');
  assert.equal((await find('"cromaticanueva"')).length,0,'Retirar una publicación también la retira del índice');
  assert.equal(manifest().publicationCount,3);

  save('posts',{...post,slug:'publicacion-futura'},'Una publicación nueva con incorporacionfutura.');
  build(); await load();
  assert.equal((await find('incorporacionfutura'))[0].url,'/blog/publicacion-futura/','La siguiente publicación se incorpora sin campos nuevos');
  fs.unlinkSync(path.join(fixture,'lecturas/textos/prueba/index.html'));
  assert.throws(()=>run('build-search'),'Una página ausente bloquea la publicación');
  console.log('Buscador verificado con Pagefind: cuatro secciones, series, texto completo, transcripciones, filtros, tildes, IA, nuevas publicaciones, ediciones, retiradas, borradores y cobertura.');
} finally {
  if(engine) await engine.destroy();
  for(const [key,value] of Object.entries(original)) { if(value===undefined)delete globalThis[key]; else globalThis[key]=value; }
  fs.rmSync(fixture,{recursive:true,force:true});
}
