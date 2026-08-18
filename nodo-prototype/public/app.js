/* =====================================================================
   ZETHA · Prototipo del modulo de automatizaciones
   Front del asistente Nodo. Sin frameworks: el objetivo es que se lea
   como una maqueta, no como una app que haya que mantener.
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. Avatar de Nodo
// ---------------------------------------------------------------------
// Construido segun la hoja de personajes: cabeza cuadrada de esquinas
// redondeadas, visor donde ocurre TODA la expresion, antena con luz de
// estado, pestanias laterales y placa de torso.
// Los tres puntos del visor son la firma que lo distingue de Zeta (dos
// ojos), Ora (barras) o Bodo (barra ancha).

function avatarNodo(estado = 'neutro') {
  return `
<svg class="avatar-nodo" data-estado="${estado}" viewBox="0 0 120 140" role="img" aria-label="Nodo">
  <ellipse class="n-sombra" cx="60" cy="132" rx="30" ry="5"/>

  <!-- antena + luz de estado -->
  <line class="n-antena" x1="60" y1="6" x2="60" y2="22"/>
  <circle class="n-luz" cx="60" cy="6" r="5.4"/>

  <!-- pestanias laterales -->
  <rect class="n-oreja" x="6"   y="52" width="10" height="22" rx="5"/>
  <rect class="n-oreja" x="104" y="52" width="10" height="22" rx="5"/>

  <!-- cabeza -->
  <rect class="n-cabeza" x="16" y="24" width="88" height="72" rx="22"/>

  <!-- visor: unica zona de expresion -->
  <rect class="n-visor" x="30" y="42" width="60" height="34" rx="13"/>

  <!-- neutro / pensando / hecho: tres puntos -->
  <g class="n-puntos">
    <rect class="n-punto" x="41" y="55" width="9" height="8" rx="2.4"/>
    <rect class="n-punto" x="55.5" y="55" width="9" height="8" rx="2.4"/>
    <rect class="n-punto" x="70" y="55" width="9" height="8" rx="2.4"/>
  </g>

  <!-- error: dos trazos -->
  <g class="n-error">
    <line x1="43" y1="55" x2="53" y2="62"/>
    <line x1="77" y1="55" x2="67" y2="62"/>
  </g>

  <!-- placa de torso -->
  <rect class="n-placa" x="34" y="102" width="52" height="22" rx="9"/>
  <rect class="n-guion" x="50" y="110" width="20" height="5" rx="2.5"/>
</svg>`;
}

/** Cambia el estado del visor de todos los avatares en pantalla. */
function estadoVisor(estado) {
  document
    .querySelectorAll('.avatar-nodo')
    .forEach((svg) => svg.setAttribute('data-estado', estado));
}

// ---------------------------------------------------------------------
// 2. Utilidades
// ---------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const cuerpo = $('#cuerpo');
const panel = $('#panel');
const lanzador = $('#lanzador');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function alFinal() {
  cuerpo.scrollTop = cuerpo.scrollHeight;
}

async function api(ruta, opciones) {
  const res = await fetch(ruta, opciones);
  if (!res.ok && res.status >= 500) throw new Error('El servidor no respondio.');
  return res.json();
}

// ---------------------------------------------------------------------
// 2b. Memoria local de activaciones
// ---------------------------------------------------------------------
// En local el servidor guarda en SQLite y es la fuente de verdad.
// En Vercel las funciones son serverless y no tienen disco: ahi el
// servidor responde `persistente: false` y el navegador se encarga.
// Los ids del catalogo son slugs estables, asi que lo guardado sigue
// siendo valido entre despliegues.

const CLAVE = 'zetha.nodo.activaciones';
let servidorPersiste = true;

const memoriaLocal = {
  leer() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) || '[]');
    } catch {
      return [];
    }
  },
  guardar(activacion) {
    const actuales = memoriaLocal.leer();
    if (actuales.some((a) => a.automatizacionId === activacion.automatizacionId)) return;
    actuales.unshift(activacion);
    localStorage.setItem(CLAVE, JSON.stringify(actuales));
  },
  ids() {
    return new Set(memoriaLocal.leer().map((a) => a.automatizacionId));
  },
};

// ---------------------------------------------------------------------
// 3. Navegacion entre vistas del POS
// ---------------------------------------------------------------------

const TITULOS = {
  dashboard: ['Dashboard', 'Panel de control y metricas clave'],
  productos: ['Productos', 'Ingredientes, modificadores y stock'],
  automatizaciones: ['Automatizaciones', 'Reglas que Nodo mantiene encendidas'],
};

function irA(vista) {
  document.querySelectorAll('.vista').forEach((s) => s.classList.add('oculta'));
  $(`#vista-${vista}`).classList.remove('oculta');

  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('activo', b.dataset.vista === vista);
  });

  const [titulo, bajada] = TITULOS[vista];
  $('#topbar-titulo').innerHTML = '';
  $('#topbar-titulo').append(crear('h1', null, titulo), crear('p', null, bajada));

  if (vista === 'automatizaciones') cargarActivas();
}

document.querySelectorAll('.nav-item[data-vista]').forEach((boton) => {
  boton.addEventListener('click', () => irA(boton.dataset.vista));
});

// ---------------------------------------------------------------------
// 4. Panel de Nodo: abrir / cerrar
// ---------------------------------------------------------------------

let saludoHecho = false;

function abrirPanel(fraseInicial) {
  panel.classList.add('abierto');
  panel.setAttribute('aria-hidden', 'false');
  lanzador.classList.add('oculto');

  if (!saludoHecho) {
    saludoHecho = true;
    saludar();
  }
  if (fraseInicial) {
    $('#entrada').value = fraseInicial;
    enviar(fraseInicial);
  } else {
    $('#entrada').focus();
  }
}

function cerrarPanel() {
  panel.classList.remove('abierto');
  panel.setAttribute('aria-hidden', 'true');
  lanzador.classList.remove('oculto');
}

lanzador.addEventListener('click', () => abrirPanel());
$('#cerrar').addEventListener('click', cerrarPanel);

document.querySelectorAll('[data-abrir-nodo]').forEach((boton) => {
  boton.addEventListener('click', () => abrirPanel(boton.dataset.frase));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panel.classList.contains('abierto')) cerrarPanel();
});

// ---------------------------------------------------------------------
// 5. Conversacion
// ---------------------------------------------------------------------

function burbujaNodo(texto) {
  const b = crear('div', 'burbuja burbuja-nodo', texto);
  cuerpo.append(b);
  alFinal();
  return b;
}

function burbujaUsuario(texto) {
  cuerpo.append(crear('div', 'burbuja burbuja-usuario', texto));
  alFinal();
}

function chipsSugeridos(frases) {
  const cont = crear('div', 'chips');
  frases.forEach((frase) => {
    const chip = crear('button', 'chip', frase);
    chip.addEventListener('click', () => enviar(frase));
    cont.append(chip);
  });
  cuerpo.append(cont);
  alFinal();
}

/**
 * Saludo inicial. Nodo se presenta y muestra de que sabe.
 * Es el paso 3 del flujo del brief.
 */
async function saludar() {
  const catalogo = await api('/api/nodo/catalogo');
  servidorPersiste = catalogo.persistente;
  $('#panel-rol').textContent = catalogo.agente.rol;

  burbujaNodo(
    `Soy Nodo. Manejo ${catalogo.totalReglas} reglas de automatizacion, ` +
      `repartidas en ${catalogo.totalIntenciones} areas del negocio.`,
  );
  burbujaNodo('Dime que te esta costando trabajo y te muestro lo que tengo.');
  chipsSugeridos(catalogo.intenciones.slice(0, 4).map((i) => i.ejemploFrase));
}

/** Flujo completo: escribir -> detectar -> presentar menu. */
async function enviar(texto) {
  const limpio = texto.trim();
  if (!limpio) return;

  burbujaUsuario(limpio);
  $('#entrada').value = '';

  // Micro-gesto: los tres puntos avanzan en secuencia mientras piensa.
  estadoVisor('pensando');
  const pensando = burbujaNodo('…');
  await esperar(650);

  let r;
  try {
    r = await api('/api/nodo/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto: limpio }),
    });
  } catch {
    pensando.remove();
    estadoVisor('error');
    burbujaNodo('No pude consultar el catalogo. Revisa que el servidor siga corriendo.');
    return;
  }

  pensando.remove();
  estadoVisor(r.visor);
  burbujaNodo(r.mensaje);

  if (r.estado === 'sin_match') {
    burbujaNodo('Puedo con esto, por ejemplo:');
    chipsSugeridos(r.sugerencias);
    return;
  }

  // Trazabilidad: por que entendio lo que entendio.
  cuerpo.append(
    crear(
      'p',
      'evidencia',
      `detectado por: ${r.evidencia.join(', ')} · confianza ${Math.round(r.confianza * 100)}%`,
    ),
  );

  // Si el servidor no persiste, el navegador sabe mejor que el que ya esta activo.
  const locales = servidorPersiste ? new Set() : memoriaLocal.ids();
  r.opciones.forEach((op) =>
    cuerpo.append(tarjetaOpcion({ ...op, yaActiva: op.yaActiva || locales.has(op.id) })),
  );

  if (r.alternativas.length) {
    burbujaNodo('Si no era esto, tambien manejo:');
    chipsSugeridos(r.alternativas.map((a) => a.ejemploFrase));
  }
  alFinal();
}

/** Una de las 3 plantillas del menu. */
function tarjetaOpcion(op) {
  const tarjeta = crear('div', 'opcion');

  const cabecera = crear('div', 'opcion-cabecera');
  cabecera.append(
    crear('p', 'opcion-nombre', op.nombre),
    crear('span', 'opcion-modulo', op.moduloDestino),
  );

  const pie = crear('div', 'opcion-pie');
  const boton = crear('button', 'boton-activar', op.yaActiva ? 'Ya activa' : 'Activar');
  boton.disabled = op.yaActiva;
  boton.addEventListener('click', () => activar(op, boton));
  pie.append(crear('span', 'opcion-regla', op.reglaLogica), boton);

  tarjeta.append(
    cabecera,
    crear('p', 'opcion-desc', op.descripcion),
    crear('p', 'opcion-impacto', op.impactoEsperado),
    pie,
  );
  return tarjeta;
}

/** Paso 4: activar la regla elegida en el POS. */
async function activar(op, boton) {
  boton.disabled = true;
  boton.textContent = 'Activando…';
  estadoVisor('pensando');
  await esperar(450);

  const r = await api('/api/nodo/activar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ automatizacionId: op.id }),
  });

  if (!r.ok) {
    estadoVisor('error');
    boton.disabled = false;
    boton.textContent = 'Activar';
    burbujaNodo(r.mensaje);
    return;
  }

  estadoVisor('hecho');
  boton.textContent = 'Ya activa';

  servidorPersiste = r.persistente;
  if (!servidorPersiste) memoriaLocal.guardar(r.activacion);

  const conf = crear('div', 'confirmacion');
  conf.append(
    crear('p', 'confirmacion-titulo', 'Hecho'),
    crear('p', 'confirmacion-texto', r.mensaje),
    crear('pre', 'confirmacion-params', JSON.stringify(r.activacion.parametros, null, 2)),
  );
  cuerpo.append(conf);
  alFinal();

  // Nodo vuelve a su reposo: solo hablo porque algo ya quedo hecho.
  setTimeout(() => estadoVisor('neutro'), 2600);

  if (!$('#vista-automatizaciones').classList.contains('oculta')) cargarActivas();
}

$('#formulario').addEventListener('submit', (e) => {
  e.preventDefault();
  enviar($('#entrada').value);
});

// ---------------------------------------------------------------------
// 6. Vista de automatizaciones activas
// ---------------------------------------------------------------------

async function cargarActivas() {
  const lista = $('#lista-activas');
  const r = await api('/api/nodo/activaciones');
  servidorPersiste = r.persistente;

  // Con servidor sin disco, la lista real la tiene el navegador.
  const activas = servidorPersiste ? r.activaciones : memoriaLocal.leer();

  lista.innerHTML = '';
  if (!activas.length) {
    lista.append(
      crear('p', 'texto-vacio', 'Todavia no hay reglas activas. Pidele una a Nodo.'),
    );
    return;
  }

  activas.forEach((a) => {
    const fila = crear('div', 'regla-activa');
    const info = crear('div');
    info.append(
      crear('p', 'regla-nombre', a.nombre),
      crear('p', 'regla-meta', `${a.intencion} · se ve en ${a.moduloDestino}`),
      crear('p', 'regla-codigo', a.reglaLogica),
    );
    fila.append(crear('div', 'regla-punto'), info);
    lista.append(fila);
  });
}

async function cargarResumenCatalogo() {
  const catalogo = await api('/api/nodo/catalogo');
  servidorPersiste = catalogo.persistente;
  $('#resumen-catalogo').textContent =
    `${catalogo.totalReglas} reglas preestablecidas en ${catalogo.totalIntenciones} areas. ` +
    `Toca una para ver sus tres opciones.`;

  const chips = $('#chips-catalogo');
  chips.innerHTML = '';
  catalogo.intenciones.forEach((i) => {
    const chip = crear('button', 'chip', i.nombre);
    chip.addEventListener('click', () => abrirPanel(i.ejemploFrase));
    chips.append(chip);
  });
}

// ---------------------------------------------------------------------
// 7. Arranque
// ---------------------------------------------------------------------

$('#nodo-tarjeta').innerHTML = avatarNodo('neutro');
$('#nodo-panel').innerHTML = avatarNodo('neutro');
$('#nodo-lanzador').innerHTML = avatarNodo('neutro');

irA('dashboard');
cargarResumenCatalogo();
