import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSnapshot, changedUrls, notifyIndexNow } from './notify-indexnow.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demas-indexnow-'));
const origin = 'https://somosdemas.com';
const key = '0123456789abcdef0123456789abcdef';
const routes = ['/', '/blog/prueba/', '/ensayos/prueba/', '/lecturas/textos/prueba/',
  '/videos/prueba/', '/podcast/series/prueba/', '/podcast/episodios/prueba/'];
const files = new Map();
const pageFile = url => path.posix.join(decodeURIComponent(new URL(url).pathname).slice(1), 'index.html');
const readFile = file => {
  if (!files.has(file)) throw Object.assign(Error(`Ausente: ${file}`), { code: 'ENOENT' });
  return Buffer.from(files.get(file));
};
const setSitemap = addresses => files.set('sitemap.xml', '<urlset>'
  + addresses.map(url => `<url><loc>${url}</loc></url>`).join('') + '</urlset>');
const stateFile = path.join(root, 'state.json');
const submitted = [];
let apiStatus = 200;
const responses = new Map();
let keyPublished = true;
const fetchImpl = async (input, options) => {
  const address = String(input);
  if (address === `${origin}/indexnow-key.txt`) {
    return new Response(keyPublished ? key : 'Página no encontrada', { status: keyPublished ? 200 : 404 });
  }
  if (address === 'https://api.indexnow.org/indexnow') {
    assert.equal(options.method, 'POST');
    const payload = JSON.parse(options.body);
    assert.deepEqual(Object.keys(payload).sort(), ['host', 'key', 'keyLocation', 'urlList']);
    assert.equal(payload.host, 'somosdemas.com');
    assert.equal(payload.key, key);
    assert.equal(payload.keyLocation, `${origin}/indexnow-key.txt`);
    assert(payload.urlList.length <= 10000);
    submitted.push(payload.urlList);
    return new Response('', { status: apiStatus });
  }
  if (responses.has(address)) return responses.get(address)();
  const file = pageFile(address);
  return new Response(files.get(file) || '', { status: files.has(file) ? 200 : 404 });
};
const send = (current, addresses) => notifyIndexNow({
  current, addresses, readFile, key, stateFile, fetchImpl, pause: async () => {},
});

try {
  const addresses = routes.map(route => origin + route);
  setSitemap(addresses);
  for (const address of addresses) files.set(pageFile(address), `<h1>${address}</h1>`);
  files.set('blog/borrador/index.html', '<h1>Contenido privado de prueba</h1>');
  const initial = readSnapshot(readFile);
  assert.deepEqual(Object.keys(initial.urls), addresses, 'Solo las páginas del sitemap son elegibles');
  assert.deepEqual(changedUrls(initial, initial), [], 'Una publicación sin cambios no genera avisos');
  for (const address of addresses) {
    const file = pageFile(address);
    const saved = files.get(file);
    files.set(file, saved + '<p>Edición</p>');
    assert.deepEqual(changedUrls(initial, readSnapshot(readFile)), [address], 'Se detectan ediciones en todas las secciones');
    files.set(file, saved);
  }

  const removed = `${origin}/lecturas/textos/prueba/`;
  const added = `${origin}/podcast/episodios/nuevo/`;
  const edited = `${origin}/ensayos/prueba/`;
  setSitemap([...addresses.filter(address => address !== removed), added]);
  files.delete(pageFile(removed));
  files.set(pageFile(added), '<h1>Nuevo episodio</h1>');
  files.set(pageFile(edited), '<h1>Ensayo corregido</h1>');
  const current = readSnapshot(readFile);
  const pending = changedUrls(initial, current);
  assert.deepEqual(pending, [edited, removed, added].sort(), 'Se acumulan altas, ediciones y bajas entre despliegues');
  fs.writeFileSync(stateFile, JSON.stringify(initial));
  const savedState = fs.readFileSync(stateFile, 'utf8');

  keyPublished = false;
  await assert.rejects(send(current, pending), /verificación aún no está publicado/);
  assert.equal(submitted.length, 0, 'Se espera la verificación pública antes del primer envío');
  keyPublished = true;

  responses.set(edited, () => new Response('<h1>Versión anterior</h1>'));
  await assert.rejects(send(current, pending), /falta confirmar el cambio publicado/);
  assert.equal(submitted.length, 0, 'El código nuevo no se anuncia mientras la web sigue sirviendo la versión anterior');
  responses.delete(edited);
  responses.set(removed, () => new Response('<h1>Lectura que aún sigue publicada</h1>'));
  await assert.rejects(send(current, pending), /falta confirmar el cambio publicado/);
  assert.equal(submitted.length, 0, 'Una baja se avisa cuando la retirada ya está disponible');
  responses.delete(removed);

  apiStatus = 429;
  await assert.rejects(send(current, pending), /envío rechazado/);
  assert.equal(fs.readFileSync(stateFile, 'utf8'), savedState, 'Un rechazo conserva todas las direcciones pendientes');
  submitted.length = 0;
  apiStatus = 202;
  await send(current, pending);
  assert.deepEqual(submitted, [pending]);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)), current, 'El estado solo avanza tras la recepción del aviso');
  assert.deepEqual(changedUrls(JSON.parse(fs.readFileSync(stateFile)), current), [], 'Repetir una ejecución aceptada no duplica los avisos');

  // A former URL can become a generated redirect when its slug changes.
  files.set(pageFile(removed), '<!-- DE+ GENERATED REDIRECT -->\n<meta http-equiv="refresh" content="0;url=/lecturas/">');
  apiStatus = 200;
  await send(current, [removed]);
  files.set(pageFile(removed), '<h1>Página antigua sin retirar</h1>');
  await assert.rejects(send(current, [removed]), /sigue existiendo una página retirada/);

  setSitemap(['https://otro-sitio.example/']);
  assert.throws(() => readSnapshot(readFile), /dirección pública no válida/);
  setSitemap([edited, edited]);
  assert.throws(() => readSnapshot(readFile), /dirección repetida/);
  files.set('sitemap.xml', '<urlset/>');
  assert.throws(() => readSnapshot(readFile), /sitemap está vacío/);
  console.log('IndexNow verificado: todas las secciones, altas, ediciones, bajas, redirecciones, despliegue público, rechazos y reintentos.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
