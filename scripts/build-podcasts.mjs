import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import {readPodcasts,e,dateLabel,spotifyId} from './podcasts.mjs';
import {authorProfile,episodeAuthor} from './authors.mjs';
import {collectionData,contentPath,podcastSeriesData,podcastEpisodeData} from './structured-data.mjs';
const {series:allSeries,episodes:allEpisodes}=readPodcasts();
const series=allSeries.filter(s=>s.status==='published');const episodes=allEpisodes.filter(s=>s.status==='published');
const md=new MarkdownIt({html:false,typographer:true});
const indexTemplate=fs.readFileSync('templates/podcast.html','utf8');const episodeTemplate=fs.readFileSync('templates/episode.html','utf8');
const fill=(source,values)=>source.replace(/\{\{([A-Z_]+)\}\}/g,(m,key)=>Object.hasOwn(values,key)?String(values[key]):m);
const write=(relative,text)=>{fs.mkdirSync(path.dirname(relative),{recursive:true});fs.writeFileSync(relative,text);};
const cover=(item,cls='podcast-portada')=>item.cover?`<img class="${cls}" src="${e(item.cover)}" alt="${e(item.cover_alt)}" loading="lazy" decoding="async">`:`<div class="${cls} podcast-portada-marca"><img src="/assets/marca/isotipo-blanco-amarillo.svg" alt="DE+"><span>${e(item.title)}</span></div>`;
const platforms=item=>`<div class="plataformas">${item.spotify_url?`<a href="${e(item.spotify_url)}" target="_blank" rel="noopener noreferrer">Spotify ↗</a>`:''}${item.apple_url?`<a href="${e(item.apple_url)}" target="_blank" rel="noopener noreferrer">Apple Podcasts ↗</a>`:''}${item.rss_url?`<a href="${e(item.rss_url)}" target="_blank" rel="noopener noreferrer">RSS ↗</a>`:''}</div>`;
const rows=list=>list.map(ep=>{
 const parent=series.find(s=>s.slug===ep.series);
 return `<article class="entrada" data-categories="${e(JSON.stringify([parent.title]))}"><div class="meta">${e(parent.title)}<span class="fecha">${dateLabel(ep.date)}</span>${ep.duration?`<span class="fecha">${e(ep.duration)}</span>`:''}</div><div><h3><a href="/podcast/episodios/${ep.slug}/">${e(ep.title)}</a></h3><p class="resumen">${e(ep.summary)}</p></div><a class="leer" href="/podcast/episodios/${ep.slug}/">Escuchar <span class="flecha" aria-hidden="true">→</span></a></article>`;
}).join('\n');
const seriesCards=series.map(s=>`<a class="serie-card" href="/podcast/series/${s.slug}/">${cover(s)}<div><h3>${e(s.title)}</h3><p>${e(s.summary)}</p><span class="serie-voz">${e(s.presenter)}</span></div></a>`).join('');
const latest=episodes.find(ep=>ep.featured)||episodes[0];
const feature=latest?`<section class="podcast-destacado"><div class="contenedor destacado-audio">${cover(latest.cover?latest:series.find(s=>s.slug===latest.series))}<div><p class="etiqueta">Episodio destacado</p><h2>${e(latest.title)}</h2><p>${e(latest.summary)}</p><a class="escuchar-principal" href="/podcast/episodios/${latest.slug}/">Escuchar el episodio →</a>${latest.duration?`<p class="duracion">${e(latest.duration)}</p>`:''}</div></div></section>`:'';
function renderPage(relative,{title,summary,featured='',seriesSection='',list,extras='',structuredData}){
 write(relative,fill(indexTemplate,{STRUCTURED_DATA:structuredData,PODCAST_TITLE:e(title),PODCAST_SUMMARY:e(summary),FEATURED:featured,SERIES:seriesSection,EPISODES:rows(list),COUNT:`${list.length} ${list.length===1?'episodio':'episodios'}`,FILTER_HIDDEN:list.length?'':'hidden',EXTRAS:extras,EMPTY:list.length?'':`<p class="vacio">${relative==='podcast/index.html'?'Estamos preparando las primeras series de DE+. Aquí podrás descubrirlas y escuchar sus episodios.':'Los episodios de esta serie aparecerán aquí cuando se publiquen.'}</p>`}));
}
renderPage('podcast/index.html',{structuredData:collectionData({path:'/podcast/',title:'Podcast',description:'Series de audio sobre filosofía, historia, educación, medicina y cultura.',items:[...series.map(s=>({title:s.title,path:contentPath('/podcast/series/',s.slug)})),...episodes.map(ep=>({title:ep.title,path:contentPath('/podcast/episodios/',ep.slug)}))]}),title:'Para escuchar.',summary:'Series de audio sobre filosofía, historia, educación, medicina y cultura.',featured:feature,seriesSection:series.length?`<section class="series-podcast"><div class="contenedor"><p class="etiqueta">Explorar</p><h2>Nuestras series.</h2><div class="series-rejilla">${seriesCards}</div></div></section>`:'',list:episodes});
for(const s of series){
 const list=episodes.filter(ep=>ep.series===s.slug);
 renderPage(`podcast/series/${s.slug}/index.html`,{structuredData:podcastSeriesData(s,list),title:s.title,summary:s.summary,list,extras:`<div class="contenedor serie-presentacion"><a class="enlace" href="/podcast/">← Todos los podcast</a><p>Con ${e(s.presenter)}${authorProfile(s.author_url,s.presenter)}</p>${platforms(s)}${s.body?`<div class="serie-descripcion">${md.render(s.body)}</div>`:''}</div>`});
}
for(const ep of episodes){
 const parent=series.find(s=>s.slug===ep.series);
 const author=episodeAuthor(ep,parent);
 const id=ep.spotify_url?spotifyId(ep.spotify_url,'episode'):null;
 const player=ep.audio_url?`<div class="reproductor-audio"><p>Escuchar el episodio</p><audio controls preload="none" aria-label="${e(ep.title)}" src="${e(ep.audio_url)}"></audio><a href="${e(ep.audio_url)}" target="_blank" rel="noopener noreferrer">Abrir el audio ↗</a></div>`:id?`<iframe class="spotify-player" title="Escuchar ${e(ep.title)} en Spotify" src="https://open.spotify.com/embed/episode/${id}" height="232" loading="lazy" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`:'<p class="escucha-externa">Escucha este episodio mediante el enlace de Apple Podcasts.</p>';
 write(`podcast/episodios/${ep.slug}/index.html`,fill(episodeTemplate,{STRUCTURED_DATA:podcastEpisodeData(ep,parent),PAGE_TITLE:`${e(ep.title)} · Podcast DE+`,META_DESCRIPTION:e(ep.summary),OG_TITLE:`${e(ep.title)} · DE+`,TITLE:e(ep.title),CATEGORIES:e(parent.title),AUTHOR:e(author.name),AUTHOR_PROFILE:authorProfile(author.url,author.name),DATE:dateLabel(ep.date),SUMMARY:e(ep.summary),EPISODE_META:ep.duration?` · ${e(ep.duration)}`:'',COVER:cover(ep.cover?ep:parent,'podcast-portada'),PLAYER:player,PLATFORMS:platforms(ep),SERIES_LINK:`<a class="enlace" href="/podcast/series/${parent.slug}/">← ${e(parent.title)}</a>`,BODY:md.render(ep.body),TRANSCRIPT:ep.transcript?`<details class="transcripcion"><summary>Leer la transcripción</summary>${md.render(ep.transcript)}</details>`:'',MORE:rows(episodes.filter(x=>x.series===ep.series&&x.slug!==ep.slug).slice(0,3))}));
}
console.log(`${series.length} serie(s) y ${episodes.length} episodio(s) publicados; portada del podcast generada.`);
