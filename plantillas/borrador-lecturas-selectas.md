# Formato de borrador · Lecturas selectas DE+

Copia el bloque siguiente en un archivo nuevo dentro de `content/readings/`. Nómbralo `AAAA-MM-DD-titulo-del-texto.md` y cambia los datos de ejemplo. No publiques este archivo de instrucciones como lectura.

Selecciona una o varias colecciones de esta lista usando sus códigos exactos:

- **Filosofía y ética** — `filosofia`
- **Educación** — `educacion`
- **Ciencia y tecnología** — `ciencia-y-tecnologia`
- **Empresa, cultura y liderazgo** — `empresa-cultura-y-liderazgo`
- **Medicina y salud** — `medicina-y-salud`
- **Historia, cultura y literatura** — `historia-cultura-y-literatura`
- **Teología y espiritualidad** — `teologia-y-espiritualidad`
- **Cine** — `cine`

La opción `status: draft` deja el texto fuera de la web. Usa `published` solo cuando el contenido esté aprobado. Las novedades de la portada se generan desde los textos publicados; cada enlace conserva su dirección `/lecturas/textos/<slug>/`.

```markdown
---
title: Título del texto
browser_title: Título breve para el navegador
slug: titulo-del-texto
author: Nombre de quien firma la publicación
date: 2026-10-27
collections:
  - filosofia
type: full
summary: Breve presentación del contenido, escrita para el lector.
status: draft
featured: false
---

Escribe aquí el artículo en Markdown, separando los párrafos con una línea en blanco.
```

Para una reseña con enlace al artículo original, cambia a `type: link` y agrega `source_url: https://...` y, si procede, `source_name`. Para imagen de portada usa `cover: /assets/imagenes/blog/archivo.webp`, `cover_alt` y, si hace falta, `cover_caption`. El archivo de imagen debe existir en la ruta indicada.

Si una lectura pertenece a dos colecciones, puedes añadir otra línea bajo `collections` con el código correspondiente. Las direcciones anteriores de las colecciones se conservan como redirecciones. Al cambiar el identificador de una publicación desde Pages, el sistema conserva sus direcciones publicadas anteriores y las dirige al destino actual. No hace falta editar el historial a mano.

**Importante:** los artículos de `content/posts/` corresponden al **Blog** y se publican en `/blog/`. Este formato es exclusivo de las **Lecturas selectas**.
