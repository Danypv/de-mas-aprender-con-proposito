import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {escapeHtml as e} from './readings.mjs';

function published(root,folder){
  const directory=path.join(root,'content',folder);
  if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory).filter(file=>file.endsWith('.md'))
    .map(file=>matter.read(path.join(directory,file)).data)
    .filter(item=>item.status==='published'&&item.title&&item.slug);
}
const newest=items=>items.filter(item=>!Number.isNaN(new Date(item.date).getTime()))
  .sort((a,b)=>new Date(b.date)-new Date(a.date)||a.slug.localeCompare(b.slug,'es'))[0];

export function updateHomeMedia(home,root){
  if(!home.includes('<!-- MEDIA_HOME_START -->'))return home;
  const series=new Set(published(root,'podcast-series').map(item=>item.slug));
  const episode=newest(published(root,'podcast-episodes').filter(item=>series.has(item.series)&&(item.audio_url||item.spotify_url||item.apple_url)));
  const video=newest(published(root,'videos'));
  const access=(kind,item)=>{
    const podcast=kind==='podcast',id=podcast?'titulo-podcast':'titulo-video';
    const target=podcast?'/podcast/':'/videos/';
    const heading=podcast?'Para escuchar.':'Ver y pensar.';
    const action=podcast?'Ver podcasts':'Ver videos';
    const description=item?'<span class="audiovisual-reciente">'+(podcast?'Episodio reciente':'Video reciente')+'</span>'+e(item.title):(podcast?'Conversaciones para ampliar la mirada.':'Ideas para mirar con atención.');
    const icon=podcast?'<path d="M4 14v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2" y="11" width="5" height="10" rx="2" fill="currentColor"/><rect x="17" y="11" width="5" height="10" rx="2" fill="currentColor"/>':'<path d="M7 3.5 21 12 7 20.5Z" fill="currentColor"/>';
    return '<a class="audiovisual-acceso" href="'+e(target)+'" aria-labelledby="'+id+'" aria-describedby="'+id+'-descripcion"><span class="audiovisual-icono" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'+icon+'</svg></span><div class="audiovisual-texto"><h3 id="'+id+'">'+heading+'</h3><p class="audiovisual-descripcion" id="'+id+'-descripcion">'+description+'</p><span class="enlace">'+action+'<span class="flecha" aria-hidden="true">→</span></span></div></a>';
  };
  const section='<section class="seccion" id="formatos" aria-labelledby="titulo-medios"><div class="contenedor"><p class="etiqueta" id="titulo-medios">Medios</p><div class="audiovisuales-accesos">'+access('podcast',episode)+access('video',video)+'</div></div></section>';
  return home.replace(/<!-- MEDIA_HOME_START -->[\s\S]*?<!-- MEDIA_HOME_END -->/,()=>'<!-- MEDIA_HOME_START -->\n'+section+'\n<!-- MEDIA_HOME_END -->');
}
