/* =====================================================================
   ZETHA · Personajes funcionales dentro del POS
   ---------------------------------------------------------------------
   Cada personaje tiene SU PROPIO panel y su propia conversacion.
   No comparten chat: Nodo vive en Automatizaciones, Ora en Analisis,
   igual que Tico vive en Soporte y Bodo en Inventario. Un hilo comun
   con seis personajes seria ilegible.

   Lo que los conecta es la DERIVACION: si a uno le preguntan algo que
   no es suyo, lo dice y ofrece pasar al que corresponde, llevandose la
   frase para que el usuario no la repita.

   Los paneles NO estan en el HTML: se generan desde el catalogo que
   manda el backend. Sumar un personaje es agregar una entrada alli.
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. Avatares
// ---------------------------------------------------------------------
// Segun la hoja de personajes: cabeza cuadrada de esquinas redondeadas,
// VISOR donde ocurre toda la expresion, antena con luz de estado,
// pestanias laterales y placa de torso. Sin cejas, sin boca, sin manos.
// Lo unico que los distingue es el contenido del visor.

function cuerpoRobot(interior, claseLuz) {
  return `
  <ellipse class="n-sombra" cx="60" cy="132" rx="30" ry="5"/>
  <line class="n-antena" x1="60" y1="6" x2="60" y2="22"/>
  <circle class="n-luz ${claseLuz}" cx="60" cy="6" r="5.4"/>
  <rect class="n-oreja" x="6"   y="52" width="10" height="22" rx="5"/>
  <rect class="n-oreja" x="104" y="52" width="10" height="22" rx="5"/>
  <rect class="n-cabeza" x="16" y="24" width="88" height="72" rx="22"/>
  <rect class="n-visor"  x="30" y="42" width="60" height="34" rx="13"/>
  ${interior}
  <g class="n-error">
    <line x1="43" y1="55" x2="53" y2="62"/>
    <line x1="77" y1="55" x2="67" y2="62"/>
  </g>
  <rect class="n-placa" x="34" y="102" width="52" height="22" rx="9"/>
  <rect class="n-guion" x="50" y="110" width="20" height="5" rx="2.5"/>`;
}

/** Nodo: tres puntos. Micro-gesto: avanzan en secuencia. */
const AVATAR_NODO = cuerpoRobot(
  `<g class="n-puntos">
     <rect class="n-punto" x="41"   y="55" width="9" height="8" rx="2.4"/>
     <rect class="n-punto" x="55.5" y="55" width="9" height="8" rx="2.4"/>
     <rect class="n-punto" x="70"   y="55" width="9" height="8" rx="2.4"/>
   </g>`,
  'luz-nodo',
);

/** Ora: barras. Micro-gesto: suben al cargar datos. */
const AVATAR_ORA = cuerpoRobot(
  `<g class="o-barras">
     <rect class="o-barra" x="42"   y="60" width="7" height="7"  rx="2"/>
     <rect class="o-barra" x="53.5" y="56" width="7" height="11" rx="2"/>
     <rect class="o-barra" x="65"   y="51" width="7" height="16" rx="2"/>
   </g>`,
  'luz-ora',
);

const AVATARES = { nodo: AVATAR_NODO, ora: AVATAR_ORA };

function avatar(slug, estado = 'neutro') {
  return `<svg class="avatar" data-agente="${slug}" data-estado="${estado}"
    viewBox="0 0 120 140" role="img" aria-label="${slug}">${AVATARES[slug]}</svg>`;
}

/** Cambia el estado del visor de un personaje (en todas sus apariciones). */
function estadoVisor(slug, estado) {
  document
    .querySelectorAll(`.avatar[data-agente="${slug}"]`)
    .forEach((svg) => svg.setAttribute('data-estado', estado));
}

// ---------------------------------------------------------------------
// 2. Utilidades
// ---------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

async function api(ruta, opciones) {
  const res = await fetch(ruta, opciones);
  if (!res.ok && res.status >= 500) throw new Error('El servidor no respondio.');
  return res.json();
}

// ---------------------------------------------------------------------
// 3. Memoria local de activaciones
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
    try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; }
  },
  guardar(a) {
    const act = memoriaLocal.leer();
    if (act.some((x) => x.automatizacionId === a.automatizacionId)) return;
    act.unshift(a);
    localStorage.setItem(CLAVE, JSON.stringify(act));
  },
  ids() { return new Set(memoriaLocal.leer().map((a) => a.automatizacionId)); },
};

// ---------------------------------------------------------------------
// 4. Registro de personajes (se llena desde /api/catalogo)
// ---------------------------------------------------------------------

/** slug -> { def, panel, cuerpo, entrada, saludado } */
const AGENTES = new Map();
let abierto = null;

/**
 * Construye el panel de un personaje. Mismo esqueleto para todos: lo
 * unico que cambia es el avatar, el tema de color y sus ejemplos.
 */
function construirPanel(def) {
  const panel = crear('section', `panel tema-${def.slug}`);
  panel.id = `panel-${def.slug}`;
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <header class="panel-cabecera">
      <div class="panel-avatar">${avatar(def.slug)}</div>
      <div class="panel-id">
        <p class="panel-nombre">${def.nombre}</p>
        <p class="panel-rol">${def.rol} &middot; ${def.modulo}</p>
      </div>
      <button class="panel-cerrar" aria-label="Cerrar">&times;</button>
    </header>
    <div class="panel-cuerpo"></div>
    <form class="panel-entrada">
      <input type="text" autocomplete="off" placeholder="${def.placeholder}">
      <button type="submit" aria-label="Enviar">&rarr;</button>
    </form>`;

  document.body.append(panel);

  const estado = {
    def,
    panel,
    cuerpo: panel.querySelector('.panel-cuerpo'),
    entrada: panel.querySelector('input'),
    saludado: false,
  };

  panel.querySelector('.panel-cerrar').addEventListener('click', cerrarPanel);
  panel.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = estado.entrada.value;
    estado.entrada.value = '';
    enviar(def.slug, v);
  });

  AGENTES.set(def.slug, estado);
  return estado;
}

/** Boton flotante por personaje. El dock crece con el elenco. */
function construirDock(defs) {
  const dock = $('#dock');
  dock.innerHTML = '';
  defs.forEach((def) => {
    const b = crear('button', 'dock-boton');
    b.title = `${def.nombre} · ${def.rol}`;
    b.setAttribute('aria-label', def.nombre);
    b.innerHTML = `<span class="dock-avatar">${avatar(def.slug)}</span>
                   <span class="dock-nombre">${def.nombre}</span>`;
    b.addEventListener('click', () => abrirAgente(def.slug));
    dock.append(b);
  });
}

function abrirAgente(slug, frase) {
  if (abierto && abierto !== slug) cerrarPanel();

  const a = AGENTES.get(slug);
  if (!a) return;

  a.panel.classList.add('abierto');
  a.panel.setAttribute('aria-hidden', 'false');
  $('#dock').classList.add('oculto');
  abierto = slug;

  if (!a.saludado) { a.saludado = true; saludar(slug); }
  if (frase) enviar(slug, frase);
  else a.entrada.focus();
}

function cerrarPanel() {
  if (!abierto) return;
  const a = AGENTES.get(abierto);
  a.panel.classList.remove('abierto');
  a.panel.setAttribute('aria-hidden', 'true');
  $('#dock').classList.remove('oculto');
  abierto = null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarPanel();
});

// ---------------------------------------------------------------------
// 5. Conversacion
// ---------------------------------------------------------------------

const alFinal = (a) => { a.cuerpo.scrollTop = a.cuerpo.scrollHeight; };

function burbuja(slug, texto) {
  const a = AGENTES.get(slug);
  const b = crear('div', `burbuja burbuja-agente`, texto);
  a.cuerpo.append(b);
  alFinal(a);
  return b;
}

function burbujaUsuario(slug, texto) {
  const a = AGENTES.get(slug);
  a.cuerpo.append(crear('div', 'burbuja burbuja-usuario', texto));
  alFinal(a);
}

function chips(slug, frases) {
  const a = AGENTES.get(slug);
  const cont = crear('div', 'chips');
  frases.forEach((f) => {
    const c = crear('button', 'chip', f);
    c.addEventListener('click', () => enviar(slug, f));
    cont.append(c);
  });
  a.cuerpo.append(cont);
  alFinal(a);
}

/** Boton de derivacion: cierra este panel y abre el del otro personaje. */
function botonDerivar(slug, derivacion) {
  const a = AGENTES.get(slug);
  const b = crear('button', `derivar derivar-${derivacion.agente}`);
  b.innerHTML = `<span class="derivar-avatar">${avatar(derivacion.agente)}</span>
                 <span>${derivacion.etiqueta}</span>
                 <span class="derivar-flecha">&rarr;</span>`;
  b.addEventListener('click', () => abrirAgente(derivacion.agente, derivacion.texto));
  a.cuerpo.append(b);
  alFinal(a);
}

function saludar(slug) {
  const { def } = AGENTES.get(slug);
  burbuja(slug, def.descripcion);
  burbuja(slug,
    slug === 'nodo'
      ? `Manejo ${def.capacidades} areas de automatizacion. Dime que te esta costando trabajo.`
      : `Tengo ${def.capacidades} consultas sobre tus datos. Pregunta.`);
  chips(slug, def.ejemplos.slice(0, 3).map((e) => e.frase));
}

async function enviar(slug, texto) {
  const limpio = (texto || '').trim();
  if (!limpio) return;

  const a = AGENTES.get(slug);
  burbujaUsuario(slug, limpio);

  estadoVisor(slug, 'pensando');
  const pensando = burbuja(slug, '…');
  await esperar(550);

  let r;
  try {
    r = await api('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agente: slug, texto: limpio }),
    });
  } catch {
    pensando.remove();
    estadoVisor(slug, 'error');
    burbuja(slug, 'No pude responder. Revisa que el servidor siga corriendo.');
    return;
  }

  pensando.remove();
  estadoVisor(slug, r.visor);
  burbuja(slug, r.mensaje);

  // Tabla de respaldo de Ora: la cifra ya va en el mensaje, aqui va el detalle.
  if (r.resultado && r.resultado.filas.length) {
    const t = crear('div', 'ora-filas');
    r.resultado.filas.forEach((f) => {
      const fila = crear('div', 'ora-fila');
      fila.append(crear('span', null, f.etiqueta), crear('span', 'ora-valor', f.valor));
      t.append(fila);
    });
    a.cuerpo.append(t);
  }

  if (r.senales.length) {
    a.cuerpo.append(crear('p', 'evidencia', `senales: ${r.senales.slice(0, 4).join(', ')}`));
  }

  if (r.automatizaciones) {
    const n = r.automatizaciones;
    a.cuerpo.append(crear('p', 'evidencia',
      `detectado por: ${n.evidencia.join(', ')} · confianza ${Math.round(n.confianza * 100)}%`));

    const locales = servidorPersiste ? new Set() : memoriaLocal.ids();
    n.opciones.forEach((op) =>
      a.cuerpo.append(tarjetaOpcion(slug, { ...op, yaActiva: op.yaActiva || locales.has(op.id) })));
  }

  if (r.derivacion) botonDerivar(slug, r.derivacion);
  if (r.sugerencias.length) chips(slug, r.sugerencias);

  alFinal(a);
}

/** Una de las 3 plantillas del menu de Nodo. */
function tarjetaOpcion(slug, op) {
  const t = crear('div', 'opcion');

  const cab = crear('div', 'opcion-cabecera');
  cab.append(crear('p', 'opcion-nombre', op.nombre), crear('span', 'opcion-modulo', op.moduloDestino));

  const pie = crear('div', 'opcion-pie');
  const boton = crear('button', 'boton-activar', op.yaActiva ? 'Ya activa' : 'Activar');
  boton.disabled = op.yaActiva;
  boton.addEventListener('click', () => activar(slug, op, boton));
  pie.append(crear('span', 'opcion-regla', op.reglaLogica), boton);

  t.append(cab, crear('p', 'opcion-desc', op.descripcion),
           crear('p', 'opcion-impacto', op.impactoEsperado), pie);
  return t;
}

async function activar(slug, op, boton) {
  const a = AGENTES.get(slug);
  boton.disabled = true;
  boton.textContent = 'Activando…';
  estadoVisor(slug, 'pensando');
  await esperar(400);

  const r = await api('/api/activar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ automatizacionId: op.id }),
  });

  if (!r.ok) {
    estadoVisor(slug, 'error');
    boton.disabled = false;
    boton.textContent = 'Activar';
    burbuja(slug, r.mensaje);
    return;
  }

  estadoVisor(slug, 'hecho');
  boton.textContent = 'Ya activa';

  servidorPersiste = r.persistente;
  if (!servidorPersiste) memoriaLocal.guardar(r.activacion);

  const conf = crear('div', 'confirmacion');
  conf.append(
    crear('p', 'confirmacion-titulo', 'Hecho'),
    crear('p', 'confirmacion-texto', r.mensaje),
    crear('pre', 'confirmacion-params', JSON.stringify(r.activacion.parametros, null, 2)),
  );
  a.cuerpo.append(conf);
  alFinal(a);

  // Nodo vuelve al reposo: solo hablo porque algo ya quedo hecho.
  setTimeout(() => estadoVisor(slug, 'neutro'), 2400);

  if (!$('#vista-automatizaciones').classList.contains('oculta')) cargarActivas();
}

// ---------------------------------------------------------------------
// 6. Navegacion entre vistas del POS
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
  const [t, b] = TITULOS[vista];
  $('#topbar-titulo').innerHTML = '';
  $('#topbar-titulo').append(crear('h1', null, t), crear('p', null, b));
  if (vista === 'automatizaciones') cargarActivas();
}

document.querySelectorAll('.nav-item[data-vista]').forEach((b) => {
  b.addEventListener('click', () => irA(b.dataset.vista));
});

async function cargarActivas() {
  const lista = $('#lista-activas');
  const r = await api('/api/activaciones');
  servidorPersiste = r.persistente;
  const activas = servidorPersiste ? r.activaciones : memoriaLocal.leer();

  lista.innerHTML = '';
  if (!activas.length) {
    lista.append(crear('p', 'texto-vacio', 'Todavia no hay reglas activas. Pidele una a Nodo.'));
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

// ---------------------------------------------------------------------
// 7. Arranque
// ---------------------------------------------------------------------

async function arrancar() {
  const cat = await api('/api/catalogo');
  servidorPersiste = cat.persistente;

  cat.agentes.forEach(construirPanel);
  construirDock(cat.agentes);

  // Tarjetas de entrada del dashboard, una por personaje.
  const tarjetas = $('#tarjetas-agentes');
  tarjetas.innerHTML = '';
  cat.agentes.forEach((def) => {
    const t = crear('article', `tarjeta tarjeta-agente tema-${def.slug}`);
    t.innerHTML = `
      <div class="agente-mini">${avatar(def.slug)}</div>
      <p class="eyebrow">${def.nombre} &middot; ${def.rol}</p>
      <p class="texto">${def.descripcion}</p>`;
    const b = crear('button', 'boton-primario', `Hablar con ${def.nombre}`);
    b.addEventListener('click', () => abrirAgente(def.slug));
    t.append(b);
    tarjetas.append(t);
  });

  // Catalogo: una fila de ejemplos por personaje.
  const cont = $('#catalogo-agentes');
  cont.innerHTML = '';
  cat.agentes.forEach((def) => {
    cont.append(crear('p', 'eyebrow eyebrow-sec',
      `${def.nombre} · ${def.slug === 'nodo' ? cat.totalReglas + ' reglas' : cat.totalConsultas + ' consultas'}`));
    const fila = crear('div', 'chips');
    def.ejemplos.forEach((e) => {
      const c = crear('button', `chip chip-${def.slug}`, e.nombre);
      c.addEventListener('click', () => abrirAgente(def.slug, e.frase));
      fila.append(c);
    });
    cont.append(fila);
  });

  $('#resumen-catalogo').textContent =
    `${cat.totalReglas} reglas de automatizacion y ${cat.totalConsultas} consultas de datos. ` +
    `Cada personaje responde solo de lo suyo y deriva al otro cuando toca.`;

  // Atajos desde los modulos del POS.
  document.querySelectorAll('[data-abrir]').forEach((b) => {
    b.addEventListener('click', () => abrirAgente(b.dataset.abrir, b.dataset.frase));
  });

  irA('dashboard');
}

arrancar();
