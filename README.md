# de-mas-aprender-con-proposito
DE+ · Aprender con propósito. Filosofía, educación, lectura y cultura.

El buscador global usa Pagefind y se actualiza en la publicación de Pages CMS. Después de generar los contenidos y el sitemap, ejecutar `npm run build:search` y `npm run check:search`. El índice incluye las publicaciones públicas, las series, las colecciones y la presentación del proyecto; excluye borradores y copias antiguas de páginas.

`npm run test:search` comprueba texto completo, transcripciones y filtros con el motor real, además de nuevas publicaciones, ediciones, retiradas y cobertura. La interfaz comparte los estilos de DE+ y está disponible en todas las plantillas.

Las recomendaciones de «Para seguir pensando» se recalculan con `npm run build:latest`, después de generar las cuatro secciones. La primera tarjeta conserva la mayor afinidad temática; la segunda muestra la publicación más reciente entre las demás que comparten al menos un tema. No se repiten tarjetas, no se incluyen borradores y el bloque se oculta si no hay contenido afín. Los empates de afinidad se resuelven por fecha; los de fecha, por afinidad y dirección, para mantener una salida estable.

`npm run test:related` comprueba esta selección y la integración de Blog, Lecturas selectas, Video y Podcast con sus plantillas reales, incluidos los temas heredados, la retirada de episodios y los destinos o marcadores ausentes. El flujo `Comprobar sitio y recomendaciones` ejecuta las pruebas y la generación completa en cada push a `main` y en cada pull request. Este flujo valida el sitio sin publicar cambios.
# Ensayos

La franja del Blog también se genera automáticamente desde las publicaciones de `content/posts`. Reutiliza los componentes visuales de Ensayos y muestra la publicación más reciente por fecha, con su imagen horizontal, título y una presentación breve. El enlace a todas las publicaciones conduce al catálogo interno del Blog, donde se conserva el selector alfabético de temas y se agrupan variantes de mayúsculas o tildes. Editar o eliminar una publicación actualiza esta franja durante `build:latest`; `npm run test:home-blog` comprueba esos comportamientos.

Ensayos reúne textos que desarrollan ideas y abren preguntas. El Blog se presenta como un espacio de reflexiones breves sobre asuntos del presente.

La colección `content/essays` genera `/ensayos/` y las páginas individuales. `npm run build:essays` valida y genera el catálogo; `build:latest` actualiza la franja entre Lecturas selectas y Podcast y video. La portada elige la fecha de publicación más reciente, sin depender de una marca manual de destacado. Sin publicaciones muestra un aviso breve.

Los temas se seleccionan de una lista alfabética de quince opciones, incluidas Ciencia y Teología. La plantilla conserva las fuentes y los colores de DE+, presenta las portadas en 16:9 y admite un enlace HTTPS opcional junto a la firma. Dos párrafos centrales se destacan con una selección estable por dirección cuando el texto tiene al menos cinco párrafos elegibles; los textos más breves conservan su estructura.

El ciclo completo se ejecuta en el publicador privado de Pages CMS: aprobación, edición y eliminación actualizan páginas, portada, novedades, recomendaciones, redirecciones, sitemap y buscador global. El borrado se basa en `cms_source`, conserva publicaciones ajenas a Pages y retira también las direcciones anteriores del ensayo. Las imágenes compartidas se conservan para evitar afectar otras publicaciones.

`npm run test:essays` comprueba el ciclo editorial con contenido temporal. `test:search` comprueba consultas reales de Pagefind, incluyendo altas, cambios y retirada de ensayos. El publicador privado incorpora una prueba adicional de eliminación con cambio previo de dirección.

