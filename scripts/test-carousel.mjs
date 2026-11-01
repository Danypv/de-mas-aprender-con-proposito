import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Element {
  listeners={};attributes={};hidden=false;disabled=false;textContent='';style={};
  classList={values:new Set(),add(value){this.values.add(value)},remove(value){this.values.delete(value)}};
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
  emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event)}
  setAttribute(name,value){this.attributes[name]=value}
  removeAttribute(name){delete this.attributes[name]}
}
function fixture(reduce){
  const slides=Array.from({length:4},(_,i)=>{const el=new Element();el.hidden=i!==0;el.querySelector=()=>({textContent:`Publicación ${i+1}`});return el});
  const dots=slides.map(()=>new Element()),count=new Element(),pause=new Element(),next=new Element(),prev=new Element(),stage=new Element(),status=new Element(),progress=new Element(),root=new Element();
  const elements={'[data-pause]':pause,'[data-next]':next,'[data-prev]':prev,'[data-stage]':stage,'[data-status]':status,'[data-progress]':progress};
  count.textContent='1 / 4';root.querySelector=q=>elements[q];root.querySelectorAll=q=>q==='[data-slide]'?slides:dots;
  root.closest=()=>({querySelector:()=>count});root.contains=()=>false;
  const media=new Element();media.matches=reduce;
  const document=new Element();document.hidden=false;document.querySelectorAll=()=>[root];
  let clock=0,id=0;const frames=new Map();
  const context={document,window:{matchMedia:()=>media},performance:{now:()=>clock},requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(fs.readFileSync(new URL('../assets/latest.js',import.meta.url),'utf8'),context);
  const tick=ms=>{clock+=ms;const work=[...frames.values()];frames.clear();work.forEach(fn=>fn(clock))};
  return {slides,dots,count,pause,next,prev,stage,media,status,root,document,tick,frames};
}
const normal=fixture(false);assert.equal(normal.frames.size,1);
normal.tick(7000);assert.equal(normal.count.textContent,'2 / 4');assert.equal(normal.slides.filter(x=>!x.hidden).length,1);
normal.dots[3].emit('click');assert.equal(normal.count.textContent,'4 / 4');assert(normal.status.textContent.includes('Publicación 4'));
normal.next.emit('click');assert.equal(normal.count.textContent,'1 / 4');normal.prev.emit('click');assert.equal(normal.count.textContent,'4 / 4');
normal.pause.emit('click');assert.equal(normal.frames.size,0);normal.tick(20000);assert.equal(normal.count.textContent,'4 / 4');normal.pause.emit('click');assert.equal(normal.frames.size,1);
normal.media.matches=true;normal.media.emit('change');assert.equal(normal.frames.size,0);assert(normal.pause.disabled);
normal.next.emit('click');assert.equal(normal.count.textContent,'1 / 4');assert(!normal.slides[0].classList.values.has('novedad-entrando'));
normal.media.matches=false;normal.media.emit('change');assert.equal(normal.frames.size,1);assert(!normal.pause.disabled);
normal.document.hidden=true;normal.document.emit('visibilitychange');assert.equal(normal.frames.size,0);
const reduced=fixture(true);assert.equal(reduced.frames.size,0);assert(reduced.pause.disabled);
reduced.tick(20000);assert.equal(reduced.count.textContent,'1 / 4');reduced.next.emit('click');assert.equal(reduced.count.textContent,'2 / 4');assert.equal(reduced.frames.size,0);
console.log('Carrusel verificado: contador, navegación, pausa, pestaña oculta y movimiento reducido inicial y durante el uso.');
