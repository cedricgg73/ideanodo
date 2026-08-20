/**
 * FUNCION SERVERLESS (Vercel)
 * ===========================
 * Mismos endpoints que el servidor local:
 *
 *   POST /api/chat          { agente, texto }
 *   POST /api/activar       { automatizacionId }
 *   GET  /api/activaciones
 *   GET  /api/catalogo
 *
 * Reusa exactamente la misma logica (src/routes/agentes.ts), el mismo
 * clasificador y los mismos dos motores. Lo unico que cambia es el store:
 * aqui va el de memoria, porque en serverless no hay disco persistente.
 *
 * Una ruta dinamica [accion] en vez de cuatro archivos: el manejo de
 * errores y cabeceras se escribe una sola vez.
 */

import { storeMemoria as store } from '../src/stores/memoria.ts';
import {
  manejarChat,
  manejarActivar,
  manejarActivaciones,
  manejarCatalogo,
} from '../src/routes/agentes.ts';

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
      const cuerpo = (req.body ?? {}) as { agente?: unknown; texto?: unknown };
      const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : '';
      const agente = cuerpo.agente === 'ora' ? 'ora' : 'nodo';
      if (!texto) {
        res.status(400).json({ error: 'Falta el campo "texto".' });
        return;
      }
      res.status(200).json(manejarChat(store, agente, texto));
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
    console.error('[zetha]', error);
    res.status(500).json({ error: 'Error interno.' });
  }
}
