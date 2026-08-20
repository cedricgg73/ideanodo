/** Borra la base local del prototipo. El catalogo se vuelve a sembrar al arrancar. */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ruta = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'nodo.sqlite');
rmSync(ruta, { force: true });
console.log('Base borrada. Al arrancar se vuelve a sembrar el catalogo.');
