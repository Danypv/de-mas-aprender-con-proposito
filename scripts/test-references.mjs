import assert from 'node:assert/strict';
import { referencesBlock } from './references.mjs';

for (const value of [undefined, null, '', ' \n\t\u00a0\u200b ', '[obra]: https://example.org/libro']) {
  assert.equal(referencesBlock(value), '', 'Un campo vacío no deja un desplegable ni un título.');
}
for (const value of [false, 42, ['Una referencia'], {}]) assert.throws(() => referencesBlock(value), /Referencias/);
const source = 'Autora, A. (2020). *Una obra*. Editorial. https://doi.org/10.0000/ejemplo\n\nAutor, B. (2021). Otro artículo. *Revista, 2*(1), 1–5. [Fuente](https://example.org/articulo?a=1&b=2)';
const html = referencesBlock(source);
assert(html.startsWith('<details class="referencias"><summary>Referencias</summary>'));
assert(!/<details[^>]*\sopen(?:\s|=|>)/.test(html), 'El apartado aparece cerrado.');
assert.equal((html.match(/<p>/g) || []).length, 2, 'Cada referencia conserva su párrafo.');
assert(html.includes('<em>Una obra</em>') && html.includes('<em>Revista, 2</em>'));
assert(html.includes('href="https://doi.org/10.0000/ejemplo"'), 'Los DOI escritos como URL se convierten en enlaces.');
assert(html.includes('href="https://example.org/articulo?a=1&amp;b=2"'));
assert(html.includes('target="_blank" rel="noopener noreferrer"'));
assert.equal(referencesBlock(source), html, 'La presentación es estable al reconstruir.');
const unsafe = referencesBlock('<script>alert(1)</script>\n\n[Fuente](javascript:alert(1))');
assert(!unsafe.includes('<script>') && !unsafe.includes('href="javascript:'), 'El editor no permite ejecutar HTML ni enlaces de script.');
console.log('Referencias: campo opcional, desplegable cerrado sin JavaScript, párrafos, cursivas, DOI, enlaces y contenido seguro verificados.');
