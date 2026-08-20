/**
 * MOTOR DE CONSULTAS (ORA)
 * ========================
 * Mismo principio que el motor de automatizaciones: coincidencia por
 * keywords contra un catalogo CERRADO. La diferencia es lo que devuelve
 * (una cifra, no una regla) y quien la presenta (Ora, no Nodo).
 *
 * Se reutilizan `normalizar` y `tokenizar` del motor de Nodo a proposito:
 * si manana se mejora el tratamiento del espanol, mejora para los dos.
 *
 * Lo que este motor NO hace, y es deliberado: generar SQL. Cada plantilla
 * trae su consulta ya escrita. El motor solo elige cual. Un texto-a-SQL
 * libre daria cifras que nadie puede verificar, y una cifra equivocada en
 * un negocio es peor que un "no se".
 */

import { normalizar, tokenizar } from './matchingEngine.ts';
import { CONSULTAS } from '../db/consultas.ts';
import type { PlantillaConsulta, Respuesta } from '../db/consultas.ts';

/**
 * Debajo de esto, Ora prefiere decir que no tiene esa consulta.
 * Basta una keyword distintiva ("propinas") porque cuando este motor
 * corre, el clasificador YA decidio que la frase es una pregunta: no
 * hay que volver a demostrarlo.
 */
const UMBRAL_MINIMO = 1.0;

/**
 * Peso por palabra de una keyword-frase.
 *
 * Es lo que hace que gane la consulta MAS ESPECIFICA. Con un peso fijo,
 * "que mas compra mi cliente" y "mas compra" valian igual, y una
 * pregunta por el producto favorito terminaba respondida con el nombre
 * del cliente. Escalando por numero de palabras, la frase mas larga
 * (que describe mejor la pregunta) siempre gana.
 */
const PESO_POR_PALABRA = 1.2;

export type ResultadoConsulta =
  | {
      estado: 'resuelta';
      plantilla: PlantillaConsulta;
      respuesta: Respuesta;
      confianza: number;
      evidencia: string[];
    }
  | { estado: 'sin_consulta'; sugerencias: string[] };

/**
 * Elige la plantilla de consulta que mejor encaja con la pregunta.
 * Las frases pesan mucho mas que las palabras sueltas: "mas vendido"
 * identifica una consulta, mientras que "mas" por si sola no dice nada.
 */
export function resolverConsulta(texto: string): ResultadoConsulta {
  const normal = normalizar(texto);
  const tokens = tokenizar(normal);

  const puntuadas = CONSULTAS.map((plantilla) => {
    let puntos = 0;
    const evidencia: string[] = [];

    for (const keywordCruda of plantilla.keywords) {
      const keyword = normalizar(keywordCruda);
      if (!keyword) continue;

      if (keyword.includes(' ')) {
        if (normal.includes(keyword)) {
          puntos += keyword.split(' ').length * PESO_POR_PALABRA;
          evidencia.push(keyword);
        }
      } else if (tokens.includes(keyword)) {
        puntos += 1;
        evidencia.push(keyword);
      }
    }

    return { plantilla, puntos, evidencia };
  })
    .filter((c) => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);

  const mejor = puntuadas[0];

  if (!mejor || mejor.puntos < UMBRAL_MINIMO) {
    return {
      estado: 'sin_consulta',
      sugerencias: CONSULTAS.slice(0, 3).map((c) => c.ejemploFrase),
    };
  }

  return {
    estado: 'resuelta',
    plantilla: mejor.plantilla,
    respuesta: mejor.plantilla.responder(),
    confianza: Math.min(1, mejor.puntos / 3),
    evidencia: mejor.evidencia,
  };
}

/** Catalogo de consultas, para mostrarlo en la UI. */
export function listarConsultas() {
  return CONSULTAS.map((c) => ({
    slug: c.slug,
    nombre: c.nombre,
    ejemploFrase: c.ejemploFrase,
  }));
}
