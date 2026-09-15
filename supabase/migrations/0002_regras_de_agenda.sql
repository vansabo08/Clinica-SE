-- ============================================================
-- Regras de agenda: quem é quem, validação de vagas, marcações,
-- avisos, lembretes, lista de espera e tempo real.
--
-- As mesmas regras estão em src/lib/disponibilidade.ts (para desenhar a
-- agenda sem esperar pelo servidor). Aqui são a palavra final.
-- Os erros de agenda saem com a mensagem igual ao código
-- ('ocupado', 'passado'…), que a aplicação traduz.
-- ============================================================

-- ------------------------------------------------------------
-- Quem é quem
-- ------------------------------------------------------------

create or replace function eu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from users where id = auth.uid()
$$;

create or replace function e_equipa() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('rececao', 'admin') from users where id = auth.uid()), false)
$$;

create or replace function meu_paciente_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from patients where user_id = auth.uid()
$$;

create or replace function meu_medico_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from doctors where user_id = auth.uid()
$$;

create or replace function posso_editar_disponibilidade() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select pode_editar_disponibilidade and activo from doctors where user_id = auth.uid()), false)
$$;

-- O próprio paciente e os familiares que ele gere.
create or replace function pacientes_que_giro() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from patients where user_id = auth.uid()
  union
  select f.patient_id from family_members f join patients g on g.id = f.guardian_id where g.user_id = auth.uid()
$$;

create or replace function pode_gerir_paciente(p_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select e_equipa() or p_patient in (select pacientes_que_giro())
$$;

-- Quem recebe os avisos de um paciente: a própria conta ou a de quem o gere.
create or replace function titular_de(p_patient uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select user_id from patients where id = p_patient),
    (select g.user_id from family_members f join patients g on g.id = f.guardian_id
      where f.patient_id = p_patient and g.user_id is not null order by f.criado_em limit 1)
  )
$$;

-- ------------------------------------------------------------
-- Tempo e texto
-- ------------------------------------------------------------

-- Luanda: UTC+1 todo o ano (sem hora de verão). Igual a src/lib/tempo.ts.
create or replace function relogio_luanda(t timestamptz) returns timestamp
language sql stable as $$
  select (t at time zone 'UTC') + interval '1 hour'
$$;

create or replace function hora_luanda(t timestamptz) returns text
language sql stable as $$
  select to_char(relogio_luanda(t), 'HH24:MI')
$$;

create or replace function data_longa(t timestamptz) returns text
language sql stable as $$
  select extract(day from relogio_luanda(t))::int || ' '
    || (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])[extract(month from relogio_luanda(t))::int]
    || ' ' || extract(year from relogio_luanda(t))::int
$$;

create or replace function data_curta(t timestamptz) returns text
language sql stable as $$
  select extract(day from relogio_luanda(t))::int || ' '
    || (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from relogio_luanda(t))::int]
$$;

create or replace function sem_acentos(t text) returns text
language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

create or replace function nome_medico(p_doctor uuid) returns text
language sql stable security definer set search_path = public as $$
  select titulo || ' ' || nome from doctors where id = p_doctor
$$;

-- " de Tiago" quando a consulta é de um familiar; vazio quando é do titular.
create or replace function sufixo_paciente(p_patient uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when user_id is null then ' de ' || split_part(nome, ' ', 1) else '' end from patients where id = p_patient
$$;

-- ------------------------------------------------------------
-- Validação de vagas
-- ------------------------------------------------------------

-- Devolve o motivo por que não se pode marcar, ou null se pode.
create or replace function vaga_invalida(p_doctor uuid, p_inicio timestamptz, p_ignorar uuid default null)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  m doctors%rowtype;
  v_local timestamp := relogio_luanda(p_inicio);
  v_hora time := relogio_luanda(p_inicio)::time;
  v_fim timestamptz;
begin
  select * into m from doctors where id = p_doctor;
  if not found or not m.activo then return 'medico_inactivo'; end if;
  if p_inicio <= now() then return 'passado'; end if;

  v_fim := p_inicio + make_interval(mins => m.duracao_min);

  -- Tem de cair num período do horário, alinhada com a duração da consulta.
  if not exists (
    select 1 from schedules s
    where s.doctor_id = p_doctor
      and s.dia_semana = extract(dow from v_local)::int
      and v_hora >= s.inicio
      and extract(epoch from (v_hora - s.inicio))::int % (m.duracao_min * 60) = 0
      and extract(epoch from (v_hora - s.inicio))::int + m.duracao_min * 60 <= extract(epoch from (s.fim - s.inicio))::int
  ) then
    return 'fora_do_horario';
  end if;

  if exists (
    select 1 from blocked_slots b
    where (b.doctor_id = p_doctor or b.doctor_id is null)
      and tstzrange(b.inicio, b.fim) && tstzrange(p_inicio, v_fim)
  ) then
    return 'bloqueado';
  end if;

  if exists (
    select 1 from appointments a
    where a.doctor_id = p_doctor and a.estado <> 'cancelada'
      and a.id is distinct from p_ignorar
      and tstzrange(a.inicio, a.fim) && tstzrange(p_inicio, v_fim)
  ) then
    return 'ocupado';
  end if;

  return null;
end $$;

-- O que o médico não pode receber num intervalo, sem dizer quem nem porquê.
-- É o que os pacientes usam para ver vagas (não podem ler consultas alheias).
create or replace function agenda_indisponivel(p_doctor uuid, p_de timestamptz, p_ate timestamptz)
returns table (doctor_id uuid, inicio timestamptz, fim timestamptz, tipo text)
language sql stable security definer set search_path = public as $$
  select a.doctor_id, a.inicio, a.fim, 'consulta'
    from appointments a
   where auth.uid() is not null and a.doctor_id = p_doctor and a.estado <> 'cancelada'
     and a.fim > p_de and a.inicio < p_ate
  union all
  select b.doctor_id, b.inicio, b.fim, 'bloqueio'
    from blocked_slots b
   where auth.uid() is not null and (b.doctor_id = p_doctor or b.doctor_id is null)
     and b.fim > p_de and b.inicio < p_ate
$$;

-- ------------------------------------------------------------
-- Marcações
-- ------------------------------------------------------------

create or replace function marcar_consulta(
  p_patient uuid,
  p_doctor uuid,
  p_inicio timestamptz,
  p_observacao text default '',
  p_canal text default null,
  p_estado text default null
) returns appointments
language plpgsql security definer set search_path = public as $$
declare
  m doctors%rowtype;
  v_codigo text;
  v_fim timestamptz;
  v_equipa boolean := e_equipa();
  v_nova appointments%rowtype;
begin
  if auth.uid() is null or not pode_gerir_paciente(p_patient) then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;

  -- Uma marcação de cada vez por médico: a segunda espera e já vê a primeira.
  perform pg_advisory_xact_lock(hashtext('agenda:' || p_doctor::text));

  v_codigo := vaga_invalida(p_doctor, p_inicio);
  if v_codigo is not null then
    raise exception '%', v_codigo using errcode = 'P0001';
  end if;

  select * into m from doctors where id = p_doctor;
  v_fim := p_inicio + make_interval(mins => m.duracao_min);

  if exists (
    select 1 from appointments a
    where a.patient_id = p_patient and a.estado in ('aguardando', 'confirmada', 'em_atendimento')
      and tstzrange(a.inicio, a.fim) && tstzrange(p_inicio, v_fim)
  ) then
    raise exception 'paciente_ocupado' using errcode = 'P0001';
  end if;

  insert into appointments (patient_id, doctor_id, specialty_id, inicio, fim, estado, observacao, canal, marcada_por, confirmada_em)
  values (
    p_patient, p_doctor, m.specialty_id, p_inicio, v_fim,
    case when v_equipa and p_estado = 'confirmada' then 'confirmada' else 'aguardando' end,
    left(trim(coalesce(p_observacao, '')), 500),
    case when v_equipa then coalesce(p_canal, 'rececao') else 'app' end,
    auth.uid(),
    case when v_equipa and p_estado = 'confirmada' then now() end
  )
  returning * into v_nova;

  return v_nova;
exception
  when exclusion_violation then
    if sqlerrm like '%paciente%' then raise exception 'paciente_ocupado' using errcode = 'P0001'; end if;
    raise exception 'ocupado' using errcode = 'P0001';
end $$;

create or replace function reagendar_consulta(p_id uuid, p_inicio timestamptz) returns appointments
language plpgsql security definer set search_path = public as $$
declare
  c appointments%rowtype;
  m doctors%rowtype;
  v_codigo text;
  v_fim timestamptz;
  v_equipa boolean := e_equipa();
begin
  select * into c from appointments where id = p_id for update;
  if not found then raise exception 'nao_encontrada' using errcode = 'P0001'; end if;
  if auth.uid() is null or not pode_gerir_paciente(c.patient_id) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if c.estado not in ('aguardando', 'confirmada') then raise exception 'estado_invalido' using errcode = 'P0001'; end if;
  if c.inicio = p_inicio then return c; end if;

  perform pg_advisory_xact_lock(hashtext('agenda:' || c.doctor_id::text));

  v_codigo := vaga_invalida(c.doctor_id, p_inicio, c.id);
  if v_codigo is not null then raise exception '%', v_codigo using errcode = 'P0001'; end if;

  select * into m from doctors where id = c.doctor_id;
  v_fim := p_inicio + make_interval(mins => m.duracao_min);

  if exists (
    select 1 from appointments a
    where a.patient_id = c.patient_id and a.id <> c.id and a.estado in ('aguardando', 'confirmada', 'em_atendimento')
      and tstzrange(a.inicio, a.fim) && tstzrange(p_inicio, v_fim)
  ) then
    raise exception 'paciente_ocupado' using errcode = 'P0001';
  end if;

  -- O paciente que muda de hora volta a precisar de confirmação; a receção não.
  update appointments
     set reagendada_de = inicio,
         inicio = p_inicio,
         fim = v_fim,
         estado = case when v_equipa then estado else 'aguardando' end,
         confirmada_em = case when v_equipa then confirmada_em end
   where id = p_id
  returning * into c;
  return c;
exception
  when exclusion_violation then
    if sqlerrm like '%paciente%' then raise exception 'paciente_ocupado' using errcode = 'P0001'; end if;
    raise exception 'ocupado' using errcode = 'P0001';
end $$;

create or replace function cancelar_consulta(p_id uuid) returns appointments
language plpgsql security definer set search_path = public as $$
declare
  c appointments%rowtype;
begin
  select * into c from appointments where id = p_id for update;
  if not found then raise exception 'nao_encontrada' using errcode = 'P0001'; end if;
  if auth.uid() is null or not pode_gerir_paciente(c.patient_id) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if c.estado not in ('aguardando', 'confirmada') then raise exception 'estado_invalido' using errcode = 'P0001'; end if;
  update appointments set estado = 'cancelada', cancelada_em = now() where id = p_id returning * into c;
  return c;
end $$;

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
      when 'aguardando' then array['em_atendimento', 'faltou']
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
-- Horários, especialidades, familiares, lista de espera
-- ------------------------------------------------------------

create or replace function guardar_horarios(p_doctor uuid, p_periodos jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (e_equipa() or (p_doctor = meu_medico_id() and posso_editar_disponibilidade())) then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  delete from schedules where doctor_id = p_doctor;
  insert into schedules (doctor_id, dia_semana, inicio, fim)
  select p_doctor, (p ->> 'dia_semana')::smallint, (p ->> 'inicio')::time, (p ->> 'fim')::time
    from jsonb_array_elements(coalesce(p_periodos, '[]'::jsonb)) p;
end $$;

create or replace function remover_especialidade(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_activos int;
begin
  if not e_equipa() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  select count(*) into v_activos from doctors where specialty_id = p_id and activo;
  if v_activos > 0 then
    raise exception 'Há % médico(s) nesta especialidade. Mude-os de especialidade antes de a remover.', v_activos;
  end if;
  -- Com histórico, só se esconde; sem histórico, apaga-se.
  if exists (select 1 from appointments where specialty_id = p_id)
     or exists (select 1 from doctors where specialty_id = p_id)
     or exists (select 1 from waitlist where specialty_id = p_id) then
    update specialties set activa = false where id = p_id;
  else
    delete from specialties where id = p_id;
  end if;
end $$;

create or replace function adicionar_familiar(p_nome text, p_parentesco text, p_data_nascimento date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_titular patients%rowtype;
  v_paciente uuid;
  v_id uuid;
begin
  select * into v_titular from patients where user_id = auth.uid();
  if not found then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Escreva o nome do familiar.'; end if;

  insert into patients (nome, telefone, data_nascimento, lembrete_whatsapp, criado_por)
  values (trim(p_nome), v_titular.telefone, p_data_nascimento, false, auth.uid())
  returning id into v_paciente;

  insert into family_members (guardian_id, patient_id, parentesco)
  values (v_titular.id, v_paciente, p_parentesco)
  returning id into v_id;
  return v_id;
end $$;

create or replace function remover_familiar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_familiar family_members%rowtype;
begin
  select f.* into v_familiar from family_members f join patients g on g.id = f.guardian_id
   where f.id = p_id and g.user_id = auth.uid();
  if not found then raise exception 'nao_encontrada' using errcode = 'P0001'; end if;
  if exists (select 1 from appointments where patient_id = v_familiar.patient_id and estado in ('aguardando', 'confirmada') and inicio > now()) then
    raise exception 'Este familiar tem consultas marcadas. Cancele-as antes de o remover.';
  end if;
  delete from family_members where id = p_id; -- o registo de paciente fica, com o histórico
end $$;

create or replace function entrar_lista_espera(p_patient uuid, p_specialty uuid, p_doctor uuid, p_data date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not pode_gerir_paciente(p_patient) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if p_data < relogio_luanda(now())::date then raise exception 'Escolha uma data de hoje em diante.'; end if;
  insert into waitlist (patient_id, specialty_id, doctor_id, data_desejada)
  values (p_patient, p_specialty, p_doctor, p_data)
  on conflict do nothing; -- já estava na lista para esse dia
end $$;

-- Resumo para a página Pacientes. Corre com as permissões de quem pede:
-- a receção vê todos, o médico só os seus, o paciente só a família.
create or replace function pacientes_resumo(p_pesquisa text default '')
returns table (
  id uuid, user_id uuid, nome text, telefone text, data_nascimento date, lembrete_whatsapp boolean, criado_em timestamptz,
  proxima_consulta timestamptz, ultimo_agendamento timestamptz, total_consultas bigint
)
language sql stable set search_path = public as $$
  select p.id, p.user_id, p.nome, p.telefone, p.data_nascimento, p.lembrete_whatsapp, p.criado_em,
    (select min(a.inicio) from appointments a where a.patient_id = p.id and a.inicio > now() and a.estado in ('aguardando', 'confirmada')),
    (select max(a.inicio) from appointments a where a.patient_id = p.id and a.inicio <= now() and a.estado <> 'cancelada'),
    (select count(*) from appointments a where a.patient_id = p.id and a.estado <> 'cancelada')
  from patients p
  where coalesce(trim(p_pesquisa), '') = ''
     or sem_acentos(p.nome) like '%' || sem_acentos(trim(p_pesquisa)) || '%'
     or (length(regexp_replace(p_pesquisa, '\D', '', 'g')) >= 3
         and p.telefone like '%' || regexp_replace(p_pesquisa, '\D', '', 'g') || '%')
  order by p.nome
  limit 500
$$;

-- Primeira consulta concluída de cada paciente, entre as que quem pede pode ver
-- (para o médico: a primeira consigo).
create or replace function primeiras_consultas(p_patients uuid[])
returns table (patient_id uuid, primeira timestamptz)
language sql stable set search_path = public as $$
  select a.patient_id, min(a.inicio) from appointments a
   where a.patient_id = any (p_patients) and a.estado = 'concluida'
   group by a.patient_id
$$;

-- ------------------------------------------------------------
-- Avisos
-- ------------------------------------------------------------

create or replace function notificar(
  p_user uuid, p_tipo text, p_titulo text, p_corpo text,
  p_appointment uuid default null, p_quando timestamptz default now(), p_canal text default 'app', p_dados jsonb default null
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, tipo, titulo, corpo, appointment_id, agendada_para, canal, dados, enviada_em)
  select p_user, p_tipo, p_titulo, p_corpo, p_appointment, p_quando, p_canal, p_dados,
         case when p_canal = 'app' and p_quando <= now() then now() end
   where p_user is not null
$$;

-- 24 horas antes; se já faltar menos, 2 horas antes. Mais uma cópia para WhatsApp.
create or replace function criar_lembretes(c appointments) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := titular_de(c.patient_id);
  v_clinica text := coalesce((select nome from clinic_settings where id = 1), 'Clínica Sagrada Esperança');
  v_quando timestamptz;
  v_titulo text;
  v_corpo text;
begin
  if v_user is null then return; end if;
  if c.inicio - interval '24 hours' > now() then
    v_quando := c.inicio - interval '24 hours';
    v_titulo := 'Consulta amanhã';
    v_corpo := 'Lembrete: você tem uma consulta amanhã às ' || hora_luanda(c.inicio) || ' na ' || v_clinica || '.';
  elsif c.inicio - interval '2 hours' > now() then
    v_quando := c.inicio - interval '2 hours';
    v_titulo := 'Consulta hoje';
    v_corpo := 'Lembrete: você tem uma consulta hoje às ' || hora_luanda(c.inicio) || ' na ' || v_clinica || '.';
  else
    return;
  end if;
  perform notificar(v_user, 'lembrete', v_titulo, v_corpo, c.id, v_quando, 'app');
  if coalesce((select lembrete_whatsapp from patients where user_id = v_user), false) then
    perform notificar(v_user, 'lembrete', v_titulo, v_corpo, c.id, v_quando, 'whatsapp');
  end if;
end $$;

-- Um horário ficou livre: avisar, por ordem de chegada, quem espera por esse dia.
create or replace function oferecer_vaga(p_doctor uuid, p_specialty uuid, p_inicio timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  if p_inicio <= now() then return; end if;
  for e in
    select * from waitlist w
     where w.estado = 'activa' and w.specialty_id = p_specialty
       and (w.doctor_id is null or w.doctor_id = p_doctor)
       and w.data_desejada = relogio_luanda(p_inicio)::date
     order by w.criada_em
     for update
  loop
    update waitlist set ultima_vaga = p_inicio, vagas_oferecidas = vagas_oferecidas + 1 where id = e.id;
    perform notificar(
      titular_de(e.patient_id), 'vaga', 'Abriu uma vaga',
      'Ficou livre um horário com ' || nome_medico(p_doctor) || ' a ' || data_curta(p_inicio) || ', às ' || hora_luanda(p_inicio) || '. Quem marcar primeiro fica com ele.',
      null, now(), 'app',
      jsonb_build_object('medico_id', p_doctor, 'especialidade_id', p_specialty, 'inicio', p_inicio)
    );
  end loop;
end $$;

-- Tempo real: um aviso público que só diz *o que* mudou, nunca quem.
create or replace function avisar_agenda(p_tabelas text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('tabelas', p_tabelas), 'mudou', 'agenda', false);
exception when others then
  null; -- sem Realtime (ex.: base de testes): as aplicações vêem a mudança na próxima leitura
end $$;

create or replace function depois_de_consulta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := titular_de(new.patient_id);
  v_de text := sufixo_paciente(new.patient_id) || ' com ' || nome_medico(new.doctor_id);
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
          (select nome from patients where id = new.patient_id) || ' marcou consulta com ' || nome_medico(new.doctor_id)
          || ' para ' || data_curta(new.inicio) || ', às ' || hora_luanda(new.inicio) || '. Falta confirmar.', new.id);
      end loop;
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
      perform oferecer_vaga(old.doctor_id, old.specialty_id, old.inicio);
    end if;

    if new.estado = 'cancelada' and old.estado <> 'cancelada' then
      delete from notifications where appointment_id = new.id and tipo = 'lembrete' and agendada_para > now();
      perform notificar(v_user, 'cancelamento', 'Consulta cancelada',
        'A consulta' || v_de || ' de ' || data_curta(old.inicio) || ', às ' || hora_luanda(old.inicio) || ', foi cancelada.', new.id);
      perform oferecer_vaga(old.doctor_id, old.specialty_id, old.inicio);
    elsif new.estado = 'confirmada' and old.estado <> 'confirmada' and old.confirmada_em is null then
      perform notificar(v_user, 'confirmacao', 'Consulta confirmada',
        'A clínica confirmou a consulta' || v_de || ' a ' || data_longa(new.inicio) || ', às ' || hora_luanda(new.inicio) || '.', new.id);
    end if;
  end if;

  perform avisar_agenda(array['consultas']);
  return null;
end $$;

drop trigger if exists appointments_depois on appointments;
create trigger appointments_depois after insert or update on appointments
  for each row execute function depois_de_consulta();

create or replace function avisar_mudanca() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform avisar_agenda(tg_argv::text[]);
  return null;
end $$;

drop trigger if exists blocked_slots_avisar on blocked_slots;
create trigger blocked_slots_avisar after insert or update or delete on blocked_slots for each statement execute function avisar_mudanca('bloqueios');
drop trigger if exists schedules_avisar on schedules;
create trigger schedules_avisar after insert or update or delete on schedules for each statement execute function avisar_mudanca('horarios');
drop trigger if exists doctors_avisar on doctors;
create trigger doctors_avisar after insert or update or delete on doctors for each statement execute function avisar_mudanca('medicos');
drop trigger if exists specialties_avisar on specialties;
create trigger specialties_avisar after insert or update or delete on specialties for each statement execute function avisar_mudanca('especialidades');
drop trigger if exists clinic_settings_avisar on clinic_settings;
create trigger clinic_settings_avisar after insert or update on clinic_settings for each statement execute function avisar_mudanca('clinica');

-- ------------------------------------------------------------
-- Contas
-- ------------------------------------------------------------

-- Cada conta nova ganha um perfil. Se foi convidada e o email é de um
-- médico, liga-se a esse médico; senão é paciente. Serve para email e Google.
create or replace function criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nome text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  v_telefone text := right(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g'), 9);
  v_medico uuid;
begin
  if new.invited_at is not null then
    select id into v_medico from doctors where user_id is null and email is not null and lower(email) = lower(new.email) limit 1;
  end if;

  insert into users (id, papel, nome, email, telefone)
  values (new.id, case when v_medico is not null then 'medico' else 'paciente' end, v_nome, new.email, v_telefone)
  on conflict (id) do nothing;

  if v_medico is not null then
    update doctors set user_id = new.id where id = v_medico;
  else
    insert into patients (user_id, nome, telefone, criado_por) values (new.id, v_nome, v_telefone, new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists auth_criar_perfil on auth.users;
create trigger auth_criar_perfil after insert on auth.users for each row execute function criar_perfil();

-- Ninguém muda o próprio papel nem se liga a outra conta pela API.
create or replace function proteger_campos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- service role e SQL Editor
  if tg_table_name = 'users' then
    if new.papel is distinct from old.papel and coalesce(eu_papel(), '') <> 'admin' then
      raise exception 'sem_permissao' using errcode = 'P0001';
    end if;
    new.id := old.id;
  elsif tg_table_name = 'patients' then
    if new.user_id is distinct from old.user_id then
      raise exception 'sem_permissao' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists users_proteger on users;
create trigger users_proteger before update on users for each row execute function proteger_campos();
drop trigger if exists patients_proteger on patients;
create trigger patients_proteger before update on patients for each row execute function proteger_campos();

-- O perfil acompanha o nome e o telefone do paciente titular.
create or replace function sincronizar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and (new.nome is distinct from old.nome or new.telefone is distinct from old.telefone) then
    update users set nome = new.nome, telefone = new.telefone where id = new.user_id;
  end if;
  return null;
end $$;

drop trigger if exists patients_sincronizar on patients;
create trigger patients_sincronizar after update on patients for each row execute function sincronizar_perfil();
