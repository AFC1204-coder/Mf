-- Seguridad de «Mente fría» (proyecto aduizdiiacrvpoavjmab): activar RLS en las 25 tablas que la tienen desactivada.
-- NO se ha ejecutado. Revísalo y ejecútalo tú en el SQL Editor, por bloques (cada bloque es independiente).
-- Modelo de la app: un solo usuario, que entra con la clave pública (anon) y usuario_id = 'default'.
-- Estas políticas mantienen exactamente lo que la app hace hoy y cierran lo que no usa. La protección REAL
-- contra quien tenga la clave pública exige iniciar sesión con Supabase Auth (ver nota al final).
-- Cómo deshacer un bloque: alter table public.<tabla> disable row level security;  (las políticas se pueden dejar).

-- ═══ BLOQUE 1 · Datos del dueño que la app usa con la clave pública (se mantiene el acceso, solo para 'default') ═══
alter table public.repaso          enable row level security;
alter table public.compromisos     enable row level security;
alter table public.perfil_usuario  enable row level security;

create policy repaso_dueno         on public.repaso         for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy compromisos_dueno    on public.compromisos    for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy perfil_usuario_dueno on public.perfil_usuario for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
-- (las funciones obtener_cola_repaso, registrar_repaso, etc. se ejecutan como el llamante, así que necesitan esta política de repaso)

-- ═══ BLOQUE 2 · Eventos: la app solo añade; solo el administrador lee y borra ═══
alter table public.eventos enable row level security;
create policy eventos_insertar on public.eventos for insert to anon, authenticated with check (usuario_id = 'default');
create policy eventos_admin_leer on public.eventos for select to authenticated using (public.is_admin());
create policy eventos_admin_borrar on public.eventos for delete to authenticated using (public.is_admin());

-- ═══ BLOQUE 3 · Artículos de cruce: lectura pública solo de los publicados; escribe solo el administrador ═══
alter table public.articulos enable row level security;
create policy articulos_leer_publicos on public.articulos for select to anon, authenticated using (publico = true);
create policy articulos_admin_escribir on public.articulos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ═══ BLOQUE 4 · Módulo «observatorio»/escenarios (todas vacías): lectura pública de las que lee esquemas/observatorio.html;
--      el resto queda cerrado (RLS activado y sin políticas = nadie con clave pública puede leer ni escribir) ═══
alter table public.vectores_cambio          enable row level security;
alter table public.escenarios               enable row level security;
alter table public.analisis_escenario       enable row level security;
alter table public.tensiones_escenario      enable row level security;
alter table public.aplicaciones_escenario   enable row level security;
alter table public.dominios_impacto         enable row level security;
create policy vectores_cambio_leer        on public.vectores_cambio        for select to anon, authenticated using (true);
create policy escenarios_leer             on public.escenarios             for select to anon, authenticated using (true);
create policy analisis_escenario_leer     on public.analisis_escenario     for select to anon, authenticated using (true);
create policy tensiones_escenario_leer    on public.tensiones_escenario    for select to anon, authenticated using (true);
create policy aplicaciones_escenario_leer on public.aplicaciones_escenario for select to anon, authenticated using (true);
create policy dominios_impacto_leer       on public.dominios_impacto       for select to anon, authenticated using (true);

alter table public.registro_calibracion      enable row level security;
alter table public.log_senales               enable row level security;
alter table public.historial_probabilidades  enable row level security;
alter table public.fuentes_senales           enable row level security;
alter table public.probabilidades_mercado    enable row level security;
alter table public.analistas                 enable row level security;
alter table public.predicciones_analista     enable row level security;
alter table public.cadenas_causales          enable row level security;
alter table public.implicaciones_personales  enable row level security;
alter table public.correlaciones_escenarios  enable row level security;
alter table public.mapeo_mercados            enable row level security;
alter table public.snapshots_mercado         enable row level security;
alter table public.alertas_agente            enable row level security;
alter table public.ejecuciones_agente        enable row level security;
-- Si un agente externo escribe en estas tablas con la clave de servicio (service_role), seguirá funcionando
-- (service_role se salta RLS). Si lo hace con la clave pública, dejará de poder: avísame y le añadimos política.

-- ═══ BLOQUE 5 (opcional) · Cerrar las políticas «permitir todo» que ya existen ═══
-- Hoy cualquiera con la clave pública puede leer y escribir favoritos y notas de CUALQUIER usuario_id.
drop policy "Allow all for favoritos_usuario" on public.favoritos_usuario;
drop policy "Allow all for notas" on public.notas;
create policy favoritos_dueno on public.favoritos_usuario for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy notas_dueno     on public.notas             for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');

-- ═══ Comprobación tras ejecutar (debe devolver 0 filas) ═══
-- select tablename from pg_tables where schemaname='public' and not rowsecurity;
-- Y abre la app: biblioteca, repaso, perfil, sesión, favoritos y notas deben funcionar igual.

-- ═══ NOTA: límite de este modelo ═══
-- Con la clave pública (anon) y usuario_id='default' hardcodeado en la app, cualquiera que obtenga la clave de la
-- app (está en el código de la web) puede seguir leyendo y escribiendo los datos de 'default'. Estas políticas impiden
-- accesos a otros usuarios, a tablas que la app no usa y a escrituras de administrador, pero no distinguen a «tú» de
-- «otra persona con la clave». Para eso hay que activar inicio de sesión (Supabase Auth) y usar auth.uid() en las políticas.
