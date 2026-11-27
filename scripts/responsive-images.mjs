import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import sharp from 'sharp';

const origin = 'https://somosdemas.com';
const directory = 'assets/imagenes/responsivas';
const owner = 'DE+ responsive images v1\n';
const widths = [160, 320, 480, 640, 960, 1200, 1600, 1920, 2560, 3200, 3840];
const settings = { version: 2, sharp: sharp.versions.sharp, quality: 95, effort: 6, smartSubsample: true, alphaQuality: 100, widths };
const hash = value => createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const attribute = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const classList = node => (attribute(node, 'class') || '').split(/\s+/);
const inside = (node, className) => { for (let current = node; current; current = current.parentNode) if (classList(current).includes(className)) return true; return false; };
const walk = (node, visit) => { visit(node); for (const child of node.childNodes || []) walk(child, visit); };
const readManifest = root => { try { return JSON.parse(fs.readFileSync(path.join(root, directory, 'manifest.json'), 'utf8')); } catch { return { images: {} }; } };
const sameFile = (file, digest) => fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink() && hash(fs.readFileSync(file)) === digest;

function pages(root) {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
    const url = new URL(loc.replaceAll('&amp;', '&'));
    if (url.origin !== origin) throw Error('Imágenes: el sitemap contiene una dirección ajena a DE+.');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname), 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) throw Error('Imágenes: falta una página del sitemap.');
    return { url, file };
  });
}

function originalFile(root, src, url) {
  if (!src) return;
  try {
    const target = new URL(src, url);
    const pathname = decodeURIComponent(target.pathname);
    if (target.origin !== origin || !pathname.startsWith('/assets/imagenes/blog/') || !/\.(?:jpe?g|png|webp)$/i.test(pathname)) return;
    const file = path.resolve(root, '.' + pathname);
    const media = path.resolve(root, 'assets/imagenes/blog');
    if (!file.startsWith(media + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return;
    if (!fs.realpathSync(file).startsWith(fs.realpathSync(media) + path.sep)) return;
    return { pathname, file };
  } catch { return; }
}

// Source locations preserve every existing img attribute and the rest of the HTML.
function unwrapGenerated(html) {
  const edits = [];
  walk(parse(html, { sourceCodeLocationInfo: true }), node => {
    if (node.tagName !== 'picture' || attribute(node, 'data-demas-responsive') !== '1') return;
    const img = node.childNodes?.find(child => child.tagName === 'img');
    if (!img?.sourceCodeLocation || !node.sourceCodeLocation) throw Error('Imágenes: un contenedor generado está incompleto.');
    edits.push({ start: node.sourceCodeLocation.startOffset, end: node.sourceCodeLocation.endOffset, value: html.slice(img.sourceCodeLocation.startOffset, img.sourceCodeLocation.endOffset) });
  });
  return edits.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.value + text.slice(edit.end), html);
}

export function imageSizes(node) {
  if (inside(node, 'coleccion-visual')) return '128px';
  if (inside(node, 'novedad-visual')) return '(max-width: 480px) calc(88vw - 35px), (max-width: 672px) calc(76vw - 30px), (max-width: 780px) 480px, (max-width: 1000px) calc(52vw - 25px), 500px';
  if (inside(node, 'ensayos-imagen')) return '(max-width: 720px) calc(100vw - 40px), (max-width: 1228px) calc(52.4vw - 46px), 598px';
  if (inside(node, 'portada-articulo')) return '(max-width: 1020px) calc(100vw - 40px), 980px';
  if (inside(node, 'miniatura-video')) return '(max-width: 720px) calc(100vw - 48px), (max-width: 1228px) calc(50vw - 40px), 575px';
  if (inside(node, 'serie-card')) return '(max-width: 820px) calc(100vw - 48px), 400px';
  if (inside(node, 'destacado-audio')) return '(max-width: 820px) calc(100vw - 48px), 400px';
  if (classList(node).includes('imagen-entrada')) return '(max-width: 820px) calc(100vw - 48px), (max-width: 900px) calc(100vw - 210px), 850px';
  if (inside(node, 'articulo')) return '(max-width: 820px) calc(100vw - 40px), 780px';
  return '(max-width: 1228px) calc(100vw - 48px), 1180px';
}

function imageNodes(html, root, url) {
  const images = [];
  walk(parse(html, { sourceCodeLocationInfo: true }), node => {
    if (node.tagName !== 'img' || !node.sourceCodeLocation || attribute(node, 'srcset')) return;
    for (let parent = node.parentNode; parent; parent = parent.parentNode) if (parent.tagName === 'picture' || parent.tagName === 'template') return;
    const source = originalFile(root, attribute(node, 'src'), url);
    if (source) images.push({ node, source, sizes: attribute(node, 'sizes') || imageSizes(node) });
  });
  return images;
}

function safeOutput(root) {
  const output = path.join(root, directory);
  fs.mkdirSync(output, { recursive: true });
  if (fs.lstatSync(output).isSymbolicLink() || !fs.realpathSync(output).startsWith(fs.realpathSync(root) + path.sep)) throw Error('Imágenes: carpeta de salida no válida.');
  return output;
}

function cachedVariants(root, item) {
  if (!item?.variants?.length || !/^[a-f0-9]{20}$/.test(item.id) || !['webp', 'jpeg', 'png'].includes(item.format)) return false;
  const extension = item.format === 'jpeg' ? 'jpg' : item.format;
  return item.variants.every(variant => {
    if (!Number.isInteger(variant.width) || variant.width <= 0) return false;
    if (variant.original) {
      const original = originalFile(root, variant.url, origin);
      return variant.url === item.original.url && variant.width === item.original.width && original && sameFile(original.file, variant.sha256);
    }
    return variant.url === `/${directory}/${item.id}/${variant.width}.${extension}` && sameFile(path.join(root, variant.url), variant.sha256);
  });
}

async function prepare(root, source, previous, minBytes, keepEfficientOriginals, warn) {
  const data = fs.readFileSync(source.file);
  if (data.length < minBytes) return;
  const id = hash(Buffer.concat([Buffer.from(JSON.stringify({ ...settings, keepEfficientOriginals })), data])).slice(0, 20);
  if (previous?.id === id && cachedVariants(root, previous)) return previous;
  let metadata;
  try { metadata = await sharp(data).metadata(); }
  catch { warn(`Imágenes: ${source.pathname} se conserva en su formato original porque no se pudo optimizar.`); return; }
  if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1) return;
  const rotated = [5, 6, 7, 8].includes(metadata.orientation);
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  const candidates = [...new Set([...widths.filter(value => value < width), Math.min(width, widths.at(-1))])].sort((a, b) => a - b);
  const folder = path.join(root, directory, id);
  if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) throw Error('Imágenes: carpeta de una variante no válida.');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, '.demas-image'), owner);
  let variants = [];
  for (const size of candidates) {
    const file = path.join(folder, `${size}.webp`);
    const info = await sharp(data).rotate().resize({ width: size, withoutEnlargement: true }).keepIccProfile()
      .webp({ quality: settings.quality, effort: settings.effort, smartSubsample: settings.smartSubsample, alphaQuality: settings.alphaQuality }).toFile(file);
    variants.push({ width: info.width, height: info.height, bytes: info.size, url: `/${directory}/${id}/${size}.webp`, sha256: hash(fs.readFileSync(file)) });
  }
  const history = previous?.id && previous.id !== id ? { previous: previous.id } : previous?.previous ? { previous: previous.previous } : {};
  const sourceDigest = hash(data);
  const original = { width, height, bytes: data.length, sha256: sourceDigest,
    url: source.pathname.split('/').map(encodeURIComponent).join('/') + '?v=' + sourceDigest.slice(0, 12) };
  let format = 'webp';
  // When WebP would be heavier at high density, use smaller copies in the
  // original format and the untouched original as the largest candidate.
  if (keepEfficientOriginals && variants.some(variant => variant.bytes >= data.length)) {
    for (const variant of variants) fs.rmSync(path.join(root, variant.url));
    format = metadata.format;
    if (!['jpeg', 'png', 'webp'].includes(format)) return;
    const extension = format === 'jpeg' ? 'jpg' : format;
    variants = [];
    for (const size of candidates.filter(value => value < width)) {
      const file = path.join(folder, `${size}.${extension}`);
      let pipeline = sharp(data).rotate().resize({ width: size, withoutEnlargement: true }).keepIccProfile();
      pipeline = format === 'jpeg' ? pipeline.jpeg({ quality: 95, mozjpeg: true }) : format === 'png' ? pipeline.png({ compressionLevel: 9 }) : pipeline.webp({ quality: 95, effort: 6, alphaQuality: 100 });
      const info = await pipeline.toFile(file);
      if (info.size >= data.length) { fs.rmSync(file); continue; }
      variants.push({ width: info.width, height: info.height, bytes: info.size, url: `/${directory}/${id}/${size}.${extension}`, sha256: hash(fs.readFileSync(file)) });
    }
    variants.push({ width, height, bytes: data.length, url: original.url, sha256: sourceDigest, original: true });
  }
  return { id, original, format, mime: `image/${format}`, variants,
    ...(previous?.id && previous.id !== id ? { previous: previous.id } : previous?.previous ? { previous: previous.previous } : {}) };
}

export async function buildResponsiveImages(root = process.cwd(), { minBytes = 32768, keepEfficientOriginals = true, warn = console.warn } = {}) {
  root = path.resolve(root);
  const output = safeOutput(root);
  const previous = readManifest(root);
  const pageList = pages(root).map(page => { const original = fs.readFileSync(page.file, 'utf8'); const html = unwrapGenerated(original); return { ...page, original, html, images: imageNodes(html, root, page.url) }; });
  const sources = new Map(pageList.flatMap(page => page.images.map(image => [image.source.pathname, image.source])));
  const pending = [...sources.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'));
  const records = new Map();
  // Identical uploads share a content-addressed directory. Serialize writes so
  // two different filenames with the same bytes cannot race on those files.
  for (const [key, source] of pending) {
    const item = await prepare(root, source, previous.images?.[key], minBytes, keepEfficientOriginals, warn);
    if (item) records.set(key, item);
  }
  const images = Object.fromEntries([...records].sort(([a], [b]) => a.localeCompare(b, 'en')));
  let optimized = 0, changedPages = 0;
  for (const page of pageList) {
    const edits = page.images.flatMap(image => {
      const item = images[image.source.pathname];
      if (!item) return [];
      const location = image.node.sourceCodeLocation;
      const img = page.html.slice(location.startOffset, location.endOffset);
      const srcset = item.variants.map(variant => `${variant.url} ${variant.width}w`).join(', ');
      optimized++;
      return [{ start: location.startOffset, end: location.endOffset, value: `<picture data-demas-responsive="1" style="display:contents"><source type="${item.mime}" srcset="${escape(srcset)}" sizes="${escape(image.sizes)}">${img}</picture>` }];
    });
    const result = edits.sort((a, b) => b.start - a.start).reduce((html, edit) => html.slice(0, edit.start) + edit.value + html.slice(edit.end), page.html);
    if (result !== page.original) { fs.writeFileSync(page.file, result); changedPages++; }
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ version: 1, settings: { ...settings, keepEfficientOriginals }, images }, null, 2) + '\n');
  // Retain one previous version per source for cached pages. Only our marked
  // directories can be pruned; original uploads are never changed or removed.
  const retained = new Set(Object.values(images).flatMap(item => [item.id, item.previous].filter(Boolean)));
  for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{20}$/.test(entry.name) || retained.has(entry.name)) continue;
    const folder = path.join(output, entry.name), marker = path.join(folder, '.demas-image');
    if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === owner) fs.rmSync(folder, { recursive: true });
  }
  return { images: Object.keys(images).length, variants: Object.values(images).reduce((sum, item) => sum + item.variants.filter(variant => !variant.original).length, 0), optimized, changedPages };
}

export function checkResponsiveImages(root = process.cwd()) {
  root = path.resolve(root);
  const manifest = readManifest(root);
  let count = 0;
  for (const page of pages(root)) {
    walk(parse(fs.readFileSync(page.file, 'utf8')), node => {
      if (node.tagName !== 'picture' || attribute(node, 'data-demas-responsive') !== '1') return;
      const img = node.childNodes?.find(child => child.tagName === 'img');
      const source = node.childNodes?.find(child => child.tagName === 'source');
      const original = originalFile(root, attribute(img || {}, 'src'), page.url);
      const item = original && manifest.images?.[original.pathname];
      if (!item || !cachedVariants(root, item) || hash(fs.readFileSync(original.file)) !== item.original.sha256) throw Error(`Imágenes: variantes ausentes o desactualizadas en ${page.url.pathname}`);
      if (attribute(source || {}, 'type') !== item.mime || !attribute(source || {}, 'sizes') || attribute(source || {}, 'srcset') !== item.variants.map(variant => `${variant.url} ${variant.width}w`).join(', ')) throw Error('Imágenes: selección de resolución incompleta.');
      count++;
    });
  }
  return count;
}
