import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Content hashes refresh a replaced file even when its name is unchanged.
export function versionedAsset(root, input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return '';
  const pathname = value.split(/[?#]/, 1)[0];
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return ''; }
  const directory = path.resolve(root);
  const local = path.resolve(directory, decoded.replace(/^\/+/, ''));
  if (!local.startsWith(directory + path.sep) || !fs.existsSync(local) || !fs.statSync(local).isFile()) return '';
  const version = createHash('sha256').update(fs.readFileSync(local)).digest('hex').slice(0, 12);
  const url = decoded.split('/').map(part => encodeURIComponent(part)).join('/');
  return `${url}?v=${version}`;
}

export function latestCover(root, data) {
  const source = typeof data.cover === 'string' ? data.cover.trim() : '';
  if (!source) return null;
  if (!/\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(source) && !/^https:\/\//i.test(source)) return null;
  const url = versionedAsset(root, source);
  return url ? {url, alt: String(data.cover_alt || ''), book: data.publication_type === 'book'} : null;
}
