-- ============================================================
-- Ajustes pedidos pelo Security Advisor do Supabase.
-- ============================================================

-- 1) Médicos sem vista SECURITY DEFINER.
--    Todos lêem as colunas públicas da tabela; telefone e email, que são
--    contactos internos, só a equipa os lê — por medicos_completos().
drop view if exists doctors_publicos;
drop policy if exists doctors_ler on doctors;
create policy doctors_ler on doctors for select to authenticated using (true);
revoke select on doctors from anon, authenticated;
grant select (id, user_id, titulo, nome, specialty_id, foto_url, activo, duracao_min, pode_editar_disponibilidade, criado_em)
  on doctors to authenticated;

create or replace function medicos_completos() returns setof doctors
language sql stable security definer set search_path = public as $$
  select * from doctors where e_equipa() order by nome
$$;
revoke execute on function medicos_completos() from public, anon;
grant execute on function medicos_completos() to authenticated;

-- 2) search_path fixo nas funções de tempo e texto.
alter function relogio_luanda(timestamptz) set search_path = public;
alter function hora_luanda(timestamptz) set search_path = public;
alter function data_longa(timestamptz) set search_path = public;
alter function data_curta(timestamptz) set search_path = public;
alter function sem_acentos(text) set search_path = public;

-- 3) Funções auxiliares fora do alcance de quem não tem sessão.
--    As políticas de RLS usam as primeiras, por isso ficam para authenticated;
--    as últimas só são chamadas por outras funções.
revoke execute on function e_equipa(), eu_papel(), meu_medico_id(), meu_paciente_id(), pacientes_que_giro(),
  pode_gerir_paciente(uuid), posso_editar_disponibilidade() from public, anon;
grant execute on function e_equipa(), eu_papel(), meu_medico_id(), meu_paciente_id(), pacientes_que_giro(),
  pode_gerir_paciente(uuid), posso_editar_disponibilidade() to authenticated;
revoke execute on function nome_medico(uuid), sufixo_paciente(uuid), vaga_invalida(uuid, timestamptz, uuid)
  from public, anon, authenticated;
