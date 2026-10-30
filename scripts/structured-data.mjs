import { episodeAuthor, profileUrl } from './authors.mjs';

export const origin = 'https://somosdemas.com';
const publisher = { '@type': 'Organization', name: 'DE+ · Aprender con propósito', url: `${origin}/` };
export const siteUrl = value => new URL(value, `${origin}/`).href;
export const contentPath = (section, slug) => `${section}${encodeURIComponent(slug)}/`;
const person = (name, url) => ({ '@type': 'Person', name, ...(profileUrl(url) ? { url: profileUrl(url) } : {}) });

// Preserve date-only input and reject impossible dates instead of normalizing them.
export function schemaDate(value, field = 'Fecha') {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value.toISOString();
  } else if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return undefined;
    const day = text.slice(0, 10);
    const date = new Date(text);
    if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(text) &&
        !Number.isNaN(date.getTime()) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day) return text;
  }
  throw Error(`${field}: indica una fecha válida`);
}

// Existing display durations stay untouched; unknown formats are simply omitted.
export function schemaDuration(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/^pt(?=\d)(?:\d+h)?(?:\d+m)?(?:\d+(?:\.\d+)?s)?$/.test(text)) return text.toUpperCase();
  let hours = 0, minutes = 0, seconds = 0;
  const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  const words = text.match(/^(?:(\d+)\s*(?:h|hora|horas)\s*)?(?:(\d+)\s*(?:min|minuto|minutos|m)\s*)?(?:(\d+)\s*(?:s|seg|segundo|segundos)\s*)?$/);
  if (clock) {
    if (clock[3] !== undefined) [hours, minutes, seconds] = clock.slice(1).map(Number);
    else [minutes, seconds] = clock.slice(1, 3).map(Number);
    if (seconds > 59 || (clock[3] !== undefined && minutes > 59)) return undefined;
  } else if (words && words.slice(1).some(Boolean)) {
    [hours, minutes, seconds] = words.slice(1).map(value => Number(value || 0));
  } else return undefined;
  const total = hours * 3600 + minutes * 60 + seconds;
  if (!total) return undefined;
  hours = Math.floor(total / 3600); minutes = Math.floor(total % 3600 / 60); seconds = total % 60;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${seconds ? `${seconds}S` : ''}`;
}

function script(graph) {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `<!-- STRUCTURED_DATA_START -->\n<script type="application/ld+json">\n${json}\n</script>\n<!-- STRUCTURED_DATA_END -->`;
}

function pageSchema({ path, title, description, parents = [], entity, page = {} }) {
  const url = siteUrl(path);
  const breadcrumbId = `${url}#breadcrumb`;
  const crumbs = [{ name: 'Inicio', path: '/' }, ...parents, { name: title, path }];
  return script([
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'es',
      breadcrumb: { '@id': breadcrumbId },
      ...(entity ? { mainEntity: { '@id': entity['@id'] } } : {}), ...page,
    },
    {
      '@type': 'BreadcrumbList', '@id': breadcrumbId,
      itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: siteUrl(crumb.path) })),
    },
    ...(entity ? [entity] : []),
  ]);
}

export function collectionData({ path, title, description, parents = [], items = [] }) {
  return pageSchema({ path, title, description, parents, page: {
    '@type': 'CollectionPage',
    mainEntity: {
      '@type': 'ItemList', numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@type': 'WebPage', name: item.title, url: siteUrl(item.path) } })),
    },
  } });
}

export function articleData(article, { section, contentSection = section, label, type = 'Article', categories = [] }) {
  const path = contentPath(contentSection, article.slug);
  const url = siteUrl(path);
  const citation = article.source_url ? { '@type': 'CreativeWork', url: article.source_url, ...(article.source_name ? { name: article.source_name } : {}) } : undefined;
  // Link-only recommendations describe the page and its source without claiming
  // that the external text was written or published by DE+.
  const hasArticle = article.type !== 'link' || Boolean(article.body?.trim());
  const entity = hasArticle ? {
    '@type': type, '@id': `${url}#article`, url, mainEntityOfPage: { '@id': `${url}#webpage` },
    headline: article.title, description: article.summary, inLanguage: 'es',
    author: person(article.author, article.author_url), publisher,
    datePublished: schemaDate(article.date),
    ...(article.cover ? { image: [siteUrl(article.cover)] } : {}),
    ...(categories.length ? { articleSection: categories } : {}),
    ...(citation ? { citation } : {}),
  } : undefined;
  return pageSchema({ path, title: article.title, description: article.summary, parents: [{ path: section, name: label }], entity,
    page: !hasArticle && citation ? { about: citation } : {} });
}

export function videoData(video) {
  const path = contentPath('/videos/', video.slug);
  const url = siteUrl(path);
  const thumbnail = video.cover || video.source.thumbnail;
  const uploadDate = schemaDate(video.upload_date, 'Fecha original del video');
  const duration = schemaDuration(video.duration);
  // A complete VideoObject is emitted only for a playable video with a known
  // original publication date and a real thumbnail. DE+ selection dates differ.
  const entity = video.embed !== false && video.source.embed && thumbnail && uploadDate ? {
    '@type': 'VideoObject', '@id': `${url}#video`, url, mainEntityOfPage: { '@id': `${url}#webpage` },
    name: video.title, description: video.summary, thumbnailUrl: [siteUrl(thumbnail)], uploadDate,
    embedUrl: video.source.embed, sameAs: video.source.url,
    actor: person(video.author, video.author_url),
    ...(video.source_credit ? { creditText: video.source_credit } : {}),
    ...(duration ? { duration } : {}),
  } : undefined;
  return pageSchema({ path, title: video.title, description: video.summary, parents: [{ name: 'Videos', path: '/videos/' }], entity,
    page: {
      datePublished: schemaDate(video.date),
      ...(video.body?.trim() && video.comment_author ? { author: person(video.comment_author, video.comment_author_url) } : {}),
      ...(!entity ? { about: { '@type': 'CreativeWork', name: video.title, url: video.source.url, contributor: person(video.author, video.author_url) } } : {}),
    } });
}

export function podcastSeriesData(series, episodes) {
  const path = contentPath('/podcast/series/', series.slug);
  const url = siteUrl(path);
  const entity = {
    '@type': 'PodcastSeries', '@id': `${url}#series`, url, mainEntityOfPage: { '@id': `${url}#webpage` },
    name: series.title, description: series.summary, inLanguage: 'es', publisher,
    actor: person(series.presenter, series.author_url),
    ...(series.cover ? { image: siteUrl(series.cover) } : {}),
    ...(series.rss_url ? { webFeed: series.rss_url } : {}),
    ...([series.spotify_url, series.apple_url].some(Boolean) ? { sameAs: [series.spotify_url, series.apple_url].filter(Boolean) } : {}),
    hasPart: episodes.map(episode => ({ '@type': 'PodcastEpisode', '@id': `${siteUrl(contentPath('/podcast/episodios/', episode.slug))}#episode`, url: siteUrl(contentPath('/podcast/episodios/', episode.slug)), name: episode.title })),
  };
  return pageSchema({ path, title: series.title, description: series.summary, parents: [{ name: 'Podcast', path: '/podcast/' }], entity });
}

export function podcastEpisodeData(episode, series) {
  const path = contentPath('/podcast/episodios/', episode.slug);
  const url = siteUrl(path);
  const seriesPath = contentPath('/podcast/series/', series.slug);
  const author = episodeAuthor(episode, series);
  const duration = schemaDuration(episode.duration);
  const cover = episode.cover || series.cover;
  const entity = {
    '@type': 'PodcastEpisode', '@id': `${url}#episode`, url, mainEntityOfPage: { '@id': `${url}#webpage` },
    name: episode.title, description: episode.summary, datePublished: schemaDate(episode.date), inLanguage: 'es',
    author: person(author.name, author.url), publisher,
    partOfSeries: { '@type': 'PodcastSeries', '@id': `${siteUrl(seriesPath)}#series`, url: siteUrl(seriesPath), name: series.title },
    ...(cover ? { image: siteUrl(cover) } : {}), ...(duration ? { duration } : {}),
    ...([episode.spotify_url, episode.apple_url].some(Boolean) ? { sameAs: [episode.spotify_url, episode.apple_url].filter(Boolean) } : {}),
    ...(episode.audio_url ? { associatedMedia: { '@type': 'AudioObject', contentUrl: episode.audio_url, ...(duration ? { duration } : {}) } } : {}),
  };
  return pageSchema({ path, title: episode.title, description: episode.summary, parents: [{ name: 'Podcast', path: '/podcast/' }, { name: series.title, path: seriesPath }], entity });
}

// The blog index is retained HTML; replace only this generator's own block.
export function setStructuredData(html, data) {
  const block = /<!-- STRUCTURED_DATA_START -->[\s\S]*?<!-- STRUCTURED_DATA_END -->/;
  if (block.test(html)) return html.replace(block, () => data);
  if (!html.includes('</head>')) throw Error('No se encuentra la cabecera para los datos estructurados');
  return html.replace('</head>', () => `${data}\n</head>`);
}
