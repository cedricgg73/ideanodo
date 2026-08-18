/**
 * FUNCION SERVERLESS (Vercel)
 * ===========================
 * Expone los mismos endpoints que el servidor local:
 *
 *   GET  /api/nodo/catalogo
 *   GET  /api/nodo/activaciones
 *   POST /api/nodo/chat
 *   POST /api/nodo/activar
 *
 * Reusa exactamente la misma logica (src/routes/nodo.ts) y el mismo motor
 * de coincidencia. Lo unico que cambia es el store: aqui va el de memoria,
 * porque en serverless no hay disco persistente.
 *
 * Se usa una ruta dinamica [accion] en vez de cuatro archivos para no
 * repetir el manejo de errores y cabeceras cuatro veces.
 */

import { storeMemoria as store } from '../../src/stores/memoria.ts';
import {
  manejarChat,
  manejarActivar,
  manejarActivaciones,
  manejarCatalogo,
} from '../../src/routes/nodo.ts';

// Tipos minimos: evita depender del paquete @vercel/node solo para esto.
type Req = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type Res = {
  status(codigo: number): Res;
  setHeader(nombre: string, valor: string): void;
  json(cuerpo: unknown): void;
};

export default function handler(req: Req, res: Res): void {
  const accion = String(req.query.accion ?? '');
  res.setHeader('cache-control', 'no-store');

  try {
    if (accion === 'catalogo' && req.method === 'GET') {
      res.status(200).json(manejarCatalogo(store));
      return;
    }

    if (accion === 'activaciones' && req.method === 'GET') {
      res.status(200).json(manejarActivaciones(store));
      return;
    }

    if (accion === 'chat' && req.method === 'POST') {
      const cuerpo = (req.body ?? {}) as { texto?: unknown };
      const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : '';
      if (!texto) {
        res.status(400).json({ error: 'Falta el campo "texto".' });
        return;
      }
      res.status(200).json(manejarChat(store, texto));
      return;
    }

    if (accion === 'activar' && req.method === 'POST') {
      const cuerpo = (req.body ?? {}) as {
        automatizacionId?: unknown;
        parametros?: unknown;
      };
      const id =
        typeof cuerpo.automatizacionId === 'string' ? cuerpo.automatizacionId : '';
      if (!id) {
        res.status(400).json({ error: 'Falta el campo "automatizacionId".' });
        return;
      }
      const parametros =
        cuerpo.parametros && typeof cuerpo.parametros === 'object'
          ? (cuerpo.parametros as Record<string, unknown>)
          : undefined;
      const resultado = manejarActivar(store, id, parametros, 'demo');
      res.status(resultado.ok ? 200 : 404).json(resultado);
      return;
    }

    res.status(404).json({ error: 'Endpoint no encontrado.' });
  } catch (error) {
    console.error('[nodo]', error);
    res.status(500).json({ error: 'Error interno.' });
  }
}
