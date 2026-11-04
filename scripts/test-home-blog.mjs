import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
import {updateHomeBlog} from './home-blog.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-home-blog-'));
const home='Antes<!-- BLOG_HOME_START -->Anterior<!-- BLOG_HOME_END -->Después';
const outside=s=>s.replace(/<!-- BLOG_HOME_START -->[\s\S]*?<!-- BLOG_HOME_END -->/,'');
const base={title:'Una reflexión',slug:'anterior',author:'Autora',date:'2026-11-01',summary:'Primera frase. Segunda frase que queda para la publicación.',status:'published',categories:['Ética','Inteligencia Artificial']};
const save=(name,data)=>fs.writeFileSync(path.join(root,'content/posts',name+'.md'),matter.stringify('Texto de la publicación.',data));
try{
  fs.mkdirSync(path.join(root,'content/posts'),{recursive:true});
  assert(updateHomeBlog(home,root).includes('Próximamente'));
  save('antiguo',{...base,featured:true});
  const image='/assets/imagenes/blog/portada.jpg';fs.mkdirSync(path.join(root,'assets/imagenes/blog'),{recursive:true});fs.writeFileSync(path.join(root,image),'imagen de prueba');
  save('nuevo',{...base,slug:'reciente',title:'Un título <nuevo> & actual',date:'2026-11-02',categories:['Ética digital','inteligencia artificial'],cover:image,cover_alt:'Imagen "horizontal"'});
  save('privado',{...base,slug:'privado',title:'Texto privado',date:'2027-01-01',status:'draft'});
  let html=updateHomeBlog(home,root);
  assert(html.includes('Un título &lt;nuevo&gt; &amp; actual'));
  assert(html.includes('src="'+image+'"')&&html.includes('alt="Imagen &quot;horizontal&quot;"'));
  assert(html.includes('/blog/reciente/'));assert(!html.includes('/blog/anterior/'));
  assert(!html.includes('Texto privado'));
  assert(!html.includes('Segunda frase que queda'));
  assert.equal((html.match(/value="inteligencia artificial"/g)||[]).length,1);
  assert.equal(outside(html),outside(home));
  assert.equal(updateHomeBlog(html,root),html,'La regeneración es estable');
  save('nuevo',{...base,slug:'reciente',title:'Título corregido',date:'2026-11-02',categories:['Historia']});
  html=updateHomeBlog(home,root);assert(html.includes('Título corregido'));assert(!html.includes(image));
  fs.unlinkSync(path.join(root,'content/posts/nuevo.md'));html=updateHomeBlog(home,root);assert(html.includes('/blog/anterior/'));
  fs.unlinkSync(path.join(root,'content/posts/antiguo.md'));html=updateHomeBlog(home,root);assert(html.includes('Próximamente'));assert(!html.includes('/blog/reciente/'));
  console.log('Franja del Blog: última publicación por fecha, imagen y texto, edición, borradores, eliminación, categorías normalizadas y conservación del resto de la portada.');
}finally{fs.rmSync(root,{recursive:true,force:true})}

// Exercise the actual catalogue script with the query emitted by the home form.
const entries=[['Ética digital','Inteligencia Artificial'],['inteligencia artificial','Ética'],['Historia']].map(categories=>({dataset:{categories:JSON.stringify(categories)},hidden:false}));
const select={value:'',options:[],append(option){this.options.push(option)},addEventListener(event,callback){this.change=callback}};
const counter={},empty={},history=[];
const document={getElementById:id=>id==='tema'?select:empty,querySelectorAll:()=>entries,querySelector:()=>counter,createElement:()=>({})};
vm.runInNewContext(fs.readFileSync(new URL('../assets/blog.js',import.meta.url),'utf8'),{document,location:{href:'https://somosdemas.com/blog/?tema=Inteligencia%20Artificial'},history:{replaceState(_state,_title,url){history.push(url)}},URL});
assert.equal(counter.textContent,'2 publicaciones');assert.equal(entries.filter(e=>!e.hidden).length,2);
assert.equal(select.options.filter(o=>o.value==='inteligencia artificial').length,1);
select.value='etica digital';select.change();assert.equal(counter.textContent,'1 publicación');assert(history.at(-1).includes('tema=etica+digital'));
select.value='';select.change();assert.equal(counter.textContent,'3 publicaciones');assert(empty.hidden);
console.log('Selector: enlace desde portada, orden por tema, tildes y mayúsculas, recuento y cambio de filtro verificados.');
