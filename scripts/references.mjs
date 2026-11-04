import MarkdownIt from 'markdown-it';

// Bibliographic entries remain editable Markdown. Formatting and source data
// are supplied by the author; no publication metadata is invented here.
const markdown = new MarkdownIt({ html: false, linkify: true });
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  if (/^https?:\/\//i.test(tokens[index].attrGet('href') || '')) {
    tokens[index].attrSet('target', '_blank');
    tokens[index].attrSet('rel', 'noopener noreferrer');
  }
  return renderer.renderToken(tokens, index, options);
};

export function referencesBlock(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw Error('Referencias: escribe una referencia por párrafo en el campo de texto opcional.');
  const source = value.replaceAll('\u200b', '').trim();
  if (!source) return '';
  const body = markdown.render(source).trim();
  if (!body) return '';
  return `<details class="referencias"><summary>Referencias</summary><div class="referencias-lista">${body}</div></details>`;
}
