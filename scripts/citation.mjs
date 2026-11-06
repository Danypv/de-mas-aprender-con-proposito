import { escapeHtml as escape } from './readings.mjs';
import { siteUrl } from './structured-data.mjs';

const contributors = new Map([
  ['Daniel Pérez Valencia', 'Pérez Valencia, D.'],
  ['Elizabeth Rojas Gutiérrez', 'Rojas Gutiérrez, E.'],
]);
const reviewTypes = new Map([
  ['book', 'del libro'],
  ['academic_article', 'del artículo'],
  ['essay', 'del ensayo'],
  ['other', 'de la obra'],
]);
const dayAndMonth = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});
const namePart = /^\p{Lu}[\p{Ll}\p{M}]+(?:[-’']\p{Lu}?[\p{Ll}\p{M}]+)*$/u;
const clean = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : '';
const period = value => /[.!?…]$/u.test(value) ? '' : '.';

function citationAuthor(article) {
  const byline = clean(article.author);
  const explicit = clean(article.citation_author) || contributors.get(byline);
  if (explicit) return explicit;
  const parts = byline.split(' ');
  if (parts.length === 2 && parts.every(part => namePart.test(part))) {
    const [given, surname] = parts;
    const initials = given.split('-').map(name => `${name[0]}.`).join('-');
    return `${surname}, ${initials}`;
  }
  // Free-text signatures can be collective or contain several given names
  // and surnames. Preserve the byline unless the editor specifies its APA form.
  return byline;
}

function reviewDescription(article) {
  const kind = reviewTypes.get(article.publication_type);
  const title = escape(clean(article.source_title));
  const author = escape(clean(article.source_author));
  if (!kind || !title || !author) return '';
  const work = article.publication_type === 'book' ? `<em>${title}</em>` : title;
  return ` [Reseña ${kind} ${work}, de ${author}]`;
}

export function citationBlock(article, pagePath, section) {
  if (article.hide_citation === true) return '';
  const date = article.date == null || article.date === '' ? null : new Date(article.date);
  const published = date ? `${date.getUTCFullYear()}, ${dayAndMonth.format(date)}` : 's. f.';
  const author = citationAuthor(article);
  const title = clean(article.title);
  const review = section === 'reading' ? reviewDescription(article) : '';
  const periodical = section === 'blog' || Boolean(review);
  const titleHtml = periodical ? escape(title) : `<em>${escape(title)}</em>`;
  const titleEntry = review ? `${titleHtml}${review}.` : `${titleHtml}${period(title)}`;
  const publication = periodical ? ' <em>DE+</em>.' : author === 'DE+' ? '' : ' DE+.';
  const dateEntry = `(${published}).`;
  const reference = author
    ? `${escape(author)}${period(author)} ${dateEntry} ${titleEntry}`
    : `${titleEntry} ${dateEntry}`;
  const url = escape(siteUrl(pagePath));
  return `<details class="citar-publicacion">
      <summary>Cómo citar esta publicación</summary>
      <p class="cita-etiqueta">Referencia en APA 7</p>
      <p class="cita-referencia">${reference}${publication} <a href="${url}">${url}</a></p>
      <div class="cita-acciones">
        <button type="button" data-copiar-referencia hidden>Copiar referencia</button>
        <span class="cita-estado" role="status"></span>
      </div>
    </details>`;
}
