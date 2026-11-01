import {collections,readReadings,escapeHtml as e} from './readings.mjs';

const themes={filosofia:'grafito',educacion:'amarillo','etica-e-inteligencia-artificial':'blanco','empresa-cultura-y-liderazgo':'grafito','ciencia-y-salud':'contorno','historia-y-cultura':'crema','teologia-y-espiritualidad':'blanco',cine:'grafito'};
export function updateHomeCollections(home,root){
  if(!home.includes('<!-- COLLECTIONS_START -->'))return home;
  const readings=readReadings(root).filter(item=>item.status==='published');
  const cards=collections.map(collection=>{
    const count=readings.filter(item=>item.collections.includes(collection.slug)).length;
    return `<a class="lectura-coleccion lectura-${themes[collection.slug]||'grafito'}" href="lecturas/${e(collection.slug)}/"><h3>${e(collection.title)}</h3><div class="lectura-coleccion-pie"><span class="lectura-cantidad"><strong>${count}</strong> ${count===1?'lectura':'lecturas'}</span><span class="lectura-explorar">Explorar <span aria-hidden="true">→</span></span></div></a>`;
  }).join('\n');
  const block=`<div class="lecturas-encabezado"><div><p class="etiqueta">Lecturas selectas</p><h2>Leer, pensar y conversar.</h2></div><a class="lecturas-todas" href="lecturas/">Todas las lecturas <span>${readings.length}</span> <span aria-hidden="true">→</span></a></div><nav class="lecturas-colecciones" aria-label="Colecciones de Lecturas selectas">${cards}</nav>`;
  return home.replace(/<!-- COLLECTIONS_START -->[\s\S]*?<!-- COLLECTIONS_END -->/,()=>`<!-- COLLECTIONS_START -->\n${block}\n<!-- COLLECTIONS_END -->`);
}
