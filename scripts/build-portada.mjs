import { buildPortada } from './portada.mjs';
const result = await buildPortada(process.argv[2] || process.cwd());
console.log(`Portada preparada: ${result.images} imagen(es); composición y textos conservados.`);
