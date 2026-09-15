// Corre as migrações num Postgres em memória (PGlite) e testa as regras de
// agenda e as permissões, como se fossem pedidos de utilizadores reais.
//
//   npm run test:sql
//
// O Supabase acrescenta o esquema auth e os papéis anon/authenticated;
// aqui fica um substituto mínimo com o mesmo comportamento.

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { btree_gist } });
let falhas = 0;
const ok = (nome) => console.log(`  ✓ ${nome}`);
const falhou = (nome, detalhe) => {
  falhas++;
  console.log(`  ✗ ${nome}\n      ${detalhe}`);
};

async function verificar(nome, fn) {
  try {
    const r = await fn();
    if (r === false) falhou(nome, "condição falsa");
    else ok(nome);
  } catch (e) {
    falhou(nome, e.message);
  }
}

/** Corre SQL como um utilizador autenticado (RLS ligada). */
async function como(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec("set local role authenticated");
    return (await tx.query(sql, params)).rows;
  });
}

/** Espera um erro com esta mensagem. */
async function recusa(uid, sql, params, esperado) {
  try {
    await como(uid, sql, params);
  } catch (e) {
    if (e.message.includes(esperado)) return true;
    throw new Error(`esperava "${esperado}", veio "${e.message}"`);
  }
  throw new Error(`esperava "${esperado}", mas passou`);
}

// ------------------------------------------------------------
// Substituto do Supabase
// ------------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', invited_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

for (const f of ["0001_esquema.sql", "0002_regras_de_agenda.sql", "0003_permissoes.sql", "0004_ajustes_de_seguranca.sql"]) {
  await db.exec(readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8"));
}
console.log("Migrações aplicadas.\n");

// ------------------------------------------------------------
// Dados: uma clínica pequena
// ------------------------------------------------------------
const TERESA = "00000000-0000-4000-a000-000000000001";
const MARIA = "00000000-0000-4000-a000-000000000002";
const CARLOS = "00000000-0000-4000-a000-000000000003";
const JOAO = "00000000-0000-4000-a000-000000000004";

const { rows: [esp] } = await db.query("insert into specialties (nome) values ('Cardiologia') returning id");
const { rows: [medico] } = await db.query("insert into doctors (nome, specialty_id, email, duracao_min) values ('João Silva', $1, 'joao@clinica.ao', 30) returning id", [esp.id]);
await db.query("insert into schedules (doctor_id, dia_semana, inicio, fim) select $1, d, '08:00', '12:00' from generate_series(0, 6) d", [medico.id]);

await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'teresa@clinica.ao', '{\"nome\":\"Teresa Sambo\"}')", [TERESA]);
await db.query("update users set papel = 'rececao' where id = $1", [TERESA]);
await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'maria@gmail.com', '{\"full_name\":\"Maria Kiala\"}')", [MARIA]);
await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'carlos@gmail.com', '{\"nome\":\"Carlos Manuel\",\"telefone\":\"923 456 789\"}')", [CARLOS]);
await db.query("insert into auth.users (id, email, invited_at) values ($1, 'joao@clinica.ao', now())", [JOAO]);

const pacienteDe = async (uid) => (await db.query("select id from patients where user_id = $1", [uid])).rows[0].id;
const pMaria = await pacienteDe(MARIA);
const pCarlos = await pacienteDe(CARLOS);

// Instantes em Luanda (UTC+1), como em src/lib/tempo.ts.
const hojeLuanda = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const dia = (n) => new Date(Date.parse(`${hojeLuanda}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const as = (d, hora) => new Date(Date.parse(`${d}T${hora}:00Z`) - 3_600_000).toISOString();
const amanha = dia(2); // depois de amanhã, para não depender da hora a que o teste corre
const MARCAR = "select * from marcar_consulta($1, $2, $3)";

console.log("Contas");
await verificar("uma conta nova vira paciente, com o nome do Google", async () => (await db.query("select nome, papel from users where id = $1", [MARIA])).rows[0].nome === "Maria Kiala");
await verificar("o telefone do registo fica só com 9 dígitos", async () => (await db.query("select telefone from patients where id = $1", [pCarlos])).rows[0].telefone === "923456789");
await verificar("um convite com o email do médico liga a conta ao médico", async () => (await db.query("select user_id from doctors where id = $1", [medico.id])).rows[0].user_id === JOAO);

console.log("\nMarcações");
let consultaMaria;
await verificar("a Maria marca uma vaga livre", async () => {
  [consultaMaria] = await como(MARIA, MARCAR, [pMaria, medico.id, as(amanha, "09:00")]);
  return consultaMaria.estado === "aguardando" && consultaMaria.canal === "app";
});
await verificar("o Carlos não fica com o mesmo horário", () => recusa(CARLOS, MARCAR, [pCarlos, medico.id, as(amanha, "09:00")], "ocupado"));
await verificar("nem com um horário desalinhado", () => recusa(CARLOS, MARCAR, [pCarlos, medico.id, as(amanha, "09:15")], "fora_do_horario"));
await verificar("nem fora do horário do médico", () => recusa(CARLOS, MARCAR, [pCarlos, medico.id, as(amanha, "14:00")], "fora_do_horario"));
await verificar("nem no passado", () => recusa(CARLOS, MARCAR, [pCarlos, medico.id, as(dia(-1), "09:00")], "passado"));
await verificar("nem em nome de outro paciente", () => recusa(CARLOS, MARCAR, [pMaria, medico.id, as(amanha, "10:00")], "sem_permissao"));
await verificar("mesmo com pedidos simultâneos, a base de dados recusa a sobreposição", async () => {
  try {
    await db.query("insert into appointments (patient_id, doctor_id, specialty_id, inicio, fim) values ($1, $2, $3, $4, $5)", [pCarlos, medico.id, esp.id, as(amanha, "09:00"), as(amanha, "09:30")]);
  } catch (e) {
    return e.message.includes("appointments_medico_sem_sobreposicao");
  }
  return false;
});

console.log("\nBloqueios");
await verificar("a receção bloqueia uma reunião", async () => {
  await como(TERESA, "insert into blocked_slots (doctor_id, inicio, fim, motivo) values ($1, $2, $3, 'reuniao')", [medico.id, as(amanha, "10:00"), as(amanha, "11:00")]);
  return true;
});
await verificar("horário bloqueado não se marca", () => recusa(CARLOS, MARCAR, [pCarlos, medico.id, as(amanha, "10:30")], "bloqueado"));
await verificar("o paciente não lê os motivos dos bloqueios", async () => (await como(CARLOS, "select count(*)::int n from blocked_slots"))[0].n === 0);
await verificar("mas vê que o horário está indisponível, sem saber de quem", async () => {
  const linhas = await como(CARLOS, "select * from agenda_indisponivel($1, $2, $3)", [medico.id, as(amanha, "00:00"), as(dia(3), "00:00")]);
  return linhas.length === 2 && linhas.every((l) => !("patient_id" in l));
});
await verificar("o médico sem permissão não bloqueia", () => recusa(JOAO, "insert into blocked_slots (doctor_id, inicio, fim, motivo) values ($1, $2, $3, 'ferias')", [medico.id, as(dia(5), "00:00"), as(dia(6), "00:00")], "row-level security"));

console.log("\nPrivacidade");
await verificar("o Carlos não vê as consultas da Maria", async () => (await como(CARLOS, "select count(*)::int n from appointments"))[0].n === 0);
await verificar("nem os dados dela", async () => (await como(CARLOS, "select id from patients")).every((p) => p.id === pCarlos));
await verificar("vê o nome do médico, mas não o telefone nem o email", async () => (await como(CARLOS, "select nome from doctors"))[0].nome === "João Silva" && (await recusa(CARLOS, "select telefone from doctors", [], "permission denied")));
await verificar("a receção lê os contactos dos médicos; o paciente não", async () => (await como(TERESA, "select email from medicos_completos()"))[0].email === "joao@clinica.ao" && (await como(CARLOS, "select count(*)::int n from medicos_completos()"))[0].n === 0);
await verificar("o médico vê a sua agenda e o paciente marcado", async () => (await como(JOAO, "select count(*)::int n from appointments"))[0].n === 1 && (await como(JOAO, "select id from patients")).length === 1);
await verificar("ninguém muda o próprio papel", () => recusa(CARLOS, "update users set papel = 'admin' where id = $1", [CARLOS], "sem_permissao"));
await verificar("ninguém cria avisos para outros", () => recusa(CARLOS, "select notificar($1, 'vaga', 'x', 'y')", [MARIA], "permission denied"));
await verificar("o paciente não escreve consultas directamente", () => recusa(CARLOS, "insert into appointments (patient_id, doctor_id, specialty_id, inicio, fim) values ($1, $2, $3, $4, $5)", [pCarlos, medico.id, esp.id, as(dia(4), "08:00"), as(dia(4), "08:30")], "row-level security"));

console.log("\nAvisos e lista de espera");
await verificar("a Maria recebe o aviso da marcação", async () => (await como(MARIA, "select corpo from notifications where tipo = 'marcacao'"))[0]?.corpo.includes("A clínica vai confirmar em breve"));
await verificar("a receção é avisada da marcação pela aplicação", async () => (await como(TERESA, "select titulo from notifications"))[0]?.titulo === "Nova marcação pela aplicação");
await verificar("o lembrete fica agendado para 24 horas antes", async () => {
  const [l] = await como(MARIA, "select agendada_para, corpo from notifications where tipo = 'lembrete'");
  return l && Date.parse(l.agendada_para) === Date.parse(as(amanha, "09:00")) - 86_400_000 && l.corpo === "Lembrete: você tem uma consulta amanhã às 09:00 na Clínica Sagrada Esperança.";
});
await verificar("o Carlos entra na lista de espera desse dia", async () => {
  await como(CARLOS, "select entrar_lista_espera($1, $2, $3, $4)", [pCarlos, esp.id, medico.id, amanha]);
  await como(CARLOS, "select entrar_lista_espera($1, $2, $3, $4)", [pCarlos, esp.id, medico.id, amanha]); // repetido não duplica
  return (await como(CARLOS, "select count(*)::int n from waitlist"))[0].n === 1;
});
await verificar("a Maria cancela e o lembrete dela desaparece", async () => {
  await como(MARIA, "select cancelar_consulta($1)", [consultaMaria.id]);
  return (await como(MARIA, "select count(*)::int n from notifications where tipo = 'lembrete'"))[0].n === 0;
});
await verificar("o Carlos é avisado da vaga, com a hora certa", async () => (await como(CARLOS, "select corpo from notifications where tipo = 'vaga'"))[0]?.corpo.includes("às 09:00"));
let consultaCarlos;
await verificar("o horário ficou livre e o Carlos marca-o", async () => {
  [consultaCarlos] = await como(CARLOS, MARCAR, [pCarlos, medico.id, as(amanha, "09:00")]);
  return consultaCarlos.estado === "aguardando";
});
await verificar("e sai da lista de espera como marcado", async () => (await como(CARLOS, "select estado from waitlist"))[0].estado === "marcada");

console.log("\nReagendar, estados e familiares");
await verificar("o Carlos reagenda e o horário antigo fica livre", async () => {
  await como(CARLOS, "select reagendar_consulta($1, $2)", [consultaCarlos.id, as(amanha, "11:00")]);
  const ocupados = await como(MARIA, "select inicio from agenda_indisponivel($1, $2, $3) where tipo = 'consulta'", [medico.id, as(amanha, "00:00"), as(dia(3), "00:00")]);
  return ocupados.length === 1 && Date.parse(ocupados[0].inicio) === Date.parse(as(amanha, "11:00"));
});
await verificar("a receção confirma e o paciente é avisado", async () => {
  await como(TERESA, "select mudar_estado_consulta($1, 'confirmada')", [consultaCarlos.id]);
  return (await como(CARLOS, "select count(*)::int n from notifications where tipo = 'confirmacao'"))[0].n === 1;
});
await verificar("o médico não cancela consultas", () => recusa(JOAO, "select mudar_estado_consulta($1, 'cancelada')", [consultaCarlos.id], "sem_permissao"));
await verificar("o médico não salta estados (confirmada → concluída)", () => recusa(JOAO, "select mudar_estado_consulta($1, 'concluida')", [consultaCarlos.id], "estado_invalido"));
await verificar("o médico inicia o atendimento", async () => (await como(JOAO, "select estado from mudar_estado_consulta($1, 'em_atendimento')", [consultaCarlos.id]))[0].estado === "em_atendimento");
await verificar("a Maria marca para o filho com a própria conta", async () => {
  const [{ adicionar_familiar: fam }] = await como(MARIA, "select adicionar_familiar('Tiago Kiala', 'filho', '2019-03-08')");
  const [{ patient_id }] = await como(MARIA, "select patient_id from family_members where id = $1", [fam]);
  const [c] = await como(MARIA, MARCAR, [patient_id, medico.id, as(amanha, "08:00")]);
  const [aviso] = await como(MARIA, "select corpo from notifications where appointment_id = $1 and tipo = 'marcacao'", [c.id]);
  return aviso.corpo.startsWith("A consulta de Tiago com Dr. João Silva");
});
await verificar("o Carlos não vê o filho da Maria", async () => (await como(CARLOS, "select count(*)::int n from patients where nome = 'Tiago Kiala'"))[0].n === 0);

console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodas as verificações passaram.");
process.exit(falhas ? 1 : 0);
