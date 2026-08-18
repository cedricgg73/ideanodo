/**
 * MOTOR DE COINCIDENCIA (Matching Engine)
 * =======================================
 * Traduce una frase en lenguaje natural del usuario a una intencion del
 * catalogo, usando solapamiento de keywords. Sin IA, sin llamadas de red:
 * es deterministico, auditable y corre en microsegundos.
 *
 * Por que reglas y no un LLM (por ahora):
 *   - El catalogo de automatizaciones es CERRADO. No hay nada que generar.
 *   - Un duenio de restaurante necesita saber por que el sistema entendio
 *     lo que entendio: `evidencia` devuelve las keywords que dispararon.
 *   - Cero costo por consulta y cero latencia.
 *
 * Como escalar despues sin romper nada:
 *   `emparejar()` es una funcion PURA con un contrato estable
 *   (texto + catalogo -> ResultadoMatch). Se puede sustituir su interior
 *   por embeddings o por un clasificador y ni las rutas HTTP ni la UI
 *   se enteran. Ver DESIGN.md, seccion "Evolucion del motor".
 */

import type { Intencion, Candidato, ResultadoMatch } from './types.ts';

// ---------------------------------------------------------------------
// Parametros del motor (un solo lugar donde ajustar el comportamiento)
// ---------------------------------------------------------------------

const PESOS = {
  /** La frase completa aparece en el texto ("perder comida"). Senal fuerte. */
  frase: 2.5,
  /** Un token del usuario es identico a una keyword ("merma"). */
  exacto: 1.0,
  /** Coincidencia por raiz ("mermas" vs "merma", "inventarios" vs "inventario"). */
  raiz: 0.6,
} as const;

/** Puntos brutos a partir de los cuales la confianza se considera plena. */
const SATURACION = 3.0;

/** Debajo de esta confianza, Nodo prefiere decir "no te entendi". */
const UMBRAL_MINIMO = 0.2;

/** Una alternativa se ofrece solo si esta razonablemente cerca de la ganadora. */
const CERCANIA_ALTERNATIVA = 0.6;

/** Tokens sin valor semantico para el matching. */
const VACIAS = new Set([
  'que', 'con', 'para', 'por', 'los', 'las', 'del', 'una', 'uno', 'unos', 'unas',
  'mis', 'sus', 'este', 'esta', 'esto', 'esos', 'esas', 'como', 'mas', 'muy',
  'quiero', 'necesito', 'ayuda', 'ayudame', 'quisiera', 'puedo', 'poder', 'hacer',
  'tener', 'algo', 'favor', 'porfa', 'hola', 'buenas', 'dias', 'tardes', 'noches',
  'sobre', 'todo', 'toda', 'cada', 'aqui', 'alli', 'donde', 'cuando', 'cual',
]);

// ---------------------------------------------------------------------
// Normalizacion
// ---------------------------------------------------------------------

/**
 * Baja a minusculas, quita tildes y signos, colapsa espacios.
 * "¿Cómo evito PERDER comida?" -> "como evito perder comida"
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacriticos (tildes, dieresis)
    .replace(/[^a-z0-9\s]/g, ' ')       // signos de puntuacion e interrogacion
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parte el texto normalizado en tokens utiles (>= 3 letras, sin palabras vacias). */
export function tokenizar(textoNormalizado: string): string[] {
  return textoNormalizado
    .split(' ')
    .filter((t) => t.length >= 3 && !VACIAS.has(t));
}

/**
 * Compara dos palabras por su raiz, para tolerar las variaciones del
 * espanol sin necesidad de un stemmer completo:
 *   plurales      "merma" / "mermas"
 *   conjugaciones "vencido" / "venciendo"
 *   genero        "danado" / "danada"
 *
 * Criterio: comparten al menos 4 letras iniciales, y ese prefijo comun
 * cubre casi toda la palabra mas corta (tolerancia de 2 letras).
 * Esa segunda condicion es la que evita falsos positivos del tipo
 * "caja" / "cajon", donde solo coincide el arranque.
 */
function comparteRaiz(a: string, b: string): boolean {
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;

  let comun = 0;
  while (comun < min && a[comun] === b[comun]) comun++;

  return comun >= 4 && comun >= min - 2;
}

// ---------------------------------------------------------------------
// Puntuacion
// ---------------------------------------------------------------------

/**
 * Puntua UNA intencion contra el texto del usuario.
 * Devuelve los puntos brutos y las keywords que los generaron.
 */
function puntuar(
  textoNormalizado: string,
  tokens: string[],
  intencion: Intencion,
): { puntos: number; evidencia: string[] } {
  let puntos = 0;
  const evidencia: string[] = [];

  for (const keywordCruda of intencion.keywords) {
    const keyword = normalizar(keywordCruda);
    if (!keyword) continue;

    // Caso 1: keyword de varias palabras -> se busca como frase completa.
    if (keyword.includes(' ')) {
      if (textoNormalizado.includes(keyword)) {
        puntos += PESOS.frase;
        evidencia.push(keyword);
      }
      continue;
    }

    // Caso 2: keyword de una palabra -> exacta primero, luego por raiz.
    if (tokens.includes(keyword)) {
      puntos += PESOS.exacto;
      evidencia.push(keyword);
      continue;
    }

    if (tokens.some((t) => comparteRaiz(t, keyword))) {
      puntos += PESOS.raiz;
      evidencia.push(keyword);
    }
  }

  return { puntos, evidencia };
}

/** Convierte puntos brutos (0..inf) en una confianza acotada (0..1). */
function aConfianza(puntos: number): number {
  return Math.min(1, puntos / SATURACION);
}

// ---------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------

/**
 * Empareja la frase del usuario con la intencion mas probable del catalogo.
 *
 * Es una funcion PURA: mismas entradas -> misma salida, sin efectos.
 * Por eso se puede testear sola (ver test/matching.test.ts) y reemplazar
 * su implementacion sin tocar el resto del sistema.
 *
 * @param texto      Lo que escribio el usuario.
 * @param intenciones Catalogo activo de intenciones.
 */
export function emparejar(texto: string, intenciones: Intencion[]): ResultadoMatch {
  const textoNormalizado = normalizar(texto);
  const tokens = tokenizar(textoNormalizado);

  const candidatos: Candidato[] = intenciones
    .filter((i) => i.activo)
    .map((intencion) => {
      const { puntos, evidencia } = puntuar(textoNormalizado, tokens, intencion);
      return { intencion, confianza: aConfianza(puntos), evidencia };
    })
    .filter((c) => c.confianza > 0)
    .sort((a, b) => b.confianza - a.confianza);

  const principal = candidatos[0];

  if (!principal || principal.confianza < UMBRAL_MINIMO) {
    return { estado: 'sin_match', sugerencias: frasesDeEjemplo(intenciones) };
  }

  const alternativas = candidatos
    .slice(1)
    .filter((c) => c.confianza >= principal.confianza * CERCANIA_ALTERNATIVA)
    .slice(0, 2);

  return { estado: 'match', principal, alternativas };
}

/**
 * Tres frases de ejemplo variadas, para cuando el motor no entiende.
 * Se rotan por sorteo simple para que la demo no se sienta repetitiva.
 */
function frasesDeEjemplo(intenciones: Intencion[], cuantas = 3): string[] {
  return [...intenciones]
    .filter((i) => i.activo)
    .sort(() => Math.random() - 0.5)
    .slice(0, cuantas)
    .map((i) => i.ejemploFrase);
}
