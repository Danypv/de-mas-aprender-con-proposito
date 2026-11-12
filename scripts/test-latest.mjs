import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import matter from 'gray-matter';
import {latestCover,versionedAsset} from './latest-covers.mjs';
import {collections} from './readings.mjs';

const reference=path.resolve(new URL('..',import.meta.url).pathname);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'demas-latest-'));
const put=(name,value)=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,value);};
const save=(slug,data={})=>{
 const record={title:`Título de ${slug}`,slug,author:'Ana Pérez',date:'2026-11-01',summary:'Una presentación para leer.',status:'published',categories:['Ética'],...data};
 put(`content/posts/${slug}.md`,matter.stringify('Un texto de prueba.',record));
 if(record.status==='published')put(`blog/${slug}/index.html`,'<!-- RELATED_START --><!-- RELATED_END -->');
};
const read=()=>fs.readFileSync(path.join(root,'index.html'),'utf8');
const banner=()=>read().match(/<!-- LATEST_START -->([\s\S]*?)<!-- LATEST_END -->/)[1];
const build=()=>execFileSync(process.execPath,[path.join(reference,'scripts/build-latest.mjs'),root],{stdio:'pipe'});
const imageUrl=()=>banner().match(/<img src="([^"]+)"/)?.[1];
try {
 fs.copyFileSync(path.join(reference,'index.html'),path.join(root,'index.html'));
 for(const collection of collections)put(`lecturas/${collection.slug}/index.html`,'Colección publicada');
 put('assets/latest.css','estilos de prueba');put('assets/latest.js','controlador de prueba');
 for(let i=1;i<=5;i++)save(`texto-${i}`,{date:`2026-11-0${i}`});
 save('privado',{date:'2027-01-01',status:'draft',title:'Contenido que debe permanecer privado'});
 build();
 assert.equal((banner().match(/data-slide /g)||[]).length,4);
 assert(!banner().includes('/blog/texto-1/'));assert(!banner().includes('Contenido que debe permanecer privado'));
 assert(banner().indexOf('/blog/texto-5/')<banner().indexOf('/blog/texto-4/'));
 assert.equal((banner().match(/data-position="current"/g)||[]).length,1);
 assert(banner().includes('data-image-state="missing"'));
 const before=read();build();assert.equal(read(),before,'La regeneración debe ser estable');
 put('assets/imagenes/blog/portada.jpg','imagen inicial');
 save('texto-5',{date:'2026-11-05',cover:'/assets/imagenes/blog/portada.jpg',cover_alt:'Descripción de la portada'});
 build();const first=imageUrl();assert(first.startsWith('/assets/imagenes/blog/portada.jpg?v='));
 assert(banner().includes('alt="Descripción de la portada"'));
 put('assets/imagenes/blog/portada.jpg','la misma dirección con una imagen distinta');
 build();assert.notEqual(imageUrl(),first,'Reemplazar el archivo debe renovar la URL de la portada');
 put('assets/imagenes/blog/otra.jpg','otra imagen');
 save('texto-5',{date:'2026-11-05',title:'Título corregido',cover:'/assets/imagenes/blog/otra.jpg',cover_alt:'Nueva descripción'});
 build();assert(imageUrl().startsWith('/assets/imagenes/blog/otra.jpg?v='));assert(banner().includes('Título corregido'));
 fs.unlinkSync(path.join(root,'assets/imagenes/blog/otra.jpg'));
 assert.equal(latestCover(root,{cover:'/assets/imagenes/blog/otra.jpg'}),null);
 // The Pages publisher clears the optional cover before the other generators run.
 save('texto-5',{date:'2026-11-05',title:'Título corregido'});
 build();assert(!imageUrl());assert(banner().includes('data-image-state="missing"'));
 save('ultima',{date:'2026-11-10',title:'La publicación más nueva'});build();assert(banner().includes('La publicación más nueva'));assert(!banner().includes('/blog/texto-2/'));
 fs.unlinkSync(path.join(root,'content/posts/ultima.md'));build();assert(!banner().includes('/blog/ultima/'));assert(banner().includes('/blog/texto-2/'));
 const cssBefore=read().match(/href="(assets\/latest\.css[^\"]+)"/)[1];
 put('assets/latest.css','estilos actualizados');build();assert.notEqual(read().match(/href="(assets\/latest\.css[^\"]+)"/)[1],cssBefore);
 for(const name of fs.readdirSync(path.join(root,'content/posts')))fs.unlinkSync(path.join(root,'content/posts',name));
 build();assert(!banner().includes('data-carousel'));
 assert.equal(latestCover(root,{cover:'javascript:alert(1)'}),null);
 assert.equal(latestCover(root,{cover:'/no-existe.jpg'}),null);
 assert.equal(versionedAsset(root,'../fuera.jpg'),'');
 console.log('Novedades verificadas: últimas cuatro publicaciones, privacidad, altas, edición, portada sustituida, retirada de imagen, eliminación de publicaciones, versiones de estilos y estado vacío.');
} finally {fs.rmSync(root,{recursive:true,force:true});}
