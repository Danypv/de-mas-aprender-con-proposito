export function expandSearchQuery(value) {
  return String(value).trim().slice(0,240).replace(/\bia\b/gi, 'inteligencia artificial');
}
