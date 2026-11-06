import { normalizePublicationAuthors } from './authors.mjs';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import {profileUrl} from './authors.mjs';
import {escapeHtml as e} from './readings.mjs';
import {contentPath, schemaDate} from './structured-data.mjs';

export const essayCategories = [
  ['arte','Arte'], ['bioetica','Bioética'], ['ciencia','Ciencia'], ['cultura','Cultura'],
  ['empresa','Empresa'], ['etica','Ética'], ['filosofia','Filosofía'],
  ['historia','Historia'], ['inteligencia-artificial','Inteligencia Artificial'],
  ['literatura','Literatura'], ['medicina','Medicina'], ['politica','Política'],
  ['salud','Salud'], ['tecnologia','Tecnología'], ['teologia','Teología'],
].map(([slug,title])=>({slug,title}));
export const categoryLabels = item => item.categories.map(slug=>essayCategories.find(c=>c.slug===slug).title);
export const essayPath = item => contentPath('/ensayos/',item.slug);
export const essayMinutes = item => Math.max(1,Math.ceil(item.body.trim().split(/\s+/u).length/220));
export function readEssays(root=process.cwd()) {
  const directory=path.join(root,'content/essays');
  if(!fs.existsSync(directory))return [];
  const seen=new Set();
  return fs.readdirSync(directory).filter(file=>file.endsWith('.md')).map(file=>{
    const {data,content}=matter.read(path.join(directory,file));
    Object.assign(data, normalizePublicationAuthors(data));
    const fail=message=>{throw Error(`${file}: ${message}`)};
    for(const key of ['title','slug','author','date','summary','status'])if(!String(data[key]??'').trim())fail(`falta ${key}`);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug))fail('usa minúsculas, números y guiones en la dirección');
    if(seen.has(data.slug))fail('identificador repetido');seen.add(data.slug);
    if(!['draft','review','published'].includes(data.status))fail('estado no válido');
    schemaDate(data.date,`${file}: fecha`);
    if(!Array.isArray(data.categories)||!data.categories.length||data.categories.some(key=>!essayCategories.some(c=>c.slug===key)))fail('selecciona al menos un tema válido');
    data.categories=[...new Set(data.categories)];
    profileUrl(data.author_url,`${file}: enlace del autor`);
    if(!content.trim())fail('el ensayo está vacío');
    if(data.cover){
      if(typeof data.cover!=='string'||!/^\/assets\/imagenes\/blog\/[a-zA-Z0-9_./% -]+\.(jpe?g|png|webp)$/i.test(data.cover)||decodeURIComponent(data.cover).split('/').includes('..'))fail('imagen de portada no válida');
      if(!String(data.cover_alt||'').trim())fail('falta la descripción de la imagen');
      if(!fs.existsSync(path.join(root,decodeURIComponent(data.cover))))fail('no se encuentra la imagen de portada');
    }
    return {...data,file,body:content};
  }).sort((a,b)=>new Date(b.date)-new Date(a.date)||a.slug.localeCompare(b.slug,'es'));
}

const markdown=new MarkdownIt({html:false,typographer:true});
export function renderEssayBody(source,slug){
  const env={},tokens=markdown.parse(source.trim(),env),paragraphs=[];
  for(let i=0;i<tokens.length-2;i++)if(tokens[i].type==='paragraph_open'&&tokens[i].level===0&&tokens[i+1].type==='inline'&&tokens[i+2].type==='paragraph_close'&&tokens[i+1].content.trim()&&!tokens[i+1].children?.some(t=>t.type==='image'))paragraphs.push(i);
  // Seeded selection stays stable across rebuilds and visits. Only original,
  // top-level middle paragraphs qualify; quotations, lists and images do not.
  if(paragraphs.length>=5){
    let seed=2166136261;for(const ch of String(slug))seed=Math.imul(seed^ch.codePointAt(0),16777619)>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    const lo=Math.max(1,Math.floor(paragraphs.length*.2));
    const hi=Math.min(paragraphs.length-2,Math.ceil(paragraphs.length*.8)-1);
    const mid=Math.floor((lo+hi)/2);
    const first=lo+Math.floor(random()*(mid-lo+1));
    const secondLo=Math.max(mid+1,first+2);
    const second=secondLo<=hi?secondLo+Math.floor(random()*(hi-secondLo+1)):hi;
    for(const pos of new Set([first,second]))tokens[paragraphs[pos]].attrJoin('class','destacado-editorial');
  }
  if(paragraphs.length)tokens[paragraphs[0]].attrJoin('class','apertura');
  return markdown.renderer.render(tokens,markdown.options,env);
}

export function themeOptions(items){
  return '<option value="">Todos los temas</option>'+essayCategories.map(c=>`<option value="${c.slug}"${items.some(item=>item.categories.includes(c.slug))?'':' disabled'}>${e(c.title)}</option>`).join('');
}
export function updateHomeEssays(home,root){
  const items=readEssays(root).filter(item=>item.status==='published'),item=items[0];
  const feature=item?`<article class="ensayos-portada">${item.cover?`<a href="${essayPath(item)}" class="ensayos-imagen"><img src="${e(item.cover)}" alt="${e(item.cover_alt)}" loading="lazy" decoding="async" width="960" height="540"></a>`:''}<div><p class="ensayos-tema">${e(categoryLabels(item).join(' · '))}</p><h3><a href="${essayPath(item)}">${e(item.title)}</a></h3><p class="ensayos-resumen">${e(item.summary)}</p><a class="enlace" href="${essayPath(item)}">Leer ensayo <span class="flecha" aria-hidden="true">→</span></a></div></article>`:'<p class="ensayos-vacio">Próximamente encontrarás aquí los primeros ensayos.</p>';
  const section=`<section class="seccion seccion-hueso ensayos-franja" id="ensayos" aria-labelledby="titulo-ensayos"><div class="contenedor"><div class="ensayos-encabezado"><div><p class="etiqueta">Ensayos</p><h2 id="titulo-ensayos">Pensar a fondo</h2><p class="ensayos-descripcion">Textos que desarrollan ideas y abren preguntas.</p></div><form class="ensayos-form" action="/ensayos/" method="get"><label for="ensayos-tema-portada">Explorar por tema</label><select id="ensayos-tema-portada" name="tema"${items.length?'':' disabled'}>${themeOptions(items)}</select><button type="submit" class="enlace">Ver todos los ensayos <span class="flecha" aria-hidden="true">→</span></button></form></div>${feature}</div></section>`;
  if(!home.includes('<!-- ESSAYS_START -->'))throw Error('Falta el espacio de la franja Ensayos');
  return home.replace(/<!-- ESSAYS_START -->[\s\S]*?<!-- ESSAYS_END -->/,()=>`<!-- ESSAYS_START -->\n${section}\n<!-- ESSAYS_END -->`);
}
