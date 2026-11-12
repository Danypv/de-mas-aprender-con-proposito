import {latestCover, versionedAsset} from './latest-covers.mjs';
import { normalizePublicationAuthors } from './authors.mjs';
import {buildRelated} from './related.mjs';
import {buildRedirects} from './redirects.mjs';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {updateHomeCollections} from './home-collections.mjs';
import {updateHomeEssays} from './essays.mjs';
import {updateHomeBlog} from './home-blog.mjs';
import {updateHomeMedia} from './home-media.mjs';
import {buildSharedFooter} from './footer.mjs';
const root=path.resolve(process.argv[2]||process.cwd());
const homePath=path.join(root,'index.html');let home=fs.readFileSync(homePath,'utf8');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const featured=home.match(/class="ficha"[\s\S]*?href="([^"#]+)"/)?.[1];
const canonical=v=>decodeURIComponent(v).replace(/^https?:\/\/somosdemas\.com\//,'/').replace(/^\/?/,'/').replace(/\/$/,'');
const sources=[['posts','Blog','blog','Leer'],['essays','Ensayos','ensayos','Leer'],['readings','Lecturas selectas','lecturas/textos','Leer'],['podcast-episodes','Podcast','podcast/episodios','Escuchar'],['videos','Video','videos','Ver']];
const items=[];const seen=new Set();
for(const [folder,section,prefix,action]of sources){
 const dir=path.join(root,'content',folder);if(!fs.existsSync(dir))continue;
 for(const name of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))){
  const {data}=matter.read(path.join(dir,name));
    Object.assign(data, normalizePublicationAuthors(data));if(data.status!=='published')continue;
  if(!data.slug||!data.title||Number.isNaN(new Date(data.date).getTime()))continue;
  const url=`/${prefix}/${encodeURIComponent(data.slug)}/`;const key=canonical(url);
  if(seen.has(key)||(featured&&key===canonical(featured)))continue;seen.add(key);
  const approved={
   'estoicismo-una-filosofia-de-vida': ['Vivir\ncon sentido.','Filosofía práctica para afrontar las decisiones de cada día.'],
   'conocer-el-cerebro-para-vivir-mejor': ['Comprender\nla mente.','Una mirada a la relación entre el cerebro y nuestra vida cotidiana.'],
   'La-tecnica-ante-el-límite-humano': ['Pensar\nel límite.','Una reflexión sobre la responsabilidad de crear tecnología.']
  }[data.slug];
  const fallback={posts:'Ideas para\npensar.',essays:'Pensar\na fondo',readings:'Leer para\ncomprender.',videos:'Mirar y\npensar.','podcast-episodes':'Escuchar con\natención.'};
  const summary=data.banner_summary||approved?.[1]||String(data.summary||'').split(/(?<=[.!?])\s/)[0];
  const coverTitle=data.banner_title||approved?.[0]||fallback[folder];
  items.push({url,key,section,action,coverTitle,title:data.banner_heading||approved?.[2]||data.browser_title||data.title,fullTitle:data.title,summary,author:data.author||data.presenter||'',cover:latestCover(root,data),date:new Date(data.date),name});
 }
}
const latest=items.sort((a,b)=>b.date-a.date||b.name.localeCompare(a.name,'es')).slice(0,4);
const dateLabel=d=>new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
const actionLabel=item=>item.action==='Ver'?'Ver video':item.action==='Escuchar'?'Escuchar episodio':item.section==='Ensayos'?'Leer ensayo':item.section==='Lecturas selectas'?'Leer reseña':'Leer publicación';
const position=(i,n)=>i===0?'current':i===1?'right':i===n-1?'left':'away';
const slides=latest.map((item,i)=>{
 const visual=item.cover?`<a class="novedad-visual${item.cover.book?' novedad-visual--libro':''}" data-image-state="loading" href="${esc(item.url)}" aria-label="${esc(item.action+' '+item.fullTitle)}"><img src="${esc(item.cover.url)}" alt="${esc(item.cover.alt)}" width="960" height="540" loading="lazy" decoding="async" draggable="false"></a>`:'<div class="novedad-visual" data-image-state="missing" aria-hidden="true"></div>';
 return `<article class="novedad-slide novedad-tarjeta" data-slide data-position="${position(i,latest.length)}" aria-roledescription="diapositiva" aria-label="${i+1} de ${latest.length}" aria-hidden="${i?'true':'false'}"${i?' inert':''}>
 ${visual}<div class="novedad-texto"><p class="etiqueta">${esc(item.section)}</p><h3>${esc(item.title)}</h3><p class="novedad-resumen">${esc(item.summary)}</p>${item.author?`<p class="novedad-autor">${esc(item.author)}</p>`:''}<div class="novedad-pie"><p class="novedad-fecha">${dateLabel(item.date)}</p><a class="enlace" href="${esc(item.url)}">${actionLabel(item)} <span class="flecha" aria-hidden="true">→</span></a></div></div>
</article>`;
}).join('\n');
const banner=latest.length?`<section class="novedades" id="novedades" aria-labelledby="titulo-novedades"><div class="contenedor"><div class="novedades-cabecera"><div><p class="etiqueta">Novedades de DE+</p><h2 id="titulo-novedades">Lo más reciente.</h2></div><span class="novedades-cuenta" data-count aria-live="off">1 / ${latest.length}</span></div><div class="novedades-carrusel" data-carousel data-deck data-interval="7000" role="region" aria-roledescription="carrusel" aria-label="Últimas publicaciones de DE+"><div class="baraja-ventana"><div class="baraja-escenario" data-stage>${slides}</div></div><div class="novedades-controles"${latest.length<2?' hidden':''}><div class="novedades-puntos">${latest.map((v,i)=>`<button type="button" data-dot="${i}" class="novedad-punto" aria-label="Mostrar publicación ${i+1}: ${esc(v.title)}"${!i?' aria-current="true"':''}><span aria-hidden="true"></span></button>`).join('')}</div><div class="novedades-acciones"><button type="button" class="novedad-control" data-prev aria-label="Publicación anterior">←</button><button type="button" class="novedad-control novedad-pausa" data-pause aria-pressed="false" aria-label="Pausar el avance automático">Pausar</button><button type="button" class="novedad-control" data-next aria-label="Siguiente publicación">→</button></div></div><div class="novedades-progreso" aria-hidden="true"><span data-progress></span></div><p class="novedades-estado" data-status role="status" aria-live="polite"></p></div></div></section>`:'';
if(!home.includes('<!-- LATEST_START -->'))throw Error('Falta el punto de inserción del banner');
home=home.replace(/<!-- LATEST_START -->[\s\S]*?<!-- LATEST_END -->/,()=>`<!-- LATEST_START -->\n${banner}\n<!-- LATEST_END -->`);
// Refresh component resources and replaced covers together after deployment.
for(const file of ['assets/latest.css','assets/latest.js','/assets/colecciones.css','/assets/colecciones.js','/assets/ensayos.css','/assets/audiovisuales.css','/assets/sobre.css']){
 const versioned=versionedAsset(root,file);
 if(versioned)home=home.replace(new RegExp('(href|src)="'+file.replaceAll('.','\\.')+'(?:\\?[^" ]*)?"','g'),`$1="${versioned}"`);
}
home=updateHomeCollections(home,root);
home=updateHomeEssays(home,root);
home=updateHomeBlog(home,root);
home=updateHomeMedia(home,root);
fs.writeFileSync(homePath,home);console.log(`${latest.length} novedades generadas; solo contenidos publicados.`);

console.log(`${buildRedirects(root)} redirecciones generadas.`);

const related=buildRelated(root);
console.log(`${related.blocks} bloques de recomendaciones entre ${related.publications} publicaciones.`);

console.log(`${buildSharedFooter(root)} páginas y plantillas con el pie compartido.`);
