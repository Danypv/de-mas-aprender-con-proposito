import fs from 'node:fs';
import path from 'node:path';
import {readEssays,categoryLabels,essayPath,essayMinutes,renderEssayBody,themeOptions} from './essays.mjs';
import {escapeHtml as e,formatDate} from './readings.mjs';
import {authorProfile} from './authors.mjs';
import {articleData,collectionData,origin} from './structured-data.mjs';
import {shareBlock} from './share.mjs';
import {referencesBlock} from './references.mjs';

const root=process.cwd(),items=readEssays(root).filter(item=>item.status==='published');
const load=file=>fs.readFileSync(path.join(root,'templates',file),'utf8');
const fill=(source,values)=>source.replace(/\{\{([A-Z_]+)\}\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
const write=(file,html)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html)};
const marker='<!-- DE+ GENERATED ESSAY -->';
const html=load('essay.html');
for(const item of items){
  const image=item.cover?origin+item.cover:origin+'/assets/marca/de-mas-compartir.png';
  write(`ensayos/${item.slug}/index.html`,marker+'\n'+fill(html,{
    PAGE_TITLE:`${e(item.browser_title||item.title)} · DE+`,META_DESCRIPTION:e(item.summary),OG_TITLE:`${e(item.title)} · DE+`,
    OG_IMAGE:e(image),OG_IMAGE_ALT:e(item.cover_alt||'DE+ · Aprender con propósito'),
    TITLE:e(item.title),SUMMARY:e(item.summary),CATEGORIES:e(categoryLabels(item).join(' · ')),AUTHOR:e(item.author),AUTHOR_PROFILE:authorProfile(item.author_url,item.author),DATE:formatDate(item.date),MINUTES:essayMinutes(item),
    COVER:item.cover?`<figure class="portada-articulo"><img src="${e(item.cover)}" alt="${e(item.cover_alt)}" decoding="async" width="1200" height="675">${item.cover_caption?`<figcaption>${e(item.cover_caption)}</figcaption>`:''}</figure>`:'',
    BODY:renderEssayBody(item.body,item.slug),REFERENCES:referencesBlock(item.references),SHARE:shareBlock(item.title,essayPath(item)),
    STRUCTURED_DATA:articleData(item,{section:'/ensayos/',label:'Ensayos',categories:categoryLabels(item)}),
  }));
}
// Remove stale generated pages, including retracted drafts. Redirect aliases
// are reconciled later by build-latest; unrelated files remain untouched.
const directory=path.join(root,'ensayos');
if(fs.existsSync(directory))for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name,'index.html');
  if(entry.isDirectory()&&!items.some(item=>item.slug===entry.name)&&fs.existsSync(file)&&fs.readFileSync(file,'utf8').startsWith(marker)){
    fs.rmSync(file);if(!fs.readdirSync(path.dirname(file)).length)fs.rmdirSync(path.dirname(file));
  }
}
const cards=items.map(item=>`<article class="entrada" data-essay-categories="${e(JSON.stringify(item.categories))}"><div class="meta">${e(categoryLabels(item).join(' · '))}<span class="fecha">${formatDate(item.date)}</span><span class="fecha">${essayMinutes(item)} min de lectura</span></div><div>${item.cover?`<img class="imagen-entrada" src="${e(item.cover)}" alt="${e(item.cover_alt)}" loading="lazy" decoding="async">`:''}<h3><a href="${essayPath(item)}">${e(item.title)}</a></h3><p class="resumen">${e(item.summary)}</p><p class="firma">${e(item.author)}${authorProfile(item.author_url,item.author)}</p></div><a class="leer" href="${essayPath(item)}">Leer ensayo <span class="flecha" aria-hidden="true">→</span></a></article>`).join('\n');
write('ensayos/index.html',fill(load('essays.html'),{
  COUNT:`${items.length} ${items.length===1?'ensayo':'ensayos'}`,CARDS:cards,OPTIONS:themeOptions(items),SELECT_DISABLED:items.length?'':'disabled',EMPTY:items.length?'':'<p class="vacio">Próximamente encontrarás aquí los primeros ensayos.</p>',
  STRUCTURED_DATA:collectionData({path:'/ensayos/',title:'Ensayos',description:'Textos que desarrollan ideas y abren preguntas.',items:items.map(item=>({title:item.title,path:essayPath(item)}))}),
}));
console.log(`${items.length} ensayo(s) generado(s); catálogo actualizado.`);
