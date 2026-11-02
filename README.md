# de-mas-aprender-con-proposito
DE+ · Aprender con propósito. Filosofía, educación, lectura y cultura.

El buscador global usa Pagefind y se actualiza en la publicación de Pages CMS. Después de generar los contenidos y el sitemap, ejecutar `npm run build:search` y `npm run check:search`. El índice incluye las publicaciones públicas, las series, las colecciones y la presentación del proyecto; excluye borradores y copias antiguas de páginas.

`npm run test:search` comprueba texto completo, transcripciones y filtros con el motor real, además de nuevas publicaciones, ediciones, retiradas y cobertura. La interfaz comparte los estilos de DE+ y está disponible en todas las plantillas.

Las recomendaciones de «Para seguir pensando» se recalculan con `npm run build:latest`, después de generar las cuatro secciones. La primera tarjeta conserva la mayor afinidad temática; la segunda muestra la publicación más reciente entre las demás que comparten al menos un tema. No se repiten tarjetas, no se incluyen borradores y el bloque se oculta si no hay contenido afín. Los empates de afinidad se resuelven por fecha; los de fecha, por afinidad y dirección, para mantener una salida estable.

`npm run test:related` comprueba esta selección y la integración de Blog, Lecturas selectas, Video y Podcast con sus plantillas reales, incluidos los temas heredados, la retirada de episodios y los destinos o marcadores ausentes. El flujo `Comprobar sitio y recomendaciones` ejecuta las pruebas y la generación completa en cada push a `main` y en cada pull request. Este flujo valida el sitio sin publicar cambios.
