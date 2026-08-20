/**
 * CAPA DE BASE DE DATOS
 * =====================
 * El prototipo usa SQLite via `node:sqlite` (modulo integrado en Node 22).
 * Esto permite correr SQL real sin instalar nada ni pedir credenciales.
 *
 * El diseno de produccion es PostgreSQL / Supabase: ver db/schema.sql.
 * Las consultas de aqui son SQL estandar y se trasladan casi sin cambios;
 * lo unico especifico es el (de)serializado de JSON, que en Postgres lo
 * hace el driver con jsonb.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CATALOGO, AGENTE_NODO, AGENTE_ORA } from '../db/seed.ts';
import type {
  Agente,
  Intencion,
  Automatizacion,
  ActivacionRegistrada,
} from './types.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_DB = join(RAIZ, 'db', 'nodo.sqlite');
const RUTA_SCHEMA = join(RAIZ, 'db', 'schema.sqlite.sql');

export const db = new DatabaseSync(RUTA_DB);

// ---------------------------------------------------------------------
// Arranque: crear tablas y sembrar el catalogo si esta vacio
// ---------------------------------------------------------------------

db.exec(readFileSync(RUTA_SCHEMA, 'utf8'));

/**
 * Siembra agente + intenciones + automatizaciones.
 * Es idempotente: si el catalogo ya esta cargado, no hace nada.
 * Las activaciones del usuario nunca se tocan.
 */
export function sembrarSiHaceFalta(): { sembrado: boolean; reglas: number } {
  const yaHay = db.prepare('select count(*) as n from intenciones').get() as { n: number };
  if (yaHay.n > 0) {
    const total = db
      .prepare('select count(*) as n from automatizaciones_preestablecidas')
      .get() as { n: number };
    return { sembrado: false, reglas: total.n };
  }

  const insAgente = db.prepare(
    `insert into agentes (id, slug, nombre, rol, descripcion, personalidad, micro_gesto)
     values (?, ?, ?, ?, ?, ?, ?)`,
  );

  // Los dos personajes FUNCIONALES del modulo: Nodo automatiza, Ora
  // responde. El resto del elenco (Tico, Sello, Bodo, Zeta) es branding
  // de otras areas y no vive en esta tabla.
  const agenteId = randomUUID(); // Nodo: es el duenio de las intenciones
  insAgente.run(
    agenteId,
    AGENTE_NODO.slug,
    AGENTE_NODO.nombre,
    AGENTE_NODO.rol,
    AGENTE_NODO.descripcion,
    AGENTE_NODO.personalidad,
    AGENTE_NODO.microGesto,
  );
  insAgente.run(
    randomUUID(),
    AGENTE_ORA.slug,
    AGENTE_ORA.nombre,
    AGENTE_ORA.rol,
    AGENTE_ORA.descripcion,
    AGENTE_ORA.personalidad,
    AGENTE_ORA.microGesto,
  );

  const insIntencion = db.prepare(
    `insert into intenciones
       (id, agente_id, slug, nombre, descripcion, categoria, keywords, ejemplo_frase)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insAutomatizacion = db.prepare(
    `insert into automatizaciones_preestablecidas
       (id, intencion_id, slug, nombre, descripcion, regla_logica,
        parametros_default, impacto_esperado, modulo_destino, orden)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let reglas = 0;
  for (const intencion of CATALOGO) {
    const intencionId = randomUUID();
    insIntencion.run(
      intencionId,
      agenteId,
      intencion.slug,
      intencion.nombre,
      intencion.descripcion,
      intencion.categoria,
      JSON.stringify(intencion.keywords),
      intencion.ejemploFrase,
    );

    intencion.automatizaciones.forEach((a, i) => {
      insAutomatizacion.run(
        randomUUID(),
        intencionId,
        a.slug,
        a.nombre,
        a.descripcion,
        a.reglaLogica,
        JSON.stringify(a.parametrosDefault),
        a.impactoEsperado,
        a.moduloDestino,
        i + 1,
      );
      reglas++;
    });
  }

  return { sembrado: true, reglas };
}

// ---------------------------------------------------------------------
// Lectura del catalogo
// ---------------------------------------------------------------------

type FilaIntencion = {
  id: string; agente_id: string; slug: string; nombre: string;
  descripcion: string; categoria: string; keywords: string;
  ejemplo_frase: string; activo: number;
};

type FilaAutomatizacion = {
  id: string; intencion_id: string; slug: string; nombre: string;
  descripcion: string; regla_logica: string; parametros_default: string;
  impacto_esperado: string; modulo_destino: string; orden: number; activo: number;
};

function aIntencion(f: FilaIntencion): Intencion {
  return {
    id: f.id,
    agenteId: f.agente_id,
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion,
    categoria: f.categoria,
    keywords: JSON.parse(f.keywords) as string[],
    ejemploFrase: f.ejemplo_frase,
    activo: f.activo === 1,
  };
}

function aAutomatizacion(f: FilaAutomatizacion): Automatizacion {
  return {
    id: f.id,
    intencionId: f.intencion_id,
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion,
    reglaLogica: f.regla_logica,
    parametrosDefault: JSON.parse(f.parametros_default) as Record<string, unknown>,
    impactoEsperado: f.impacto_esperado,
    moduloDestino: f.modulo_destino,
    orden: f.orden,
    activo: f.activo === 1,
  };
}

function obtenerAgente(slug: string): Agente {
  const f = db.prepare('select * from agentes where slug = ?').get(slug) as {
    id: string; slug: string; nombre: string; rol: string;
    descripcion: string; personalidad: string; micro_gesto: string; activo: number;
  };
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    rol: f.rol,
    descripcion: f.descripcion,
    personalidad: f.personalidad,
    microGesto: f.micro_gesto,
    activo: f.activo === 1,
  };
}

export const obtenerAgenteNodo = () => obtenerAgente('nodo');
export const obtenerAgenteOra = () => obtenerAgente('ora');

export function listarIntenciones(): Intencion[] {
  const filas = db
    .prepare('select * from intenciones where activo = 1 order by slug')
    .all() as FilaIntencion[];
  return filas.map(aIntencion);
}

export function listarAutomatizacionesDe(intencionId: string): Automatizacion[] {
  const filas = db
    .prepare(
      `select * from automatizaciones_preestablecidas
       where intencion_id = ? and activo = 1 order by orden`,
    )
    .all(intencionId) as FilaAutomatizacion[];
  return filas.map(aAutomatizacion);
}

export function obtenerAutomatizacion(id: string): Automatizacion | null {
  const f = db
    .prepare('select * from automatizaciones_preestablecidas where id = ?')
    .get(id) as FilaAutomatizacion | undefined;
  return f ? aAutomatizacion(f) : null;
}

// ---------------------------------------------------------------------
// Activaciones (lo unico que escribe el usuario final)
// ---------------------------------------------------------------------

export type ActivacionDetallada = ActivacionRegistrada & {
  automatizacion: Automatizacion;
  intencionNombre: string;
};

/**
 * Enciende una automatizacion. Si ya estaba activa, devuelve la existente
 * en lugar de fallar: activar dos veces la misma regla no es un error,
 * simplemente no cambia nada.
 */
export function activarAutomatizacion(
  automatizacionId: string,
  parametros: Record<string, unknown>,
  activadaPor: string,
): { activacion: ActivacionRegistrada; yaEstaba: boolean } {
  const existente = db
    .prepare(
      `select * from automatizaciones_activas
       where automatizacion_id = ? and restaurante_id is null`,
    )
    .get(automatizacionId) as
    | { id: string; automatizacion_id: string; restaurante_id: string | null;
        parametros: string; estado: string; activada_en: string; activada_por: string | null }
    | undefined;

  if (existente) {
    return {
      yaEstaba: true,
      activacion: {
        id: existente.id,
        automatizacionId: existente.automatizacion_id,
        restauranteId: existente.restaurante_id,
        parametros: JSON.parse(existente.parametros) as Record<string, unknown>,
        estado: existente.estado as ActivacionRegistrada['estado'],
        activadaEn: existente.activada_en,
        activadaPor: existente.activada_por,
      },
    };
  }

  const id = randomUUID();
  const activadaEn = new Date().toISOString();
  db.prepare(
    `insert into automatizaciones_activas
       (id, automatizacion_id, restaurante_id, parametros, estado, activada_en, activada_por)
     values (?, ?, null, ?, 'activa', ?, ?)`,
  ).run(id, automatizacionId, JSON.stringify(parametros), activadaEn, activadaPor);

  return {
    yaEstaba: false,
    activacion: {
      id,
      automatizacionId,
      restauranteId: null,
      parametros,
      estado: 'activa',
      activadaEn,
      activadaPor,
    },
  };
}

export function listarActivaciones(): ActivacionDetallada[] {
  const filas = db
    .prepare(
      `select act.*, aut.*, i.nombre as intencion_nombre, act.id as act_id
       from automatizaciones_activas act
       join automatizaciones_preestablecidas aut on aut.id = act.automatizacion_id
       join intenciones i on i.id = aut.intencion_id
       where act.estado = 'activa'
       order by act.activada_en desc`,
    )
    .all() as Array<Record<string, unknown>>;

  return filas.map((f) => ({
    id: f.act_id as string,
    automatizacionId: f.automatizacion_id as string,
    restauranteId: (f.restaurante_id as string | null) ?? null,
    parametros: JSON.parse(f.parametros as string) as Record<string, unknown>,
    estado: f.estado as ActivacionRegistrada['estado'],
    activadaEn: f.activada_en as string,
    activadaPor: (f.activada_por as string | null) ?? null,
    intencionNombre: f.intencion_nombre as string,
    automatizacion: aAutomatizacion(f as unknown as FilaAutomatizacion),
  }));
}

// ---------------------------------------------------------------------
// Telemetria: toda frase sin match es una keyword que falta
// ---------------------------------------------------------------------

export function registrarConversacion(
  textoUsuario: string,
  intencionId: string | null,
  confianza: number | null,
  resultado: 'match' | 'sin_match',
): void {
  db.prepare(
    `insert into conversaciones_nodo (id, texto_usuario, intencion_id, confianza, resultado)
     values (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), textoUsuario, intencionId, confianza, resultado);
}

/** Frases que el motor no entendio. Alimenta la mejora del catalogo. */
export function listarSinMatch(limite = 20): Array<{ texto: string; fecha: string }> {
  const filas = db
    .prepare(
      `select texto_usuario, creado_en from conversaciones_nodo
       where resultado = 'sin_match' order by creado_en desc limit ?`,
    )
    .all(limite) as Array<{ texto_usuario: string; creado_en: string }>;
  return filas.map((f) => ({ texto: f.texto_usuario, fecha: f.creado_en }));
}
