/**
 * INTERFAZ DE ALMACENAMIENTO
 * ==========================
 * El modulo tiene dos entornos con capacidades distintas:
 *
 *   local   -> SQLite en disco. Persiste. Corre el schema real.
 *   Vercel  -> funciones serverless, filesystem efimero. No persiste.
 *
 * En vez de escribir dos veces la logica, las rutas hablan contra esta
 * interfaz y cada entorno enchufa su implementacion:
 *
 *   src/stores/sqlite.ts   (local, `npm run dev`)
 *   src/stores/memoria.ts  (Vercel y cualquier entorno sin disco)
 *
 * `persistente` le dice al cliente si puede confiar en el servidor para
 * recordar las reglas activas, o si debe guardarlas el mismo. Es una
 * limitacion real del despliegue, no se disimula: se declara.
 */

import type {
  Agente,
  Intencion,
  Automatizacion,
  ActivacionRegistrada,
} from './types.ts';

export type ActivacionDetallada = ActivacionRegistrada & {
  automatizacion: Automatizacion;
  intencionNombre: string;
};

export type Store = {
  /** true si las activaciones sobreviven entre peticiones. */
  readonly persistente: boolean;

  obtenerAgenteNodo(): Agente;
  obtenerAgenteOra(): Agente;
  listarIntenciones(): Intencion[];
  listarAutomatizacionesDe(intencionId: string): Automatizacion[];
  obtenerAutomatizacion(id: string): Automatizacion | null;

  listarActivaciones(): ActivacionDetallada[];
  activarAutomatizacion(
    automatizacionId: string,
    parametros: Record<string, unknown>,
    activadaPor: string,
  ): { activacion: ActivacionRegistrada; yaEstaba: boolean };

  registrarConversacion(
    textoUsuario: string,
    intencionId: string | null,
    confianza: number | null,
    resultado: 'match' | 'sin_match',
  ): void;
};
