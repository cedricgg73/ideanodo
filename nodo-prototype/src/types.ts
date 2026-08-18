/**
 * Tipos del modulo de automatizaciones de Zetha.
 * Espejan 1:1 las tablas de db/schema.sql.
 */

/** Personaje capaz de ejecutar un flujo intencion -> automatizacion. Hoy: solo Nodo. */
export type Agente = {
  id: string;
  slug: string;
  nombre: string;
  rol: string;
  descripcion: string;
  /** Guia de tono: como escribe este personaje. */
  personalidad: string;
  /** Animacion firma. En Nodo: los tres puntos del visor avanzan en secuencia. */
  microGesto: string;
  activo: boolean;
};

/** Lo que el usuario quiere lograr. Se detecta por keywords. */
export type Intencion = {
  id: string;
  agenteId: string;
  slug: string;
  nombre: string;
  descripcion: string;
  /** Modulo del POS al que pertenece: 'inventario', 'caja', 'ventas'... */
  categoria: string;
  /** Palabras y frases que disparan esta intencion. */
  keywords: string[];
  /** Frase de ejemplo que la UI ofrece como chip. */
  ejemploFrase: string;
  activo: boolean;
};

/** Plantilla fija de automatizacion. Exactamente 3 por intencion. */
export type Automatizacion = {
  id: string;
  intencionId: string;
  slug: string;
  nombre: string;
  descripcion: string;
  /** Identificador simbolico que el POS resuelve contra un mapa fijo de handlers. */
  reglaLogica: string;
  parametrosDefault: Record<string, unknown>;
  impactoEsperado: string;
  /** Donde se ve el efecto dentro del POS. */
  moduloDestino: string;
  orden: number;
  activo: boolean;
};

/** Regla encendida por el usuario. */
export type ActivacionRegistrada = {
  id: string;
  automatizacionId: string;
  restauranteId: string | null;
  parametros: Record<string, unknown>;
  estado: 'activa' | 'pausada' | 'archivada';
  activadaEn: string;
  activadaPor: string | null;
};

// ---------------------------------------------------------------------
// Motor de coincidencia
// ---------------------------------------------------------------------

/** Una intencion candidata con su puntaje y la evidencia que lo justifica. */
export type Candidato = {
  intencion: Intencion;
  /** Confianza normalizada 0..1. */
  confianza: number;
  /** Keywords que efectivamente coincidieron (para poder explicar la decision). */
  evidencia: string[];
};

export type ResultadoMatch =
  | {
      estado: 'match';
      principal: Candidato;
      /** Otras intenciones cercanas, para ofrecer "no era esto?". */
      alternativas: Candidato[];
    }
  | {
      estado: 'sin_match';
      /** Frases de ejemplo para reencauzar al usuario. */
      sugerencias: string[];
    };
