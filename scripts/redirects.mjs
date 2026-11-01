import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {collections, escapeHtml as escape} from './readings.mjs';

const marker='<!-- DE+ GENERATED REDIRECT -->';
const routes={posts:'/blog/',readings:'/lecturas/textos/','podcast-series':'/podcast/series/','podcast-episodes':'/podcast/episodios/',videos:'/videos/'};
const valid=slug=>typeof slug==='string'&&/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(slug);
export function buildRedirects(root){
  const active=new Set(['/','/blog/','/lecturas/','/podcast/','/videos/']);
  const aliases=new Map();
  const add=(from,to)=>{
    if(from===to)return;
    if(aliases.has(from)&&aliases.get(from)!==to)throw Error(`Redirección repetida: ${from}`);
    aliases.set(from,to);
  };
  for(const collection of collections){
    const target=`/lecturas/${collection.slug}/`;active.add(target);
    for(const slug of collection.previousSlugs||[])add(`/lecturas/${slug}/`,target);
  }
  for(const [folder,prefix] of Object.entries(routes)){
    const dir=path.join(root,'content',folder);
    if(!fs.existsSync(dir))continue;
    for(const file of fs.readdirSync(dir).filter(file=>file.endsWith('.md'))){
      const {data}=matter.read(path.join(dir,file));
      if(data.status!=='published')continue;
      if(!valid(data.slug))throw Error(`${file}: dirección no válida`);
      const target=prefix+encodeURIComponent(data.slug)+'/';active.add(target);
      const history=data.previous_slugs||[];
      if(!Array.isArray(history)||history.some(slug=>!valid(slug)))throw Error(`${file}: historial de direcciones no válido`);
      for(const slug of history)add(prefix+encodeURIComponent(slug)+'/',target);
    }
  }
  const output=url=>path.join(root,decodeURIComponent(url.slice(1)),'index.html');
  const entries=[...aliases].sort(([a],[b])=>a.localeCompare(b));
  // Validate the complete plan before touching files; redirects never form chains.
  for(const [from,to] of entries){
    if(active.has(from))throw Error(`La redirección sustituiría una página publicada: ${from}`);
    if(!active.has(to)||!fs.existsSync(output(to)))throw Error(`Destino ausente: ${to}`);
  }
  const manifest=path.join(root,'assets/redirecciones.json');
  const previous=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,'utf8')):[];
  for(const {from} of previous){
    if(typeof from!=='string'||!/^\/(blog|lecturas|podcast|videos)\/[\p{L}\p{N}/%-]+\/$/u.test(from)||from.includes('..'))throw Error('Historial de redirecciones no válido');
    const file=output(from);
    if(!aliases.has(from)&&!active.has(from)&&fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes(marker))fs.rmSync(file);
  }
  for(const [from,to] of entries){
    const absolute='https://somosdemas.com'+to;
    const file=output(from);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,`${marker}\n<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página trasladada · DE+</title><link rel="canonical" href="${escape(absolute)}"><meta http-equiv="refresh" content="0;url=${escape(to)}"><script>location.replace(${JSON.stringify(to)}+location.search+location.hash)</script><style>body{margin:0;background:#000;color:#fff;font:18px/1.6 Arial,sans-serif;padding:48px 24px}main{max-width:680px;margin:10vh auto}a{color:#ffb600}</style></head><body data-pagefind-ignore><main><h1>Esta página cambió de dirección.</h1><p><a href="${escape(to)}">Continuar en DE+ →</a></p></main></body></html>\n`);
  }
  fs.mkdirSync(path.dirname(manifest),{recursive:true});
  fs.writeFileSync(manifest,JSON.stringify(entries.map(([from,to])=>({from,to})),null,2)+'\n');
  return entries.length;
}
