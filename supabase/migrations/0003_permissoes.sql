-- ============================================================
-- Permissões (RLS)
--
--   Paciente  vê e gere só a sua família; vê vagas sem ver quem as ocupa.
--   Médico    vê a sua agenda e os pacientes que tem marcados.
--   Receção   e administração gerem a clínica toda.
--
-- As marcações nunca se escrevem directamente nas tabelas: passam pelas
-- funções de 0002, que validam tudo. Por isso appointments não tem
-- políticas de escrita.
-- ============================================================

alter table users enable row level security;
alter table specialties enable row level security;
alter table doctors enable row level security;
alter table patients enable row level security;
alter table family_members enable row level security;
alter table schedules enable row level security;
alter table blocked_slots enable row level security;
alter table appointments enable row level security;
alter table notifications enable row level security;
alter table waitlist enable row level security;
alter table clinic_settings enable row level security;

-- users
drop policy if exists users_ler on users;
create policy users_ler on users for select to authenticated
  using (id = auth.uid() or e_equipa());
drop policy if exists users_editar on users;
create policy users_editar on users for update to authenticated
  using (id = auth.uid() or eu_papel() = 'admin') with check (id = auth.uid() or eu_papel() = 'admin');

-- specialties
drop policy if exists specialties_ler on specialties;
create policy specialties_ler on specialties for select to authenticated using (true);
drop policy if exists specialties_gerir on specialties;
create policy specialties_gerir on specialties for all to authenticated using (e_equipa()) with check (e_equipa());

-- doctors: a tabela completa (telefone, email) é da equipa e do próprio.
-- Os pacientes lêem doctors_publicos, só com o que precisam para marcar.
drop policy if exists doctors_ler on doctors;
create policy doctors_ler on doctors for select to authenticated
  using (e_equipa() or user_id = auth.uid());
drop policy if exists doctors_gerir on doctors;
create policy doctors_gerir on doctors for all to authenticated using (e_equipa()) with check (e_equipa());

create or replace view doctors_publicos with (security_barrier = true) as
  select id, user_id, titulo, nome, specialty_id, foto_url, activo, duracao_min, pode_editar_disponibilidade
    from doctors;
revoke all on doctors_publicos from anon;
grant select on doctors_publicos to authenticated;

-- patients
drop policy if exists patients_ler on patients;
create policy patients_ler on patients for select to authenticated
  using (
    pode_gerir_paciente(id)
    or exists (select 1 from appointments a where a.patient_id = patients.id and a.doctor_id = meu_medico_id())
  );
drop policy if exists patients_criar on patients;
create policy patients_criar on patients for insert to authenticated with check (e_equipa());
drop policy if exists patients_editar on patients;
create policy patients_editar on patients for update to authenticated
  using (pode_gerir_paciente(id)) with check (pode_gerir_paciente(id));

-- family_members (escrita só por adicionar_familiar / remover_familiar)
drop policy if exists family_members_ler on family_members;
create policy family_members_ler on family_members for select to authenticated
  using (guardian_id = meu_paciente_id() or e_equipa());

-- schedules (escrita da equipa; o médico com permissão usa guardar_horarios)
drop policy if exists schedules_ler on schedules;
create policy schedules_ler on schedules for select to authenticated using (true);
drop policy if exists schedules_gerir on schedules;
create policy schedules_gerir on schedules for all to authenticated using (e_equipa()) with check (e_equipa());

-- blocked_slots: os pacientes não vêem motivos — usam agenda_indisponivel.
drop policy if exists blocked_slots_ler on blocked_slots;
create policy blocked_slots_ler on blocked_slots for select to authenticated
  using (e_equipa() or (meu_medico_id() is not null and (doctor_id is null or doctor_id = meu_medico_id())));
drop policy if exists blocked_slots_criar on blocked_slots;
create policy blocked_slots_criar on blocked_slots for insert to authenticated
  with check (e_equipa() or (doctor_id = meu_medico_id() and posso_editar_disponibilidade()));
drop policy if exists blocked_slots_apagar on blocked_slots;
create policy blocked_slots_apagar on blocked_slots for delete to authenticated
  using (e_equipa() or (doctor_id = meu_medico_id() and posso_editar_disponibilidade()));

-- appointments (só leitura; escrita pelas funções)
drop policy if exists appointments_ler on appointments;
create policy appointments_ler on appointments for select to authenticated
  using (e_equipa() or doctor_id = meu_medico_id() or patient_id in (select pacientes_que_giro()));

-- notifications: cada um as suas; só se pode marcar como lida.
drop policy if exists notifications_ler on notifications;
create policy notifications_ler on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_ler_marcar on notifications;
create policy notifications_ler_marcar on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (lida_em) on notifications to authenticated;

-- waitlist (entrada por entrar_lista_espera; só se pode mudar o estado)
drop policy if exists waitlist_ler on waitlist;
create policy waitlist_ler on waitlist for select to authenticated
  using (e_equipa() or pode_gerir_paciente(patient_id));
drop policy if exists waitlist_editar on waitlist;
create policy waitlist_editar on waitlist for update to authenticated
  using (pode_gerir_paciente(patient_id)) with check (pode_gerir_paciente(patient_id));
revoke update on waitlist from authenticated;
grant update (estado) on waitlist to authenticated;

-- clinic_settings: público para leitura (o ecrã de entrada mostra o endereço).
drop policy if exists clinic_settings_ler on clinic_settings;
create policy clinic_settings_ler on clinic_settings for select to anon, authenticated using (true);
drop policy if exists clinic_settings_gerir on clinic_settings;
create policy clinic_settings_gerir on clinic_settings for all to authenticated using (e_equipa()) with check (e_equipa());

-- ------------------------------------------------------------
-- Funções internas: só os triggers e as outras funções as chamam.
-- ------------------------------------------------------------
revoke execute on function notificar(uuid, text, text, text, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
revoke execute on function criar_lembretes(appointments) from public, anon, authenticated;
revoke execute on function oferecer_vaga(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function avisar_agenda(text[]) from public, anon, authenticated;
revoke execute on function titular_de(uuid) from public, anon, authenticated;
revoke execute on function depois_de_consulta() from public, anon, authenticated;
revoke execute on function avisar_mudanca() from public, anon, authenticated;
revoke execute on function criar_perfil() from public, anon, authenticated;
revoke execute on function proteger_campos() from public, anon, authenticated;
revoke execute on function sincronizar_perfil() from public, anon, authenticated;

-- As funções públicas exigem sessão.
revoke execute on function marcar_consulta(uuid, uuid, timestamptz, text, text, text) from public, anon;
revoke execute on function reagendar_consulta(uuid, timestamptz) from public, anon;
revoke execute on function cancelar_consulta(uuid) from public, anon;
revoke execute on function mudar_estado_consulta(uuid, text) from public, anon;
revoke execute on function agenda_indisponivel(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function guardar_horarios(uuid, jsonb) from public, anon;
revoke execute on function remover_especialidade(uuid) from public, anon;
revoke execute on function adicionar_familiar(text, text, date) from public, anon;
revoke execute on function remover_familiar(uuid) from public, anon;
revoke execute on function entrar_lista_espera(uuid, uuid, uuid, date) from public, anon;
grant execute on function marcar_consulta(uuid, uuid, timestamptz, text, text, text) to authenticated;
grant execute on function reagendar_consulta(uuid, timestamptz) to authenticated;
grant execute on function cancelar_consulta(uuid) to authenticated;
grant execute on function mudar_estado_consulta(uuid, text) to authenticated;
grant execute on function agenda_indisponivel(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function guardar_horarios(uuid, jsonb) to authenticated;
grant execute on function remover_especialidade(uuid) to authenticated;
grant execute on function adicionar_familiar(text, text, date) to authenticated;
grant execute on function remover_familiar(uuid) to authenticated;
grant execute on function entrar_lista_espera(uuid, uuid, uuid, date) to authenticated;

-- ------------------------------------------------------------
-- Realtime: alterações por linha, filtradas pela RLS de cada um.
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table notifications, waitlist, family_members, patients;
exception when others then
  null; -- fora do Supabase não há esta publicação
end $$;
