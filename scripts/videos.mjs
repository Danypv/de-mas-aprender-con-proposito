import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
export const formats={conference:'Conferencias',class:'Clases abiertas',conversation:'Conversaciones',audiovisual:'Piezas audiovisuales'};
export const e=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const dateLabel=date=>new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date));
export function videoSource(value){
 let url;try{url=new URL(value);}catch{throw Error('Indica una dirección válida del video');}
 if(url.protocol!=='https:'||url.username||url.password)throw Error('El enlace del video debe usar HTTPS y no contener credenciales');
 const host=url.hostname.toLowerCase();
 if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host)){
  let id=host==='youtu.be'?url.pathname.slice(1).split('/')[0]:url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id||''))throw Error('YouTube: pega el enlace a un video, no a un canal o una lista');
  return {provider:'YouTube',id,url:`https://www.youtube.com/watch?v=${id}`,embed:`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`,thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`};
 }
 if(['ted.com','www.ted.com','embed.ted.com'].includes(host)){
  const match=url.pathname.match(/^\/talks\/(?:lang\/[a-z-]+\/)?([a-zA-Z0-9_-]+)\/?$/);
  if(!match)throw Error('TED: pega el enlace de una charla en ted.com/talks/…');
  return {provider:'TED',url:`https://www.ted.com/talks/${match[1]}`,embed:`https://embed.ted.com/talks/${match[1]}`};
 }
 return {provider:'Fuente externa',url:url.href,embed:null};
}
export function readVideos(root=process.cwd()){
 const folder=path.join(root,'content/videos');if(!fs.existsSync(folder))return [];
 const seen=new Set();
 return fs.readdirSync(folder).filter(f=>f.endsWith('.md')).map(file=>{
  const {data,content}=matter.read(path.join(folder,file));
  for(const key of ['title','slug','author','summary','date','format','status','source_url'])if(!String(data[key]??'').trim())throw Error(`${file}: falta ${key}`);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)||seen.has(data.slug))throw Error(`${file}: dirección no válida o repetida`);seen.add(data.slug);
  if(!['draft','review','published'].includes(data.status)||!Object.hasOwn(formats,data.format))throw Error(`${file}: estado o formato no válido`);
  if(Number.isNaN(new Date(data.date).getTime()))throw Error(`${file}: fecha no válida`);
  if(!Array.isArray(data.categories)||!data.categories.length)throw Error(`${file}: añade al menos un tema`);
  const source=videoSource(data.source_url);
  if(data.cover){
   const media=path.join(root,'assets/imagenes/blog');const local=path.resolve(root,'.'+decodeURIComponent(data.cover));
   if(!/^\/assets\/imagenes\/blog\/[a-zA-Z0-9_./% -]+\.(jpe?g|png|webp)$/i.test(data.cover)||!local.startsWith(media+path.sep)||!fs.existsSync(local)||!String(data.cover_alt||'').trim())throw Error(`${file}: imagen o descripción no válida`);
  }
  return {...data,file,source,body:content};
 }).sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||new Date(b.date)-new Date(a.date)||a.title.localeCompare(b.title,'es'));
}
