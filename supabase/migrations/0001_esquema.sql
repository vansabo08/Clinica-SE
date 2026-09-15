-- ============================================================
-- Clínica Sagrada Esperança — esquema
-- Correr por ordem: 0001, 0002, 0003 (SQL Editor do Supabase ou
-- `supabase db push`). Testado com `npm run test:sql`.
-- ============================================================

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions; -- restrições "sem sobreposição" com uuid

-- ------------------------------------------------------------
-- users: o perfil de cada conta (auth.users → public.users)
-- ------------------------------------------------------------
create table if not exists users (
  id uuid primary key references auth.users on delete cascade,
  papel text not null default 'paciente' check (papel in ('paciente', 'rececao', 'admin', 'medico')),
  nome text not null default '',
  email text,
  telefone text not null default '',   -- 9 dígitos, sem 244
  criado_em timestamptz not null default now()
);

create table if not exists specialties (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  descricao text not null default '',
  icone text not null default 'estetoscopio',
  ordem int not null default 0,
  activa boolean not null default true
);

create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users on delete set null,
  titulo text not null default 'Dr.' check (titulo in ('Dr.', 'Dra.')),
  nome text not null check (length(trim(nome)) > 0),
  specialty_id uuid not null references specialties,
  telefone text not null default '',   -- contacto interno: só a equipa e o próprio vêem
  email text,                          -- o convite para a conta vai para aqui
  foto_url text,
  activo boolean not null default true,
  duracao_min int not null default 30 check (duracao_min between 10 and 240),
  pode_editar_disponibilidade boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users on delete set null,  -- null = familiar ou registado na receção
  nome text not null check (length(trim(nome)) > 0),
  telefone text not null default '',
  data_nascimento date,
  lembrete_whatsapp boolean not null default true,
  criado_por uuid references users on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references patients on delete cascade,  -- quem tem a conta
  patient_id uuid not null references patients on delete cascade,   -- o familiar
  parentesco text not null check (parentesco in ('filho', 'filha', 'esposo', 'esposa', 'mae', 'pai', 'outro')),
  criado_em timestamptz not null default now(),
  unique (guardian_id, patient_id),
  check (guardian_id <> patient_id)
);

-- ------------------------------------------------------------
-- Agenda
-- ------------------------------------------------------------

-- Horário semanal. Um dia pode ter vários períodos (manhã e tarde).
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  inicio time not null,
  fim time not null,
  check (inicio < fim),
  constraint schedules_sem_sobreposicao exclude using gist (
    doctor_id with =,
    dia_semana with =,
    int4range(extract(epoch from inicio)::int, extract(epoch from fim)::int) with &&
  )
);

-- Férias, reuniões, ausências, intervalos e feriados. doctor_id null = clínica inteira.
create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text not null check (motivo in ('ferias', 'reuniao', 'ausencia', 'intervalo', 'feriado')),
  nota text not null default '',
  criado_por uuid default auth.uid() references users on delete set null,
  criado_em timestamptz not null default now(),
  check (inicio < fim)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients on delete restrict,
  doctor_id uuid not null references doctors on delete restrict,
  specialty_id uuid not null references specialties,
  inicio timestamptz not null,
  fim timestamptz not null,
  estado text not null default 'aguardando'
    check (estado in ('aguardando', 'confirmada', 'em_atendimento', 'concluida', 'cancelada', 'faltou')),
  observacao text not null default '' check (length(observacao) <= 500),
  canal text not null default 'app' check (canal in ('app', 'rececao', 'telefone', 'whatsapp')),
  marcada_por uuid references users on delete set null,
  criada_em timestamptz not null default now(),
  confirmada_em timestamptz,
  cancelada_em timestamptz,
  reagendada_de timestamptz,
  check (inicio < fim),

  -- A última palavra sobre sobreposições é da base de dados, mesmo com
  -- dois pedidos no mesmo milissegundo.
  constraint appointments_medico_sem_sobreposicao
    exclude using gist (doctor_id with =, tstzrange(inicio, fim) with &&)
    where (estado <> 'cancelada'),
  constraint appointments_paciente_sem_sobreposicao
    exclude using gist (patient_id with =, tstzrange(inicio, fim) with &&)
    where (estado in ('aguardando', 'confirmada', 'em_atendimento'))
);

-- ------------------------------------------------------------
-- Avisos e lista de espera
-- ------------------------------------------------------------

-- Uma linha por aviso e por canal. canal = 'app' aparece na aplicação a
-- partir de agendada_para; 'whatsapp' e 'sms' são enviados pela função
-- supabase/functions/enviar-lembretes, que preenche enviada_em.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  tipo text not null check (tipo in ('lembrete', 'marcacao', 'confirmacao', 'reagendamento', 'cancelamento', 'vaga')),
  titulo text not null,
  corpo text not null,
  appointment_id uuid references appointments on delete cascade,
  canal text not null default 'app' check (canal in ('app', 'whatsapp', 'sms')),
  agendada_para timestamptz not null default now(),
  enviada_em timestamptz,
  lida_em timestamptz,
  tentativas int not null default 0,
  erro text,
  dados jsonb
);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients on delete cascade,
  specialty_id uuid not null references specialties,
  doctor_id uuid references doctors on delete cascade,  -- null = qualquer médico da especialidade
  data_desejada date not null,
  estado text not null default 'activa' check (estado in ('activa', 'marcada', 'removida')),
  criada_em timestamptz not null default now(),
  ultima_vaga timestamptz,
  vagas_oferecidas int not null default 0
);

create table if not exists clinic_settings (
  id int primary key default 1 check (id = 1),
  nome text not null default 'Clínica Sagrada Esperança',
  endereco text not null default '',
  cidade text not null default 'Luanda',
  telefone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  horario text not null default '',
  latitude double precision not null default -8.8383,
  longitude double precision not null default 13.2344
);
insert into clinic_settings (id) values (1) on conflict do nothing;

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists appointments_medico_inicio_idx on appointments (doctor_id, inicio);
create index if not exists appointments_paciente_inicio_idx on appointments (patient_id, inicio);
create index if not exists appointments_inicio_idx on appointments (inicio);
create index if not exists blocked_slots_medico_idx on blocked_slots (doctor_id, inicio, fim);
create index if not exists schedules_medico_idx on schedules (doctor_id, dia_semana);
create index if not exists notifications_utilizador_idx on notifications (user_id, agendada_para desc);
create index if not exists notifications_por_enviar_idx on notifications (agendada_para) where enviada_em is null and canal <> 'app';
create index if not exists waitlist_procura_idx on waitlist (specialty_id, data_desejada) where estado = 'activa';
create unique index if not exists waitlist_um_pedido_activo on waitlist
  (patient_id, specialty_id, coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid), data_desejada)
  where estado = 'activa';
create index if not exists family_members_patient_idx on family_members (patient_id);
create index if not exists doctors_specialty_idx on doctors (specialty_id);
