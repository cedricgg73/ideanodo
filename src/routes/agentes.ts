/**
 * RUTAS POR PERSONAJE
 * ===================
 * Cada personaje funcional tiene su propia conversacion. NO comparten
 * chat: Nodo vive en Automatizaciones y Ora en Analisis, igual que Tico
 * vive en Soporte y Bodo en Inventario. Meterlos a todos en un mismo hilo
 * seria comodo de programar y confuso de usar.
 *
 * Lo que los conecta no es un chat comun, es la DERIVACION: cuando a un
 * personaje le preguntan algo que no es suyo, no improvisa ni se lo
 * inventa. Lo dice y ofrece pasar al que corresponde, llevandose la
 * frase original para que el usuario no tenga que repetirla.
 *
 *   POST /api/chat  { agente: 'nodo' | 'ora', texto }
 *
 * Un endpoint con el personaje como parametro, y no un endpoint por
 * personaje, para que sumar a Tico o a Bodo sea agregar una entrada al
 * catalogo y no una ruta nueva.
 */

import { emparejar } from '../matchingEngine.ts';
import { clasificar } from '../clasificador.ts';
import { resolverConsulta, listarConsultas } from '../consultasEngine.ts';
import { CONSULTAS } from '../../db/consultas.ts';
import type { Store } from '../store.ts';

export type SlugAgente = 'nodo' | 'ora';

/** Estados del visor. Coinciden con la hoja de expresiones de marca. */
export type EstadoVisor = 'neutro' | 'pensando' | 'hecho' | 'error';

/** Oferta de pasar al personaje que si sabe del tema. */
export type Derivacion = {
  agente: SlugAgente;
  etiqueta: string;
  /** La frase original, para no obligar al usuario a repetirla. */
  texto: string;
};

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

export type RespuestaAgente = {
  agente: SlugAgente;
  visor: EstadoVisor;
  /** Lo que dice el personaje, en su propio tono. */
  mensaje: string;
  /** Que disparo la clasificacion. Auditable. */
  senales: string[];
  derivacion: Derivacion | null;
  /** Solo Nodo. */
  automatizaciones: {
    intencion: { id: string; slug: string; nombre: string; categoria: string };
    confianza: number;
    evidencia: string[];
    opciones: OpcionPlantilla[];
  } | null;
  /** Solo Ora. */
  resultado: {
    consulta: string;
    cifra: string;
    detalle: string;
    filas: Array<{ etiqueta: string; valor: string }>;
  } | null;
  sugerencias: string[];
};

// ---------------------------------------------------------------------
// NODO · callado y metodico. Confirma hechos, no promete resultados.
// ---------------------------------------------------------------------

export function chatNodo(store: Store, texto: string): RespuestaAgente {
  const { tipo, senales } = clasificar(texto);

  // No es lo suyo: lo dice y pasa la frase a Ora. No intenta responderla.
  if (tipo === 'consulta') {
    return {
      agente: 'nodo',
      visor: 'neutro',
      mensaje: 'Eso es una cifra, no una regla. Yo automatizo; preguntar es de Ora.',
      senales,
      derivacion: { agente: 'ora', etiqueta: 'Preguntarle a Ora', texto },
      automatizaciones: null,
      resultado: null,
      sugerencias: [],
    };
  }

  const match = emparejar(texto, store.listarIntenciones());

  if (match.estado === 'sin_match') {
    store.registrarConversacion(texto, null, null, 'sin_match');
    return {
      agente: 'nodo',
      visor: 'error',
      mensaje: 'No tengo una regla para eso. Todavia no manejo esa area.',
      senales,
      derivacion: null,
      automatizaciones: null,
      resultado: null,
      sugerencias: match.sugerencias,
    };
  }

  const { principal } = match;
  store.registrarConversacion(texto, principal.intencion.id, principal.confianza, 'match');

  const yaActivas = new Set(store.listarActivaciones().map((a) => a.automatizacionId));

  return {
    agente: 'nodo',
    visor: 'neutro',
    mensaje:
      principal.confianza >= 0.6
        ? `Entendido: ${principal.intencion.nombre.toLowerCase()}. Tengo tres reglas para eso.`
        : `Creo que te refieres a ${principal.intencion.nombre.toLowerCase()}. Estas son mis tres reglas.`,
    senales,
    derivacion: null,
    automatizaciones: {
      intencion: {
        id: principal.intencion.id,
        slug: principal.intencion.slug,
        nombre: principal.intencion.nombre,
        categoria: principal.intencion.categoria,
      },
      confianza: Number(principal.confianza.toFixed(3)),
      evidencia: principal.evidencia,
      opciones: store.listarAutomatizacionesDe(principal.intencion.id).map((a) => ({
        id: a.id,
        nombre: a.nombre,
        descripcion: a.descripcion,
        impactoEsperado: a.impactoEsperado,
        moduloDestino: a.moduloDestino,
        reglaLogica: a.reglaLogica,
        parametrosDefault: a.parametrosDefault,
        yaActiva: yaActivas.has(a.id),
      })),
    },
    resultado: null,
    sugerencias: [],
  };
}

// ---------------------------------------------------------------------
// ORA · la cifra primero. Una linea de contexto y se calla.
// ---------------------------------------------------------------------

export function chatOra(store: Store, texto: string): RespuestaAgente {
  const { tipo, senales } = clasificar(texto);

  if (tipo === 'automatizacion') {
    return {
      agente: 'ora',
      visor: 'neutro',
      mensaje: 'Eso no es un dato, es una regla. Yo mido; automatizar es de Nodo.',
      senales,
      derivacion: { agente: 'nodo', etiqueta: 'Pasarselo a Nodo', texto },
      automatizaciones: null,
      resultado: null,
      sugerencias: [],
    };
  }

  const consulta = resolverConsulta(texto);

  if (consulta.estado === 'sin_consulta') {
    store.registrarConversacion(texto, null, null, 'sin_match');
    return {
      agente: 'ora',
      visor: 'error',
      mensaje: 'Esa consulta no la tengo. Estas si.',
      senales,
      derivacion: null,
      automatizaciones: null,
      resultado: null,
      sugerencias: consulta.sugerencias,
    };
  }

  store.registrarConversacion(texto, null, consulta.confianza, 'match');

  // Si la pregunta tiene una automatizacion equivalente, Ora la nombra y
  // pasa a Nodo. La relacion es explicita (db/consultas.ts), no adivinada
  // por keywords: por eso ofrece la regla correcta y no la que se parece.
  const relacionada = consulta.plantilla.intencionesRelacionadas[0];
  const intencion = relacionada
    ? store.listarIntenciones().find((i) => i.slug === relacionada)
    : undefined;

  return {
    agente: 'ora',
    visor: 'neutro',
    mensaje: `${consulta.respuesta.cifra}. ${consulta.respuesta.detalle}`,
    senales,
    derivacion: intencion
      ? {
          agente: 'nodo',
          etiqueta: 'Que Nodo lo automatice',
          texto: intencion.ejemploFrase,
        }
      : null,
    automatizaciones: null,
    resultado: {
      consulta: consulta.plantilla.nombre,
      cifra: consulta.respuesta.cifra,
      detalle: consulta.respuesta.detalle,
      filas: consulta.respuesta.filas ?? [],
    },
    sugerencias: [],
  };
}

export function manejarChat(store: Store, agente: string, texto: string): RespuestaAgente {
  return agente === 'ora' ? chatOra(store, texto) : chatNodo(store, texto);
}

// ---------------------------------------------------------------------
// Activaciones (solo Nodo escribe)
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
      ? 'Esa regla ya estaba activa. No cambie nada.'
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

// ---------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------

export function manejarCatalogo(store: Store) {
  const nodo = store.obtenerAgenteNodo();
  const ora = store.obtenerAgenteOra();
  const intenciones = store.listarIntenciones();

  return {
    persistente: store.persistente,
    // El front construye un panel por cada entrada de aqui. Sumar un
    // personaje funcional es agregar un elemento a esta lista.
    agentes: [
      {
        slug: 'nodo',
        nombre: nodo.nombre,
        rol: nodo.rol,
        descripcion: nodo.descripcion,
        microGesto: nodo.microGesto,
        modulo: 'Automatizaciones',
        placeholder: '¿Que quieres que pase solo?',
        capacidades: intenciones.length,
        ejemplos: intenciones.map((i) => ({
          id: i.slug,
          nombre: i.nombre,
          frase: i.ejemploFrase,
        })),
      },
      {
        slug: 'ora',
        nombre: ora.nombre,
        rol: ora.rol,
        descripcion: ora.descripcion,
        microGesto: ora.microGesto,
        modulo: 'Analisis',
        placeholder: '¿Que cifra necesitas?',
        capacidades: CONSULTAS.length,
        ejemplos: listarConsultas().map((c) => ({
          id: c.slug,
          nombre: c.nombre,
          frase: c.ejemploFrase,
        })),
      },
    ],
    totalReglas: intenciones.reduce(
      (n, i) => n + store.listarAutomatizacionesDe(i.id).length,
      0,
    ),
    totalConsultas: CONSULTAS.length,
  };
}
