import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import {readVideos,formats,e,dateLabel} from './videos.mjs';
const videos=readVideos().filter(v=>v.status==='published');const md=new MarkdownIt({html:false,typographer:true});
const index=fs.readFileSync('templates/videos.html','utf8');const page=fs.readFileSync('templates/video.html','utf8');
const fill=(source,values)=>source.replace(/\{\{([A-Z_]+)\}\}/g,(m,k)=>Object.hasOwn(values,k)?String(values[k]):m);
const write=(relative,text)=>{fs.mkdirSync(path.dirname(relative),{recursive:true});fs.writeFileSync(relative,text);};
function thumbnail(v){
 const src=v.cover||v.source.thumbnail;
 return `<div class="miniatura-video">${src?`<img src="${e(src)}" alt="${e(v.cover?v.cover_alt:'')}" loading="lazy" decoding="async">`:`<div class="miniatura-marca"><img src="/assets/marca/isotipo-blanco-amarillo.svg" alt="DE+"></div>`}<span class="ver-indicador" aria-hidden="true">▶</span>${v.duration?`<span class="video-duracion">${e(v.duration)}</span>`:''}</div>`;
}
const cards=list=>list.map(v=>`<article class="entrada video-tarjeta${v.featured?' destacada':''}" data-categories="${e(JSON.stringify([formats[v.format]]))}"><a class="enlace-miniatura" href="/videos/${v.slug}/" aria-label="${e('Ver '+v.title)}">${thumbnail(v)}</a><div class="video-tarjeta-texto"><div class="meta">${e(formats[v.format])} · ${e(v.source.provider)}</div><h3><a href="/videos/${v.slug}/">${e(v.title)}</a></h3><p class="firma">${e(v.author)}</p><p class="resumen">${e(v.summary)}</p><p class="temas-video">${v.categories.map(e).join(' · ')}</p><a class="leer" href="/videos/${v.slug}/">Ver video <span class="flecha" aria-hidden="true">→</span></a></div></article>`).join('');
const featured=videos.find(v=>v.featured)||videos[0];
write('videos/index.html',fill(index,{FEATURED:featured?`<section class="video-destacado"><div class="contenedor video-destacado-interior"><a class="enlace-miniatura" href="/videos/${featured.slug}/" aria-label="${e('Ver '+featured.title)}">${thumbnail(featured)}</a><div><p class="etiqueta">Para comenzar</p><h2>${e(featured.title)}</h2><p class="firma">${e(featured.author)}</p><p>${e(featured.summary)}</p><a class="enlace" href="/videos/${featured.slug}/">Ver video →</a></div></div></section>`:'',COUNT:`${videos.length} ${videos.length===1?'video':'videos'}`,VIDEOS:cards(videos),FILTER_HIDDEN:videos.length?'':'hidden',EMPTY:videos.length?'':'<p class="vacio">Estamos preparando una selección de conferencias, clases y conversaciones. Los videos aparecerán aquí cuando se publiquen.</p>'}));
for(const v of videos){
 const player=v.embed!==false&&v.source.embed?`<div class="video-player"><iframe title="${e(v.title)}" src="${e(v.source.embed)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; fullscreen; picture-in-picture; web-share" allowfullscreen></iframe></div>`:'<div class="video-enlace-externo"><p>Este video se puede ver en su plataforma de origen.</p></div>';
 write(`videos/${v.slug}/index.html`,fill(page,{PAGE_TITLE:`${e(v.title)} · Videos DE+`,META_DESCRIPTION:e(v.summary),OG_TITLE:`${e(v.title)} · DE+`,TITLE:e(v.title),CATEGORIES:`${e(formats[v.format])} · ${v.categories.map(e).join(' · ')}`,AUTHOR:e(v.author),DATE:dateLabel(v.date),SUMMARY:e(v.summary),VIDEO_META:v.duration?` · ${e(v.duration)}`:'',PLAYER:player,SOURCE:`<p class="fuente-video">${v.source.provider==='TED'?'Charla de TED. ':''}<a class="enlace" href="${e(v.source.url)}" target="_blank" rel="noopener noreferrer">Ver en ${e(v.source.provider==='Fuente externa'?(v.source_name||'la fuente original'):v.source.provider)} ↗</a></p>`,BODY:md.render(v.body),TRANSCRIPT:v.transcript?`<details class="transcripcion"><summary>Leer la transcripción</summary>${md.render(v.transcript)}</details>`:''}));
}
console.log(`${videos.length} video(s) publicados; catálogo generado.`);
