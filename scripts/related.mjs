import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {readReadings,escapeHtml as escape} from './readings.mjs';
import {readVideos} from './videos.mjs';
import {readPodcasts} from './podcasts.mjs';
import {contentPath} from './structured-data.mjs';
import {identifyTopics,topics} from './topics.mjs';

const start='<!-- RELATED_START -->',end='<!-- RELATED_END -->';
const pattern=/<!-- RELATED_START -->[\s\S]*?<!-- RELATED_END -->/;
export function relatedInventory(root){
  const items=[];
  const add=(item,prefix,section,action,inherited=[])=>{
    if(item.status!=='published')return;
    if(typeof item.slug!=='string'||!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(item.slug))throw Error('Dirección no válida para las recomendaciones');
    const date=+new Date(item.date);if(!Number.isFinite(date))throw Error(`${item.slug}: fecha no válida para las recomendaciones`);
    items.push({url:contentPath(prefix,item.slug),title:item.title,summary:item.summary||'',topics:identifyTopics(item,inherited),date,section,action});
  };
  const dir=path.join(root,'content/posts');
  if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(file=>file.endsWith('.md')))add(matter.read(path.join(dir,file)).data,'/blog/','Blog','Leer el artículo');
  for(const item of readReadings(root))add(item,'/lecturas/textos/','Lecturas selectas','Leer la reseña');
  for(const item of readVideos(root))add(item,'/videos/','Video','Ver el video');
  const {series,episodes}=readPodcasts(root);
  for(const item of episodes){
    if(item.status!=='published')continue;
    const parent=series.find(series=>series.slug===item.series&&series.status==='published');
    if(parent)add(item,'/podcast/episodios/','Podcast','Escuchar el episodio',identifyTopics(parent));
  }
  if(new Set(items.map(item=>item.url)).size!==items.length)throw Error('Direcciones repetidas en las recomendaciones');
  return items;
}
export function relatedSelections(items){
  const byTopic=new Map(),weights=new Map(topics.map(topic=>[topic.slug,topic.weight]));
  for(const item of items)for(const topic of item.topics){if(!byTopic.has(topic))byTopic.set(topic,[]);byTopic.get(topic).push(item)}
  return new Map(items.map(current=>{
    const scores=new Map();
    for(const topic of current.topics)for(const candidate of byTopic.get(topic)||[]){
      if(candidate.url===current.url)continue;
      scores.set(candidate,(scores.get(candidate)||0)+(weights.get(topic)||1));
    }
    // Specific shared subjects outrank broad ones. Within equal relevance,
    // newest publications come first; URLs provide a stable final tie-break.
    const selected=[...scores].sort(([a,sa],[b,sb])=>sb-sa||b.date-a.date||a.url.localeCompare(b.url,'es')).slice(0,2).map(([item])=>item);
    return [current.url,selected];
  }));
}
function excerpt(summary){
  const text=String(summary).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const first=text.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim()||text;
  return first.length<=165?first:first.slice(0,162).replace(/\s+\S*$/u,'')+'…';
}
export function relatedBlock(selected){
  if(!selected.length)return '';
  const cards=selected.map(item=>`<a class="relacionado" href="${escape(item.url)}"><span class="relacionado-seccion">${escape(item.section)}</span><h3>${escape(item.title)}</h3><p>${escape(excerpt(item.summary))}</p><span class="relacionado-accion">${escape(item.action)} <span aria-hidden="true">→</span></span></a>`).join('\n');
  return `<div class="relacionados" data-pagefind-ignore="all"><h2 id="relacionados-titulo">Para seguir pensando.</h2><nav class="relacionados-grid${selected.length===1?' relacionados-uno':''}" aria-labelledby="relacionados-titulo">${cards}</nav></div>`;
}
export function buildRelated(root){
  const items=relatedInventory(root),selections=relatedSelections(items);
  // Validate all target files and markers before changing any output.
  const outputs=items.map(item=>{
    const file=path.join(root,decodeURIComponent(item.url.slice(1)),'index.html');
    if(!fs.existsSync(file))throw Error(`Genera primero ${item.url}`);
    const html=fs.readFileSync(file,'utf8');
    if(!pattern.test(html))throw Error(`Falta el espacio de recomendaciones en ${item.url}`);
    return {file,html,selected:selections.get(item.url)};
  });
  for(const {file,html,selected}of outputs)fs.writeFileSync(file,html.replace(pattern,()=>`${start}\n${relatedBlock(selected)}\n${end}`));
  return {publications:items.length,blocks:outputs.filter(item=>item.selected.length).length};
}
