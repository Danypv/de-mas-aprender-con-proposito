import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const postsDir = path.join(process.cwd(), "content", "posts");
const required = ["title", "slug", "author", "date", "categories", "summary", "status"];
const allowedStatuses = new Set(["draft", "review", "published"]);
const slugs = new Set();

for (const file of fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"))) {
  const { data, content } = matter.read(path.join(postsDir, file));
  for (const field of required) {
    if (data[field] === undefined || data[field] === "") {
      throw new Error(`${file}: falta el campo ${field}`);
    }
  }
  if (!allowedStatuses.has(data.status)) {
    throw new Error(`${file}: estado no permitido`);
  }
  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    throw new Error(`${file}: debe tener al menos una categoría`);
  }
  if (!content.trim()) {
    throw new Error(`${file}: el cuerpo está vacío`);
  }
  if (slugs.has(data.slug)) {
    throw new Error(`${file}: el identificador ${data.slug} está repetido`);
  }
  slugs.add(data.slug);
}

console.log("Contenido validado.");
