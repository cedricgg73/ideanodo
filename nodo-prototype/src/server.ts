/**
 * SERVIDOR DEL PROTOTIPO (local)
 * ==============================
 * Sin dependencias externas: node:http + node:sqlite.
 * En el POS real esto seria un router de Express/Fastify; la logica de
 * las rutas (src/routes/agentes.ts) no cambia.
 *
 *   POST /api/chat          { agente, texto }
 *   POST /api/activar       { automatizacionId }
 *   GET  /api/activaciones
 *   GET  /api/catalogo
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { sembrarSiHaceFalta } from './db.ts';
import { storeSqlite as store } from './stores/sqlite.ts';
import {
  manejarChat,
  manejarActivar,
  manejarActivaciones,
  manejarCatalogo,
} from './routes/agentes.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = join(RAIZ, 'public');
const PUERTO = Number(process.env.PORT ?? 3000);

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function json(res: import('node:http').ServerResponse, codigo: number, cuerpo: unknown): void {
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(cuerpo, null, 2));
}

async function leerCuerpo(req: import('node:http').IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];
  let bytes = 0;
  for await (const trozo of req) {
    bytes += (trozo as Buffer).length;
    if (bytes > 64 * 1024) throw new Error('cuerpo demasiado grande');
    trozos.push(trozo as Buffer);
  }
  if (trozos.length === 0) return {};
  return JSON.parse(Buffer.concat(trozos).toString('utf8'));
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const ruta = url.pathname;

  try {
    if (ruta === '/api/chat' && req.method === 'POST') {
      const cuerpo = (await leerCuerpo(req)) as { agente?: unknown; texto?: unknown };
      const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : '';
      const agente = cuerpo.agente === 'ora' ? 'ora' : 'nodo';
      if (!texto) return json(res, 400, { error: 'Falta el campo "texto".' });
      return json(res, 200, manejarChat(store, agente, texto));
    }

    if (ruta === '/api/activar' && req.method === 'POST') {
      const cuerpo = (await leerCuerpo(req)) as {
        automatizacionId?: unknown;
        parametros?: unknown;
      };
      const id = typeof cuerpo.automatizacionId === 'string' ? cuerpo.automatizacionId : '';
      if (!id) return json(res, 400, { error: 'Falta el campo "automatizacionId".' });
      const parametros =
        cuerpo.parametros && typeof cuerpo.parametros === 'object'
          ? (cuerpo.parametros as Record<string, unknown>)
          : undefined;
      const resultado = manejarActivar(store, id, parametros, 'prueba');
      return json(res, resultado.ok ? 200 : 404, resultado);
    }

    if (ruta === '/api/activaciones' && req.method === 'GET') {
      return json(res, 200, manejarActivaciones(store));
    }

    if (ruta === '/api/catalogo' && req.method === 'GET') {
      return json(res, 200, manejarCatalogo(store));
    }

    if (ruta.startsWith('/api/')) {
      return json(res, 404, { error: 'Endpoint no encontrado.' });
    }

    // ---------------- Estaticos ----------------
    const relativa = ruta === '/' ? 'index.html' : ruta.slice(1);
    const destino = join(PUBLICO, normalize(relativa));
    if (!destino.startsWith(PUBLICO)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    const contenido = await readFile(destino);
    res.writeHead(200, {
      'content-type': TIPOS[extname(destino)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(contenido);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('No encontrado');
      return;
    }
    console.error('[zetha] error:', err.message);
    json(res, 500, { error: 'Error interno.' });
  }
});

const { sembrado, reglas } = sembrarSiHaceFalta();

servidor.listen(PUERTO, () => {
  console.log('');
  console.log('  ZETHA · Prototipo de personajes funcionales');
  console.log('  ' + '-'.repeat(52));
  console.log(`  Nodo:      ${reglas} reglas de automatizacion ${sembrado ? '(sembradas)' : '(ya existian)'}`);
  console.log('  Ora:       9 consultas de datos');
  console.log(`  Servidor:  http://localhost:${PUERTO}`);
  console.log('');
});
