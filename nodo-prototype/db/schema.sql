-- =====================================================================
-- ZETHA · Modulo de Automatizaciones ("Nodo")
-- Esquema de referencia para PostgreSQL / Supabase
-- ---------------------------------------------------------------------
-- Este archivo es el DISENO OFICIAL de produccion.
-- El prototipo local corre sobre SQLite (db/schema.sqlite.sql), que es
-- una traduccion 1:1 de este archivo. Ver la tabla de equivalencias en
-- DESIGN.md, seccion "Portabilidad Postgres -> SQLite".
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. agentes
-- ---------------------------------------------------------------------
-- OJO: esta tabla NO es el roster de branding de Zetha.
-- Zeta, Ora, Tico, Sello y Bodo son mascotas de marca ligadas a otras
-- areas del producto (onboarding, reportes, soporte, facturacion,
-- inventario) y NO viven aqui ni participan de este flujo.
-- Esta tabla lista unicamente a los personajes que EJECUTAN un flujo
-- intencion -> automatizacion. Hoy hay exactamente uno: Nodo.
-- Se deja como tabla (y no como constante) para que en el futuro otro
-- personaje funcional pueda sumarse al mismo mecanismo sin migracion.
-- ---------------------------------------------------------------------
create table if not exists agentes (
  id            uuid primary key default gen_random_uuid(),
  slug          text        not null unique,           -- 'nodo'
  nombre        text        not null,                  -- 'Nodo'
  rol           text        not null,                  -- 'La automatizacion'
  descripcion   text        not null,
  personalidad  text        not null,                  -- guia de tono para sus mensajes
  micro_gesto   text        not null,                  -- animacion firma del personaje
  activo        boolean     not null default true,
  creado_en     timestamptz not null default now()
);

comment on table agentes is
  'Personajes con capacidad de ejecutar flujos intencion->automatizacion. No es el roster de branding.';

-- ---------------------------------------------------------------------
-- 2. intenciones
-- ---------------------------------------------------------------------
-- Lo que el usuario quiere lograr, expresado en lenguaje natural.
-- La columna keywords alimenta el motor de coincidencia
-- (src/matchingEngine.ts). Una keyword puede ser una palabra ('merma')
-- o una frase ('perder comida').
-- ---------------------------------------------------------------------
create table if not exists intenciones (
  id            uuid primary key default gen_random_uuid(),
  agente_id     uuid        not null references agentes(id) on delete cascade,
  slug          text        not null unique,           -- 'control_mermas'
  nombre        text        not null,                  -- 'Controlar perdidas y mermas'
  descripcion   text        not null,
  categoria     text        not null,                  -- modulo del POS: 'inventario', 'caja', ...
  keywords      jsonb       not null default '[]'::jsonb,
  ejemplo_frase text        not null,                  -- se muestra como chip sugerido en la UI
  activo        boolean     not null default true,
  creado_en     timestamptz not null default now()
);

-- Busqueda por keyword del lado de la base (opcional; el prototipo
-- puntua en memoria porque el catalogo es pequeno y cabe en cache).
create index if not exists idx_intenciones_keywords on intenciones using gin (keywords);
create index if not exists idx_intenciones_agente   on intenciones (agente_id) where activo;

-- ---------------------------------------------------------------------
-- 3. automatizaciones_preestablecidas
-- ---------------------------------------------------------------------
-- Las PLANTILLAS FIJAS. Nunca se generan dinamicamente: son reglas que
-- el equipo de Zetha define, prueba y versiona. Cada intencion expone
-- exactamente 3 (el menu que Nodo presenta al usuario).
--
-- regla_logica es el identificador simbolico que el POS resuelve a un
-- handler real (ej. 'stock.alerta_umbral' -> handlers/stock/alertaUmbral).
-- Nunca se ejecuta codigo arbitrario: es un despacho contra un mapa fijo.
-- ---------------------------------------------------------------------
create table if not exists automatizaciones_preestablecidas (
  id                 uuid primary key default gen_random_uuid(),
  intencion_id       uuid        not null references intenciones(id) on delete cascade,
  slug               text        not null unique,
  nombre             text        not null,
  descripcion        text        not null,
  regla_logica       text        not null,             -- 'stock.alerta_umbral'
  parametros_default jsonb       not null default '{}'::jsonb,
  impacto_esperado   text        not null,             -- copy honesto que Nodo muestra en la tarjeta
  modulo_destino     text        not null,             -- donde se ve el efecto: 'Productos', 'Caja', ...
  orden              smallint    not null default 1,   -- posicion en el menu (1..3)
  activo             boolean     not null default true,
  creado_en          timestamptz not null default now()
);

create index if not exists idx_autom_intencion
  on automatizaciones_preestablecidas (intencion_id, orden) where activo;

-- ---------------------------------------------------------------------
-- 4. automatizaciones_activas
-- ---------------------------------------------------------------------
-- Paso 4 del flujo: la regla que el usuario eligio y quedo encendida
-- para SU restaurante. Es la unica tabla que escribe el usuario final.
-- ---------------------------------------------------------------------
create table if not exists automatizaciones_activas (
  id                uuid primary key default gen_random_uuid(),
  automatizacion_id uuid        not null references automatizaciones_preestablecidas(id) on delete restrict,
  restaurante_id    uuid,                              -- multi-tenant; null en el prototipo
  parametros        jsonb       not null default '{}'::jsonb,  -- default + overrides del usuario
  estado            text        not null default 'activa'
                    check (estado in ('activa', 'pausada', 'archivada')),
  activada_en       timestamptz not null default now(),
  activada_por      text,                              -- usuario que la encendio
  -- una misma plantilla no se enciende dos veces en el mismo restaurante
  unique (restaurante_id, automatizacion_id)
);

create index if not exists idx_activas_restaurante
  on automatizaciones_activas (restaurante_id) where estado = 'activa';

-- ---------------------------------------------------------------------
-- 5. conversaciones_nodo  (telemetria)
-- ---------------------------------------------------------------------
-- Registro de que escribio el usuario y que entendio el motor.
-- Es la materia prima para mejorar las keywords: toda frase que cae en
-- 'sin_match' es una intencion que falta o una keyword que falta.
-- ---------------------------------------------------------------------
create table if not exists conversaciones_nodo (
  id                uuid primary key default gen_random_uuid(),
  texto_usuario     text        not null,
  intencion_id      uuid        references intenciones(id) on delete set null,
  confianza         numeric(4,3),                      -- 0.000 .. 1.000
  resultado         text        not null
                    check (resultado in ('match', 'sin_match')),
  creado_en         timestamptz not null default now()
);

create index if not exists idx_conv_sin_match
  on conversaciones_nodo (creado_en desc) where resultado = 'sin_match';

-- ---------------------------------------------------------------------
-- Notas para Supabase
-- ---------------------------------------------------------------------
-- - agentes / intenciones / automatizaciones_preestablecidas son
--   CATALOGO: solo lectura para el cliente. RLS con policy de SELECT
--   para authenticated, escritura reservada al service_role.
-- - automatizaciones_activas y conversaciones_nodo son datos del
--   inquilino: RLS filtrando por restaurante_id contra el JWT.
--
--   alter table automatizaciones_activas enable row level security;
--   create policy "activas del propio restaurante"
--     on automatizaciones_activas for all
--     using (restaurante_id = (auth.jwt() ->> 'restaurante_id')::uuid);
-- =====================================================================
