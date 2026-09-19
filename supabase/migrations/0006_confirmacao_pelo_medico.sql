-- ============================================================
-- O médico confirma ou recusa as consultas que lhe marcam.
--
-- Recusar é cancelar com a indicação de que foi o médico, e porquê:
-- o horário fica livre (a restrição de sobreposição já ignora as
-- canceladas), o paciente é avisado com o motivo e a receção também.
-- O médico passa a receber avisos das consultas novas, reagendadas
-- e canceladas da sua agenda.
-- ============================================================

alter table appointments add column if not exists recusada boolean not null default false;
alter table appointments add column if not exists motivo_recusa text not null default '';
do $$
begin
  alter table appointments add constraint appointments_motivo_recusa_curto check (length(motivo_recusa) <= 300);
exception when duplicate_object then null;
end $$;

-- A conta do médico (para os avisos), se já tiver entrado na aplicação.
create or replace function conta_do_medico(p_doctor uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from doctors where id = p_doctor
$$;
revoke execute on function conta_do_medico(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Estados: o médico passa a poder confirmar.
-- ------------------------------------------------------------
create or replace function mudar_estado_consulta(p_id uuid, p_estado text) returns appointments
language plpgsql security definer set search_path = public as $$
declare
  c appointments%rowtype;
  v_permitidos text[];
begin
  if p_estado = 'cancelada' then
    return cancelar_consulta(p_id);
  end if;

  select * into c from appointments where id = p_id for update;
  if not found then raise exception 'nao_encontrada' using errcode = 'P0001'; end if;

  if e_equipa() then
    v_permitidos := case c.estado
      when 'aguardando' then array['confirmada', 'em_atendimento', 'faltou']
      when 'confirmada' then array['em_atendimento', 'aguardando', 'faltou']
      when 'em_atendimento' then array['concluida', 'confirmada']
      when 'concluida' then array['em_atendimento']
      when 'faltou' then array['confirmada']
      else array[]::text[] end;
  elsif c.doctor_id = meu_medico_id() then
    v_permitidos := case c.estado
      when 'aguardando' then array['confirmada', 'em_atendimento', 'faltou']
      when 'confirmada' then array['em_atendimento', 'faltou']
      when 'em_atendimento' then array['concluida']
      else array[]::text[] end;
  else
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;

  if not (p_estado = any (v_permitidos)) then raise exception 'estado_invalido' using errcode = 'P0001'; end if;

  update appointments
     set estado = p_estado,
         confirmada_em = case when p_estado = 'confirmada' then coalesce(confirmada_em, now()) else confirmada_em end
   where id = p_id
  returning * into c;
  return c;
end $$;

-- ------------------------------------------------------------
-- Recusar: só o médico da consulta, só enquanto aguarda e ainda não começou.
-- ------------------------------------------------------------
create or replace function recusar_consulta(p_id uuid, p_motivo text default '') returns appointments
language plpgsql security definer set search_path = public as $$
declare
  c appointments%rowtype;
begin
  select * into c from appointments where id = p_id for update;
  if not found then raise exception 'nao_encontrada' using errcode = 'P0001'; end if;
  if auth.uid() is null or c.doctor_id is distinct from meu_medico_id() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if c.estado <> 'aguardando' then raise exception 'estado_invalido' using errcode = 'P0001'; end if;
  if c.inicio <= now() then raise exception 'passado' using errcode = 'P0001'; end if;

  update appointments
     set estado = 'cancelada',
         cancelada_em = now(),
         recusada = true,
         motivo_recusa = left(btrim(coalesce(p_motivo, '')), 300)
   where id = p_id
  returning * into c;
  return c;
end $$;
revoke execute on function recusar_consulta(uuid, text) from public, anon;
grant execute on function recusar_consulta(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Avisos (os textos repetem src/lib/textos.ts)
-- ------------------------------------------------------------
create or replace function depois_de_consulta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := titular_de(new.patient_id);
  v_medico uuid := conta_do_medico(new.doctor_id);
  v_de text := sufixo_paciente(new.patient_id) || ' com ' || nome_medico(new.doctor_id);
  v_paciente text := (select nome from patients where id = new.patient_id);
  v_motivo text := case when btrim(new.motivo_recusa) <> '' then ' Motivo: ' || btrim(new.motivo_recusa) || '.' else '' end;
  v_equipa record;
begin
  if tg_op = 'INSERT' then
    if new.estado = 'confirmada' then
      perform notificar(v_user, 'confirmacao', 'Consulta confirmada',
        'A clínica confirmou a consulta' || v_de || ' a ' || data_longa(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.', new.id);
    else
      perform notificar(v_user, 'marcacao', 'Consulta agendada',
        'A consulta' || v_de || ' ficou marcada para ' || data_longa(new.inicio) || ', às ' || hora_luanda(new.inicio) || '. A clínica vai confirmar em breve.', new.id);
    end if;
    perform criar_lembretes(new);

    if new.canal = 'app' then
      for v_equipa in select id from users where papel in ('rececao', 'admin') loop
        perform notificar(v_equipa.id, 'marcacao', 'Nova marcação pela aplicação',
          v_paciente || ' marcou consulta com ' || nome_medico(new.doctor_id)
          || ' para ' || data_curta(new.inicio) || ', às ' || hora_luanda(new.inicio) || '. Falta confirmar.', new.id);
      end loop;
    end if;

    if new.estado = 'aguardando' then
      perform notificar(v_medico, 'marcacao', 'Nova consulta por confirmar',
        v_paciente || ' marcou consulta para ' || data_curta(new.inicio) || ', às ' || hora_luanda(new.inicio) || '. Confirme ou recuse.', new.id);
    else
      perform notificar(v_medico, 'marcacao', 'Nova consulta na agenda',
        v_paciente || ' tem consulta consigo a ' || data_curta(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.', new.id);
    end if;

    update waitlist set estado = 'marcada'
     where estado = 'activa' and patient_id = new.patient_id and specialty_id = new.specialty_id
       and data_desejada = relogio_luanda(new.inicio)::date;

  elsif tg_op = 'UPDATE' then
    if new.inicio <> old.inicio then
      delete from notifications where appointment_id = new.id and tipo = 'lembrete' and agendada_para > now();
      perform criar_lembretes(new);
      perform notificar(v_user, 'reagendamento', 'Consulta reagendada',
        'A consulta' || v_de || ' passou para ' || data_longa(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.', new.id);
      perform notificar(v_medico, 'reagendamento', 'Consulta reagendada',
        'A consulta de ' || v_paciente || ' passou para ' || data_curta(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.'
        || case when new.estado = 'aguardando' then ' Confirme ou recuse.' else '' end, new.id);
      perform oferecer_vaga(old.doctor_id, old.specialty_id, old.inicio);
    end if;

    if new.estado = 'cancelada' and old.estado <> 'cancelada' then
      delete from notifications where appointment_id = new.id and tipo = 'lembrete' and agendada_para > now();
      if new.recusada then
        -- O médico não pode: o horário não vai para a lista de espera.
        perform notificar(v_user, 'cancelamento', 'Consulta não confirmada',
          nome_medico(new.doctor_id) || ' não pode atender a consulta' || sufixo_paciente(new.patient_id) || ' de ' || data_curta(old.inicio)
          || ', às ' || hora_luanda(old.inicio) || '.' || v_motivo || ' Escolha outro horário na aplicação.', new.id);
        for v_equipa in select id from users where papel in ('rececao', 'admin') loop
          perform notificar(v_equipa.id, 'cancelamento', 'Consulta recusada pelo médico',
            nome_medico(new.doctor_id) || ' recusou a consulta de ' || v_paciente || ' de ' || data_curta(old.inicio)
            || ', às ' || hora_luanda(old.inicio) || '.' || v_motivo, new.id);
        end loop;
      else
        perform notificar(v_user, 'cancelamento', 'Consulta cancelada',
          'A consulta' || v_de || ' de ' || data_curta(old.inicio) || ', às ' || hora_luanda(old.inicio) || ', foi cancelada.', new.id);
        perform notificar(v_medico, 'cancelamento', 'Consulta cancelada',
          'A consulta de ' || v_paciente || ' de ' || data_curta(old.inicio) || ', às ' || hora_luanda(old.inicio) || ', foi cancelada. O horário ficou livre.', new.id);
        perform oferecer_vaga(old.doctor_id, old.specialty_id, old.inicio);
      end if;
    elsif new.estado = 'confirmada' and old.estado <> 'confirmada' and old.confirmada_em is null then
      if auth.uid() is not null and auth.uid() = v_medico then
        perform notificar(v_user, 'confirmacao', 'Consulta confirmada',
          nome_medico(new.doctor_id) || ' confirmou a consulta' || sufixo_paciente(new.patient_id) || ' a ' || data_longa(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.', new.id);
      else
        perform notificar(v_user, 'confirmacao', 'Consulta confirmada',
          'A clínica confirmou a consulta' || v_de || ' a ' || data_longa(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.', new.id);
      end if;
    end if;
  end if;

  perform avisar_agenda(array['consultas']);
  return null;
end $$;
revoke execute on function depois_de_consulta() from public, anon, authenticated;
