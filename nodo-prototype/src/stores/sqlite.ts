/**
 * STORE SOBRE SQLITE
 * ==================
 * Para desarrollo local (`npm run dev`). Persiste en db/nodo.sqlite y
 * corre SQL real, traducido 1:1 del schema de Postgres.
 * Es la implementacion que mas se parece a produccion.
 */

import * as base from '../db.ts';
import type { Store } from '../store.ts';

export const storeSqlite: Store = {
  persistente: true,

  obtenerAgenteNodo: base.obtenerAgenteNodo,
  listarIntenciones: base.listarIntenciones,
  listarAutomatizacionesDe: base.listarAutomatizacionesDe,
  obtenerAutomatizacion: base.obtenerAutomatizacion,
  listarActivaciones: base.listarActivaciones,
  activarAutomatizacion: base.activarAutomatizacion,
  registrarConversacion: base.registrarConversacion,
};
