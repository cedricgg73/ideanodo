/**
 * SERVIDOR DEL PROTOTIPO
 * ======================
 * Sin dependencias externas: node:http + node:sqlite.
 * En el POS real esto seria un router de Express/Fastify montado en
 * /api/nodo; la logica de las rutas (src/routes/nodo.ts) no cambia.
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
} from './routes/nodo.ts';

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
  const texto = JSON.stringify(cuerpo, null, 2);
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(texto);
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
    // ---------------- API ----------------
    if (ruta === '/api/nodo/chat' && req.method === 'POST') {
      const cuerpo = (await leerCuerpo(req)) as { texto?: unknown };
      const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : '';
      if (!texto) {
        return json(res, 400, { error: 'Falta el campo "texto".' });
      }
      return json(res, 200, manejarChat(store, texto));
    }

    if (ruta === '/api/nodo/activar' && req.method === 'POST') {
      const cuerpo = (await leerCuerpo(req)) as {
        automatizacionId?: unknown;
        parametros?: unknown;
      };
      const id = typeof cuerpo.automatizacionId === 'string' ? cuerpo.automatizacionId : '';
      if (!id) {
        return json(res, 400, { error: 'Falta el campo "automatizacionId".' });
      }
      const parametros =
        cuerpo.parametros && typeof cuerpo.parametros === 'object'
          ? (cuerpo.parametros as Record<string, unknown>)
          : undefined;
      const resultado = manejarActivar(store, id, parametros, 'prueba');
      return json(res, resultado.ok ? 200 : 404, resultado);
    }

    if (ruta === '/api/nodo/activaciones' && req.method === 'GET') {
      return json(res, 200, manejarActivaciones(store));
    }

    if (ruta === '/api/nodo/catalogo' && req.method === 'GET') {
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
    console.error('[nodo] error:', err.message);
    json(res, 500, { error: 'Error interno.' });
  }
});

const { sembrado, reglas } = sembrarSiHaceFalta();

servidor.listen(PUERTO, () => {
  console.log('');
  console.log('  ZETHA · Prototipo del modulo de automatizaciones (Nodo)');
  console.log('  ' + '-'.repeat(54));
  console.log(`  Catalogo:  ${reglas} reglas preestablecidas ${sembrado ? '(recien sembradas)' : '(ya existian)'}`);
  console.log(`  Servidor:  http://localhost:${PUERTO}`);
  console.log('');
  console.log('  Probar:    escribe "quiero controlar las perdidas de comida"');
  console.log('');
});
