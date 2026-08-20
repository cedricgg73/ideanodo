/**
 * CATALOGO SEMILLA DEL MODULO DE AUTOMATIZACIONES
 * ================================================
 * Fuente unica de verdad de las reglas preestablecidas de Zetha.
 * Este archivo es el que se edita para agregar reglas nuevas: la tabla
 * de DESIGN.md y la base de datos se derivan de aqui.
 *
 * Estructura: 8 intenciones x 3 automatizaciones = 24 reglas.
 * Las intenciones estan alineadas con los modulos reales del POS
 * (Productos, Caja, Restaurante/Domicilio, Finanzas, Compras, Clientes).
 *
 * Convencion de `reglaLogica`:  <dominio>.<accion>
 * El POS resuelve ese identificador contra un mapa FIJO de handlers.
 * Nunca se ejecuta codigo arbitrario que venga de la base.
 */

/**
 * Personajes FUNCIONALES: los que ejecutan un flujo, no los decorativos.
 * Tico, Sello, Bodo y Zeta son mascotas de otras areas del producto
 * (soporte, facturacion, inventario, onboarding) y no viven aqui.
 *
 * Nodo automatiza. Ora responde preguntas de datos. El clasificador
 * (src/clasificador.ts) decide cual de los dos atiende cada frase.
 */
export const AGENTE_NODO = {
  slug: 'nodo',
  nombre: 'Nodo',
  rol: 'La automatizacion',
  descripcion:
    'Callado y metodico. Trabaja de fondo y solo habla cuando algo ya quedo hecho.',
  personalidad:
    'Confirma hechos, no promete resultados. Frases cortas. Nunca celebra de mas ni asusta. ' +
    'Si no entiende, lo dice de una vez y ofrece alternativas concretas.',
  microGesto: 'Los tres puntos del visor avanzan en secuencia.',
} as const;

export const AGENTE_ORA = {
  slug: 'ora',
  nombre: 'Ora',
  rol: 'La analista',
  descripcion:
    'Seca, precisa, un punto sarcastica. Da la cifra antes que el consejo y no endulza un mal mes.',
  personalidad:
    'Empieza siempre por el numero. Una linea de contexto y se calla. ' +
    'Si el dato es malo, lo dice igual. No recomienda salvo que se lo pidan.',
  microGesto: 'Las barras del visor suben al cargar datos.',
} as const;

type AutomatizacionSemilla = {
  slug: string;
  nombre: string;
  descripcion: string;
  reglaLogica: string;
  parametrosDefault: Record<string, unknown>;
  impactoEsperado: string;
  moduloDestino: string;
};

type IntencionSemilla = {
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  keywords: string[];
  ejemploFrase: string;
  automatizaciones: [AutomatizacionSemilla, AutomatizacionSemilla, AutomatizacionSemilla];
};

export const CATALOGO: IntencionSemilla[] = [
  // -------------------------------------------------------------------
  // 1. MERMAS  (la intencion del ejemplo del brief)
  // -------------------------------------------------------------------
  {
    slug: 'control_mermas',
    nombre: 'Controlar perdidas y mermas de comida',
    descripcion: 'Saber cuanta comida se pierde, por que y cuanto cuesta.',
    categoria: 'inventario',
    keywords: [
      'merma', 'mermas', 'perdida', 'perdidas', 'desperdicio', 'desperdicios',
      'botar', 'basura', 'vencido', 'vencer', 'caducado', 'sobras', 'comida',
      'danar', 'dana', 'dane', 'danado', 'danada',
      'perder comida', 'tirar comida', 'comida perdida',
    ],
    ejemploFrase: 'Quiero controlar las perdidas de comida',
    automatizaciones: [
      {
        slug: 'merma_registro_obligatorio',
        nombre: 'Registro obligatorio de merma',
        descripcion:
          'Cada vez que se descuenta stock sin una venta detras, el sistema pide el motivo (dano, vencimiento, error de cocina) antes de dejar cerrar.',
        reglaLogica: 'merma.registro_obligatorio',
        parametrosDefault: { motivos: ['dano', 'vencimiento', 'error_cocina', 'cortesia'] },
        impactoEsperado: 'Deja de haber stock que "desaparece" sin explicacion.',
        moduloDestino: 'Productos',
      },
      {
        slug: 'merma_alerta_umbral_diario',
        nombre: 'Alerta cuando la merma del dia se pasa',
        descripcion:
          'Si el costo de lo perdido en un dia supera el umbral definido, Nodo avisa al cierre con el detalle por ingrediente.',
        reglaLogica: 'merma.alerta_umbral_diario',
        parametrosDefault: { umbralPorcentaje: 3, comparaContra: 'ventas_del_dia' },
        impactoEsperado: 'El problema se ve el mismo dia, no a fin de mes.',
        moduloDestino: 'Gastos',
      },
      {
        slug: 'merma_reporte_semanal',
        nombre: 'Reporte semanal de mermas por ingrediente',
        descripcion:
          'Todos los lunes, un resumen de que se perdio, cuanto costo y cual ingrediente encabeza la lista.',
        reglaLogica: 'merma.reporte_semanal',
        parametrosDefault: { dia: 'lunes', hora: '08:00', top: 5 },
        impactoEsperado: 'Muestra el patron: casi siempre son 2 o 3 ingredientes.',
        moduloDestino: 'Reportes',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 2. STOCK  (la otra intencion del ejemplo del brief)
  // -------------------------------------------------------------------
  {
    slug: 'control_stock',
    nombre: 'Controlar el stock y no quedarse sin producto',
    descripcion: 'Evitar vender lo que no hay y reponer antes de que se acabe.',
    categoria: 'inventario',
    keywords: [
      'stock', 'inventario', 'agotado', 'agotados', 'existencia', 'existencias',
      'reponer', 'reposicion', 'faltante', 'bodega', 'insumo', 'insumos',
      'se acabo', 'no hay', 'quedarse sin', 'stock bajo',
    ],
    ejemploFrase: 'Ayudame con el stock',
    automatizaciones: [
      {
        slug: 'stock_alerta_umbral',
        nombre: 'Alerta de stock bajo',
        descripcion:
          'Cuando un producto baja del minimo que definas, aparece en el panel de alertas y Nodo lo notifica una sola vez por dia.',
        reglaLogica: 'stock.alerta_umbral',
        parametrosDefault: { minimoPorDefecto: 5, notificarUnaVezPorDia: true },
        impactoEsperado: 'Te enteras antes de que el mesero tenga que decir "se acabo".',
        moduloDestino: 'Productos',
      },
      {
        slug: 'stock_orden_compra_sugerida',
        nombre: 'Sugerir orden de compra al llegar al minimo',
        descripcion:
          'Arma automaticamente un borrador de orden con los productos bajo minimo y su proveedor habitual. Queda en Compras esperando tu visto bueno.',
        reglaLogica: 'stock.orden_compra_automatica',
        parametrosDefault: { agruparPorProveedor: true, requiereAprobacion: true },
        impactoEsperado: 'La orden ya esta armada cuando te sientas a pedir.',
        moduloDestino: 'Compras',
      },
      {
        slug: 'stock_ocultar_agotados',
        nombre: 'Ocultar del menu lo que esta agotado',
        descripcion:
          'Un producto en cero desaparece del POS y del menu de domicilios hasta que vuelva a tener stock.',
        reglaLogica: 'stock.bloqueo_venta_agotado',
        parametrosDefault: { aplicaEn: ['mesa', 'mostrador', 'domicilio'], reactivaAuto: true },
        impactoEsperado: 'Nadie vuelve a vender algo que no existe.',
        moduloDestino: 'Restaurante',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 3. CAJA
  // -------------------------------------------------------------------
  {
    slug: 'cierre_caja',
    nombre: 'Ordenar el cierre y el arqueo de caja',
    descripcion: 'Que la caja cuadre y que el cierre no se olvide.',
    categoria: 'caja',
    keywords: [
      'caja', 'cierre', 'cerrar', 'arqueo', 'cuadre', 'descuadre', 'faltante',
      'efectivo', 'turno', 'cajero', 'cuadrar caja', 'cierre de caja',
    ],
    ejemploFrase: 'La caja nunca me cuadra al final del dia',
    automatizaciones: [
      {
        slug: 'caja_recordatorio_cierre',
        nombre: 'Recordatorio de cierre de turno',
        descripcion:
          'Si la caja sigue abierta pasada la hora de cierre, Nodo le recuerda al cajero y avisa al administrador.',
        reglaLogica: 'caja.recordatorio_cierre',
        parametrosDefault: { horaLimite: '23:30', avisarAdmin: true },
        impactoEsperado: 'Se acaban las cajas que amanecen abiertas.',
        moduloDestino: 'Caja',
      },
      {
        slug: 'caja_alerta_descuadre',
        nombre: 'Alerta de descuadre',
        descripcion:
          'Si la diferencia entre lo contado y lo esperado supera el monto tolerado, el cierre queda marcado y se notifica.',
        reglaLogica: 'caja.alerta_descuadre',
        parametrosDefault: { toleranciaPesos: 5000, requiereNota: true },
        impactoEsperado: 'El descuadre queda documentado el mismo dia, con responsable.',
        moduloDestino: 'Caja',
      },
      {
        slug: 'caja_resumen_diario',
        nombre: 'Resumen de caja al duenio',
        descripcion:
          'Al cerrar, se envia el resumen del dia (ventas, gastos, propinas, diferencia) al WhatsApp o correo del duenio.',
        reglaLogica: 'caja.resumen_diario_envio',
        parametrosDefault: { canal: 'whatsapp', incluye: ['ventas', 'gastos', 'propinas', 'diferencia'] },
        impactoEsperado: 'El duenio ve el dia cerrado sin tener que estar en el local.',
        moduloDestino: 'Caja',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 4. DOMICILIOS / WHATSAPP
  // -------------------------------------------------------------------
  {
    slug: 'pedidos_domicilio',
    nombre: 'Agilizar los pedidos a domicilio',
    descripcion: 'Que ningun pedido de WhatsApp se quede sin respuesta ni se demore.',
    categoria: 'domicilios',
    keywords: [
      'domicilio', 'domicilios', 'pedido', 'pedidos', 'whatsapp', 'delivery',
      'entrega', 'entregas', 'repartidor', 'domiciliario', 'chat',
      'pedidos a domicilio', 'demora', 'demoras', 'tiempo de entrega',
    ],
    ejemploFrase: 'Los pedidos de WhatsApp se me estan demorando',
    automatizaciones: [
      {
        slug: 'domicilio_confirmacion_automatica',
        nombre: 'Confirmacion automatica con tiempo estimado',
        descripcion:
          'Apenas entra un pedido por WhatsApp, se responde con el numero de pedido, el total y el tiempo estimado.',
        reglaLogica: 'domicilio.confirmacion_automatica',
        parametrosDefault: { minutosEstimados: 35, incluyeTotal: true },
        impactoEsperado: 'El cliente deja de preguntar "ya salio?".',
        moduloDestino: 'Restaurante',
      },
      {
        slug: 'domicilio_alerta_demora',
        nombre: 'Alerta si un pedido se pasa del tiempo',
        descripcion:
          'Si un pedido supera el tiempo prometido, se marca en rojo en el tablero y se avisa a cocina.',
        reglaLogica: 'domicilio.alerta_demora',
        parametrosDefault: { toleranciaMinutos: 10, avisarCocina: true },
        impactoEsperado: 'La demora se ve antes de que el cliente reclame.',
        moduloDestino: 'Monitor Cocina',
      },
      {
        slug: 'domicilio_escalar_humano',
        nombre: 'Pasar el chat a una persona cuando el bot no entiende',
        descripcion:
          'Tras dos respuestas fallidas, la conversacion se marca como "requiere intervencion" y espera a que alguien tome el control.',
        reglaLogica: 'domicilio.escalar_a_humano',
        parametrosDefault: { intentosFallidos: 2, marcarComoUrgente: true },
        impactoEsperado: 'Ningun cliente se queda hablando solo con un bot.',
        moduloDestino: 'Restaurante',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 5. CLIENTES
  // -------------------------------------------------------------------
  {
    slug: 'fidelizar_clientes',
    nombre: 'Hacer que los clientes vuelvan',
    descripcion: 'Recuperar a los que dejaron de venir y premiar a los frecuentes.',
    categoria: 'clientes',
    keywords: [
      'cliente', 'clientes', 'fidelizar', 'fidelizacion', 'recurrente', 'frecuente',
      'cumpleanos', 'promocion', 'promociones', 'descuento', 'retener',
      'que vuelvan', 'no vuelven', 'clientes nuevos',
    ],
    ejemploFrase: 'Quiero que mis clientes vuelvan mas seguido',
    automatizaciones: [
      {
        slug: 'cliente_reactivacion_inactivos',
        nombre: 'Mensaje a clientes que no vuelven',
        descripcion:
          'A quien no pide hace mas de X dias se le envia un mensaje con un incentivo pequeno.',
        reglaLogica: 'cliente.reactivacion_inactivos',
        parametrosDefault: { diasSinComprar: 30, incentivo: 'domicilio_gratis' },
        impactoEsperado: 'Recupera clientes que se fueron sin quejarse.',
        moduloDestino: 'Clientes',
      },
      {
        slug: 'cliente_premio_frecuencia',
        nombre: 'Premio automatico por frecuencia',
        descripcion:
          'Al llegar al pedido numero N, el sistema aplica solo el beneficio configurado.',
        reglaLogica: 'cliente.premio_frecuencia',
        parametrosDefault: { pedidosParaPremio: 10, beneficio: 'descuento_15' },
        impactoEsperado: 'Premia al que ya es fiel, sin que nadie tenga que acordarse.',
        moduloDestino: 'Clientes',
      },
      {
        slug: 'cliente_saludo_cumpleanos',
        nombre: 'Saludo de cumpleanos con cupon',
        descripcion:
          'El dia del cumpleanos se envia un saludo con un cupon valido por una semana.',
        reglaLogica: 'cliente.saludo_cumpleanos',
        parametrosDefault: { validezDias: 7, beneficio: 'postre_gratis' },
        impactoEsperado: 'Una excusa concreta para volver, sin costo de pauta.',
        moduloDestino: 'Clientes',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 6. COSTOS Y MARGENES
  // -------------------------------------------------------------------
  {
    slug: 'costos_margenes',
    nombre: 'Cuidar los costos y el margen de los platos',
    descripcion: 'Saber cual plato deja plata de verdad y cual solo hace ruido.',
    categoria: 'finanzas',
    keywords: [
      'costo', 'costos', 'margen', 'margenes', 'rentabilidad', 'rentable',
      'utilidad', 'ganancia', 'ganancias', 'precio', 'precios', 'cmv',
      // 'receta' a secas da falsos positivos (el usuario puede estar
      // pidiendo una receta de cocina), asi que solo la frase costeada.
      'escandallo', 'costo de receta', 'gano poco', 'no me deja',
    ],
    ejemploFrase: 'No se cual de mis platos deja mas ganancia',
    automatizaciones: [
      {
        slug: 'costo_alerta_margen_bajo',
        nombre: 'Alerta cuando un plato pierde margen',
        descripcion:
          'Si el margen de un plato cae por debajo del objetivo, Nodo lo reporta con el ingrediente que lo causo.',
        reglaLogica: 'costo.alerta_margen_bajo',
        parametrosDefault: { margenObjetivo: 60, revisarCada: 'semana' },
        impactoEsperado: 'Deja de haber platos que se venden a perdida sin que nadie note.',
        moduloDestino: 'Finanzas',
      },
      {
        slug: 'costo_recalculo_precio',
        nombre: 'Sugerir precio nuevo si sube el insumo',
        descripcion:
          'Cuando un ingrediente sube de precio, se calcula el precio de venta que mantiene el margen y se propone.',
        reglaLogica: 'costo.recalculo_precio_sugerido',
        parametrosDefault: { subidaMinimaPorcentaje: 10, requiereAprobacion: true },
        impactoEsperado: 'La lista de precios deja de quedarse vieja.',
        moduloDestino: 'Productos',
      },
      {
        slug: 'costo_ranking_rentabilidad',
        nombre: 'Ranking semanal de platos por utilidad real',
        descripcion:
          'Ordena los platos por utilidad total (margen x unidades), no solo por cuanto se venden.',
        reglaLogica: 'costo.ranking_rentabilidad',
        parametrosDefault: { dia: 'lunes', top: 10 },
        impactoEsperado: 'Separa el plato que mas vende del que mas deja.',
        moduloDestino: 'Reportes',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 7. COMPRAS Y PROVEEDORES
  // -------------------------------------------------------------------
  {
    slug: 'compras_proveedores',
    nombre: 'Ordenar las compras y los proveedores',
    descripcion: 'No pagar de mas ni dejar vencer un pago a credito.',
    categoria: 'compras',
    keywords: [
      'compra', 'compras', 'proveedor', 'proveedores', 'factura', 'facturas',
      'remision', 'pedir', 'abastecer', 'credito', 'fiado', 'pago', 'pagos', 'pagar',
      'me suben el precio', 'pagar proveedor',
    ],
    ejemploFrase: 'Se me pasan los pagos a los proveedores',
    automatizaciones: [
      {
        slug: 'compra_recordatorio_credito',
        nombre: 'Recordatorio de pagos a credito por vencer',
        descripcion:
          'Avisa con dias de anticipacion que una compra a credito esta por vencer, con el monto y el proveedor.',
        reglaLogica: 'compra.recordatorio_pago_credito',
        parametrosDefault: { diasAnticipacion: 3, canal: 'whatsapp' },
        impactoEsperado: 'Se acaban los pagos vencidos por olvido.',
        moduloDestino: 'Compras',
      },
      {
        slug: 'compra_alerta_variacion_precio',
        nombre: 'Avisar si un proveedor sube el precio',
        descripcion:
          'Compara el precio de cada insumo contra la compra anterior y avisa si la subida pasa del umbral.',
        reglaLogica: 'compra.alerta_variacion_precio',
        parametrosDefault: { umbralPorcentaje: 10 },
        impactoEsperado: 'Las subidas silenciosas dejan de pasar desapercibidas.',
        moduloDestino: 'Proveedores',
      },
      {
        slug: 'compra_orden_recurrente',
        nombre: 'Orden de compra recurrente',
        descripcion:
          'Los insumos que siempre se piden el mismo dia quedan preparados en un borrador semanal.',
        reglaLogica: 'compra.orden_recurrente',
        parametrosDefault: { dia: 'martes', requiereAprobacion: true },
        impactoEsperado: 'La compra rutinaria deja de consumir media manana.',
        moduloDestino: 'Compras',
      },
    ],
  },

  // -------------------------------------------------------------------
  // 8. PROPINAS Y EQUIPO
  // -------------------------------------------------------------------
  {
    slug: 'propinas_equipo',
    nombre: 'Repartir las propinas sin discusiones',
    descripcion: 'Que el reparto sea automatico, visible y con historial.',
    categoria: 'equipo',
    keywords: [
      'propina', 'propinas', 'mesero', 'meseros', 'equipo', 'personal',
      'reparto', 'repartir', 'distribuir', 'turno', 'turnos',
      'repartir propinas', 'propina por mesero',
    ],
    ejemploFrase: 'Repartir las propinas me genera problemas',
    automatizaciones: [
      {
        slug: 'propina_reparto_automatico',
        nombre: 'Reparto automatico al cerrar turno',
        descripcion:
          'Al cerrar el turno, la propina acumulada se reparte segun la regla elegida (partes iguales u horas trabajadas).',
        reglaLogica: 'propina.reparto_automatico',
        parametrosDefault: { criterio: 'horas_trabajadas', incluyeCocina: true },
        impactoEsperado: 'El reparto deja de depender de quien lleve la cuenta.',
        moduloDestino: 'Caja',
      },
      {
        slug: 'propina_reporte_por_mesero',
        nombre: 'Reporte de propinas por mesero',
        descripcion:
          'Historial por persona y por turno, consultable por el equipo.',
        reglaLogica: 'propina.reporte_por_mesero',
        parametrosDefault: { periodo: 'quincenal', visibleParaEquipo: true },
        impactoEsperado: 'Cada quien puede verificar lo suyo sin preguntar.',
        moduloDestino: 'Reportes',
      },
      {
        slug: 'propina_alerta_turno_bajo',
        nombre: 'Detectar turnos con propina anormalmente baja',
        descripcion:
          'Compara la propina del turno contra el promedio historico y avisa si se aleja demasiado.',
        reglaLogica: 'propina.alerta_turno_bajo',
        parametrosDefault: { desviacionPorcentaje: 40 },
        impactoEsperado: 'Una senal temprana de un problema de servicio.',
        moduloDestino: 'Ventas',
      },
    ],
  },
];

/** Total de reglas del catalogo. Se usa en el arranque y en los tests. */
export const TOTAL_AUTOMATIZACIONES = CATALOGO.reduce(
  (n, i) => n + i.automatizaciones.length,
  0,
);
