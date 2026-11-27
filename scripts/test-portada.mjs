import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { buildPortada, checkPortada, normalizePortada, portadaConfig, syncPortada } from './portada.mjs';

const reference = path.resolve(new URL('..', import.meta.url).pathname);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demas-portada-'));
const sha = data => createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
const outside = html => html.replace(/<!-- PORTADA_(HEAD|IMAGES)_START -->[\s\S]*?<!-- PORTADA_\1_END -->/g, '');
const media = '/assets/imagenes/portada/';
const photo = (name, rest = {}) => ({ title: name, image: media + name, ...rest });
const manifest = site => JSON.parse(read(path.join(site, 'assets/imagenes/portada-generada/manifest.json')));
const home = site => read(path.join(site, 'index.html'));
function fixture(name) {
  const site = path.join(root, name);
  fs.mkdirSync(site, { recursive: true });
  fs.copyFileSync(path.join(reference, 'index.html'), path.join(site, 'index.html'));
  for (const file of ['portada.css', 'portada.js']) fs.copyFileSync(path.join(reference, 'assets', file), path.join(site, 'assets-' + file));
  fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
  for (const file of ['portada.css', 'portada.js']) fs.renameSync(path.join(site, 'assets-' + file), path.join(site, 'assets', file));
  return site;
}

try {
  const site = fixture('single');
  const untouched = outside(home(site));
  assert.deepEqual(await buildPortada(site), { images: 0, changed: false });
  assert.equal(checkPortada(site), 0);
  const webp = await sharp({ create: { width: 1200, height: 640, channels: 3, background: '#32769a' } }).webp({ quality: 95 }).toBuffer();
  const portrait = await sharp({ create: { width: 480, height: 720, channels: 4, background: '#a14b66' } }).png().toBuffer();
  const replacement = await sharp(webp).modulate({ brightness: 1.1 }).webp({ quality: 95 }).toBuffer();
  save(path.join(site, media, 'primera.webp'), webp);
  save(path.join(site, media, 'movil.png'), portrait);
  save(path.join(site, media, 'segunda.png'), portrait);
  const config = { carousel: false, interval: 10, images: [photo('primera.webp', { mobile_image: media + 'movil.png', manual_framing: true, desktop_x: 100, desktop_y: 32, mobile_x: 68, mobile_y: 30 }), photo('segunda.png')] };
  save(path.join(site, portadaConfig), config);
  assert.equal((await buildPortada(site)).images, 1);
  assert.equal(checkPortada(site), 1);
  assert.equal(outside(home(site)), untouched, 'La franja, los textos y todo el resto de la página quedan intactos');
  assert(!home(site).includes('data-portada-pausa'), 'Una foto fija no añade controles');
  assert.equal((home(site).match(/data-portada-foto/g) || []).length, 1);
  assert(home(site).includes('--portada-x:100%;--portada-y:32%;--portada-movil-x:68%;--portada-movil-y:30%'));
  const initial = manifest(site);
  const first = initial.assets[media + 'primera.webp'];
  assert.equal(first.images.length, 1, 'Un WebP ya optimizado conserva su versión de calidad original');
  assert.deepEqual(fs.readFileSync(path.join(site, first.images[0].url)), webp, 'La imagen WebP no se recomprime');
  assert.deepEqual(fs.readFileSync(path.join(site, media, 'primera.webp')), webp);
  for (const asset of Object.values(initial.assets)) for (const image of asset.images) {
    const metadata = await sharp(path.join(site, image.url)).metadata();
    assert(metadata.width <= asset.width, 'No se amplía el original');
    assert(Math.abs(metadata.width / metadata.height - asset.width / asset.height) < 0.01, 'Se conservan las proporciones');
  }
  const initialHtml = home(site), initialManifest = read(path.join(site, 'assets/imagenes/portada-generada/manifest.json'));
  assert.equal((await buildPortada(site)).changed, false);
  assert.equal(home(site), initialHtml);
  assert.equal(read(path.join(site, 'assets/imagenes/portada-generada/manifest.json')), initialManifest);

  config.carousel = true;
  save(path.join(site, portadaConfig), config);
  assert.equal((await buildPortada(site)).images, 2);
  assert.equal(checkPortada(site), 2);
  assert.equal((home(site).match(/data-portada-foto/g) || []).length, 2);
  assert(home(site).includes('data-portada-pausa'));
  assert(home(site).includes('data-srcset='), 'Las siguientes imágenes esperan a su turno para descargarse');
  assert.equal(outside(home(site)), untouched);
  const before = manifest(site).assets[media + 'primera.webp'].id;
  save(path.join(site, media, 'primera.webp'), replacement);
  await buildPortada(site);
  assert.notEqual(manifest(site).assets[media + 'primera.webp'].id, before, 'La sustitución con el mismo nombre cambia la caché');
  assert(fs.existsSync(path.join(site, 'assets/imagenes/portada-generada', before)), 'El HTML en caché conserva sus fotos anteriores');
  const current = manifest(site).assets[media + 'primera.webp'];
  const derivative = path.join(site, current.images[0].url);
  const good = fs.readFileSync(derivative);
  fs.writeFileSync(derivative, 'copia dañada');
  assert.throws(() => checkPortada(site));
  await buildPortada(site);
  assert.deepEqual(fs.readFileSync(derivative), good, 'Se repara una copia dañada');
  config.carousel = false;
  config.images.reverse();
  save(path.join(site, portadaConfig), config);
  await buildPortada(site);
  assert.equal(checkPortada(site), 1);
  assert(!home(site).includes('data-portada-pausa'));
  assert.equal(outside(home(site)), untouched);
  assert.deepEqual(fs.readFileSync(path.join(site, media, 'primera.webp')), replacement, 'Cambiar el modo no elimina originales');

  const editor = path.join(root, 'editor');
  save(path.join(editor, media, 'primera.webp'), webp);
  const editorConfig = { carousel: false, interval: 10, images: [photo('primera.webp')], status: 'draft' };
  save(path.join(editor, portadaConfig), editorConfig);
  const oldPublicConfig = read(path.join(site, portadaConfig));
  assert.equal(await syncPortada(editor, site), false);
  assert.equal(read(path.join(site, portadaConfig)), oldPublicConfig);
  assert.deepEqual(fs.readFileSync(path.join(site, media, 'primera.webp')), replacement, 'El borrador no filtra una sustitución de imagen');
  save(path.join(editor, media, 'anterior-movil.webp'), webp);
  editorConfig.images[0].mobile_image = media + 'anterior-movil.webp';
  editorConfig.status = 'approved';
  save(path.join(editor, portadaConfig), editorConfig);
  assert(await syncPortada(editor, site));
  assert.equal(JSON.parse(read(path.join(site, portadaConfig))).images[0].mobile_image, '', 'Una nueva foto principal no hereda el recorte móvil de la foto anterior');
  assert.deepEqual(fs.readFileSync(path.join(site, media, 'primera.webp')), webp);
  await buildPortada(site);
  assert.equal(checkPortada(site), 1);
  editorConfig.images = [photo('no-existe.jpg')];
  save(path.join(editor, portadaConfig), editorConfig);
  const publicBeforeError = read(path.join(site, portadaConfig));
  await assert.rejects(() => syncPortada(editor, site));
  assert.equal(read(path.join(site, portadaConfig)), publicBeforeError, 'Una imagen ausente no altera la portada publicada');
  for (const invalid of [null, {}, { ...config, interval: 1 }, { ...config, carousel: 'true' }, { ...config, images: [photo('../secreto.jpg')] }, { ...config, images: [photo('%2e%2e/secreto.jpg')] }, { ...config, images: [photo('primera.webp', { desktop_x: 101 })] }]) assert.throws(() => normalizePortada(invalid));
  const cleanupSite = fixture('cleanup'), cleanupEditor = path.join(root, 'cleanup-editor');
  const a = media + 'a.webp', b = media + 'b.webp', fresh = media + 'sin-publicar.webp';
  for (const url of [a, b, fresh]) save(path.join(cleanupEditor, url), url === b ? replacement : webp);
  const gallery = { status: 'approved', carousel: true, images: [photo('a.webp'), photo('b.webp')] };
  const syncGallery = async () => { save(path.join(cleanupEditor, portadaConfig), gallery); await syncPortada(cleanupEditor, cleanupSite); await buildPortada(cleanupSite); };
  await syncGallery();
  const retiredId = manifest(cleanupSite).assets[a].id;
  assert(manifest(cleanupSite).assets[a].focus.x >= 0 && manifest(cleanupSite).assets[a].focus.x <= 100);
  save(path.join(cleanupEditor, 'content/posts/compartida.md'), `![Compartida](${a})`);
  gallery.images = [photo('b.webp')];await syncGallery();
  assert(fs.existsSync(path.join(cleanupEditor, a)) && fs.existsSync(path.join(cleanupSite, a)), 'Una referencia en otra publicación protege el original');
  fs.unlinkSync(path.join(cleanupEditor, 'content/posts/compartida.md'));await syncGallery();
  assert(!fs.existsSync(path.join(cleanupEditor, a)) && !fs.existsSync(path.join(cleanupSite, a)), 'Se retira el original de ambos repositorios');
  assert(!fs.existsSync(path.join(cleanupSite, 'assets/imagenes/portada-generada', retiredId)), 'Se retiran las copias y los difuminados de una foto eliminada');
  assert(fs.existsSync(path.join(cleanupEditor, fresh)), 'Las subidas nuevas aún no publicadas no se borran');
  gallery.images = [];await syncGallery();
  assert.equal(checkPortada(cleanupSite), 0);
  assert(!home(cleanupSite).includes('data-portada-foto'));
  assert(home(cleanupSite).includes('capa capa-velo'));
  assert(!fs.existsSync(path.join(cleanupEditor, b)) && !fs.existsSync(path.join(cleanupSite, b)));
  assert(!home(cleanupSite).includes('data-portada-pausa'));
  console.log('Portada: publicación, borradores, imágenes fijas, carrusel, orden, encuadres, originales, adaptación, caché, reparación y conservación del resto del sitio comprobados.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }

class Element {
  dataset = {}; attributes = {}; listeners = {}; hidden = false; disabled = false; textContent = '';
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter(listener => listener !== fn); }
  emit(name, event = {}) { for (const fn of [...(this.listeners[name] || [])]) fn(event); }
  setAttribute(name, value) { this.attributes[name] = String(value); if (this.image && ['src', 'srcset'].includes(name)) { this.complete = true; this.naturalWidth = this.failed ? 0 : 1200; this.emit(this.failed ? 'error' : 'load'); } }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; if (name.startsWith('data-')) delete this.dataset[name.slice(5)]; }
}
function browserFixture({ count = 3, reduce = false, coarse = false, failed = [], width = 1360, height = 560 } = {}) {
  const document = new Element(), window = new Element(), button = new Element(), root = new Element(), stage = new Element(), reduced = new Element();
  let box = { width, height }, resize, intersection, clock = 0, id = 0;
  const timers = new Map();
  const slides = Array.from({ length: count }, (_, index) => {
    const slide = new Element(), image = new Element(), source = new Element();
    slide.dataset.activa = String(index === 0);
    image.image = true; image.complete = index === 0; image.naturalWidth = index === 0 ? 1200 : 0; image.failed = failed.includes(index);
    image.dataset.aspecto = '2'; source.dataset.aspecto = '2';
    if (index) { image.dataset.src = `/foto-${index}.webp`; image.dataset.srcset = `/foto-${index}.webp 1200w`; source.dataset.srcset = `/movil-${index}.webp 1200w`; }
    slide.querySelector = () => image;
    slide.querySelectorAll = query => query === 'source' ? [source] : query === '[data-aspecto]' ? [image, source] : [source, image].filter(node => node.dataset.srcset);
    return Object.assign(slide, { image, source });
  });
  stage.dataset.intervalo = '10000'; stage.querySelectorAll = () => slides; stage.closest = () => root;
  root.querySelector = () => button; root.contains = value => value === button || value === root.link; root.getBoundingClientRect = () => box;
  root.link = new Element();
  document.querySelector = () => stage; document.hidden = false;
  reduced.matches = reduce;
  window.matchMedia = query => query.includes('prefers-reduced-motion') ? reduced : { matches: query.includes('max-width') ? width <= 780 : !coarse };
  window.setTimeout = (fn, delay) => { const key = ++id; timers.set(key, { fn, at: clock + delay }); return key; };
  window.clearTimeout = key => timers.delete(key);
  window.ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} };
  window.IntersectionObserver = class { constructor(callback) { intersection = callback; } observe() {} };
  vm.runInNewContext(read(path.join(reference, 'assets/portada.js')), { document, window });
  const tick = async ms => { clock += ms; for (const [key, timer] of [...timers]) if (timers.has(key) && timer.at <= clock) { timers.delete(key); await timer.fn(); } };
  return { root, stage, button, slides, document, reduced, timers, tick, resize(w, h) { box = { width: w, height: h }; resize(); }, visible(value) { intersection([{ isIntersecting: value }]); } };
}
const normal = browserFixture();
assert.equal(normal.timers.size, 1);
assert.equal(normal.slides[0].image.getAttribute('sizes'), '1360px');
await normal.tick(9999); assert.equal(normal.slides[0].dataset.activa, 'true');
await normal.tick(1); assert.equal(normal.slides[1].dataset.activa, 'true');
assert.equal(normal.slides[2].image.dataset.src, '/foto-2.webp', 'La tercera foto no se descarga antes de necesitarla');
await normal.tick(10000); assert.equal(normal.slides[2].dataset.activa, 'true');
await normal.tick(10000); assert.equal(normal.slides[0].dataset.activa, 'true');
normal.button.emit('click'); assert.equal(normal.timers.size, 0); assert.equal(normal.button.textContent, 'Reanudar imágenes');
await normal.tick(20000); assert.equal(normal.slides[0].dataset.activa, 'true');
normal.button.emit('click'); assert.equal(normal.timers.size, 1);
normal.root.emit('mouseenter'); assert.equal(normal.timers.size, 0);
normal.root.emit('mouseleave'); assert.equal(normal.timers.size, 1);
normal.root.emit('focusin', { target: normal.root.link }); assert.equal(normal.timers.size, 0);
normal.root.emit('focusout', { relatedTarget: null }); assert.equal(normal.timers.size, 1);
normal.document.hidden = true; normal.document.emit('visibilitychange'); assert.equal(normal.timers.size, 0);
normal.document.hidden = false; normal.document.emit('visibilitychange'); assert.equal(normal.timers.size, 1);
normal.visible(false); assert.equal(normal.timers.size, 0); normal.visible(true); assert.equal(normal.timers.size, 1);
normal.reduced.matches = true; normal.reduced.emit('change'); assert.equal(normal.timers.size, 0); assert(normal.button.disabled);
normal.reduced.matches = false; normal.reduced.emit('change'); assert.equal(normal.timers.size, 1);
normal.resize(390, 720); assert.equal(normal.slides[0].image.getAttribute('sizes'), '1440px', 'El teléfono selecciona resolución para cubrir toda la altura sin estirar una miniatura');
assert.equal(normal.slides[0].source.getAttribute('sizes'), '1440px');
const phone = browserFixture({ coarse: true }); phone.root.emit('mouseenter'); assert.equal(phone.timers.size, 1);
const reduced = browserFixture({ reduce: true }); assert.equal(reduced.timers.size, 0); assert(reduced.button.disabled);
const single = browserFixture({ count: 1 }); assert.equal(single.timers.size, 0); assert(single.button.hidden);
const broken = browserFixture({ failed: [1] }); await broken.tick(10000); assert.equal(broken.slides[2].dataset.activa, 'true', 'Una foto fallida se omite sin mostrar una pantalla vacía');
console.log('Carrusel de portada: fundido, pausa, teclado, teléfono, visibilidad, movimiento reducido, carga diferida, fallos de red y selección de resolución comprobados.');
