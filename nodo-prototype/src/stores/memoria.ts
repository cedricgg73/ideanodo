/**
 * STORE EN MEMORIA
 * ================
 * Para entornos sin disco persistente (Vercel, cualquier serverless).
 * El catalogo se construye una vez desde db/seed.ts y queda en memoria:
 * es de solo lectura, asi que no hay nada que sincronizar.
 *
 * IMPORTANTE: los ids se derivan del SLUG, no de un uuid aleatorio.
 * En serverless cada instancia arranca de cero; si los ids cambiaran en
 * cada arranque en frio, el cliente guardaria referencias que dejan de
 * existir. Con el slug como id, el catalogo tiene ids estables para
 * siempre y el cliente puede recordar lo que activo.
 */

import { CATALOGO, AGENTE_NODO } from '../../db/seed.ts';
import type { Agente, Intencion, Automatizacion, ActivacionRegistrada } from '../types.ts';
import type { Store, ActivacionDetallada } from '../store.ts';

const AGENTE: Agente = {
  id: AGENTE_NODO.slug,
  slug: AGENTE_NODO.slug,
  nombre: AGENTE_NODO.nombre,
  rol: AGENTE_NODO.rol,
  descripcion: AGENTE_NODO.descripcion,
  personalidad: AGENTE_NODO.personalidad,
  microGesto: AGENTE_NODO.microGesto,
  activo: true,
};

const INTENCIONES: Intencion[] = CATALOGO.map((i) => ({
  id: i.slug,
  agenteId: AGENTE.id,
  slug: i.slug,
  nombre: i.nombre,
  descripcion: i.descripcion,
  categoria: i.categoria,
  keywords: i.keywords,
  ejemploFrase: i.ejemploFrase,
  activo: true,
}));

const AUTOMATIZACIONES: Automatizacion[] = CATALOGO.flatMap((i) =>
  i.automatizaciones.map((a, n) => ({
    id: a.slug,
    intencionId: i.slug,
    slug: a.slug,
    nombre: a.nombre,
    descripcion: a.descripcion,
    reglaLogica: a.reglaLogica,
    parametrosDefault: a.parametrosDefault,
    impactoEsperado: a.impactoEsperado,
    moduloDestino: a.moduloDestino,
    orden: n + 1,
    activo: true,
  })),
);

/** Vive lo que viva la instancia. El cliente es la fuente de verdad. */
const activaciones = new Map<string, ActivacionRegistrada>();

export const storeMemoria: Store = {
  persistente: false,

  obtenerAgenteNodo: () => AGENTE,

  listarIntenciones: () => INTENCIONES,

  listarAutomatizacionesDe: (intencionId) =>
    AUTOMATIZACIONES.filter((a) => a.intencionId === intencionId).sort(
      (x, y) => x.orden - y.orden,
    ),

  obtenerAutomatizacion: (id) => AUTOMATIZACIONES.find((a) => a.id === id) ?? null,

  listarActivaciones(): ActivacionDetallada[] {
    return [...activaciones.values()].map((act) => {
      const automatizacion = AUTOMATIZACIONES.find((a) => a.id === act.automatizacionId)!;
      const intencion = INTENCIONES.find((i) => i.id === automatizacion.intencionId)!;
      return { ...act, automatizacion, intencionNombre: intencion.nombre };
    });
  },

  activarAutomatizacion(automatizacionId, parametros, activadaPor) {
    const existente = activaciones.get(automatizacionId);
    if (existente) return { activacion: existente, yaEstaba: true };

    const activacion: ActivacionRegistrada = {
      id: `act-${automatizacionId}`,
      automatizacionId,
      restauranteId: null,
      parametros,
      estado: 'activa',
      activadaEn: new Date().toISOString(),
      activadaPor,
    };
    activaciones.set(automatizacionId, activacion);
    return { activacion, yaEstaba: false };
  },

  // En serverless la telemetria iria a un servicio externo (Supabase,
  // Logflare). Aqui no se guarda: se declara y ya.
  registrarConversacion() {},
};
