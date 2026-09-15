-- ============================================================
-- Dados iniciais: especialidades, dados da clínica e médicos de
-- demonstração com horário de segunda a sexta (08:00–12:00, 14:00–17:00).
-- Só corre numa base vazia. Troque os médicos pelos reais na página
-- Médicos da receção.
-- ============================================================

do $$
begin
  if exists (select 1 from specialties) then return; end if;

  insert into specialties (nome, descricao, icone, ordem) values
    ('Clínica Geral', 'Consultas de rotina, check-ups e primeiro diagnóstico.', 'estetoscopio', 0),
    ('Pediatria', 'Bebés, crianças e adolescentes.', 'bebe', 1),
    ('Ginecologia', 'Saúde da mulher e planeamento familiar.', 'flor', 2),
    ('Cardiologia', 'Coração, tensão arterial e circulação.', 'coracao', 3),
    ('Dermatologia', 'Pele, cabelo e unhas.', 'pele', 4),
    ('Odontologia', 'Dentes, gengivas e higiene oral.', 'dente', 5),
    ('Oftalmologia', 'Visão e saúde dos olhos.', 'olho', 6),
    ('Ortopedia', 'Ossos, articulações e músculos.', 'osso', 7);

  update clinic_settings
     set endereco = 'Avenida Mortala Mohamed', cidade = 'Ilha de Luanda, Luanda',
         horario = E'Segunda a sexta, das 07:30 às 19:00\nSábado, das 08:00 às 13:00',
         latitude = -8.7925, longitude = 13.2236
   where id = 1;

  with novos as (
    insert into doctors (titulo, nome, specialty_id, duracao_min, pode_editar_disponibilidade)
    select v.titulo, v.nome, s.id, v.dur, v.pode
      from (values
        ('Dr.', 'João Silva', 'Cardiologia', 30, true),
        ('Dra.', 'Ana Cardoso', 'Clínica Geral', 20, false),
        ('Dr.', 'Paulo Mendes', 'Clínica Geral', 20, false),
        ('Dra.', 'Maria Neto', 'Pediatria', 30, false),
        ('Dra.', 'Isabel Mbala', 'Ginecologia', 30, false),
        ('Dr.', 'Nelson Bento', 'Dermatologia', 30, false),
        ('Dra.', 'Luísa Tavares', 'Odontologia', 45, false),
        ('Dra.', 'Sofia Lemos', 'Oftalmologia', 30, false),
        ('Dr.', 'Adriano Van-Dúnem', 'Ortopedia', 30, false)
      ) as v(titulo, nome, esp, dur, pode)
      join specialties s on s.nome = v.esp
    returning id
  )
  insert into schedules (doctor_id, dia_semana, inicio, fim)
  select novos.id, d, p.inicio::time, p.fim::time
    from novos
    cross join generate_series(1, 5) as d
    cross join (values ('08:00', '12:00'), ('14:00', '17:00')) as p(inicio, fim);
end $$;

-- Para dar à sua conta acesso de administração (depois de a criar na aplicação):
--   update users set papel = 'admin' where email = 'o-seu-email@exemplo.com';
