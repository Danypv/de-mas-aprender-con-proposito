import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { authorProfile, profileUrl } from './authors.mjs';

const root = process.cwd();
const postsDir = path.join(root, "content", "posts");
const postTemplate = fs.readFileSync(path.join(root, "templates", "post.html"), "utf8");
const blogPath = path.join(root, "blog", "index.html");
const markdown = new MarkdownIt({ html: true, typographer: true });

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const required = ["title", "slug", "author", "date", "categories", "summary", "status"];
const allowedStatuses = new Set(["draft", "review", "published"]);

const posts = fs.readdirSync(postsDir)
  .filter((file) => file.endsWith(".md"))
  .map((file) => {
    const parsed = matter.read(path.join(postsDir, file));
    for (const field of required) {
      if (parsed.data[field] === undefined || parsed.data[field] === "") {
        throw new Error(`${file}: falta el campo ${field}`);
      }
    }
    if (!allowedStatuses.has(parsed.data.status)) {
      throw new Error(`${file}: el estado debe ser draft, review o published`);
    }
    if (!Array.isArray(parsed.data.categories) || parsed.data.categories.length === 0) {
      throw new Error(`${file}: categories debe contener al menos una categoría`);
    }
    profileUrl(parsed.data.author_url, `${file}: perfil del autor`);
    return { file, ...parsed.data, body: parsed.content };
  })
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const visiblePosts = posts.filter((post) => post.status === "published")
  .sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || new Date(b.date) - new Date(a.date));
const minutes = (post) => Math.max(1, Math.ceil(post.body.trim().split(/\s+/u).length / 220));
const coverUrl = (post) => {
  if (!post.cover) return "";
  if (!/^\/assets\/imagenes\/blog\/[a-zA-Z0-9_./% -]+\.(jpe?g|png|webp)$/i.test(post.cover) || post.cover.includes(".."))
    throw new Error(`${post.file}: la imagen debe estar en /assets/imagenes/blog/`);
  if (!String(post.cover_alt || "").trim()) throw new Error(`${post.file}: falta la descripción de la imagen`);
  return post.cover;
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));

const replaceToken = (template, token, value) =>
  template.replaceAll(`{{${token}}}`, () => String(value));


// Selección estable por artículo entre los párrafos de la zona central.
const renderPostBody = (source, slug) => {
  const env = {};
  const tokens = markdown.parse(source.trim(), env);
  const hasHighlight = tokens.some((token) =>
    token.type === "blockquote_open" ||
    (token.type.startsWith("html_") && /<blockquote\b/i.test(token.content)));
  if (!hasHighlight) {
    const paragraphs = [];
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type === "paragraph_open" && tokens[i].level === 0 &&
          tokens[i + 1].type === "inline" && tokens[i + 2].type === "paragraph_close" &&
          tokens[i + 1].content.trim() &&
          !tokens[i + 1].children?.some((token) => token.type === "image")) {
        paragraphs.push(i);
      }
    }
    // Los textos muy cortos conservan su formato.
    if (paragraphs.length >= 5) {
      const start = Math.max(1, Math.floor(paragraphs.length * 0.35));
      const end = Math.min(paragraphs.length - 2, Math.ceil(paragraphs.length * 0.65) - 1);
      let hash = 2166136261;
      for (const char of String(slug)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
      const index = paragraphs[start + hash % (end - start + 1)];
      const Token = tokens[index].constructor;
      const open = new Token("blockquote_open", "blockquote", 1);
      const close = new Token("blockquote_close", "blockquote", -1);
      open.block = close.block = true;
      tokens.splice(index + 3, 0, close);
      tokens.splice(index, 0, open);
    }
  }
  return markdown.renderer.render(tokens, markdown.options, env);
};

for (const post of visiblePosts) {
  let body = renderPostBody(post.body, post.slug);
  body = body.replace("<p>", '<p class="apertura">');

  let page = postTemplate;
  const categories = post.categories.map(escapeHtml).join(" · ");
  const values = {
    PAGE_TITLE: `${escapeHtml(post.browser_title || post.title)} · DE+`,
    META_DESCRIPTION: escapeHtml(post.summary),
    OG_TITLE: `${escapeHtml(post.title)} · DE+`,
    CATEGORIES: categories,
    TITLE: escapeHtml(post.title),
    AUTHOR: escapeHtml(post.author),
    AUTHOR_PROFILE: authorProfile(post.author_url, post.author),
    DATE: formatDate(post.date),
    BODY: body.trim(),
    SUMMARY: escapeHtml(post.summary),
    MINUTES: minutes(post),
    COVER: coverUrl(post) ? `<figure class="portada-articulo"><img src="${escapeHtml(coverUrl(post))}" alt="${escapeHtml(post.cover_alt)}" decoding="async">${post.cover_caption ? `<figcaption>${escapeHtml(post.cover_caption)}</figcaption>` : ""}</figure>` : "",
  };
  for (const [token, value] of Object.entries(values)) {
    page = replaceToken(page, token, value);
  }

  const outputDir = path.join(root, "blog", post.slug);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "index.html"), page);
}

const cards = visiblePosts.map((post) => {
  const categories = post.categories.map(escapeHtml).join(" · ");
  return `          <article class="entrada${post.featured ? " destacada" : ""}" data-categories="${escapeHtml(JSON.stringify(post.categories))}">
            <div class="meta">${post.featured ? '<span class="distintivo">Lectura destacada</span>' : ""}${categories}<span class="fecha">${formatDate(post.date)}</span><span class="fecha">${minutes(post)} min de lectura</span></div>
            <div>
              ${coverUrl(post) ? `<img class="imagen-entrada" src="${escapeHtml(coverUrl(post))}" alt="${escapeHtml(post.cover_alt)}" loading="lazy" decoding="async">` : ""}<h3><a href="${encodeURIComponent(post.slug)}/">${escapeHtml(post.title)}</a></h3>
              <p class="resumen">${escapeHtml(post.summary)}</p>
              <p class="firma">${escapeHtml(post.author)}</p>
            </div>
            <a class="leer" href="${encodeURIComponent(post.slug)}/">Leer artículo <span class="flecha" aria-hidden="true">→</span></a>
          </article>`;
}).join("\n");

let blog = fs.readFileSync(blogPath, "utf8");
blog = blog.replace(
  /<!-- POSTS_START -->[\s\S]*?<!-- POSTS_END -->/,
  `<!-- POSTS_START -->\n${cards}\n          <!-- POSTS_END -->`,
);
blog = blog.replace(
  /<p class="contador"[^>]*>[^<]*<\/p>/,
  `<p class="contador" aria-live="polite" aria-atomic="true">${visiblePosts.length} ${visiblePosts.length === 1 ? "publicación" : "publicaciones"}</p>`,
);
fs.writeFileSync(blogPath, blog);

console.log(`${visiblePosts.length} publicación(es) generada(s); ${posts.length - visiblePosts.length} pendiente(s).`);

