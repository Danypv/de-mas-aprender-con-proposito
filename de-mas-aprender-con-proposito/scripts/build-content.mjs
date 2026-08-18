import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

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
    return { file, ...parsed.data, body: parsed.content };
  })
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const visiblePosts = posts.filter((post) => post.status === "published");

const formatDate = (date) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));

const replaceToken = (template, token, value) =>
  template.replaceAll(`{{${token}}}`, value);

for (const post of visiblePosts) {
  let body = markdown.render(post.body.trim());
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
    DATE: formatDate(post.date),
    BODY: body.trim(),
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
  return `          <article class="entrada">
            <div class="meta">${categories}<span class="fecha">${formatDate(post.date)}</span></div>
            <div>
              <h3>${escapeHtml(post.title)}</h3>
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
  /<p class="contador">[^<]*<\/p>/,
  `<p class="contador">${visiblePosts.length} ${visiblePosts.length === 1 ? "publicación" : "publicaciones"}</p>`,
);
fs.writeFileSync(blogPath, blog);

console.log(`${visiblePosts.length} publicación(es) generada(s); ${posts.length - visiblePosts.length} pendiente(s).`);
