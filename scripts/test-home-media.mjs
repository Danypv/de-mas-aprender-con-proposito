import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
import {updateHomeMedia} from './home-media.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-home-media-'));
const home='Antes<!-- MEDIA_HOME_START -->Medios<!-- MEDIA_HOME_END -->Después';
const outside=html=>html.replace(/<!-- MEDIA_HOME_START -->[\s\S]*?<!-- MEDIA_HOME_END -->/,'');
const save=(folder,name,data)=>{
 const directory=path.join(root,'content',folder);fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,name+'.md'),matter.stringify('',data));
};
const base={title:'Conversación de prueba',slug:'prueba',status:'published',date:'2026-11-01'};
try{
 let result=updateHomeMedia(home,root);
 assert(result.includes('href="/podcast/"')&&result.includes('href="/videos/"'));
 assert(result.includes('Conversaciones para ampliar la mirada.'));
 save('videos','anterior',{...base,slug:'anterior',title:'Video anterior',featured:true,date:'2026-10-01'});
 save('videos','actual',{...base,slug:'actual',title:'Video <reciente> & claro'});
 save('videos','privado',{...base,slug:'privado',title:'Video privado',date:'2027-01-01',status:'draft'});
 save('podcast-series','serie',{...base,slug:'serie'});
 save('podcast-episodes','episodio',{...base,title:'Episodio publicado',slug:'episodio',series:'serie',audio_url:'https://example.org/audio.mp3'});
 result=updateHomeMedia(home,root);
 assert(result.includes('href="/videos/"')&&result.includes('Video &lt;reciente&gt; &amp; claro'));
 assert(!result.includes('Video privado')&&!result.includes('Video anterior'));
 assert(result.includes('href="/podcast/"')&&result.includes('Episodio publicado'));
 assert.deepEqual([...result.matchAll(/href="([^"]+)"/g)].map(match=>match[1]),['/podcast/','/videos/'],'Las tarjetas siempre abren el catálogo completo');
 assert(result.includes('Ver podcasts')&&result.includes('Ver videos'));
 assert.equal(outside(result),outside(home));
 assert.equal(updateHomeMedia(result,root),result,'La generación es estable');
 save('videos','actual',{...base,slug:'actual',title:'Título corregido'});
 assert(updateHomeMedia(home,root).includes('Título corregido'));
 fs.unlinkSync(path.join(root,'content/videos/actual.md'));
 result=updateHomeMedia(home,root);
 assert(result.includes('Video anterior')&&result.includes('href="/videos/"'));
 save('podcast-series','serie',{...base,slug:'serie',status:'draft'});
 assert(!updateHomeMedia(home,root).includes('Episodio publicado'),'Una serie sin publicar no expone su episodio');
 fs.unlinkSync(path.join(root,'content/podcast-series/serie.md'));
 assert(!updateHomeMedia(home,root).includes('Episodio publicado'),'Una serie eliminada no expone su episodio');
 fs.unlinkSync(path.join(root,'content/videos/anterior.md'));
 result=updateHomeMedia(home,root);assert(result.includes('href="/videos/"'));
 assert(!result.includes('Video reciente</span>'));
 assert.equal(updateHomeMedia('Otra página',root),'Otra página');
 console.log('Medios: último contenido por fecha, edición, eliminación, privacidad de series y episodios, enlaces y estados sin publicaciones verificados.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
