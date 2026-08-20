/**
 * CLASIFICADOR DE INTENCION
 * =========================
 * Antes de buscar nada, hay que saber QUE tipo de cosa pidio el usuario.
 * Son dos problemas distintos, y confundirlos es lo que hacia que el
 * sistema respondiera cualquier cosa:
 *
 *   AUTOMATIZAR  "quiero controlar las perdidas de comida"
 *                pide un comportamiento permanente  -> lo resuelve NODO
 *
 *   CONSULTAR    "cual es el producto que mas compra mi mejor cliente"
 *                pide una cifra, ahora mismo        -> lo resuelve ORA
 *
 * Ejemplo real del error que esto corrige: "quiero que me muestre el
 * producto que mas compra mi cliente favorito" hacia match con la
 * intencion de Compras y Proveedores al 53%, solo porque contiene la
 * palabra "compra". Sin clasificar, todo texto se interpretaba como una
 * peticion de automatizacion.
 *
 * Hay un tercer caso que importa: una pregunta que ADEMAS se puede
 * automatizar. "No se cual plato deja mas ganancia" es una pregunta
 * (Ora la responde) y a la vez algo que no deberia tener que volver a
 * preguntar (Nodo tiene un ranking semanal). Ahi contestan los dos.
 */

import { normalizar } from './matchingEngine.ts';

/**
 * Tokenizador propio, sin filtro de palabras vacias.
 *
 * El motor de Nodo descarta "cual", "cuando", "donde" porque para buscar
 * keywords son ruido. Para clasificar son EXACTAMENTE lo contrario: son
 * la senal mas fuerte de que la frase es una pregunta. Reutilizar aquel
 * tokenizador dejaba al clasificador ciego a los interrogativos.
 */
function tokenizarCrudo(textoNormalizado: string): string[] {
  return textoNormalizado.split(' ').filter((t) => t.length >= 2);
}

export type Clasificacion = 'consulta' | 'automatizacion';

/**
 * Senales de PREGUNTA. Piden un dato puntual.
 * Se separan en interrogativos, verbos de mostrar y superlativos porque
 * cada grupo pesa distinto: un superlativo solo ("el mejor") es debil,
 * pero un interrogativo mas un superlativo ya es claramente una consulta.
 */
const INTERROGATIVOS = new Set([
  'cuanto', 'cuanta', 'cuantos', 'cuantas', 'cual', 'cuales',
  'quien', 'quienes', 'donde',
]);

const VERBOS_CONSULTA = new Set([
  'muestra', 'muestre', 'muestrame', 'mostrar', 'dime', 'decir',
  'ver', 'veo', 'saber', 'consultar', 'consulta', 'revisar', 'reporte',
  'listado', 'listar', 'compara', 'comparar',
]);

const SUPERLATIVOS = [
  'el que mas', 'la que mas', 'lo que mas', 'el que menos', 'los que mas',
  'mas vendido', 'mas rentable', 'mas compra', 'mas pide', 'mas gasta',
  'mejor', 'peor', 'top', 'ranking', 'promedio', 'total',
];

/**
 * Senales de AUTOMATIZACION. Piden un comportamiento que se repite.
 * Nota: son frases de accion continua, no preguntas.
 */
const VERBOS_AUTOMATIZACION = new Set([
  'avisa', 'avisame', 'avise', 'notifica', 'notificame', 'recuerda',
  'recuerdame', 'alerta', 'alertame', 'automatizar', 'automatico',
  'automatica', 'automaticamente', 'controlar', 'control', 'evitar',
  'evito', 'bloquear', 'obligar', 'programar', 'agendar',
]);

const FRASES_AUTOMATIZACION = [
  'cada vez que', 'siempre que', 'que se haga solo', 'sin que yo',
  'por mi cuenta', 'de forma automatica', 'que me avise', 'que me recuerde',
  'que no se me olvide', 'me ayude con', 'ayudame con',
];

/**
 * Clasifica la frase. Cuenta senales de cada lado y decide.
 * Empate o ausencia de senales -> automatizacion, porque este modulo
 * es el de automatizaciones: es su comportamiento por defecto.
 */
export function clasificar(texto: string): {
  tipo: Clasificacion;
  /** Que disparo la decision. Igual que el matcher, es auditable. */
  senales: string[];
} {
  const normal = normalizar(texto);
  const tokens = tokenizarCrudo(normal);
  const senales: string[] = [];

  let consulta = 0;
  let automatizacion = 0;

  // El signo de interrogacion se pierde al normalizar, asi que se mira
  // sobre el texto original.
  if (texto.includes('?')) {
    consulta += 1;
    senales.push('signo de interrogacion');
  }

  for (const t of tokens) {
    if (INTERROGATIVOS.has(t)) {
      consulta += 2;
      senales.push(t);
    } else if (VERBOS_CONSULTA.has(t)) {
      consulta += 2;
      senales.push(t);
    } else if (VERBOS_AUTOMATIZACION.has(t)) {
      automatizacion += 2;
      senales.push(t);
    }
  }

  for (const frase of SUPERLATIVOS) {
    if (normal.includes(frase)) {
      consulta += 1;
      senales.push(frase);
      break; // una sola vez: no acumular por sinonimos solapados
    }
  }

  for (const frase of FRASES_AUTOMATIZACION) {
    if (normal.includes(frase)) {
      automatizacion += 3;
      senales.push(frase);
      break;
    }
  }

  return {
    tipo: consulta > automatizacion ? 'consulta' : 'automatizacion',
    senales,
  };
}

/**
 * Palabras tipicamente interrogativas que NO deben contarse como
 * evidencia de una intencion de automatizacion. Se exporta para que el
 * catalogo de intenciones pueda revisarse contra esta lista.
 */
export const PALABRAS_DE_PREGUNTA = [
  ...INTERROGATIVOS,
  ...VERBOS_CONSULTA,
];
