-- Auditoría de calidad de los SVG antiguos (lecciones.imagen_principal).
-- SOLO LECTURA: no modifica nada. Se puede ejecutar en el SQL Editor cuantas veces quieras.
-- Informe: docs/auditoria-svg.md
--
-- Criterio de legibilidad: se asume un ancho de contenido de ~350 px en móvil, así que un texto
-- de font-size F en un lienzo de ancho W se ve a F*350/W px. Por debajo de 8 px no se lee; la
-- referencia razonable para texto de apoyo es ≥ 11 px.

-- ════════ 1. SVG en data:image/svg+xml,… (URL-encoded o utf8) — por lección ════════
-- Devuelve una fila por lección con sus métricas y una prioridad (1 = rehacer antes).
with s as (
  select l.id, l.libro_id, l.titulo, l.imagen_principal ip, length(l.imagen_principal) len,
    coalesce(((regexp_match(l.imagen_principal, 'viewBox(?:=|%3D)(?:%22|")?0(?:%20| )0(?:%20| )([0-9]+)', 'i'))[1])::numeric, 400) vbw
  from lecciones l
  where l.activa and (l.imagen_principal like 'data:image/svg+xml,%' or l.imagen_principal like 'data:image/svg+xml;utf8,%')
), f as (
  select s.id, (m)[1]::numeric * 350 / s.vbw px
  from s, regexp_matches(s.ip, 'font-size(?:=|%3D)(?:%22|"|'')?([0-9]+(?:\.[0-9]+)?)', 'g') m
), p as (
  select id, count(*) textos, min(px) min_px, count(*) filter (where px < 8) textos_ilegibles from f group by id
)
select s.id, s.libro_id, s.titulo, s.len,
  round(p.min_px, 1) texto_minimo_px, p.textos, p.textos_ilegibles,
  (select count(*) from regexp_matches(s.ip, '[A-Za-z]{4,}(?:cion|sion)(?![A-Za-z])', 'gi')) palabras_sin_tilde,
  case
    when s.len < 1500                                                              then 1  -- casi vacío
    when (select count(*) from regexp_matches(s.ip, '[A-Za-z]{4,}(?:cion|sion)(?![A-Za-z])', 'gi')) > 0 then 2  -- faltas de tilde
    when p.min_px < 8                                                              then 3  -- texto ilegible en móvil
    else 4
  end prioridad
from s left join p using (id)
order by prioridad, p.min_px nulls first;

-- ════════ 2. SVG en base64 — resumen (algunos no decodifican como UTF-8 válido) ════════
-- Lanza un error a propósito con el resumen (así no escribe nada y se lee en el mensaje).
-- do $$
-- declare r record; s text; vbw numeric; mn numeric; m text[]; ok int:=0; bad int:=0; ileg int:=0; tilde int:=0; badids text:='';
-- begin
--   for r in select id, imagen_principal ip from lecciones where activa and imagen_principal like 'data:image/svg+xml;base64,%' loop
--     begin
--       s := convert_from(decode(substr(r.ip, length('data:image/svg+xml;base64,')+1), 'base64'), 'UTF8'); ok := ok+1;
--       vbw := coalesce(((regexp_match(s, 'viewBox="0 0 ([0-9]+)'))[1])::numeric, 400); mn := null;
--       for m in select regexp_matches(s, 'font-size="([0-9]+(?:\.[0-9]+)?)"', 'g') loop
--         if mn is null or m[1]::numeric*350/vbw < mn then mn := m[1]::numeric*350/vbw; end if;
--       end loop;
--       if mn is not null and mn < 8 then ileg := ileg+1; end if;
--       if s ~* '[A-Za-z]{4,}(cion|sion)([^A-Za-z]|$)' then tilde := tilde+1; end if;
--     exception when others then bad := bad+1; if bad <= 5 then badids := badids || r.id::text || ' '; end if; end;
--   end loop;
--   raise exception 'ok=% invalidos_utf8=% ilegibles_movil=% sin_tilde=% ejemplos_invalidos=%', ok, bad, ileg, tilde, badids;
-- end $$;

-- ════════ 3. Cobertura visual de todas las lecciones ════════
select
  count(*) filter (where imagen_principal <> '' and imagen_principal is not null
                     and not (jsonb_typeof(imagenes_inline)='array' and jsonb_array_length(imagenes_inline)>0)) solo_svg_antiguo,
  count(*) filter (where jsonb_typeof(imagenes_inline)='array' and jsonb_array_length(imagenes_inline)>0)       con_diagrama_nuevo,
  count(*) filter (where (imagen_principal is null or imagen_principal = '')
                     and not (jsonb_typeof(imagenes_inline)='array' and jsonb_array_length(imagenes_inline)>0)) sin_imagen,
  count(*) total
from lecciones where activa;
