import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
export const e = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const dateLabel = date => new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date));
export function secureUrl(value,field) {
  if (!value) return null;
  let url;try { url=new URL(value); } catch { throw Error(`${field}: dirección no válida`); }
  if(url.protocol!=='https:' || url.username || url.password) throw Error(`${field}: usa una dirección HTTPS sin credenciales`);
  return url;
}
export function spotifyId(value,kind) {
  const url=secureUrl(value,'Spotify'); if(!url)return null;
  const match=url.pathname.match(new RegExp(`^(?:/intl-[a-z-]+)?/${kind}/([a-zA-Z0-9]+)/*$`));
  if(url.hostname!=='open.spotify.com' || !match)throw Error(`Spotify: pega el enlace a ${kind==='show'?'la serie':'un episodio'}, no el código de inserción`);
  return match[1];
}
function load(root,folder) {
 const dir=path.join(root,'content',folder);if(!fs.existsSync(dir))return [];
 const seen=new Set();
 return fs.readdirSync(dir).filter(f=>f.endsWith('.md')).map(file=>{
  const {data,content}=matter.read(path.join(dir,file));
  for(const key of ['title','slug','summary','status'])if(!String(data[key]??'').trim())throw Error(`${file}: falta ${key}`);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)||seen.has(data.slug))throw Error(`${file}: dirección no válida o repetida`);
  seen.add(data.slug);
  if(!['draft','review','published'].includes(data.status))throw Error(`${file}: estado no válido`);
  for(const field of ['audio_url','apple_url','rss_url'])secureUrl(data[field],field);
  if(data.apple_url && new URL(data.apple_url).hostname!=='podcasts.apple.com')throw Error(`${file}: enlace de Apple Podcasts no válido`);
  if(data.spotify_url)spotifyId(data.spotify_url,folder==='podcast-series'?'show':'episode');
  if(data.cover){
   if(!/^\/assets\/imagenes\/blog\/[a-zA-Z0-9_./% -]+\.(jpe?g|png|webp)$/i.test(data.cover)||!String(data.cover_alt||'').trim())throw Error(`${file}: portada o descripción no válida`);
   const media=path.join(root,'assets/imagenes/blog');const local=path.resolve(root,'.'+decodeURIComponent(data.cover));
   if(!local.startsWith(media+path.sep)||!fs.existsSync(local))throw Error(`${file}: no se encuentra la portada`);
  }
  if(folder==='podcast-series' && !String(data.presenter||'').trim())throw Error(`${file}: falta la voz o presentación de la serie`);
  if(folder==='podcast-episodes'){
   if(!String(data.series||'').trim()||Number.isNaN(new Date(data.date).getTime()))throw Error(`${file}: falta serie o fecha válida`);
   if(data.status==='published'&&!data.audio_url&&!data.spotify_url&&!data.apple_url)throw Error(`${file}: añade un audio o un enlace de escucha antes de publicar`);
  }
  return {...data,body:content,file};
 });
}
export function readPodcasts(root=process.cwd()) {
 const series=load(root,'podcast-series');const episodes=load(root,'podcast-episodes');
 for(const episode of episodes){
  const parent=series.find(s=>s.slug===episode.series);if(!parent)throw Error(`${episode.file}: la serie no existe`);
  if(episode.status==='published'&&parent.status!=='published')throw Error(`${episode.file}: aprueba también la serie antes de publicar el episodio`);
 }
 episodes.sort((a,b)=>new Date(b.date)-new Date(a.date)||a.title.localeCompare(b.title,'es'));
 return {series,episodes};
}
