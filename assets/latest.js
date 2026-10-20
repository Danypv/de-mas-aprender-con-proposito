(() => {
 for (const root of document.querySelectorAll('[data-carousel]')) {
  const slides=Array.from(root.querySelectorAll('[data-slide]'));if(slides.length<2)continue;
  const dots=Array.from(root.querySelectorAll('[data-dot]'));
  const pause=root.querySelector('[data-pause]');const stage=root.querySelector('[data-stage]');
  const count=root.closest('.novedades').querySelector('[data-count]');const status=root.querySelector('[data-status]');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,userPaused=false,hovered=false,focused=false,visible=true,timer=null,touch=null,swiped=false;
  const progress=root.querySelector('[data-progress]');
  let elapsed=0,started=0;
  const paint=()=>{progress.style.transform=`scaleX(${Math.min(elapsed/7000,1)})`;};
  const clear=()=>{if(timer!==null){cancelAnimationFrame(timer);timer=null;elapsed=Math.min(elapsed+performance.now()-started,7000);paint();}};
  const schedule=()=>{clear();if(userPaused||hovered||focused||document.hidden||!visible||reduced.matches)return;
   started=performance.now();
   const tick=now=>{const total=elapsed+now-started;progress.style.transform=`scaleX(${Math.min(total/7000,1)})`;if(total>=7000){timer=null;elapsed=0;show(index+1,false);}else timer=requestAnimationFrame(tick);};
   timer=requestAnimationFrame(tick);
  };
  const show=(next,manual)=>{
   clear();elapsed=0;paint();
   index=(next+slides.length)%slides.length;
   slides.forEach((slide,i)=>{slide.hidden=i!==index;slide.classList.remove('novedad-entrando');});
   if(!reduced.matches)slides[index].classList.add('novedad-entrando');
   dots.forEach((dot,i)=>{if(i===index)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');});
   count.textContent=`${index+1} / ${slides.length}`;
   if(manual)status.textContent=`Publicación ${index+1} de ${slides.length}: ${slides[index].querySelector('h3').textContent}`;
   schedule();
  };
  root.querySelector('[data-prev]').addEventListener('click',()=>show(index-1,true));
  root.querySelector('[data-next]').addEventListener('click',()=>show(index+1,true));
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>show(i,true)));
  pause.addEventListener('click',()=>{userPaused=!userPaused;pause.textContent=userPaused?'Reanudar':'Pausar';pause.setAttribute('aria-pressed',String(userPaused));pause.setAttribute('aria-label',userPaused?'Reanudar el avance automático':'Pausar el avance automático');schedule();});
  root.addEventListener('mouseenter',()=>{hovered=true;clear();});root.addEventListener('mouseleave',()=>{hovered=false;schedule();});
  root.addEventListener('focusin',()=>{focused=true;clear();});root.addEventListener('focusout',event=>{focused=root.contains(event.relatedTarget);schedule();});
  root.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1),true);}});
  document.addEventListener('visibilitychange',schedule);
  const motion=()=>{pause.disabled=reduced.matches;pause.textContent=reduced.matches?'Pausado':userPaused?'Reanudar':'Pausar';if(reduced.matches)pause.setAttribute('aria-label','Avance automático desactivado por preferencia de movimiento reducido');else pause.setAttribute('aria-label',userPaused?'Reanudar el avance automático':'Pausar el avance automático');schedule();};
  reduced.addEventListener('change',motion);
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.1}).observe(root);
  stage.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){touch={x:event.clientX,y:event.clientY};clear();}});
  stage.addEventListener('pointerup',event=>{if(!touch)return;const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){swiped=true;show(index+(dx<0?1:-1),true);}else schedule();});
  stage.addEventListener('pointercancel',()=>{touch=null;schedule();});
  stage.addEventListener('click',event=>{if(swiped){event.preventDefault();swiped=false;}},true);
  motion();
 }
})();
