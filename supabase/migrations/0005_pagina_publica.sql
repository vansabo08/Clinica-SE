-- ============================================================
-- A página inicial é pública: mostra as especialidades e os médicos
-- activos a quem ainda não tem sessão, como o site de qualquer clínica.
-- Sem contactos internos nem a ligação à conta (user_id).
-- ============================================================

drop policy if exists specialties_ler_publico on specialties;
create policy specialties_ler_publico on specialties for select to anon using (activa);
grant select on specialties to anon;

drop policy if exists doctors_ler_publico on doctors;
create policy doctors_ler_publico on doctors for select to anon using (activo);
grant select (id, titulo, nome, specialty_id, foto_url, activo, duracao_min) on doctors to anon;
