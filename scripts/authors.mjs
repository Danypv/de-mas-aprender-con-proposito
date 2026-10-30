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
