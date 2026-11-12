import {collections,readReadings,escapeHtml as e} from './readings.mjs';
import {latestCover} from './latest-covers.mjs';

export function updateHomeCollections(home,root){
  if(!home.includes('<!-- COLLECTIONS_START -->'))return home;
  // A featured older reading must never displace the newest publication here.
  const readings=readReadings(root).filter(item=>item.status==='published')
    .sort((a,b)=>new Date(b.date)-new Date(a.date)||a.slug.localeCompare(b.slug,'es'));
  const cards=[],pending=[];
  for(const collection of collections){
    const selected=readings.filter(item=>item.collections.includes(collection.slug));
    const slug=e(collection.slug),title=e(collection.title);
    if(!selected.length){
      pending.push(`<div class="coleccion-proxima" data-collection="${slug}"><h3>${title}</h3><span>Próximamente</span></div>`);
      continue;
    }
    const latest=selected[0],cover=latestCover(root,latest),quantity=selected.length===1?'lectura':'lecturas';
    const visual=cover?`<div class="coleccion-visual${cover.book?' coleccion-visual--libro':''}"><img src="${e(cover.url)}" alt="${e(cover.alt)}" width="128" height="108" loading="lazy" decoding="async"></div>`:'<div class="coleccion-visual sin-imagen" aria-hidden="true"></div>';
    cards.push(`<a class="lectura-coleccion" data-collection="${slug}" href="lecturas/${slug}/" aria-label="Explorar ${title}, ${selected.length} ${quantity}" aria-describedby="coleccion-${slug}-lectura"><h3>${title}</h3><div class="coleccion-pista"><div class="lectura-sugerida"><p class="lectura-sugerida-rotulo">Lectura más reciente</p><p class="lectura-sugerida-titulo" id="coleccion-${slug}-lectura">${e(latest.title)}</p></div>${visual}</div><div class="lectura-coleccion-pie"><span class="lectura-cantidad"><strong>${selected.length}</strong> ${quantity}</span><span class="lectura-explorar">Explorar <span aria-hidden="true">→</span></span></div></a>`);
  }
  const available=cards.length?`<nav class="lecturas-colecciones" aria-label="Colecciones de Lecturas selectas">${cards.join('\n')}</nav>`:'';
  const upcoming=pending.length?`<div class="proximas-colecciones"><p class="proximas-titulo">Próximas colecciones</p><div class="proximas-lista">${pending.join('\n')}</div></div>`:'';
  const block=`<div class="lecturas-encabezado"><div><p class="etiqueta">Lecturas selectas</p><h2>Leer, pensar y conversar.</h2></div><a class="lecturas-todas" href="lecturas/">Todas las lecturas <span>${readings.length}</span> <span aria-hidden="true">→</span></a></div>${available}${upcoming}`;
  return home.replace(/<!-- COLLECTIONS_START -->[\s\S]*?<!-- COLLECTIONS_END -->/,()=>`<!-- COLLECTIONS_START -->\n${block}\n<!-- COLLECTIONS_END -->`);
}
