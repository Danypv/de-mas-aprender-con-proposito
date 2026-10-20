import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
const root=path.resolve(process.argv[2]||process.cwd());
const homePath=path.join(root,'index.html');let home=fs.readFileSync(homePath,'utf8');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const featured=home.match(/class="ficha"[\s\S]*?href="([^"#]+)"/)?.[1];
const canonical=v=>decodeURIComponent(v).replace(/^https?:\/\/somosdemas\.com\//,'/').replace(/^\/?/,'/').replace(/\/$/,'');
const sources=[['posts','Blog','blog','Leer'],['readings','Lecturas selectas','lecturas/textos','Leer'],['podcast-episodes','Podcast','podcast/episodios','Escuchar'],['videos','Video','videos','Ver']];
const items=[];const seen=new Set();
for(const [folder,section,prefix,action]of sources){
 const dir=path.join(root,'content',folder);if(!fs.existsSync(dir))continue;
 for(const name of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))){
  const {data}=matter.read(path.join(dir,name));if(data.status!=='published')continue;
  if(!data.slug||!data.title||Number.isNaN(new Date(data.date).getTime()))continue;
  const url=`/${prefix}/${encodeURIComponent(data.slug)}/`;const key=canonical(url);
  if(seen.has(key)||(featured&&key===canonical(featured)))continue;seen.add(key);
  const approved={
   'estoicismo-una-filosofia-de-vida': ['Vivir\ncon sentido.','Filosofía práctica para afrontar las decisiones de cada día.'],
   'conocer-el-cerebro-para-vivir-mejor': ['Comprender\nla mente.','Una mirada a la relación entre el cerebro y nuestra vida cotidiana.'],
   'La-tecnica-ante-el-límite-humano': ['Pensar\nel límite.','Una reflexión sobre la responsabilidad de crear tecnología.'],
   'humanidades-y-ciencias': ['Saberes\nen diálogo.','Ciencia y humanidades para comprender y habitar el mundo.','Integrar las humanidades y las ciencias']
  }[data.slug];
  const fallback={posts:'Ideas para\npensar.',readings:'Leer para\ncomprender.',videos:'Mirar y\npensar.','podcast-episodes':'Escuchar con\natención.'};
  const summary=data.banner_summary||approved?.[1]||String(data.summary||'').split(/(?<=[.!?])\s/)[0];
  const coverTitle=data.banner_title||approved?.[0]||fallback[folder];
  items.push({url,key,section,action,coverTitle,title:data.banner_heading||approved?.[2]||data.browser_title||data.title,fullTitle:data.title,summary,author:data.author||data.presenter||'',date:new Date(data.date),name});
 }
}
const latest=items.sort((a,b)=>b.date-a.date||b.name.localeCompare(a.name,'es')).slice(0,4);
const dateLabel=d=>new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
const slides=latest.map((item,i)=>`<article class="novedad-slide" data-slide${i?' hidden':''} aria-roledescription="diapositiva" aria-label="${i+1} de ${latest.length}">
 <a class="novedad-imagen" href="${esc(item.url)}" aria-label="${esc(item.action+' '+item.fullTitle)}"><div class="novedad-portada" aria-hidden="true"><span class="novedad-play">${item.action==='Ver'?'▷':item.action==='Escuchar'?'♪':'+'}</span><span class="novedad-portada-titulo">${esc(item.coverTitle).replaceAll('\n','<br>')}</span><span class="novedad-portada-pie">${item.action==='Ver'?'VER Y PENSAR':item.action==='Escuchar'?'PARA ESCUCHAR':'PARA PENSAR'}</span></div></a>
 <div class="novedad-texto"><p class="etiqueta">${esc(item.section)}<span class="novedad-fecha">${dateLabel(item.date)}</span></p><h3>${esc(item.title)}</h3><p class="novedad-resumen">${esc(item.summary)}</p>${item.author?`<p class="novedad-autor">${esc(item.author)}</p>`:''}<a class="enlace" href="${esc(item.url)}">${item.action}${item.action==='Ver'?' video':item.action==='Escuchar'?' episodio':' publicación'} <span class="flecha" aria-hidden="true">→</span></a></div>
</article>`).join('\n');
const banner=latest.length?`<section class="novedades" id="novedades" aria-labelledby="titulo-novedades"><div class="contenedor"><div class="novedades-cabecera"><div><p class="etiqueta">Novedades de DE+</p><h2 id="titulo-novedades">Lo más reciente.</h2></div><span class="novedades-cuenta" data-count aria-live="off">1 / ${latest.length}</span></div><div class="novedades-carrusel" data-carousel data-interval="7000" role="region" aria-roledescription="carrusel" aria-label="Últimas publicaciones de DE+"><div class="novedades-escenario" data-stage>${slides}</div><div class="novedades-progreso" aria-hidden="true"><span data-progress></span></div><div class="novedades-controles"${latest.length<2?' hidden':''}><button type="button" class="novedad-control" data-prev aria-label="Publicación anterior">←</button><div class="novedades-puntos">${latest.map((v,i)=>`<button type="button" data-dot="${i}" class="novedad-punto" aria-label="Mostrar publicación ${i+1}: ${esc(v.title)}"${!i?' aria-current="true"':''}><span aria-hidden="true"></span></button>`).join('')}</div><button type="button" class="novedad-control novedad-pausa" data-pause aria-pressed="false" aria-label="Pausar el avance automático">Pausar</button><button type="button" class="novedad-control" data-next aria-label="Siguiente publicación">→</button></div><p class="novedades-estado" data-status role="status" aria-live="polite"></p></div></div></section>`:'';
if(!home.includes('<!-- LATEST_START -->'))throw Error('Falta el punto de inserción del banner');
home=home.replace(/<!-- LATEST_START -->[\s\S]*?<!-- LATEST_END -->/,()=>`<!-- LATEST_START -->\n${banner}\n<!-- LATEST_END -->`);
fs.writeFileSync(homePath,home);console.log(`${latest.length} novedades generadas; solo contenidos publicados.`);
