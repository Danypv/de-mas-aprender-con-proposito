import { normalizePublicationAuthors } from './authors.mjs';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {escapeHtml as e} from './readings.mjs';
import {contentPath} from './structured-data.mjs';

export function readHomeBlog(root){
  const folder=path.join(root,'content/posts');
  if(!fs.existsSync(folder))return [];
  return fs.readdirSync(folder).filter(file=>file.endsWith('.md')).map(file=>normalizePublicationAuthors(matter.read(path.join(folder,file)).data))
    .filter(post=>post.status==='published')
    .sort((a,b)=>new Date(b.date)-new Date(a.date)||a.slug.localeCompare(b.slug,'es'));
}
export function updateHomeBlog(home,root){
  const posts=readHomeBlog(root),post=posts[0];
  let feature='<p class="ensayos-vacio">Próximamente encontrarás aquí nuevas publicaciones.</p>';
  if(post){
    const url=contentPath('/blog/',post.slug);
    const image=post.cover||'/assets/marca/de-mas-compartir.png';
    if(post.cover&&(!/^\/assets\/imagenes\/blog\/[a-zA-Z0-9_./% -]+\.(jpe?g|png|webp)$/i.test(image)||decodeURIComponent(image).split('/').includes('..')||!fs.existsSync(path.join(root,decodeURIComponent(image)))))throw Error(`${post.slug}: imagen de portada del Blog no válida o ausente`);
    const summary=String(post.summary||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s/)[0];
    feature=`<article class="ensayos-portada blog-portada"><a class="ensayos-imagen" href="${e(url)}"><img src="${e(image)}" alt="${e(post.cover?post.cover_alt:'DE+ · Aprender con propósito')}" width="960" height="540" loading="lazy" decoding="async"></a><div><p class="ensayos-tema">${e((post.categories||[]).join(' · '))}</p><h3><a href="${e(url)}">${e(post.title)}</a></h3><p class="ensayos-resumen">${e(summary)}</p><a class="enlace" href="${e(url)}">Leer publicación <span class="flecha" aria-hidden="true">→</span></a></div></article>`;
  }
  const section=`<section class="seccion seccion-hueso blog-franja" id="ideas" aria-labelledby="titulo-blog"><div class="contenedor"><div class="blog-encabezado"><div><p class="etiqueta">Blog</p><h2 id="titulo-blog">Para pensar nuestro tiempo</h2><p class="ensayos-descripcion">Reflexiones breves sobre asuntos del presente.</p></div><a class="enlace" href="/blog/">Ver todas las publicaciones <span class="flecha" aria-hidden="true">→</span></a></div>${feature}</div></section>`;
  if(!home.includes('<!-- BLOG_HOME_START -->'))throw Error('Falta el espacio de la franja del Blog');
  return home.replace(/<!-- BLOG_HOME_START -->[\s\S]*?<!-- BLOG_HOME_END -->/,()=>`<!-- BLOG_HOME_START -->\n${section}\n<!-- BLOG_HOME_END -->`);
}
