-- 1) Pregunta ↔ lección (docs/rediseno-uso-diario.md, M2)
-- 2) Perfil del usuario en la base (antes solo en el navegador)
-- No modifica datos existentes salvo rellenar preguntas.leccion_id donde estaba vacío.

-- ── 1 · preguntas.leccion_id ──
alter table preguntas add column if not exists leccion_id uuid references lecciones(id) on delete set null;
alter table preguntas add column if not exists leccion_origen text;          -- 'auto' (emparejada por texto) · 'manual' (revisada en admin)
do $$ begin
  alter table preguntas add constraint preguntas_leccion_origen_chk check (leccion_origen in ('auto','manual'));
exception when duplicate_object then null; end $$;
create index if not exists preguntas_leccion_idx on preguntas (leccion_id) where leccion_id is not null;

-- Emparejado automático, solo cuando es claro: la mejor lección del mismo libro
-- puntúa al menos 1,3 veces la segunda (búsqueda de texto en español). El resto queda
-- sin asignar y se revisa en admin → «Preguntas»; mientras tanto el cliente usa su heurística.
create or replace function backfill_pregunta_leccion() returns integer
language plpgsql as $$
declare n integer;
begin
  with cand as (
    select p.id pid, l.id lid,
           ts_rank(to_tsvector('spanish', coalesce(l.titulo,'')||' '||coalesce(l.cuerpo,'')||' '||coalesce(l.idea_clave,'')),
                   to_tsquery('spanish', (
                     select string_agg(distinct w, ' | ')
                     from (select regexp_split_to_table(lower(regexp_replace(p.texto||' '||coalesce(p.explicacion,''), '[^[:alnum:]áéíóúñü ]', '', 'g')), '\s+') w) q
                     where length(w) > 4))) r
    from preguntas p
    join lecciones l on l.libro_id = p.libro_id and l.activa
    where p.activa and p.leccion_id is null and p.leccion_origen is null
  ), best as (
    select pid, lid, r,
           row_number() over (partition by pid order by r desc) rn,
           lead(r) over (partition by pid order by r desc) r2
    from cand
  ), ok as (
    select pid, lid from best where rn = 1 and r > 0.05 and (r2 is null or r >= 1.3 * r2)
  )
  update preguntas p set leccion_id = ok.lid, leccion_origen = 'auto'
  from ok where p.id = ok.pid;
  get diagnostics n = row_count;
  return n;
end $$;

-- Solo para ejecutarla a mano: que nadie la pueda llamar por la API pública.
revoke execute on function backfill_pregunta_leccion() from public, anon, authenticated;

select backfill_pregunta_leccion();

-- La escritura desde admin ya está cubierta por la política update_preguntas (rol authenticated).

-- ── 2 · perfil_usuario ──
create table if not exists perfil_usuario (
  usuario_id text primary key default 'default',
  objetivo text not null,
  minutos int not null check (minutos in (3, 7, 15)),
  dias int not null check (dias in (3, 5, 7)),
  ruta text,
  modo text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
-- Misma política que el resto de tablas de la app (acceso con la clave anónima, usuario 'default').
grant select, insert, update on perfil_usuario to anon, authenticated;
