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
  for (const folder of ['essays','posts','readings','videos','podcast-series','podcast-episodes']) fs.mkdirSync(path.join(fixture,'content',folder),{recursive:true});
  const base={title:'Juicio y filosofía',slug:'prueba',author:'Autora Boreal',date:'2026-10-31',summary:'Una investigación para conversar.',status:'published'};
  const save=(folder,data,body='En el centro del texto aparece juiciocompartido.')=>fs.writeFileSync(path.join(fixture,'content',folder,'prueba.md'),matter.stringify(body,data));
  const reference=word=>`Autora, A. (2020). *${word}*. Editorial de prueba. https://example.org/${word}`;
  const post={...base,title:'Atención con <etiquetas> & criterio',categories:['Ética'],references:reference('bibliografiablog')};
  save('posts',post,'La inteligencia artificial requiere juicio. En el centro aparece juiciocompartido y cromaticaantigua.');
  save('readings',{...base,title:'Leer filosofía',type:'full',collections:['filosofia','educacion','cine'],source_url:'https://example.org/fuente',source_name:'Cuadernos Boreales',references:reference('bibliografialectura')},'La inteligencia artificial y juiciocompartido invitan a la lectura.');
  save('videos',{...base,title:'Un video para pensar',categories:['Educación'],format:'conference',source_url:'https://youtu.be/WisWde4lZdQ',transcript:'El término transcripcionvisual aparece en el video.',references:reference('bibliografiavideo')});
  save('podcast-series',{title:'Conversaciones',slug:'serie',presenter:'Voz Austral',summary:'Una serie de DE+.',status:'published',references:reference('bibliografiaserie')},'La presentación contiene presentacionaustral.');
  save('podcast-episodes',{...base,title:'El episodio del juicio',series:'serie',audio_url:'https://example.org/audio.mp3',transcript:'La palabra transcripcionaudio aparece en el episodio.',references:reference('bibliografiaepisodio')});
  save('essays',{...base,title:'Un ensayo sobre Platón',categories:['filosofia','ciencia','teologia'],references:reference('bibliografiaensayo')},'El eros y juiciocompartido con textopropioensayo.');
  fs.writeFileSync(path.join(fixture,'content/posts/privado.md'),matter.stringify('secretoborrador',{...base,slug:'privado',categories:['Ética'],status:'draft',references:reference('bibliografiaprivada')}));
  const run=script=>execFileSync(process.execPath,[`scripts/${script}.mjs`],{cwd:fixture,stdio:'pipe'});
  const build=()=>{ for(const step of ['build-essays','build-content','build-readings','build-videos','build-podcasts','build-latest','build-sitemap','build-search','check-search']) run(step); };
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
  assert.equal(manifest().publicationCount,6,'Las cinco secciones y la serie entran en el índice');
  assert.equal(manifest().count,21);
  for(const item of manifest().entries) {
    const page=fs.readFileSync(path.join(fixture,decodeURIComponent(item.url.split('#')[0].slice(1)),'index.html'),'utf8');
    assert(!page.includes('id="buscar"'),`No reaparece un buscador local en ${item.url}`);
    assert(page.includes('src="/assets/buscar.js"'),`La lupa global permanece en ${item.url}`);
  }
  assert(/<div hidden class="herramientas"/.test(fs.readFileSync(path.join(fixture,'blog/index.html'),'utf8')),'Un solo tema no muestra un filtro redundante');
  await load();
  assert.equal((await find('juiciocompartido')).length,5,'Se busca en el texto completo');
  for(const section of ['Blog','Ensayos','Lecturas selectas','Videos','Podcast']) {
    const results=await find('juiciocompartido',section);
    assert.equal(results.length,1);
    assert.equal(results[0].meta.section,section);
  }
  assert((await find('filosofia')).some(item=>item.url==='/lecturas/textos/prueba/'),'Búsqueda sin tildes');
  for(const theme of ['Ciencia','Teología'])assert((await find(theme,'Ensayos')).some(item=>item.url==='/ensayos/prueba/'),'Los temas nuevos de Ensayos se indexan');
  assert.equal((await find('IA')).length,2,'Equivalencia entre IA e inteligencia artificial');
  assert.equal((await find('transcripcionvisual'))[0].url,'/videos/prueba/');
  assert.equal((await find('transcripcionaudio'))[0].url,'/podcast/episodios/prueba/');
  assert.equal((await find('presentacionaustral'))[0].url,'/podcast/series/serie/');
  for (const [term,url] of [['bibliografiablog','/blog/prueba/'],['bibliografialectura','/lecturas/textos/prueba/'],['bibliografiavideo','/videos/prueba/'],['bibliografiaserie','/podcast/series/serie/'],['bibliografiaepisodio','/podcast/episodios/prueba/'],['bibliografiaensayo','/ensayos/prueba/']]) {
    const page=fs.readFileSync(path.join(fixture,url,'index.html'),'utf8');
    assert(page.includes('<details class="referencias"><summary>Referencias</summary>'),'La referencia está en un desplegable cerrado');
    assert.equal((await find(`"${term}"`))[0].url,url,'Se encuentran referencias aunque el apartado esté cerrado');
  }
  assert.equal((await find('"bibliografiaprivada"')).length,0,'Las referencias de los borradores permanecen privadas');
  assert.equal((await find('Elizabeth'))[0].url,'/#sobre','También se busca en Sobre DE+');
  assert((await find('Cuadernos Boreales')).some(item=>item.url==='/lecturas/textos/prueba/'));
  for(const term of ['Educación','Cine']) assert((await find(term,'Lecturas selectas')).some(item=>item.url==='/lecturas/textos/prueba/'),'Las nuevas colecciones participan en la búsqueda');
  assert.equal((await find('"secretoborrador"')).length,0,'Un borrador no se indexa; la coincidencia exacta evita sugerencias por prefijo');
  assert.equal((await find('"Facebook"')).length,0,'Los botones de compartir quedan fuera del texto de búsqueda');
  const unsafe=(await find('etiquetas'))[0];
  assert.equal(unsafe.meta.title,post.title,'El título conserva sus caracteres');
  const stable=manifest().revision;
  run('build-search');
  assert.equal(manifest().revision,stable,'Generación estable');

  save('posts',{...post,title:'Un título actualizado',categories:['Ética','Educación'],references:reference('bibliografiacorregida')},'La inteligencia artificial y juiciocompartido. Ahora aparece cromaticanueva.');
  build(); await load();
  assert(!/<div hidden class="herramientas"/.test(fs.readFileSync(path.join(fixture,'blog/index.html'),'utf8')),'Un tema nuevo habilita la exploración del blog');
  assert.notEqual(manifest().revision,stable,'Las ediciones renuevan el índice');
  assert.equal((await find('"cromaticaantigua"')).length,0);
  assert.equal((await find('cromaticanueva'))[0].meta.title,'Un título actualizado');
  assert.equal((await find('"bibliografiablog"')).length,0,'Editar las referencias retira su texto anterior del índice');
  assert.equal((await find('"bibliografiacorregida"'))[0].url,'/blog/prueba/');
  fs.unlinkSync(path.join(fixture,'content/videos/prueba.md'));
  save('posts',{...post,status:'draft'},'La inteligencia artificial y juiciocompartido. cromaticanueva.');
  build(); await load();
  assert(fs.existsSync(path.join(fixture,'videos/prueba/index.html')),'La prueba conserva una página antigua a propósito');
  assert(/<div hidden class="herramientas"/.test(fs.readFileSync(path.join(fixture,'blog/index.html'),'utf8')),'Un blog vacío no muestra filtros');
  assert.equal((await find('"transcripcionvisual"')).length,0,'Los archivos antiguos no vuelven a entrar en el buscador');
  assert.equal((await find('"cromaticanueva"')).length,0,'Retirar una publicación también la retira del índice');
  for (const term of ['bibliografiavideo','bibliografiacorregida','bibliografiablog']) assert.equal((await find(`"${term}"`)).length,0,'Las referencias retiradas no aparecen aunque quede una página antigua');
  assert.equal(manifest().publicationCount,4);

  save('posts',{...post,slug:'publicacion-futura'},'Una publicación nueva con incorporacionfutura.');
  build(); await load();
  assert.equal((await find('incorporacionfutura'))[0].url,'/blog/publicacion-futura/','La siguiente publicación se incorpora sin campos nuevos');
  save('essays',{...base,title:'Ensayo corregido',categories:['etica']},'Texto actualizado textocorregidoensayo.');
  build();await load();assert.equal((await find('textocorregidoensayo','Ensayos'))[0].meta.title,'Ensayo corregido');
  assert.equal((await find('"textopropioensayo"')).length,0);
  assert.equal((await find('"bibliografiaensayo"')).length,0,'Vaciar el campo elimina las referencias del buscador');
  assert(!fs.readFileSync(path.join(fixture,'ensayos/prueba/index.html'),'utf8').includes('class="referencias"'));
  fs.unlinkSync(path.join(fixture,'content/essays/prueba.md'));
  build();await load();assert.equal((await find('"textocorregidoensayo"')).length,0);
  assert(!fs.existsSync(path.join(fixture,'ensayos/prueba/index.html')));
  fs.unlinkSync(path.join(fixture,'lecturas/textos/prueba/index.html'));
  assert.throws(()=>run('build-search'),'Una página ausente bloquea la publicación');
  console.log('Buscador verificado con Pagefind: cinco secciones, series, texto completo, transcripciones, filtros, tildes, IA, nuevas publicaciones, ediciones, retiradas, borradores y cobertura.');
} finally {
  if(engine) await engine.destroy();
  for(const [key,value] of Object.entries(original)) { if(value===undefined)delete globalThis[key]; else globalThis[key]=value; }
  fs.rmSync(fixture,{recursive:true,force:true});
}
