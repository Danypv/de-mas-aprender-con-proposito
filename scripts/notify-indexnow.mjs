import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const origin = 'https://somosdemas.com';
const endpoint = 'https://api.indexnow.org/indexnow';
const keyPath = 'indexnow-key.txt';
const firstUrl = `${origin}/ensayos/lo-que-hace-fecundo-el-saber/`;
const hash = value => createHash('sha256').update(value).digest('hex');

function pagePath(address) {
  const url = new URL(address);
  const decoded = decodeURIComponent(url.pathname);
  if (url.origin !== origin || url.search || url.hash || !decoded.endsWith('/')
      || decoded.includes('\\') || decoded.split('/').some(part => part === '..')) {
    throw Error(`IndexNow: dirección pública no válida: ${address}`);
  }
  return path.posix.join(decoded.slice(1), 'index.html');
}

export function readSnapshot(readFile) {
  const sitemap = readFile('sitemap.xml').toString('utf8');
  const urls = {};
  for (const [, value] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const address = value.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    if (Object.hasOwn(urls, address)) throw Error(`IndexNow: dirección repetida: ${address}`);
    urls[address] = hash(readFile(pagePath(address)));
  }
  if (!Object.keys(urls).length) throw Error('IndexNow: el sitemap está vacío o no es válido.');
  return { version: 1, urls };
}

export function changedUrls(previous, current) {
  return [...new Set([...Object.keys(previous.urls), ...Object.keys(current.urls)])]
    .filter(address => previous.urls[address] !== current.urls[address]).sort();
}

async function retry(operation, pause, attempts = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await pause(Math.min(5000 * (attempt + 1), 15000));
    }
  }
}

export async function notifyIndexNow({ current, addresses, readFile, key, stateFile,
  fetchImpl = fetch, pause = sleep }) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw Error('IndexNow: clave de verificación no válida.');
  const request = (url, options = {}) => fetchImpl(url, {
    cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(20000),
    ...options,
  });

  // Check the deployed version, including removals, before notifying any engine.
  await retry(async () => {
    const response = await request(`${origin}/${keyPath}`);
    if (response.status !== 200 || (await response.text()).trim() !== key) {
      throw Error('IndexNow: el archivo de verificación aún no está publicado.');
    }
  }, pause, 21);

  for (const address of addresses) {
    const file = pagePath(address);
    let expectedHash = current.urls[address];
    if (!expectedHash) {
      try {
        const replacement = readFile(file);
        if (!replacement.toString('utf8').includes('<!-- DE+ GENERATED REDIRECT -->')) {
          throw Error(`IndexNow: sigue existiendo una página retirada del sitemap: ${address}`);
        }
        expectedHash = hash(replacement);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    await retry(async () => {
      const response = await request(address);
      if (expectedHash) {
        if (response.status === 200
            && hash(Buffer.from(await response.arrayBuffer())) === expectedHash) return;
      } else if (response.status === 404 || response.status === 410) {
        return;
      }
      throw Error(`IndexNow: falta confirmar el cambio publicado: ${address} (HTTP ${response.status}).`);
    }, pause, 21);
  }

  for (let offset = 0; offset < addresses.length; offset += 10000) {
    const urlList = addresses.slice(offset, offset + 10000);
    await retry(async () => {
      const response = await request(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: new URL(origin).host, key,
          keyLocation: `${origin}/${keyPath}`, urlList }),
      });
      if (response.status !== 200 && response.status !== 202) {
        throw Error(`IndexNow: envío rechazado (HTTP ${response.status}). Se conserva el envío pendiente.`);
      }
      console.log(`IndexNow: ${urlList.length} avisos recibidos (HTTP ${response.status}).`);
    }, pause);
  }

  // Advance the checkpoint only after every batch has been accepted.
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(current, null, 2) + '\n');
  fs.renameSync(`${stateFile}.tmp`, stateFile);
}

async function main() {
  const root = process.cwd();
  const readFile = relative => fs.readFileSync(path.join(root, relative));
  const stateFile = process.env.INDEXNOW_STATE_FILE || path.join(root, '.indexnow/state.json');
  const current = readSnapshot(readFile);
  const hasState = fs.existsSync(stateFile);
  const previous = hasState ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : current;
  if (previous.version !== 1 || !previous.urls || Array.isArray(previous.urls)) {
    throw Error('IndexNow: el registro del último envío no es válido.');
  }
  for (const [address, digest] of Object.entries(previous.urls)) {
    pagePath(address);
    if (!/^[a-f0-9]{64}$/.test(digest)) throw Error('IndexNow: huella de publicación no válida.');
  }
  const addresses = changedUrls(previous, current);
  // A local first run starts with one existing essay as a verification.
  if (!hasState && current.urls[firstUrl] && !addresses.includes(firstUrl)) addresses.push(firstUrl);
  console.log(`IndexNow: ${addresses.length} direcciones pendientes.`);
  for (const address of addresses) console.log(address);
  if (process.argv.includes('--dry-run') || !addresses.length) return;
  await notifyIndexNow({ current, addresses, readFile, key: readFile(keyPath).toString('utf8').trim(), stateFile });
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary,
    `## IndexNow\n\nSe confirmó la publicación y se recibieron ${addresses.length} avisos.\n\n`
    + addresses.map(address => `- ${address}`).join('\n') + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
