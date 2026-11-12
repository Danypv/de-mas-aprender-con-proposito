import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Element {
  listeners={};attributes={};dataset={};hidden=false;disabled=false;textContent='';style={};inert=false;
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
  emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event)}
  setAttribute(name,value){this.attributes[name]=String(value)}
  getAttribute(name){return this.attributes[name]??null}
  removeAttribute(name){delete this.attributes[name]}
  closest(){return null}
}
function fixture({reduce=false,coarse=false,length=4}={}){
 const document=new Element();document.readyState='complete';document.hidden=false;
 const slides=Array.from({length},(_,i)=>{
  const card=new Element(),visual=new Element(),image=new Element(),link=new Element();
  image.setAttribute('src',`/image-${i}.jpg`);image.complete=true;image.naturalWidth=960;
  visual.querySelector=()=>image;
  link.closest=q=>q==='[data-slide]'?card:null;link.focus=()=>{document.activeElement=link};
  card.querySelector=q=>q==='.novedad-visual'?visual:q==='h3'?{textContent:`Publicación ${i+1}`}:link;
  card.visual=visual;card.image=image;card.link=link;return card;
 });
 const dots=slides.map(()=>new Element()),count=new Element(),pause=new Element(),next=new Element(),prev=new Element(),stage=new Element(),status=new Element(),progress=new Element(),root=new Element();
 const queries={'[data-pause]':pause,'[data-next]':next,'[data-prev]':prev,'[data-stage]':stage,'[data-status]':status,'[data-progress]':progress};
 root.dataset.interval='7000';root.querySelector=q=>queries[q];root.querySelectorAll=q=>q==='[data-slide]'?slides:dots;
 root.closest=()=>({querySelector:()=>count});root.contains=target=>[pause,next,prev,...slides.map(s=>s.link)].includes(target);
 const media=new Element();media.matches=reduce;const hover=new Element();hover.matches=!coarse;
 document.querySelectorAll=()=>[root];
 let clock=0,id=0;const timers=new Map();
 const window=new Element();window.matchMedia=q=>q.includes('prefers-reduced-motion')?media:hover;
 window.setInterval=(fn,delay)=>{const key=++id;timers.set(key,{fn,delay,start:clock});return key};window.clearInterval=key=>timers.delete(key);
 const context={document,window,performance:{now:()=>clock}};
 vm.runInNewContext(fs.readFileSync(new URL('../assets/latest.js',import.meta.url),'utf8'),context);
 const tick=ms=>{clock+=ms;for(const[key,timer]of [...timers])if(timers.has(key)&&clock-timer.start>=timer.delay)timer.fn()};
 const gesture=(from,to,type='touch',dy=0)=>{stage.emit('pointerdown',{clientX:from,clientY:50,pointerId:1,pointerType:type,button:0});stage.emit('pointermove',{clientX:to,clientY:50+dy,pointerId:1});window.emit('pointerup',{clientX:to,clientY:50+dy,pointerId:1})};
 return {slides,dots,count,pause,next,prev,stage,media,status,root,document,window,tick,timers,gesture};
}
const normal=fixture();assert.equal(normal.timers.size,1);
normal.tick(6999);assert.equal(normal.count.textContent,'1 / 4');normal.tick(1);assert.equal(normal.count.textContent,'2 / 4');
assert.deepEqual(normal.slides.map(s=>s.dataset.position),['left','current','right','away']);assert.equal(normal.slides.filter(s=>!s.inert).length,1);
normal.dots[3].emit('click');assert.equal(normal.count.textContent,'4 / 4');assert(normal.status.textContent.includes('Publicación 4'));
normal.next.emit('click');assert.equal(normal.count.textContent,'1 / 4');normal.prev.emit('click');assert.equal(normal.count.textContent,'4 / 4');
assert.equal(normal.timers.size,1,'La navegación manual debe permitir que continúe el avance automático');
normal.tick(7000);assert.equal(normal.count.textContent,'1 / 4');
normal.pause.emit('click');assert.equal(normal.timers.size,0);normal.tick(20000);assert.equal(normal.count.textContent,'1 / 4');normal.pause.emit('click');assert.equal(normal.timers.size,1);
normal.stage.emit('mouseenter');assert.equal(normal.timers.size,0);normal.stage.emit('mouseleave');assert.equal(normal.timers.size,1);
normal.root.emit('focusin',{target:normal.slides[0].link});assert.equal(normal.timers.size,0);normal.root.emit('focusout',{relatedTarget:normal.next});assert.equal(normal.timers.size,1);
normal.gesture(500,250,'mouse');assert.equal(normal.count.textContent,'2 / 4');
let prevented=false;normal.stage.emit('click',{target:{closest:()=>({})},preventDefault(){prevented=true},stopPropagation(){}});assert(prevented,'Arrastrar una portada no debe abrir el enlace');
normal.gesture(200,450,'mouse');assert.equal(normal.count.textContent,'1 / 4');assert.equal(normal.timers.size,1);
normal.gesture(250,265,'mouse',150);assert.equal(normal.count.textContent,'1 / 4','El desplazamiento vertical no cambia la carta');
normal.media.matches=true;normal.media.emit('change');assert.equal(normal.timers.size,0);assert(normal.pause.disabled);normal.next.emit('click');assert.equal(normal.count.textContent,'2 / 4');
normal.media.matches=false;normal.media.emit('change');assert.equal(normal.timers.size,1);assert(!normal.pause.disabled);
normal.document.hidden=true;normal.document.emit('visibilitychange');assert.equal(normal.timers.size,0);normal.document.hidden=false;normal.document.emit('visibilitychange');assert.equal(normal.timers.size,1);
normal.slides[1].image.emit('error');assert.equal(normal.slides[1].visual.dataset.imageState,'missing');assert(normal.slides[1].image.hidden);
normal.slides[1].image.emit('load');assert.equal(normal.slides[1].visual.dataset.imageState,'ready');assert(!normal.slides[1].image.hidden);
const phone=fixture({coarse:true});phone.stage.emit('mouseenter');assert.equal(phone.timers.size,1,'El hover sintético de un teléfono no debe detener el carrusel');phone.gesture(350,150);assert.equal(phone.count.textContent,'2 / 4');phone.gesture(150,350);assert.equal(phone.count.textContent,'1 / 4');assert.equal(phone.timers.size,1);
const reduced=fixture({reduce:true});assert.equal(reduced.timers.size,0);assert(reduced.pause.disabled);reduced.next.emit('click');assert.equal(reduced.count.textContent,'2 / 4');
const single=fixture({length:1});assert.equal(single.timers.size,0);assert(single.next.disabled&&single.prev.disabled&&single.pause.disabled);
console.log('Carrusel verificado: pausa central, bucle, teclado, dedo y mouse en ambos sentidos, reanudación automática, enlaces al arrastrar, fondos sin imagen, visibilidad y movimiento reducido.');

await import('./test-latest.mjs');
