/**
 * Tests del motor de coincidencia.
 * Se pueden correr porque `emparejar()` es una funcion pura: no necesita
 * base de datos ni servidor.
 *
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { emparejar, normalizar, tokenizar } from '../src/matchingEngine.ts';
import { CATALOGO, TOTAL_AUTOMATIZACIONES } from '../db/seed.ts';
import type { Intencion } from '../src/types.ts';

/** Convierte el catalogo semilla en intenciones, sin pasar por la base. */
const INTENCIONES: Intencion[] = CATALOGO.map((i, n) => ({
  id: `int-${n}`,
  agenteId: 'nodo',
  slug: i.slug,
  nombre: i.nombre,
  descripcion: i.descripcion,
  categoria: i.categoria,
  keywords: i.keywords,
  ejemploFrase: i.ejemploFrase,
  activo: true,
}));

/** Helper: devuelve el slug detectado, o null si no hubo match. */
function detectar(frase: string): string | null {
  const r = emparejar(frase, INTENCIONES);
  return r.estado === 'match' ? r.principal.intencion.slug : null;
}

describe('normalizacion', () => {
  test('quita tildes, signos y mayusculas', () => {
    assert.equal(normalizar('¿Cómo evito PERDER comida?'), 'como evito perder comida');
  });

  test('descarta palabras vacias y tokens muy cortos', () => {
    assert.deepEqual(tokenizar(normalizar('quiero ayuda con el stock')), ['stock']);
  });
});

describe('deteccion de intencion', () => {
  // Las dos frases textuales del brief original.
  test('detecta la intencion de mermas (frase del brief)', () => {
    assert.equal(detectar('Quiero controlar las perdidas de comida'), 'control_mermas');
  });

  test('detecta la intencion de stock (frase del brief)', () => {
    assert.equal(detectar('Ayudame con el stock'), 'control_stock');
  });

  test('tolera tildes y signos de interrogacion', () => {
    assert.equal(detectar('¿Cómo evito que se me dañe la comida?'), 'control_mermas');
  });

  test('tolera conjugaciones y plurales', () => {
    assert.equal(detectar('se me estan venciendo los productos'), 'control_mermas');
    assert.equal(detectar('tengo que pagarle al proveedor'), 'compras_proveedores');
  });

  test('cada intencion del catalogo se detecta con su propia frase de ejemplo', () => {
    for (const intencion of CATALOGO) {
      assert.equal(
        detectar(intencion.ejemploFrase),
        intencion.slug,
        `la frase de ejemplo de "${intencion.slug}" no se detecta a si misma`,
      );
    }
  });
});

describe('fallback honesto', () => {
  test('no inventa una intencion cuando el tema es ajeno al POS', () => {
    assert.equal(detectar('quiero pintar el local'), null);
    assert.equal(detectar('necesito una receta de lasagna'), null);
  });

  test('al no entender, ofrece frases de ejemplo concretas', () => {
    const r = emparejar('asdfgh qwerty', INTENCIONES);
    assert.equal(r.estado, 'sin_match');
    if (r.estado === 'sin_match') {
      assert.equal(r.sugerencias.length, 3);
      assert.ok(r.sugerencias.every((s) => s.length > 0));
    }
  });
});

describe('trazabilidad', () => {
  test('devuelve la evidencia que justifica la deteccion', () => {
    const r = emparejar('quiero controlar las perdidas de comida', INTENCIONES);
    assert.equal(r.estado, 'match');
    if (r.estado === 'match') {
      assert.ok(r.principal.evidencia.includes('perdida'));
      assert.ok(r.principal.confianza > 0 && r.principal.confianza <= 1);
    }
  });

  test('una frase mas especifica da mas confianza que una generica', () => {
    const generica = emparejar('stock', INTENCIONES);
    const especifica = emparejar('el stock del inventario esta agotado', INTENCIONES);
    assert.equal(generica.estado, 'match');
    assert.equal(especifica.estado, 'match');
    if (generica.estado === 'match' && especifica.estado === 'match') {
      assert.ok(especifica.principal.confianza > generica.principal.confianza);
    }
  });
});

describe('integridad del catalogo', () => {
  test('cada intencion expone exactamente 3 automatizaciones', () => {
    for (const i of CATALOGO) {
      assert.equal(i.automatizaciones.length, 3, `${i.slug} no tiene 3 reglas`);
    }
  });

  test('el catalogo tiene 24 reglas preestablecidas', () => {
    assert.equal(TOTAL_AUTOMATIZACIONES, 24);
  });

  test('no hay slugs repetidos', () => {
    const slugs = CATALOGO.flatMap((i) => [i.slug, ...i.automatizaciones.map((a) => a.slug)]);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('cada regla_logica sigue la convencion dominio.accion', () => {
    for (const i of CATALOGO) {
      for (const a of i.automatizaciones) {
        assert.match(a.reglaLogica, /^[a-z]+\.[a-z_]+$/, `${a.slug}: ${a.reglaLogica}`);
      }
    }
  });
});
