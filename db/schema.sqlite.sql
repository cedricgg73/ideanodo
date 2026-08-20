-- =====================================================================
-- Traduccion 1:1 de db/schema.sql (Postgres/Supabase) a SQLite.
-- SOLO para que el prototipo corra en local sin credenciales de nube.
-- El diseno de verdad vive en db/schema.sql.
--
-- Equivalencias aplicadas:
--   uuid          -> text        (uuid generado en JS con crypto.randomUUID)
--   jsonb         -> text        (JSON serializado; se parsea al leer)
--   timestamptz   -> text        (ISO-8601 UTC)
--   boolean       -> integer     (0 / 1)
--   numeric(4,3)  -> real
--   indices GIN / parciales -> indices B-tree simples
-- =====================================================================

pragma foreign_keys = on;

create table if not exists agentes (
  id            text    primary key,
  slug          text    not null unique,
  nombre        text    not null,
  rol           text    not null,
  descripcion   text    not null,
  personalidad  text    not null,
  micro_gesto   text    not null,
  activo        integer not null default 1,
  creado_en     text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create table if not exists intenciones (
  id            text    primary key,
  agente_id     text    not null references agentes(id) on delete cascade,
  slug          text    not null unique,
  nombre        text    not null,
  descripcion   text    not null,
  categoria     text    not null,
  keywords      text    not null default '[]',
  ejemplo_frase text    not null,
  activo        integer not null default 1,
  creado_en     text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists idx_intenciones_agente on intenciones (agente_id);

create table if not exists automatizaciones_preestablecidas (
  id                 text    primary key,
  intencion_id       text    not null references intenciones(id) on delete cascade,
  slug               text    not null unique,
  nombre             text    not null,
  descripcion        text    not null,
  regla_logica       text    not null,
  parametros_default text    not null default '{}',
  impacto_esperado   text    not null,
  modulo_destino     text    not null,
  orden              integer not null default 1,
  activo             integer not null default 1,
  creado_en          text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists idx_autom_intencion
  on automatizaciones_preestablecidas (intencion_id, orden);

create table if not exists automatizaciones_activas (
  id                text    primary key,
  automatizacion_id text    not null references automatizaciones_preestablecidas(id) on delete restrict,
  restaurante_id    text,
  parametros        text    not null default '{}',
  estado            text    not null default 'activa'
                    check (estado in ('activa', 'pausada', 'archivada')),
  activada_en       text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  activada_por      text,
  unique (restaurante_id, automatizacion_id)
);

create table if not exists conversaciones_nodo (
  id            text primary key,
  texto_usuario text not null,
  intencion_id  text references intenciones(id) on delete set null,
  confianza     real,
  resultado     text not null check (resultado in ('match', 'sin_match')),
  creado_en     text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists idx_conv_creado on conversaciones_nodo (creado_en desc);
