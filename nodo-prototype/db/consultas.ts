/**
 * CATALOGO DE CONSULTAS (ORA)
 * ===========================
 * Segundo nivel del sistema: preguntas de datos.
 *
 * Nodo automatiza; Ora responde. Son dos problemas distintos y por eso
 * son dos personajes distintos, no dos modos del mismo.
 *
 * Igual que las automatizaciones, esto NO es texto-a-SQL libre: es un
 * catalogo cerrado de plantillas de consulta. El motor solo decide cual
 * plantilla aplica y con que parametros. La consulta en si ya esta
 * escrita y probada por el equipo, asi que las cifras nunca se inventan.
 *
 * En produccion cada `responder()` seria una query parametrizada contra
 * Postgres. Aqui opera sobre el dataset de ejemplo de mas abajo, que es
 * el mismo que muestra el dashboard: si Ora dice una cifra, coincide con
 * lo que el usuario ve en pantalla.
 */

// ---------------------------------------------------------------------
// Dataset de ejemplo (equivale a las tablas ventas / items / clientes)
// ---------------------------------------------------------------------

export const PRODUCTOS_VENDIDOS = [
  { nombre: 'Bandeja Paisa',        categoria: 'Platos fuertes', precio: 28000, costo: 12000, unidades: 5 },
  { nombre: 'Pechuga a la Plancha', categoria: 'Platos fuertes', precio: 22000, costo:  9500, unidades: 2 },
  { nombre: 'Patacon con Hogao',    categoria: 'Entradas',       precio: 12000, costo:  4000, unidades: 2 },
  { nombre: 'Empanadas x3',         categoria: 'Entradas',       precio:  9000, costo:  3500, unidades: 3 },
  { nombre: 'Jugo de Mora',         categoria: 'Bebidas',        precio:  5500, costo:  2000, unidades: 2 },
  { nombre: 'Limonada Natural',     categoria: 'Bebidas',        precio:  5000, costo:  1800, unidades: 2 },
  { nombre: 'Gaseosa 400ml',        categoria: 'Bebidas',        precio:  4000, costo:  2200, unidades: 5 },
];

export const CLIENTES = [
  { nombre: 'Andres Lopez',    pedidos: 4, gastado: 96000, favorito: 'Bandeja Paisa',        vecesFavorito: 3 },
  { nombre: 'Maria Rodriguez', pedidos: 3, gastado: 72000, favorito: 'Bandeja Paisa',        vecesFavorito: 2 },
  { nombre: 'Luisa Martinez',  pedidos: 2, gastado: 54000, favorito: 'Pechuga a la Plancha', vecesFavorito: 2 },
  { nombre: 'Pedro Gomez',     pedidos: 2, gastado: 34000, favorito: 'Empanadas x3',         vecesFavorito: 2 },
  { nombre: 'Sin identificar', pedidos: 1, gastado: 20000, favorito: 'Gaseosa 400ml',        vecesFavorito: 1 },
];

export const CANALES = [
  { nombre: 'Mesa',      ventas: 7, total: 180000 },
  { nombre: 'Mostrador', ventas: 3, total:  48000 },
  { nombre: 'Domicilio', ventas: 2, total:  48000 },
];

export const PROPINAS_TOTAL = 2800;

// Derivados: se calculan, no se hardcodean, para que nunca se
// contradigan entre si ni con el dashboard.
export const VENTAS_TOTAL = PRODUCTOS_VENDIDOS.reduce((n, p) => n + p.precio * p.unidades, 0);
export const NUM_VENTAS = CANALES.reduce((n, c) => n + c.ventas, 0);
export const TICKET_PROMEDIO = Math.round(VENTAS_TOTAL / NUM_VENTAS);
export const UTILIDAD_TOTAL = PRODUCTOS_VENDIDOS.reduce(
  (n, p) => n + (p.precio - p.costo) * p.unidades,
  0,
);

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

/** Lo que Ora devuelve: la cifra primero, el detalle despues. */
export type Respuesta = {
  /** La cifra o el nombre. Es lo que Ora dice primero. */
  cifra: string;
  /** Una linea de contexto. Sin adornos. */
  detalle: string;
  /** Tabla opcional de respaldo. */
  filas?: Array<{ etiqueta: string; valor: string }>;
};

export type PlantillaConsulta = {
  slug: string;
  nombre: string;
  /** Palabras y frases que disparan esta consulta. */
  keywords: string[];
  ejemploFrase: string;
  /**
   * Intenciones de automatizacion que vuelven innecesaria esta pregunta.
   * Es una relacion EXPLICITA, no una heuristica: cuando el usuario
   * pregunta algo que ademas se puede automatizar, Nodo ofrece justo la
   * regla que corresponde y no lo que se le parezca por keywords.
   * Vacio = la pregunta no tiene automatizacion equivalente.
   */
  intencionesRelacionadas: string[];
  /** En produccion: una query parametrizada. Aqui: calculo sobre el dataset. */
  responder: () => Respuesta;
};

const pesos = (n: number) => '$ ' + n.toLocaleString('es-CO');
const pct = (parte: number, total: number) =>
  ((parte / total) * 100).toFixed(1).replace('.', ',') + '%';

// ---------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------

export const CONSULTAS: PlantillaConsulta[] = [
  {
    slug: 'ventas_periodo',
    nombre: 'Ventas del periodo',
    keywords: [
      'vendi', 'vendido', 'venta', 'ventas', 'ingreso', 'ingresos',
      'facture', 'facturado', 'cuanto vendi', 'como van las ventas',
    ],
    ejemploFrase: '¿Cuanto vendi hoy?',
    intencionesRelacionadas: ['cierre_caja'],
    responder: () => ({
      cifra: pesos(VENTAS_TOTAL),
      detalle: `${NUM_VENTAS} ventas. Ticket promedio ${pesos(TICKET_PROMEDIO)}.`,
      filas: CANALES.map((c) => ({
        etiqueta: `${c.nombre} (${c.ventas})`,
        valor: pesos(c.total),
      })),
    }),
  },

  {
    slug: 'producto_mas_vendido',
    nombre: 'Producto mas vendido',
    keywords: [
      'producto mas vendido', 'que mas vendo', 'mas vendido', 'mas se vende',
      'plato mas vendido', 'top productos', 'ranking productos',
    ],
    ejemploFrase: '¿Cual es mi producto mas vendido?',
    intencionesRelacionadas: ['control_stock'],
    responder: () => {
      const orden = [...PRODUCTOS_VENDIDOS].sort((a, b) => b.unidades - a.unidades);
      const top = orden[0];
      return {
        cifra: top.nombre,
        detalle: `${top.unidades} unidades, ${pesos(top.precio * top.unidades)}.`,
        filas: orden.slice(0, 5).map((p) => ({
          etiqueta: p.nombre,
          valor: `${p.unidades} und · ${pesos(p.precio * p.unidades)}`,
        })),
      };
    },
  },

  {
    slug: 'producto_mas_rentable',
    nombre: 'Producto que deja mas utilidad',
    keywords: [
      'mas rentable', 'mas ganancia', 'mas utilidad', 'deja mas',
      'mejor margen', 'plato mas rentable', 'que me deja mas',
    ],
    ejemploFrase: '¿Cual de mis platos deja mas ganancia?',
    intencionesRelacionadas: ['costos_margenes'],
    responder: () => {
      const conUtilidad = PRODUCTOS_VENDIDOS.map((p) => ({
        ...p,
        utilidad: (p.precio - p.costo) * p.unidades,
        margen: (p.precio - p.costo) / p.precio,
      }));
      const porUtilidad = [...conUtilidad].sort((a, b) => b.utilidad - a.utilidad);
      const porMargen = [...conUtilidad].sort((a, b) => b.margen - a.margen);
      const top = porUtilidad[0];
      const mejorMargen = porMargen[0];

      // Ora distingue lo que MAS DEJA de lo que MEJOR MARGEN tiene.
      // No son lo mismo y confundirlos cuesta plata.
      return {
        cifra: top.nombre,
        detalle:
          `${pesos(top.utilidad)} de utilidad. El de mejor margen es ` +
          `${mejorMargen.nombre} (${pct(mejorMargen.precio - mejorMargen.costo, mejorMargen.precio)}), ` +
          `pero solo vendiste ${mejorMargen.unidades}.`,
        filas: porUtilidad.slice(0, 5).map((p) => ({
          etiqueta: p.nombre,
          valor: `${pesos(p.utilidad)} · margen ${pct(p.precio - p.costo, p.precio)}`,
        })),
      };
    },
  },

  {
    slug: 'mejor_cliente',
    nombre: 'Cliente que mas gasta',
    keywords: [
      'mejor cliente', 'cliente favorito', 'cliente que mas', 'mas compra',
      'mas gasta', 'clientes frecuentes', 'quien compra mas',
    ],
    ejemploFrase: '¿Cual es mi mejor cliente?',
    intencionesRelacionadas: ['fidelizar_clientes'],
    responder: () => {
      const orden = [...CLIENTES]
        .filter((c) => c.nombre !== 'Sin identificar')
        .sort((a, b) => b.gastado - a.gastado);
      const top = orden[0];
      return {
        cifra: top.nombre,
        detalle: `${top.pedidos} pedidos, ${pesos(top.gastado)}. El ${pct(top.gastado, VENTAS_TOTAL)} de tus ventas.`,
        filas: orden.map((c) => ({
          etiqueta: `${c.nombre} (${c.pedidos})`,
          valor: pesos(c.gastado),
        })),
      };
    },
  },

  {
    slug: 'producto_favorito_de_cliente',
    nombre: 'Lo que mas pide tu mejor cliente',
    keywords: [
      'que mas compra mi cliente', 'producto que mas compra',
      'mas pide mi cliente', 'que mas pide', 'que pide mi mejor cliente',
      'favorito de mi cliente', 'cliente favorito producto',
    ],
    ejemploFrase: '¿Que es lo que mas pide mi cliente favorito?',
    intencionesRelacionadas: ['fidelizar_clientes'],
    responder: () => {
      const top = [...CLIENTES]
        .filter((c) => c.nombre !== 'Sin identificar')
        .sort((a, b) => b.gastado - a.gastado)[0];
      return {
        cifra: top.favorito,
        detalle:
          `Tu cliente que mas gasta es ${top.nombre} (${pesos(top.gastado)}). ` +
          `Pidio ${top.favorito} en ${top.vecesFavorito} de sus ${top.pedidos} pedidos.`,
        filas: CLIENTES.filter((c) => c.nombre !== 'Sin identificar').map((c) => ({
          etiqueta: c.nombre,
          valor: `${c.favorito} (${c.vecesFavorito}/${c.pedidos})`,
        })),
      };
    },
  },

  {
    slug: 'ventas_por_canal',
    nombre: 'Ventas por canal',
    keywords: [
      'ventas por canal', 'por canal', 'canales', 'mesa mostrador domicilio',
      'de donde viene', 'domicilio o mesa', 'cual canal',
    ],
    ejemploFrase: '¿Como van las ventas por canal?',
    intencionesRelacionadas: ['pedidos_domicilio'],
    responder: () => {
      const orden = [...CANALES].sort((a, b) => b.total - a.total);
      const top = orden[0];
      return {
        cifra: `${top.nombre}: ${pesos(top.total)}`,
        detalle: `El ${pct(top.total, VENTAS_TOTAL)} de las ventas viene de ${top.nombre.toLowerCase()}.`,
        filas: orden.map((c) => ({
          etiqueta: `${c.nombre} (${c.ventas} ventas)`,
          valor: `${pesos(c.total)} · ${pct(c.total, VENTAS_TOTAL)}`,
        })),
      };
    },
  },

  {
    slug: 'ticket_promedio',
    nombre: 'Ticket promedio',
    keywords: ['ticket promedio', 'ticket', 'promedio por venta', 'cuanto gasta cada'],
    ejemploFrase: '¿Cual es mi ticket promedio?',
    intencionesRelacionadas: [],
    responder: () => ({
      cifra: pesos(TICKET_PROMEDIO),
      detalle: `${pesos(VENTAS_TOTAL)} repartidos en ${NUM_VENTAS} ventas.`,
    }),
  },

  {
    slug: 'margen_periodo',
    nombre: 'Margen y utilidad del periodo',
    keywords: ['margen', 'utilidad', 'rentabilidad', 'cuanto gane', 'ganancia total', 'cmv'],
    ejemploFrase: '¿Cuanta utilidad deje este mes?',
    intencionesRelacionadas: ['costos_margenes'],
    responder: () => ({
      cifra: pesos(UTILIDAD_TOTAL),
      detalle: `Margen bruto ${pct(UTILIDAD_TOTAL, VENTAS_TOTAL)} sobre ${pesos(VENTAS_TOTAL)} vendidos.`,
      filas: [
        { etiqueta: 'Ventas', valor: pesos(VENTAS_TOTAL) },
        { etiqueta: 'Costo de la mercancia', valor: pesos(VENTAS_TOTAL - UTILIDAD_TOTAL) },
        { etiqueta: 'Utilidad bruta', valor: pesos(UTILIDAD_TOTAL) },
      ],
    }),
  },

  {
    slug: 'propinas_periodo',
    nombre: 'Propinas del periodo',
    keywords: ['propina', 'propinas', 'cuanto de propina'],
    ejemploFrase: '¿Cuanto se hizo de propinas?',
    intencionesRelacionadas: ['propinas_equipo'],
    responder: () => ({
      cifra: pesos(PROPINAS_TOTAL),
      detalle: `El ${pct(PROPINAS_TOTAL, VENTAS_TOTAL)} de las ventas del periodo.`,
    }),
  },
];
