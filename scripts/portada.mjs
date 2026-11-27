import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const portadaConfig = 'content/settings/portada.json';
const media = 'assets/imagenes/portada';
const output = 'assets/imagenes/portada-generada';
const marker = 'DE+ portada v1\n';
const settings = { version: 1, sharp: sharp.versions.sharp, quality: 95, widths: [480, 780, 1200, 1600, 1920, 2560, 3200, 3840] };
const digest = value => createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const read = file => fs.readFileSync(file, 'utf8');
const json = value => JSON.stringify(value, null, 2) + '\n';
const writeChanged = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); if (!fs.existsSync(file) || read(file) !== value) fs.writeFileSync(file, value); };

function position(value, fallback, name) {
  const number = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw Error(`Portada: ${name} debe estar entre 0 y 100.`);
  return number;
}

export function normalizePortada(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Portada: configuración no válida.');
  if (data.carousel !== undefined && typeof data.carousel !== 'boolean') throw Error('Portada: activa o desactiva el carrusel.');
  const interval = Number(data.interval ?? 10);
  if (!Number.isInteger(interval) || interval < 5 || interval > 60) throw Error('Portada: el intervalo debe ser de 5 a 60 segundos.');
  if (!Array.isArray(data.images) || !data.images.length || data.images.length > 8) throw Error('Portada: añade entre una y ocho imágenes.');
  const images = data.images.filter(item => item?.enabled !== false).map((item, index) => {
    if (!item || typeof item !== 'object') throw Error('Portada: imagen no válida.');
    const image = imagePath(item.image);
    const mobile_image = item.mobile_image ? imagePath(item.mobile_image) : '';
    return { title: String(item.title || `Imagen ${index + 1}`).trim().slice(0, 160), image, mobile_image,
      desktop_x: position(item.desktop_x, 50, 'la posición horizontal en computador'),
      desktop_y: position(item.desktop_y, 50, 'la posición vertical en computador'),
      mobile_x: position(item.mobile_x, 50, 'la posición horizontal en teléfono'),
      mobile_y: position(item.mobile_y, 50, 'la posición vertical en teléfono') };
  });
  if (!images.length) throw Error('Portada: conserva al menos una imagen activa.');
  return { carousel: data.carousel === true, interval, images };
}

function imagePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/' + media + '/') || /[?#\\\x00-\x1f]/u.test(value)) throw Error('Portada: sube la imagen en la carpeta Imágenes de portada.');
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw Error('Portada: dirección de imagen no válida.'); }
  if (!/\.(?:jpe?g|png|webp)$/i.test(decoded) || decoded.slice(1).split('/').some(part => !part || part === '.' || part === '..')) throw Error('Portada: dirección de imagen no válida.');
  if (!decoded.startsWith('/' + media + '/') || /[?#\\\x00-\x1f]/u.test(decoded)) throw Error('Portada: dirección de imagen no válida.');
  return decoded;
}

function sourceFile(root, url) {
  const file = path.resolve(root, '.' + imagePath(url));
  const folder = path.resolve(root, media);
  if (!file.startsWith(folder + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(fs.realpathSync(folder) + path.sep)) throw Error(`Portada: falta la imagen ${url}.`);
  return file;
}

async function validateSources(root, config) {
  const sources = [...new Set(config.images.flatMap(item => [item.image, item.mobile_image].filter(Boolean)))];
  for (const url of sources) {
    const metadata = await sharp(sourceFile(root, url)).metadata();
    if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw Error(`Portada: usa una fotografía estática JPG, PNG o WebP (${url}).`);
  }
  return sources;
}

// A draft must never replace published photos, including uploads with the same name.
export async function syncPortada(editor, site) {
  const file = path.join(editor, portadaConfig);
  if (!fs.existsSync(file)) return false;
  const data = JSON.parse(read(file));
  if (data.status !== 'approved') return false;
  const config = normalizePortada(data);
  const sources = await validateSources(editor, config);
  for (const url of sources) {
    const destination = path.join(site, url);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(sourceFile(editor, url), destination);
  }
  writeChanged(path.join(site, portadaConfig), json(config));
  return true;
}

const urlFor = (id, filename) => `/${output}/${id}/${filename}`;
function cached(root, item, id) {
  return item?.id === id && item.files?.length && item.files.every(file => file.url.startsWith(`/${output}/${id}/`) && !file.url.includes('..') && fs.existsSync(path.join(root, file.url)) && digest(fs.readFileSync(path.join(root, file.url))) === file.sha256);
}

async function variants(root, url, previous) {
  const source = fs.readFileSync(sourceFile(root, url));
  const id = digest(Buffer.concat([Buffer.from(json(settings)), source])).slice(0, 20);
  if (cached(root, previous, id)) return previous;
  const metadata = await sharp(source).metadata();
  const rotated = [5, 6, 7, 8].includes(metadata.orientation);
  const width = rotated ? metadata.height : metadata.width, height = rotated ? metadata.width : metadata.height;
  if (!width || !height || (metadata.pages || 1) > 1) throw Error('Portada: imagen no válida.');
  const folder = path.join(root, output, id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, '.demas-portada'), marker);
  // The existing, already optimized WebP covers keep their exact pixels.
  const preserve = metadata.format === 'webp' && !metadata.orientation && width <= 2048;
  const widths = preserve ? [width] : [...new Set([...settings.widths.filter(size => size < width), Math.min(width, settings.widths.at(-1))])];
  const files = [], images = [];
  const record = (name, info) => {
    const data = fs.readFileSync(path.join(folder, name));
    const file = { url: urlFor(id, name), bytes: data.length, sha256: digest(data), ...info };
    files.push(file); return file;
  };
  for (const size of widths) {
    const name = `${size}.webp`;
    if (preserve) fs.writeFileSync(path.join(folder, name), source);
    else await sharp(source).rotate().resize({ width: size, withoutEnlargement: true }).keepIccProfile().webp({ quality: 95, effort: 6, smartSubsample: true, alphaQuality: 100 }).toFile(path.join(folder, name));
    images.push(record(name, { width: size, height: Math.round(height * size / width) }));
  }
  await sharp(source).rotate().resize({ width: Math.min(width, 720), withoutEnlargement: true }).keepIccProfile().blur(20).webp({ quality: 85 }).toFile(path.join(folder, 'difusa.webp'));
  const blur = record('difusa.webp', {});
  return { id, width, height, sourceSha256: digest(source), images, blur: blur.url, files };
}

const srcset = item => item.images.map(image => `${image.url} ${image.width}w`).join(', ');
const fallbackSizes = (item, height) => `max(100vw, ${Math.ceil(height * item.width / item.height)}px)`;
function photoHtml(photo, assets, index) {
  const desktop = assets[photo.image], mobile = assets[photo.mobile_image || photo.image];
  const eager = index === 0;
  const source = `${eager ? 'srcset' : 'data-srcset'}="${escape(srcset(mobile))}"`;
  const image = `${eager ? 'src' : 'data-src'}="${desktop.images.at(-1).url}" ${eager ? 'srcset' : 'data-srcset'}="${escape(srcset(desktop))}"`;
  const style = `--portada-x:${photo.desktop_x}%;--portada-y:${photo.desktop_y}%;--portada-movil-x:${photo.mobile_x}%;--portada-movil-y:${photo.mobile_y}%;--portada-difusa:url('${desktop.blur}');--portada-difusa-movil:url('${mobile.blur}')`;
  return `<div class="portada-foto" data-portada-foto data-activa="${eager}" style="${style}"><div class="capa capa-nitida"><picture><source media="(max-width: 780px)" ${source} sizes="${fallbackSizes(mobile, 800)}" data-aspecto="${mobile.width / mobile.height}"><img ${image} sizes="${fallbackSizes(desktop, 600)}" width="${desktop.width}" height="${desktop.height}" data-aspecto="${desktop.width / desktop.height}" alt="" decoding="async"${eager ? ' fetchpriority="high"' : ''}></picture></div><div class="capa capa-difusa"></div></div>`;
}

function headHtml(root, config, assets) {
  const first = config.images[0], desktop = assets[first.image], mobile = assets[first.mobile_image || first.image];
  const version = file => digest(fs.readFileSync(path.join(root, file))).slice(0, 12);
  return `\n  <link rel="preload" as="image" href="${mobile.images.at(-1).url}" imagesrcset="${escape(srcset(mobile))}" imagesizes="${fallbackSizes(mobile, 800)}" media="(max-width: 780px)">\n  <link rel="preload" as="image" href="${desktop.images.at(-1).url}" imagesrcset="${escape(srcset(desktop))}" imagesizes="${fallbackSizes(desktop, 600)}" media="not all and (max-width: 780px)">\n  <link rel="stylesheet" href="/assets/portada.css?v=${version('assets/portada.css')}">\n  <script src="/assets/portada.js?v=${version('assets/portada.js')}" defer></script>\n  `;
}

function imagesHtml(config, assets) {
  const images = config.carousel ? config.images : config.images.slice(0, 1);
  return `\n      <div class="capas" aria-hidden="true" data-portada data-intervalo="${config.interval * 1000}">${images.map((photo, index) => photoHtml(photo, assets, index)).join('')}<div class="capa capa-velo"></div></div>\n      ${images.length > 1 ? '<button class="portada-pausa" type="button" data-portada-pausa data-pagefind-ignore hidden aria-pressed="false">Pausar imágenes</button>' : ''}\n      `;
}

function replaceBlock(html, name, value) {
  const expression = new RegExp(`(<!-- ${name}_START -->)[\\s\\S]*?(<!-- ${name}_END -->)`);
  if (!expression.test(html)) throw Error(`Portada: falta el espacio ${name} en la página principal.`);
  return html.replace(expression, (_, start, end) => start + value + end);
}

export async function buildPortada(root = process.cwd()) {
  root = path.resolve(root);
  const file = path.join(root, portadaConfig);
  if (!fs.existsSync(file)) return { images: 0, changed: false };
  const config = normalizePortada(JSON.parse(read(file)));
  const selected = { ...config, images: config.carousel ? config.images : config.images.slice(0, 1) };
  const sources = await validateSources(root, selected);
  let previous = {};
  try { previous = JSON.parse(read(path.join(root, output, 'manifest.json'))); } catch { /* First publication. */ }
  const assets = {};
  for (const url of sources) assets[url] = await variants(root, url, previous.assets?.[url]);
  const ids = [...new Set(Object.values(assets).map(item => item.id))].sort();
  const oldIds = previous.ids && JSON.stringify(previous.ids) !== JSON.stringify(ids) ? previous.ids : previous.previous || [];
  const manifest = { version: 1, settings, ids, previous: oldIds.filter(id => !ids.includes(id)), assets };
  writeChanged(path.join(root, output, 'manifest.json'), json(manifest));
  const home = path.join(root, 'index.html'), before = read(home);
  const after = replaceBlock(replaceBlock(before, 'PORTADA_HEAD', headHtml(root, selected, assets)), 'PORTADA_IMAGES', imagesHtml(selected, assets));
  writeChanged(home, after);
  const retained = new Set([...ids, ...manifest.previous]);
  for (const entry of fs.readdirSync(path.join(root, output), { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{20}$/.test(entry.name) || retained.has(entry.name)) continue;
    const folder = path.join(root, output, entry.name), owner = path.join(folder, '.demas-portada');
    if (fs.existsSync(owner) && read(owner) === marker) fs.rmSync(folder, { recursive: true });
  }
  return { images: selected.images.length, changed: before !== after };
}

export function checkPortada(root = process.cwd()) {
  const file = path.join(root, portadaConfig);
  if (!fs.existsSync(file)) return 0;
  const config = normalizePortada(JSON.parse(read(file)));
  const selected = { ...config, images: config.carousel ? config.images : config.images.slice(0, 1) };
  const manifest = JSON.parse(read(path.join(root, output, 'manifest.json'))), html = read(path.join(root, 'index.html'));
  for (const url of new Set(selected.images.flatMap(item => [item.image, item.mobile_image].filter(Boolean)))) {
    const item = manifest.assets[url];
    if (!item || item.sourceSha256 !== digest(fs.readFileSync(sourceFile(root, url))) || !cached(root, item, item.id)) throw Error('Portada: faltan versiones o cambió un original.');
  }
  if (!html.includes(headHtml(root, selected, manifest.assets)) || !html.includes(imagesHtml(selected, manifest.assets))) throw Error('Portada: configuración y página principal no coinciden.');
  return selected.images.length;
}
