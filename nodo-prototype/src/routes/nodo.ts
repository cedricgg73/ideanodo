/**
 * LOGICA DEL ASISTENTE NODO
 * =========================
 * Cubre el flujo completo del brief:
 *
 *   1-2. manejarChat()      el usuario escribe -> se detecta la intencion
 *                           -> se devuelven sus 3 plantillas
 *   3.   (lo hace la UI)    Nodo saluda y presenta el menu
 *   4.   manejarActivar()   el usuario elige -> se enciende la regla
 *
 * Todas las funciones reciben un `Store` (ver src/store.ts): asi la misma
 * logica corre sobre SQLite en local y en memoria en Vercel, sin ramas.
 *
 * El guion de Nodo vive aqui y no en el front, porque el tono del
 * personaje es parte del sistema: si cambia, cambia en un solo lugar.
 */

import { emparejar } from '../matchingEngine.ts';
import type { Store } from '../store.ts';

/** Estados del visor de Nodo. Coinciden con la hoja de expresiones de marca. */
export type EstadoVisor = 'neutro' | 'pensando' | 'hecho' | 'error';

// ---------------------------------------------------------------------
// Guion de Nodo
// ---------------------------------------------------------------------
// Personalidad: callado y metodico. Confirma hechos, no promete
// resultados. Nunca celebra de mas ni asusta.

function saludoConMatch(nombreIntencion: string, confianza: number): string {
  return confianza >= 0.6
    ? `Entendido: ${nombreIntencion.toLowerCase()}. Tengo tres reglas listas para eso.`
    : `Creo que te refieres a ${nombreIntencion.toLowerCase()}. Estas son las tres reglas que tengo.`;
}

const SIN_MATCH =
  'No encontre una regla para eso. Todavia no manejo esa area, o lo dijiste con otras palabras.';

// ---------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------

export type OpcionPlantilla = {
  id: string;
  nombre: string;
  descripcion: string;
  impactoEsperado: string;
  moduloDestino: string;
  reglaLogica: string;
  parametrosDefault: Record<string, unknown>;
  yaActiva: boolean;
};

export type RespuestaChat =
  | {
      estado: 'match';
      visor: EstadoVisor;
      mensaje: string;
      intencion: { id: string; slug: string; nombre: string; categoria: string };
      confianza: number;
      /** Keywords que dispararon la deteccion. Hace auditable la decision. */
      evidencia: string[];
      opciones: OpcionPlantilla[];
      alternativas: Array<{ id: string; nombre: string; ejemploFrase: string }>;
    }
  | {
      estado: 'sin_match';
      visor: EstadoVisor;
      mensaje: string;
      sugerencias: string[];
    };

export function manejarChat(store: Store, texto: string): RespuestaChat {
  const resultado = emparejar(texto, store.listarIntenciones());

  if (resultado.estado === 'sin_match') {
    store.registrarConversacion(texto, null, null, 'sin_match');
    return {
      estado: 'sin_match',
      visor: 'error',
      mensaje: SIN_MATCH,
      sugerencias: resultado.sugerencias,
    };
  }

  const { principal, alternativas } = resultado;
  store.registrarConversacion(texto, principal.intencion.id, principal.confianza, 'match');

  const yaActivas = new Set(store.listarActivaciones().map((a) => a.automatizacionId));
  const opciones = store.listarAutomatizacionesDe(principal.intencion.id).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    descripcion: a.descripcion,
    impactoEsperado: a.impactoEsperado,
    moduloDestino: a.moduloDestino,
    reglaLogica: a.reglaLogica,
    parametrosDefault: a.parametrosDefault,
    yaActiva: yaActivas.has(a.id),
  }));

  return {
    estado: 'match',
    visor: 'neutro',
    mensaje: saludoConMatch(principal.intencion.nombre, principal.confianza),
    intencion: {
      id: principal.intencion.id,
      slug: principal.intencion.slug,
      nombre: principal.intencion.nombre,
      categoria: principal.intencion.categoria,
    },
    confianza: Number(principal.confianza.toFixed(3)),
    evidencia: principal.evidencia,
    opciones,
    alternativas: alternativas.map((c) => ({
      id: c.intencion.id,
      nombre: c.intencion.nombre,
      ejemploFrase: c.intencion.ejemploFrase,
    })),
  };
}

// ---------------------------------------------------------------------
// Activar
// ---------------------------------------------------------------------

export type RespuestaActivar =
  | {
      ok: true;
      visor: EstadoVisor;
      mensaje: string;
      /** false en serverless: el cliente debe recordar la activacion. */
      persistente: boolean;
      activacion: {
        id: string;
        automatizacionId: string;
        nombre: string;
        descripcion: string;
        reglaLogica: string;
        moduloDestino: string;
        intencion: string;
        parametros: Record<string, unknown>;
        activadaEn: string;
      };
    }
  | { ok: false; visor: EstadoVisor; mensaje: string };

export function manejarActivar(
  store: Store,
  automatizacionId: string,
  parametros: Record<string, unknown> | undefined,
  usuario: string,
): RespuestaActivar {
  const automatizacion = store.obtenerAutomatizacion(automatizacionId);
  if (!automatizacion) {
    return { ok: false, visor: 'error', mensaje: 'Esa regla no existe en el catalogo.' };
  }

  // Los parametros del usuario se aplican SOBRE los del catalogo,
  // nunca reemplazan la plantilla completa.
  const finales = { ...automatizacion.parametrosDefault, ...(parametros ?? {}) };
  const { activacion, yaEstaba } = store.activarAutomatizacion(
    automatizacionId,
    finales,
    usuario,
  );

  const intencion = store
    .listarIntenciones()
    .find((i) => i.id === automatizacion.intencionId);

  return {
    ok: true,
    visor: 'hecho',
    persistente: store.persistente,
    mensaje: yaEstaba
      ? 'Esa regla ya estaba activa desde antes. No cambie nada.'
      : `Listo. "${automatizacion.nombre}" quedo activa en ${automatizacion.moduloDestino}.`,
    activacion: {
      id: activacion.id,
      automatizacionId,
      nombre: automatizacion.nombre,
      descripcion: automatizacion.descripcion,
      reglaLogica: automatizacion.reglaLogica,
      moduloDestino: automatizacion.moduloDestino,
      intencion: intencion?.nombre ?? '',
      parametros: activacion.parametros,
      activadaEn: activacion.activadaEn,
    },
  };
}

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------

export function manejarActivaciones(store: Store) {
  return {
    persistente: store.persistente,
    activaciones: store.listarActivaciones().map((a) => ({
      id: a.id,
      automatizacionId: a.automatizacionId,
      nombre: a.automatizacion.nombre,
      descripcion: a.automatizacion.descripcion,
      reglaLogica: a.automatizacion.reglaLogica,
      moduloDestino: a.automatizacion.moduloDestino,
      intencion: a.intencionNombre,
      parametros: a.parametros,
      activadaEn: a.activadaEn,
    })),
  };
}

/** Catalogo completo: lo consume la UI para los chips de ejemplo. */
export function manejarCatalogo(store: Store) {
  const agente = store.obtenerAgenteNodo();
  const intenciones = store.listarIntenciones();
  return {
    agente: {
      nombre: agente.nombre,
      rol: agente.rol,
      descripcion: agente.descripcion,
      microGesto: agente.microGesto,
    },
    persistente: store.persistente,
    totalIntenciones: intenciones.length,
    totalReglas: intenciones.reduce(
      (n, i) => n + store.listarAutomatizacionesDe(i.id).length,
      0,
    ),
    intenciones: intenciones.map((i) => ({
      id: i.id,
      slug: i.slug,
      nombre: i.nombre,
      categoria: i.categoria,
      ejemploFrase: i.ejemploFrase,
    })),
  };
}
