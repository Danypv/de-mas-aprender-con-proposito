import { buildResponsiveImages } from './responsive-images.mjs';
const result = await buildResponsiveImages(process.argv[2]);
console.log(`Imágenes adaptables: ${result.images} originales conservados, ${result.variants} variantes y ${result.optimized} usos en las páginas públicas.`);
