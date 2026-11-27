import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { parse } from 'parse5';
import { buildResponsiveImages, checkResponsiveImages } from './responsive-images.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demas-images-'));
const directory = path.join(root, 'assets/imagenes/blog');
const output = path.join(root, 'assets/imagenes/responsivas');
const source = path.join(directory, 'foto con espacios.jpg');
const pathname = '/assets/imagenes/blog/foto%20con%20espacios.jpg';
const read = () => fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = () => JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
const record = () => manifest().images['/assets/imagenes/blog/foto con espacios.jpg'];
const build = () => buildResponsiveImages(root, { minBytes: 0, keepEfficientOriginals: false });
const save = body => fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html lang="es"><body>${body}</body></html>`);
const count = (html, tag) => { let n = 0; const visit = node => { if (node.tagName === tag) n++; for (const child of node.childNodes || []) visit(child); }; visit(parse(html)); return n; };
const originalTag = `<img class="ejemplo" src="${pathname}?v=1&amp;autor=de-mas" alt="Un marco &amp; una pintura" width="960" height="540" loading="lazy" decoding="async" style="object-fit:cover">`;

try {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset><url><loc>https://somosdemas.com/</loc></url></urlset>');
  const pixels = Buffer.alloc(1100 * 800 * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 73 + (i >>> 6) * 31) % 256;
  const jpeg = await sharp(pixels, { raw: { width: 1100, height: 800, channels: 3 } }).jpeg({ quality: 95 }).withIccProfile('srgb').toBuffer();
  fs.writeFileSync(source, jpeg);
  save(`<a class="novedad-visual">${originalTag}</a><div class="coleccion-visual">${originalTag}</div><figure class="portada-articulo">${originalTag}</figure>`);
  const initial = await build();
  assert.equal(initial.images, 1);
  assert.equal(initial.optimized, 3);
  assert.equal(checkResponsiveImages(root), 3);
  assert.equal(count(read(), 'picture'), 3);
  assert(read().includes(originalTag), 'Se conservan src, alt, tamaño, encuadre, carga diferida y atributos del img original');
  assert(read().includes('sizes="128px"'), 'Las miniaturas no descargan una portada completa');
  assert(read().includes('980px'), 'La portada conserva variantes suficientes para pantallas densas');
  assert.deepEqual(fs.readFileSync(source), jpeg, 'El archivo original no cambia');
  for (const variant of record().variants) {
    const metadata = await sharp(path.join(root, variant.url)).metadata();
    assert.equal(metadata.width, variant.width);
    assert.equal(metadata.height, variant.height);
    assert.equal(metadata.format, 'webp');
    assert(metadata.width <= 1100, 'Las variantes no se amplían por encima del original');
    assert(Math.abs(metadata.width / metadata.height - 1100 / 800) < .01, 'Se mantiene la proporción');
    assert(metadata.icc, 'Se conserva el perfil de color');
  }
  const before = read(), oldManifest = JSON.stringify(manifest()), firstId = record().id;
  const again = await build();
  assert.equal(again.changedPages, 0);
  assert.equal(read(), before);
  assert.equal(JSON.stringify(manifest()), oldManifest, 'Las generaciones repetidas son estables');

  const broken = record().variants[0];
  fs.writeFileSync(path.join(root, broken.url), 'variante dañada');
  assert.throws(() => checkResponsiveImages(root), /variantes/);
  await build();
  assert.equal(checkResponsiveImages(root), 3, 'Una variante dañada se regenera');

  fs.writeFileSync(source, await sharp(jpeg).modulate({ brightness: 1.05 }).jpeg({ quality: 95 }).toBuffer());
  await build();
  const secondId = record().id;
  assert.notEqual(firstId, secondId, 'Sustituir una foto con el mismo nombre renueva sus direcciones');
  assert.equal(record().previous, firstId);
  assert(fs.existsSync(path.join(output, firstId)), 'La generación anterior permite atender páginas en caché');
  fs.writeFileSync(source, await sharp(jpeg).modulate({ brightness: 1.1 }).jpeg({ quality: 95 }).toBuffer());
  await build();
  assert.equal(record().previous, secondId);
  assert(!fs.existsSync(path.join(output, firstId)), 'Las generaciones antiguas propias se limpian');

  const alpha = path.join(directory, 'transparencia.png');
  fs.writeFileSync(alpha, await sharp({ create: { width: 240, height: 180, channels: 4, background: { r: 10, g: 100, b: 200, alpha: .4 } } }).png().toBuffer());
  const rotated = path.join(directory, 'orientada.jpg');
  fs.writeFileSync(rotated, await sharp(jpeg).withMetadata({ orientation: 6 }).jpeg().toBuffer());
  fs.writeFileSync(path.join(directory, 'sin-publicar.jpg'), jpeg);
  fs.copyFileSync(source, path.join(directory, 'duplicada.jpg'));
  const authored = `<picture><source srcset="https://example.org/otra.webp"><img src="${pathname}" alt="Control editorial"></picture>`;
  save(`${authored}<img src="https://example.org/externa.jpg" alt="Externa"><img src="/assets/marca/logo.svg" alt="Marca"><img src="/assets/imagenes/blog/transparencia.png"><img src="/assets/imagenes/blog/orientada.jpg"><img src="${pathname}"><img src="/assets/imagenes/blog/duplicada.jpg">`);
  await build();
  assert(read().includes(authored), 'Los picture preparados por el editor no se reescriben');
  assert(!manifest().images['/assets/imagenes/blog/sin-publicar.jpg'], 'Solo se procesa lo referenciado por páginas públicas');
  assert(!manifest().images['https://example.org/externa.jpg'], 'No se descargan fuentes externas');
  assert.equal(manifest().images['/assets/imagenes/blog/duplicada.jpg'].id, record().id, 'Los archivos idénticos comparten variantes sin escrituras simultáneas');
  assert.equal(checkResponsiveImages(root), 4);
  const transparency = manifest().images['/assets/imagenes/blog/transparencia.png'];
  const transparentMetadata = await sharp(path.join(root, transparency.variants.at(-1).url)).metadata();
  assert(transparentMetadata.hasAlpha, 'Se conserva la transparencia');
  const oriented = manifest().images['/assets/imagenes/blog/orientada.jpg'];
  assert.equal(oriented.original.width, 800);
  assert.equal(oriented.original.height, 1100, 'La orientación EXIF se respeta');

  const foreign = path.join(output, 'material-del-editor');
  fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign, 'nota.txt'), 'Conservar');
  save('<p>La última publicación con imágenes se ha retirado.</p>');
  await build();
  assert.equal(Object.keys(manifest().images).length, 0);
  assert.equal(checkResponsiveImages(root), 0);
  assert.deepEqual(fs.readdirSync(output).sort(), ['manifest.json', 'material-del-editor']);
  assert(fs.existsSync(source) && fs.existsSync(alpha), 'Retirar una página conserva sus originales');
  fs.writeFileSync(source, await sharp(jpeg).jpeg({ quality: 25 }).toBuffer());
  save(`<img src="${pathname}" alt="Ya comprimida">`);
  const efficient = await buildResponsiveImages(root, { minBytes: 0 });
  assert.equal(efficient.optimized, 0, 'Una fuente eficiente no se sustituye por una copia de mayor peso');
  assert(record().keepOriginal);
  assert.equal(count(read(), 'picture'), 0);
  assert.equal((await buildResponsiveImages(root, { minBytes: 0 })).changedPages, 0, 'La decisión de conservar el original también se reutiliza');
  console.log('Imágenes verificadas: tamaños por contexto, originales intactos, color, transparencia, orientación, caché, sustitución, recuperación, retirada, privacidad y fuentes externas.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
