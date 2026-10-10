# Prompt para Claude en Chrome — aplicar la migración de Mente fría

Copia todo lo que hay debajo de la línea y pégalo en Claude en Chrome.
Antes, inicia sesión en Supabase en esa pestaña (no le des tus credenciales a Claude).

---

Necesito que apliques una migración SQL en mi proyecto de Supabase "Mente fría" (ref `aduizdiiacrvpoavjmab`) usando el SQL Editor del panel. Hazlo tú en el navegador, paso a paso.

## Reglas
- Trabaja solo en este proyecto y solo en el SQL Editor. No cambies ajustes, claves, autenticación ni otras tablas.
- Si te pide iniciar sesión, para y avísame; yo me identifico.
- Si aparece un aviso de "operación potencialmente destructiva" (la migración contiene un `update` y un `drop function`, ambos esperados), confirma solo ese aviso.
- Si algo no coincide con lo descrito (otro proyecto, errores de sintaxis, tablas que no existen), para y cuéntamelo antes de seguir.

## Qué hace la migración
No borra datos. Añade la columna `repaso.estado`, marca como `dormida` las tarjetas de repaso que nunca se han revisado (unas 5.333), cambia la curva de repaso, y reescribe 5 funciones (`registrar_repaso`, `obtener_cola_repaso`, `estado_repaso`, `check_racha`, `check_repaso_pendiente`) y crea una nueva (`repaso_desde_lecciones`).

## Pasos
1. Abre https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/sql/new y comprueba que el nombre del proyecto es el de Mente fría.
2. Antes de nada, ejecuta esta comprobación y dime el resultado (debe dar `col_estado = 0` y `fn_nueva = 0`; si ya dan 1, para: significa que ya está aplicada):
   ```sql
   select (select count(*) from information_schema.columns where table_name='repaso' and column_name='estado') col_estado,
          (select count(*) from pg_proc where proname='repaso_desde_lecciones') fn_nueva;
   ```
3. Abre una consulta nueva, selecciona todo el contenido del editor y bórralo. Pega el SQL completo del bloque "MIGRACIÓN" de más abajo, tal cual, sin modificar nada. Comprueba que se pegó entero (la última línea es `update notificaciones set leida = true where tipo in ('racha','repaso') and not leida;`). Si el editor corta o desordena el texto, pégalo por partes siguiendo los separadores `-- ====` y ejecútalas en orden.
4. Pulsa **Run** y espera a que termine. Debe decir "Success" sin errores. Si hay un error, copia el mensaje completo y para.
5. Verifica con esta consulta y dime los valores:
   ```sql
   select
     (select count(*) from repaso where estado='activa')  activas,
     (select count(*) from repaso where estado='dormida') dormidas,
     (select count(*) from pg_proc where proname in ('repaso_desde_lecciones','registrar_repaso','obtener_cola_repaso','estado_repaso','check_racha','check_repaso_pendiente')) funciones,
     (select count(*) from notificaciones where tipo in ('racha','repaso') and not leida) avisos_sin_leer;
   ```
   Esperado: `dormidas` unas 5.300 (5.333 aprox.), `activas` unas 25, `funciones` = 6, `avisos_sin_leer` = 0.
6. Prueba la cola (no modifica nada):
   ```sql
   select count(*) from obtener_cola_repaso('default', 'mixto', 20, null);
   ```
   Debe devolver un número entre 0 y 20.
7. Dime en una lista corta qué pasó en cada paso y los valores de las comprobaciones.

## MIGRACIÓN
```sql
-- Quick wins del rediseño (docs/rediseno-uso-diario.md §12)
-- QW1 repaso sin deuda · QW2 día con corte 04:00 · QW3 repasar cuenta · QW5 sin avisos de culpa

-- ── QW1 · estado de tarjeta: solo las «activa» entran en la cola ──
alter table repaso add column if not exists estado text not null default 'activa';
do $$ begin
  alter table repaso add constraint repaso_estado_chk check (estado in ('activa','dormida','asentada'));
exception when duplicate_object then null; end $$;

-- Las nunca revisadas (activadas en bloque, de libros sin leer) se duermen.
-- Se despiertan al leer su lección (repaso_desde_lecciones).
update repaso set estado = 'dormida' where ultima_revision is null and estado = 'activa';

create index if not exists repaso_cola_idx on repaso (usuario_id, estado, proxima_revision);

-- ── QW1 · curva 0–6: hoy, 1, 3, 7, 16, 35, 90 días ──
create or replace function public.registrar_repaso(p_repaso_id uuid, p_evaluacion text)
returns void language plpgsql as $function$
declare
  v_nivel integer;
  v_nuevo integer;
  v_dias  integer;
  c_dias  constant integer[] := array[0,1,3,7,16,35,90];  -- índice = nivel + 1
begin
  select nivel into v_nivel from repaso where id = p_repaso_id;
  if v_nivel is null then return; end if;
  v_nivel := least(greatest(v_nivel, 0), 6);

  if p_evaluacion = 'fallo' then
    v_nuevo := greatest(v_nivel - 2, 1);
    v_dias  := 1;                                  -- vuelve mañana, no en esta sesión
  elsif p_evaluacion = 'pendiente' then            -- reflexión «aún no»: no castiga
    v_nuevo := v_nivel;
    v_dias  := 3;
  elsif p_evaluacion in ('dudoso','en_proceso') then
    v_nuevo := v_nivel;
    v_dias  := greatest(c_dias[v_nivel + 1], 1);
  elsif p_evaluacion in ('correcto','integrado') then
    v_nuevo := least(v_nivel + 1, 6);
    v_dias  := c_dias[v_nuevo + 1];
  else
    v_nuevo := v_nivel;
    v_dias  := 1;
  end if;

  update repaso set
    nivel = v_nuevo,
    estado = 'activa',
    proxima_revision = now() + make_interval(days => v_dias),
    ultima_revision = now(),
    veces_correcta   = veces_correcta   + case when p_evaluacion in ('correcto','integrado') then 1 else 0 end,
    veces_incorrecta = veces_incorrecta + case when p_evaluacion = 'fallo' then 1 else 0 end
  where id = p_repaso_id;
end;
$function$;

-- ── QW1 · cola: solo activas, la más atrasada primero, filtrable por libro ──
drop function if exists public.obtener_cola_repaso(text, text, integer);
create or replace function public.obtener_cola_repaso(
  p_usuario text default 'default', p_modo text default null,
  p_limite integer default 20, p_libro_id uuid default null)
returns table(repaso_id uuid, modo text, nivel integer, pregunta_texto text, opciones jsonb,
  correcta integer, explicacion text, leccion_titulo text, aplicacion_practica text,
  autocorreccion text, libro_titulo text, libro_autor text, eje text)
language plpgsql as $function$
begin
  return query
  select r.id, r.modo, r.nivel, p.texto, p.opciones, p.correcta, p.explicacion,
         le.titulo, le.aplicacion_practica, le.autocorreccion, l.titulo, l.autor, l.eje
  from repaso r
  left join preguntas p  on r.pregunta_id = p.id
  left join lecciones le on r.leccion_id = le.id
  left join libros l     on l.id = coalesce(p.libro_id, le.libro_id)
  where r.usuario_id = p_usuario
    and r.estado = 'activa'
    and r.proxima_revision <= now()
    and (p_modo is null or p_modo = 'mixto' or r.modo = p_modo)
    and (p_libro_id is null or l.id = p_libro_id)
  order by r.proxima_revision asc, r.nivel asc
  limit least(greatest(p_limite, 1), 20);
end;
$function$;

-- ── QW1 · estado: solo activas (nada de totales de deuda) ──
create or replace function public.estado_repaso(p_usuario text default 'default')
returns table(total_items bigint, pendientes_hoy bigint, nivel_1 bigint, nivel_2 bigint,
  nivel_3 bigint, nivel_4 bigint, items_quiz bigint, items_reflexion bigint, libros_activos bigint)
language plpgsql as $function$
begin
  return query
  select count(*),
         least(count(*) filter (where r.proxima_revision <= now()), 20),
         count(*) filter (where r.nivel <= 1),
         count(*) filter (where r.nivel in (2,3)),
         count(*) filter (where r.nivel = 4),
         count(*) filter (where r.nivel >= 5),
         count(*) filter (where r.modo = 'quiz'),
         count(*) filter (where r.modo = 'reflexion'),
         count(distinct l.id)
  from repaso r
  left join preguntas p  on r.pregunta_id = p.id
  left join lecciones le on r.leccion_id = le.id
  left join libros l     on l.id = coalesce(p.libro_id, le.libro_id)
  where r.usuario_id = p_usuario and r.estado = 'activa';
end;
$function$;

-- ── QW1 · leer una lección mete (o despierta) sus tarjetas ──
-- p_items: [{"leccion_id": "...", "preguntas": ["...", ...]}, ...]
-- p_repartir_dias = 0 → primera revisión mañana; > 0 → repartidas entre mañana y +N días.
create or replace function public.repaso_desde_lecciones(
  p_usuario text, p_items jsonb, p_repartir_dias integer default 0)
returns integer language plpgsql as $function$
declare
  it jsonb;
  v_lec uuid;
  v_preg uuid;
  v_n integer := 0;
  v_cuando timestamptz;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_lec := (it->>'leccion_id')::uuid;
    v_cuando := now() + interval '1 day'
      + case when p_repartir_dias > 0 then make_interval(days => floor(random() * (p_repartir_dias + 1))::int) else interval '0' end;

    -- reflexión de la lección
    if exists (select 1 from lecciones where id = v_lec and coalesce(aplicacion_practica,'') <> '') then
      update repaso set estado = 'activa', proxima_revision = v_cuando
        where usuario_id = p_usuario and leccion_id = v_lec and modo = 'reflexion' and estado = 'dormida';
      if not exists (select 1 from repaso where usuario_id = p_usuario and leccion_id = v_lec and modo = 'reflexion') then
        insert into repaso (usuario_id, modo, leccion_id, nivel, proxima_revision, estado)
        values (p_usuario, 'reflexion', v_lec, 0, v_cuando, 'activa');
      end if;
      v_n := v_n + 1;
    end if;

    -- preguntas afines
    for v_preg in select (jsonb_array_elements_text(coalesce(it->'preguntas', '[]'::jsonb)))::uuid loop
      update repaso set estado = 'activa', proxima_revision = v_cuando
        where usuario_id = p_usuario and pregunta_id = v_preg and estado = 'dormida';
      if not exists (select 1 from repaso where usuario_id = p_usuario and pregunta_id = v_preg) then
        insert into repaso (usuario_id, modo, pregunta_id, nivel, proxima_revision, estado)
        values (p_usuario, 'quiz', v_preg, 0, v_cuando, 'activa');
      end if;
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end;
$function$;

-- ── QW2 + QW3 + QW5 · racha: día con corte 04:00 (Madrid), cuenta el repaso, sin avisos ──
create or replace function public.check_racha(p_usuario_id text default 'default')
returns jsonb language plpgsql as $function$
declare
  v_racha int := 0;
  v_ultima date;
  v_hoy date := ((now() at time zone 'Europe/Madrid') - interval '4 hours')::date;
begin
  with dias as (
    select ((fecha at time zone 'Europe/Madrid') - interval '4 hours')::date d
      from progreso where usuario_id = p_usuario_id and fecha is not null
    union
    select ((ultima_revision at time zone 'Europe/Madrid') - interval '4 hours')::date
      from repaso where usuario_id = p_usuario_id and ultima_revision is not null
  ), g as (
    select d, d - (row_number() over (order by d desc))::int grp from dias
  ), ult as (select max(d) m from dias)
  select (select m from ult), count(*) filter (where g.grp = (select m from ult) - 1)
    into v_ultima, v_racha from g;

  if v_ultima is null then
    return jsonb_build_object('racha', 0, 'dias_sin_actividad', -1, 'alerta', false);
  end if;
  if v_hoy - v_ultima > 1 then v_racha := 0; end if;
  return jsonb_build_object('racha', v_racha, 'dias_sin_actividad', v_hoy - v_ultima, 'alerta', false);
end;
$function$;

create or replace function public.check_repaso_pendiente(p_usuario_id text default 'default')
returns jsonb language plpgsql as $function$
declare v int;
begin
  select least(count(*), 20) into v from repaso
   where usuario_id = p_usuario_id and estado = 'activa' and proxima_revision <= now();
  return jsonb_build_object('pendientes', v);
end;
$function$;

-- Los avisos de racha/deuda ya generados se dan por leídos (no se borran).
update notificaciones set leida = true where tipo in ('racha','repaso') and not leida;
```
