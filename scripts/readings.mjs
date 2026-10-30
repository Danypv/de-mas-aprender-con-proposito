import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { profileUrl } from './authors.mjs';

export const collections = [
  {
    "slug": "filosofia",
    "title": "Filosofía y ética",
    "summary": "Preguntas sobre la vida, nuestras decisiones y los valores que las orientan."
  },
  {
    "slug": "etica-e-inteligencia-artificial",
    "title": "Ciencia y tecnología",
    "summary": "Conocimiento y desarrollos que transforman nuestra manera de comprender el mundo."
  },
  {
    "slug": "empresa-cultura-y-liderazgo",
    "title": "Empresa, cultura y liderazgo",
    "summary": "Organizaciones, trabajo y liderazgo desde una mirada humana."
  },
  {
    "slug": "ciencia-y-salud",
    "title": "Medicina y salud",
    "summary": "El cuidado, la salud, la enfermedad y la experiencia humana."
  },
  {
    "slug": "historia-y-cultura",
    "title": "Historia, cultura y literatura",
    "summary": "Sociedades, obras y relatos que ayudan a comprender otras épocas."
  },
  {
    "slug": "teologia-y-espiritualidad",
    "title": "Teología y espiritualidad",
    "summary": "Tradiciones y preguntas sobre el sentido de la vida."
  }
];
export const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const formatDate = date => new Intl.DateTimeFormat('es-CO', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(date));
export const typeLabel = type => type === 'full' ? 'Texto completo' : 'Lectura recomendada';
export function readReadings(root = process.cwd()) {
  const directory = path.join(root,'content/readings');
  if (!fs.existsSync(directory)) return [];
  const seen = new Set();
  return fs.readdirSync(directory).filter(file => file.endsWith('.md')).map(file => {
    const { data, content } = matter.read(path.join(directory,file));
    profileUrl(data.author_url, `${file}: perfil de quien firma la reseña`);
    const fail = message => { throw Error(`${file}: ${message}`); };
    for (const key of ['title','slug','author','date','summary','status','type']) if (!String(data[key] ?? '').trim()) fail(`falta ${key}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) fail('la dirección debe usar minúsculas, números y guiones');
    if (seen.has(data.slug)) fail('identificador repetido');
    seen.add(data.slug);
    if (!['draft','review','published'].includes(data.status)) fail('estado no válido');
    if (!['full','link'].includes(data.type)) fail('tipo no válido');
    if (Number.isNaN(new Date(data.date).getTime())) fail('fecha no válida');
    if (!Array.isArray(data.collections) || !data.collections.length || data.collections.some(key => !collections.some(c => c.slug === key))) fail('selecciona al menos una colección válida');
    if (data.type === 'full' && !content.trim()) fail('el texto completo está vacío');
    if (data.type === 'link' && !data.source_url) fail('la lectura recomendada necesita un enlace a la fuente');
    if (data.source_url) {
      try { const url = new URL(data.source_url); if (url.protocol !== 'https:' || url.username || url.password) fail('el enlace debe ser una dirección HTTPS pública'); }
      catch { fail('enlace a la fuente no válido'); }
    }
    if (data.cover) {
      if (!/^\/assets\/imagenes\/blog\/[a-zA-Z0-9_./% -]+\.(jpe?g|png|webp)$/i.test(data.cover) || data.cover.includes('..')) fail('imagen no válida');
      if (!String(data.cover_alt || '').trim()) fail('falta la descripción de la imagen');
      const image = path.join(root,decodeURIComponent(data.cover));
      if (!fs.existsSync(image)) fail('no se encuentra la imagen de portada');
    }
    return { ...data, file, body:content };
  }).sort((a,b) => Number(Boolean(b.featured))-Number(Boolean(a.featured)) || new Date(b.date)-new Date(a.date) || a.title.localeCompare(b.title,'es'));
}
