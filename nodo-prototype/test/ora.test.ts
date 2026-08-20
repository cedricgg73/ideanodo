/**
 * Tests del clasificador y del motor de consultas (Ora).
 *
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clasificar } from '../src/clasificador.ts';
import { resolverConsulta } from '../src/consultasEngine.ts';
import { CONSULTAS, VENTAS_TOTAL, NUM_VENTAS, TICKET_PROMEDIO } from '../db/consultas.ts';

const tipo = (frase: string) => clasificar(frase).tipo;
const consulta = (frase: string) => {
  const r = resolverConsulta(frase);
  return r.estado === 'resuelta' ? r.plantilla.slug : null;
};

describe('clasificador: automatizacion vs consulta', () => {
  test('una peticion de comportamiento permanente es automatizacion', () => {
    assert.equal(tipo('Quiero controlar las perdidas de comida'), 'automatizacion');
    assert.equal(tipo('Ayudame con el stock'), 'automatizacion');
    assert.equal(tipo('Que me avise cuando algo se agote'), 'automatizacion');
    assert.equal(tipo('La caja nunca me cuadra'), 'automatizacion');
  });

  test('una peticion de dato puntual es consulta', () => {
    assert.equal(tipo('¿Cuanto vendi hoy?'), 'consulta');
    assert.equal(tipo('Cual es mi mejor cliente'), 'consulta');
    assert.equal(tipo('Muestrame el ticket promedio'), 'consulta');
  });

  // El caso concreto que rompia el sistema antes de existir el clasificador:
  // hacia match con "compras y proveedores" al 53% por la palabra "compra".
  test('la frase que fallaba ahora se reconoce como consulta', () => {
    assert.equal(
      tipo('quiero que me muestre el producto que mas compra mi cliente favorito'),
      'consulta',
    );
  });

  test('expone las senales que justifican la decision', () => {
    const r = clasificar('¿Cual es mi mejor cliente?');
    assert.ok(r.senales.includes('cual'));
    assert.ok(r.senales.length > 0);
  });
});

describe('motor de consultas de Ora', () => {
  test('resuelve las preguntas tipicas de un restaurante', () => {
    assert.equal(consulta('cuanto vendi hoy'), 'ventas_periodo');
    assert.equal(consulta('cual es mi producto mas vendido'), 'producto_mas_vendido');
    assert.equal(consulta('cual es mi mejor cliente'), 'mejor_cliente');
    assert.equal(consulta('como van las ventas por canal'), 'ventas_por_canal');
    assert.equal(consulta('cuanto se hizo de propinas'), 'propinas_periodo');
  });

  // Sin escalar el peso por numero de palabras, "mas compra" (de
  // mejor_cliente) empataba con "que mas compra mi cliente" y Ora
  // respondia el nombre del cliente en vez del producto.
  test('gana la consulta mas especifica, no la primera del catalogo', () => {
    assert.equal(
      consulta('quiero que me muestre el producto que mas compra mi cliente favorito'),
      'producto_favorito_de_cliente',
    );
  });

  test('no responde lo que no tiene', () => {
    assert.equal(consulta('quiero pintar el local'), null);
  });

  test('cada plantilla se resuelve a si misma con su frase de ejemplo', () => {
    for (const c of CONSULTAS) {
      assert.equal(consulta(c.ejemploFrase), c.slug, `fallo: ${c.slug}`);
    }
  });
});

describe('coherencia de las cifras', () => {
  // Si Ora dice una cifra tiene que cuadrar con las demas. Se derivan
  // del mismo dataset justamente para que no puedan contradecirse.
  test('el ticket promedio es consistente con ventas y numero de ventas', () => {
    assert.equal(TICKET_PROMEDIO, Math.round(VENTAS_TOTAL / NUM_VENTAS));
  });

  test('toda respuesta trae cifra y detalle no vacios', () => {
    for (const c of CONSULTAS) {
      const r = c.responder();
      assert.ok(r.cifra.length > 0, `${c.slug} sin cifra`);
      assert.ok(r.detalle.length > 0, `${c.slug} sin detalle`);
    }
  });
});
