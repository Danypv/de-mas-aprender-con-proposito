import { expandSearchQuery } from './buscar-consultas.js';

const header = document.querySelector('.cabecera');
const navigation = header?.querySelector('.navegacion');
if (navigation && !document.getElementById('buscador-global')) initializeSearch();

function initializeSearch() {
  const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 5 5"/></svg>';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'buscar-abrir';
  button.setAttribute('aria-label','Buscar en DE+');
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls','buscador-global');
  button.setAttribute('aria-expanded','false');
  button.innerHTML = searchIcon;
  navigation.append(button);
  header.classList.add('has-global-search');

  const dialog = document.createElement('dialog');
  dialog.id = 'buscador-global';
  dialog.setAttribute('aria-labelledby','busqueda-titulo');
  dialog.innerHTML = `<div class="busqueda-cabecera"><h2 id="busqueda-titulo">Buscar en DE+</h2><button class="busqueda-cerrar" type="button" aria-label="Cerrar búsqueda"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    <form role="search" aria-label="Buscar en todo DE+"><label class="busqueda-solo-lector" for="busqueda-consulta">Buscar un tema, una palabra o un autor</label><div class="busqueda-campo">${searchIcon}<input id="busqueda-consulta" type="search" placeholder="¿Qué te gustaría encontrar?" autocomplete="off" spellcheck="false"></div></form>
    <div class="busqueda-filtros" role="group" aria-label="Filtrar resultados por sección">${['Todo','Blog','Ensayos','Lecturas selectas','Videos','Podcast'].map((label,i)=>`<button type="button" data-section="${i ? label : ''}" aria-pressed="${!i}">${label}</button>`).join('')}</div>
    <p class="busqueda-estado" role="status" aria-live="polite" aria-atomic="true">Busca por tema, título o autor.</p>
    <div class="busqueda-resultados"></div>
    <button class="busqueda-accion busqueda-mas" type="button" hidden>Mostrar más resultados</button>
    <button class="busqueda-accion busqueda-reintentar" type="button" hidden>Intentar de nuevo</button>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  const status = dialog.querySelector('.busqueda-estado');
  const results = dialog.querySelector('.busqueda-resultados');
  const more = dialog.querySelector('.busqueda-mas');
  const retry = dialog.querySelector('.busqueda-reintentar');
  let section = '', request = 0, timer, manifestPromise, bundlePromise, revision, engine, previousOverflow;
  let matches = [], displayed = 0;
  const isOpen = () => dialog.hasAttribute('open');
  const reset = () => { results.replaceChildren(); matches=[]; displayed=0; more.hidden=true; retry.hidden=true; };
  const dateLabel = value => {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date) : '';
  };

  async function manifest() {
    if (!manifestPromise) manifestPromise = fetch('/assets/busqueda/manifest.json',{cache:'no-store'}).then(response => {
      if (!response.ok) throw Error('Search manifest unavailable');
      return response.json();
    }).then(data => {
      if (data.version !== 1 || !/^\/assets\/busqueda\/[a-f0-9]{16}\/pagefind\.js$/.test(data.bundle)) throw Error('Invalid search manifest');
      if (revision !== data.revision) { engine?.destroy(); bundlePromise=undefined; engine=undefined; revision=data.revision; }
      return data;
    }).catch(error => { manifestPromise=undefined; throw error; });
    return manifestPromise;
  }
  async function loadEngine() {
    const data = await manifest();
    if (!bundlePromise) bundlePromise = import(data.bundle).then(async module => { await module.init(); engine=module; return module; }).catch(error => { bundlePromise=undefined; throw error; });
    return bundlePromise;
  }
  function safeExcerpt(container, value) {
    const source = document.createElement('template');
    source.innerHTML = String(value || '');
    for (const node of source.content.childNodes) {
      if (node.nodeName === 'MARK') { const mark=document.createElement('mark'); mark.textContent=node.textContent; container.append(mark); }
      else container.append(document.createTextNode(node.textContent || ''));
    }
  }
  function card(data) {
    const url = new URL(data.url, location.origin);
    if (url.origin !== location.origin) throw Error('Invalid result URL');
    const article = document.createElement('article'); article.className='busqueda-resultado';
    const link = document.createElement('a'); link.className='busqueda-enlace'; link.href=url.pathname+url.search+url.hash;
    const meta = document.createElement('p'); meta.className='busqueda-meta';
    const label = document.createElement('span'); label.className='busqueda-seccion'; label.textContent=data.meta?.section || 'DE+'; meta.append(label);
    const date = dateLabel(data.meta?.date);
    if (date) { const dateText=document.createElement('span'); dateText.textContent='· '+date; meta.append(dateText); }
    const title = document.createElement('h3'); title.textContent=data.meta?.title || 'Leer publicación';
    const excerpt = document.createElement('p'); excerpt.className='busqueda-extracto'; safeExcerpt(excerpt,data.excerpt || data.meta?.description);
    const arrow = document.createElement('span'); arrow.className='busqueda-flecha'; arrow.setAttribute('aria-hidden','true'); arrow.textContent='↗';
    link.append(meta,title,excerpt,arrow); article.append(link); return article;
  }
  async function showMore(ticket) {
    more.hidden=true;
    const list = await Promise.all(matches.slice(displayed,displayed+8).map(result=>result.data()));
    if (ticket !== request || !isOpen()) return;
    const fragment = document.createDocumentFragment();
    list.forEach(data=>fragment.append(card(data))); results.append(fragment);
    displayed+=list.length; more.hidden=displayed>=matches.length;
  }
  async function search() {
    const ticket=++request;
    const term=expandSearchQuery(input.value);
    reset();
    if (!term) { status.textContent='Busca por tema, título o autor.'; return; }
    status.textContent='Buscando…';
    try {
      const module = await loadEngine();
      const found = await module.search(term,section ? {filters:{section}} : {});
      if (ticket !== request || !isOpen()) return;
      matches=found.results;
      status.textContent=matches.length ? `${matches.length} ${matches.length===1 ? 'resultado' : 'resultados'}` : 'No encontramos resultados. Prueba otra palabra o selecciona Todo.';
      await showMore(ticket);
    } catch {
      if (ticket !== request || !isOpen()) return;
      status.textContent='No pudimos cargar la búsqueda. Inténtalo de nuevo.';
      retry.hidden=false;
    }
  }
  function cleanup() {
    request++; clearTimeout(timer);
    document.body.style.overflow=previousOverflow ?? '';
    button.setAttribute('aria-expanded','false');
    button.focus({preventScroll:true});
  }
  function close() {
    if (!isOpen()) return;
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); cleanup(); }
  }
  function open() {
    if (isOpen()) return;
    const menu=header.querySelector('.menu');
    menu?.classList.remove('abierto');
    const menuButton=header.querySelector('.boton-menu');
    menuButton?.setAttribute('aria-expanded','false'); menuButton?.setAttribute('aria-label','Abrir menú');
    previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    manifestPromise=undefined;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
    button.setAttribute('aria-expanded','true'); input.focus();
    if (input.value.trim()) search();
  }
  button.addEventListener('click',open);
  dialog.querySelector('.busqueda-cerrar').addEventListener('click',close);
  dialog.addEventListener('close',cleanup);
  dialog.addEventListener('click',event=>{ const box=dialog.getBoundingClientRect(); if(event.target===dialog && (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)) close(); });
  dialog.addEventListener('keydown',event=>{ if(event.key==='Escape'){event.preventDefault();close();} });
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,150);});
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);search();});
  dialog.querySelectorAll('[data-section]').forEach(filter=>filter.addEventListener('click',()=>{
    section=filter.dataset.section;
    dialog.querySelectorAll('[data-section]').forEach(item=>item.setAttribute('aria-pressed',String(item===filter)));
    clearTimeout(timer); search();
  }));
  more.addEventListener('click',()=>{const ticket=request;showMore(ticket).catch(()=>{if(ticket===request && isOpen()){status.textContent='No pudimos cargar más resultados. Inténtalo de nuevo.';more.hidden=false;}});});
  retry.addEventListener('click',()=>{manifestPromise=undefined;search();});
}
