const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function profileUrl(value, field = 'Enlace al perfil del autor') {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw Error(`${field}: pega una dirección HTTPS válida`);
  const text = value.trim();
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw Error(`${field}: pega una dirección HTTPS válida`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw Error(`${field}: usa una dirección HTTPS sin credenciales`);
  return url.href;
}

export function authorProfile(value, name) {
  const href = profileUrl(value);
  if (!href) return '';
  const host = new URL(href).hostname;
  const label = host === 'linkedin.com' || host.endsWith('.linkedin.com') ? 'LinkedIn' : host === 'orcid.org' || host.endsWith('.orcid.org') ? 'ORCID' : 'Perfil';
  const aria = `Ver el perfil de ${name}${label === 'Perfil' ? '' : ` en ${label}`} (se abre en una pestaña nueva)`;
  return `<a class="perfil-autor" href="${escape(href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(aria)}">${label} <span aria-hidden="true">↗</span></a>`;
}

export function episodeAuthor(episode, series) {
  const customName = String(episode.author || '').trim();
  const name = customName || series.presenter;
  const ownUrl = profileUrl(episode.author_url);
  const samePerson = !customName || customName === String(series.presenter).trim();
  return { name, url: ownUrl || (samePerson ? profileUrl(series.author_url) : '') };
}

// Structured authors are authoritative; legacy signatures remain supported.
export function publicationAuthors(data) {
  if (!Object.hasOwn(data, 'authors')) return null;
  if (!Array.isArray(data.authors) || !data.authors.length) throw Error('Añade al menos un autor con nombres y apellidos.');
  return data.authors.map((author, index) => {
    const given = typeof author?.given === 'string' ? author.given.trim().replace(/\s+/gu, ' ') : '';
    const family = typeof author?.family === 'string' ? author.family.trim().replace(/\s+/gu, ' ') : '';
    if (!given || !family) throw Error(`Autor ${index + 1}: completa nombres y apellidos.`);
    return { given, family, name: `${given} ${family}`, url: profileUrl(author.url, `Perfil del autor ${index + 1}`) };
  });
}

export function normalizePublicationAuthors(data) {
  const authors = publicationAuthors(data);
  if (!authors) return data;
  const apa = authors.map(({given, family}) => `${family}, ${given.split(' ').map(part => part.split('-').map(piece => `${[...piece][0].toUpperCase()}.`).join('-')).join(' ')}`);
  const citation = apa.length === 1 ? apa[0] : apa.length <= 20 ? `${apa.slice(0, -1).join(', ')}, & ${apa.at(-1)}` : `${apa.slice(0, 19).join(', ')}, … ${apa.at(-1)}`;
  return { ...data, author: new Intl.ListFormat('es').format(authors.map(a => a.name)), author_url: authors.length === 1 ? authors[0].url : '', citation_author: citation };
}

export function publicationProfiles(data) {
  const authors = publicationAuthors(data);
  return authors ? authors.map(a => authorProfile(a.url, a.name)).join('') : authorProfile(data.author_url, data.author);
}
