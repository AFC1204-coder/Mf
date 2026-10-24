-- Cruces entre libros: la tabla `articulos` (sección Ensayos) pasa a guardar esquemas, cápsulas,
-- lecciones de origen y preguntas. Solo se ven los marcados `publico` (se publican tras verificarlos).
alter table articulos add column if not exists tipo text check (tipo in ('convergencia','tension','complementariedad'));
alter table articulos add column if not exists cautelas text,
  add column if not exists esquemas jsonb not null default '[]'::jsonb,
  add column if not exists capsulas jsonb not null default '[]'::jsonb,
  add column if not exists fuentes jsonb not null default '[]'::jsonb,
  add column if not exists preguntas jsonb not null default '[]'::jsonb,
  add column if not exists publico boolean not null default false;
