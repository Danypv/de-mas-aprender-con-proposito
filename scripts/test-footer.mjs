import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {buildSharedFooter,sharedFooter} from './footer.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-footer-'));
const put=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text)};
const page=title=>'<html><head><title>'+title+'</title></head><body><main>Texto conservado <footer>Nota de autor</footer></main><footer class="pie-pagina">Pie anterior</footer><script>const conservar=true;</script></body></html>';
try{
 put('templates/footer.html',fs.readFileSync('templates/footer.html','utf8'));
 put('assets/pie.css','Primera versión');
 put('index.html',page('Portada'));put('blog/entrada/index.html',page('Artículo'));
 put('templates/post.html',page('Plantilla'));put('alias/index.html','<html>Redirección sin pie</html>');
 assert.equal(buildSharedFooter(root),3);
 const canonical=sharedFooter(root),read=name=>fs.readFileSync(path.join(root,name),'utf8');
 const social=canonical.match(/<nav class="pie-redes"[^>]*>([\s\S]*?)<\/nav>/)[1];
 assert(social.includes('href="https://www.instagram.com/somosdemas.co/"'));
 assert(social.includes('href="https://x.com/somosdemascom"'));
 assert.equal((social.match(/class="pie-red-social"/g)||[]).length,2);
 assert.equal((social.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,2);
 assert(social.includes('aria-label="Instagram de DE+')&&social.includes('aria-label="X de DE+'));
 assert(!social.replace(/<[^>]+>/g,'').trim(),'Solo se muestran los iconos, con nombres accesibles');
 for(const file of ['index.html','blog/entrada/index.html','templates/post.html']){
   const html=read(file);assert(html.includes(canonical));
   assert(html.includes('<main>Texto conservado <footer>Nota de autor</footer></main>'));
   assert(html.includes('const conservar=true;'));
   assert(html.includes('href="/#sobre"')&&html.includes('src="/assets/marca/logo-blanco-amarillo.svg"'));
   assert.equal((html.match(/data-shared-footer/g)||[]).length,1);
 }
 assert.equal(read('alias/index.html'),'<html>Redirección sin pie</html>');
 assert.equal(buildSharedFooter(root),0,'Regenerar no vuelve a cambiar los archivos');
 const before=read('index.html').match(/href="([^"]+)" data-shared-footer/)[1];
 put('assets/pie.css','Segunda versión');buildSharedFooter(root);
 assert.notEqual(read('index.html').match(/href="([^"]+)" data-shared-footer/)[1],before);
 console.log('Pie compartido: portada, páginas internas y plantillas iguales, texto y scripts intactos, redirecciones respetadas y renovación de estilos verificados.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
