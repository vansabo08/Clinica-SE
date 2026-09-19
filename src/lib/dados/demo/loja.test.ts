import { beforeEach, describe, expect, it } from "vitest";
import { RepositorioDemo } from "./loja";
import { vagasLivres, type Vaga } from "../../disponibilidade";
import { diaDe, hoje, horaDe, instanteISO, somarDias } from "../../tempo";
import type { ErroAgenda } from "../../tipos";

// Segunda-feira, 14 de Setembro de 2026, 10:15 em Luanda.
let relogio = new Date("2026-09-14T09:15:00Z");
let repo: RepositorioDemo;

beforeEach(() => {
  relogio = new Date("2026-09-14T09:15:00Z");
  repo = new RepositorioDemo({ persistir: false, relogio: () => relogio });
});

async function vagasDe(medicoId: string, dias = 21): Promise<Vaga[]> {
  const medico = (await repo.medicos()).find((m) => m.id === medicoId)!;
  const horarios = await repo.horarios(medicoId);
  const inicio = hoje(relogio);
  const indisponiveis = await repo.indisponiveis(medicoId, instanteISO(inicio, "00:00"), instanteISO(somarDias(inicio, dias), "00:00"));
  const out: Vaga[] = [];
  for (let i = 0; i < dias; i++) out.push(...vagasLivres({ medico, horarios, indisponiveis, agora: relogio }, somarDias(inicio, i)));
  return out;
}

const codigo = (p: Promise<unknown>) => p.then(() => "ok", (e: ErroAgenda) => e.codigo ?? e.message);

describe("regras de agenda", () => {
  it("dois pacientes nunca ficam com o mesmo horário", async () => {
    await repo.entrarComo("paciente");
    const [vaga] = await vagasDe("m-joao");
    await repo.marcar({ pacienteId: "p-maria", medicoId: "m-joao", inicio: vaga.inicio });

    await repo.entrarComo("rececao");
    const outro = (await repo.pacientes()).find((p) => !p.id.startsWith("p-maria"))!;
    expect(await codigo(repo.marcar({ pacienteId: outro.id, medicoId: "m-joao", inicio: vaga.inicio }))).toBe("ocupado");
  });

  it("a vaga reservada desaparece de imediato para os outros", async () => {
    await repo.entrarComo("paciente");
    const [vaga] = await vagasDe("m-ana");
    await repo.marcar({ pacienteId: "p-tiago", medicoId: "m-ana", inicio: vaga.inicio });
    expect((await vagasDe("m-ana")).some((v) => v.inicio === vaga.inicio)).toBe(false);
  });

  it("não marca no passado nem em horário bloqueado", async () => {
    await repo.entrarComo("rececao");
    expect(await codigo(repo.marcar({ pacienteId: "p-maria", medicoId: "m-joao", inicio: instanteISO(hoje(relogio), "08:00") }))).toBe("passado");
    // A Dra. Helena está de férias esta semana.
    expect(await codigo(repo.marcar({ pacienteId: "p-maria", medicoId: "m-helena", inicio: instanteISO(somarDias(hoje(relogio), 2), "08:00") }))).toBe("bloqueado");
    // 17 de Setembro é feriado nacional: a clínica inteira está fechada.
    expect(await codigo(repo.marcar({ pacienteId: "p-maria", medicoId: "m-ana", inicio: instanteISO("2026-09-17", "09:00") }))).toBe("bloqueado");
  });

  it("um paciente não fica com duas consultas à mesma hora", async () => {
    await repo.entrarComo("paciente");
    const joao = await vagasDe("m-joao");
    const paulo = new Set((await vagasDe("m-paulo")).map((v) => v.inicio));
    const comum = joao.find((v) => paulo.has(v.inicio))!;
    await repo.marcar({ pacienteId: "p-maria", medicoId: "m-joao", inicio: comum.inicio });
    expect(await codigo(repo.marcar({ pacienteId: "p-maria", medicoId: "m-paulo", inicio: comum.inicio }))).toBe("paciente_ocupado");
    // O filho pode ter consulta à mesma hora — é outra pessoa.
    expect(await codigo(repo.marcar({ pacienteId: "p-tiago", medicoId: "m-paulo", inicio: comum.inicio }))).toBe("ok");
  });

  it("reagendar liberta o horário antigo e volta a pedir confirmação", async () => {
    await repo.entrarComo("paciente");
    const antes = (await repo.consulta("c-maria-cardio"))!;
    const nova = (await vagasDe("m-joao")).find((v) => v.inicio !== antes.inicio)!;
    const depois = await repo.reagendar("c-maria-cardio", nova.inicio);
    expect(depois.inicio).toBe(nova.inicio);
    expect(depois.estado).toBe("aguardando");
    expect(depois.reagendadaDe).toBe(antes.inicio);
    expect((await vagasDe("m-joao")).some((v) => v.inicio === antes.inicio)).toBe(true);
  });

  it("cancelar liberta o horário e avisa quem está na lista de espera", async () => {
    await repo.entrarComo("rececao");
    const alvo = (await repo.consultas({ medicoId: "m-joao", de: relogio.toISOString() })).find(
      (c) => c.estado === "confirmada" && c.pacienteId !== "p-maria" && diaDe(c.inicio) !== hoje(relogio),
    )!;

    await repo.entrarComo("paciente");
    await repo.entrarListaEspera({ pacienteId: "p-maria", especialidadeId: "esp-cardio", medicoId: "m-joao", dataDesejada: diaDe(alvo.inicio) });

    await repo.entrarComo("rececao");
    await repo.cancelar(alvo.id);
    expect((await repo.indisponiveis("m-joao", alvo.inicio, alvo.fim)).filter((i) => i.tipo === "consulta")).toEqual([]);

    await repo.entrarComo("paciente");
    const vaga = (await repo.notificacoes()).find((n) => n.tipo === "vaga" && n.dados?.inicio === alvo.inicio);
    expect(vaga?.corpo).toContain(horaDe(alvo.inicio));
  });

  it("o lembrete aparece 24 horas antes da consulta", async () => {
    await repo.entrarComo("paciente");
    const vaga = (await vagasDe("m-sofia")).find((v) => Date.parse(v.inicio) - relogio.getTime() > 48 * 3_600_000)!;
    const c = await repo.marcar({ pacienteId: "p-maria", medicoId: "m-sofia", inicio: vaga.inicio });
    const lembretes = async () => (await repo.notificacoes()).filter((n) => n.tipo === "lembrete" && n.consultaId === c.id);
    expect(await lembretes()).toHaveLength(0);
    relogio = new Date(Date.parse(vaga.inicio) - 23 * 3_600_000);
    const [l] = await lembretes();
    expect(l.corpo).toBe(`Lembrete: você tem uma consulta amanhã às ${horaDe(vaga.inicio)} na Clínica Sagrada Esperança.`);
  });
});

describe("permissões", () => {
  it("sem sessão não se lê a agenda", async () => {
    expect(await codigo(repo.consultas())).toBe("sem_permissao");
  });

  it("o paciente só vê as consultas da sua família", async () => {
    await repo.entrarComo("paciente");
    const familia = new Set(["p-maria", "p-tiago", "p-luena", "p-domingos"]);
    const minhas = await repo.consultas();
    expect(minhas.length).toBeGreaterThan(0);
    expect(minhas.every((c) => familia.has(c.pacienteId))).toBe(true);
    expect((await repo.pacientes()).every((p) => familia.has(p.id))).toBe(true);

    await repo.entrarComo("rececao");
    const deOutro = (await repo.consultas()).find((c) => !familia.has(c.pacienteId))!;
    await repo.entrarComo("paciente");
    expect(await repo.consulta(deOutro.id)).toBeNull();
    expect(await codigo(repo.cancelar(deOutro.id))).toBe("sem_permissao");
    expect(await codigo(repo.marcar({ pacienteId: deOutro.pacienteId, medicoId: "m-joao", inicio: deOutro.inicio }))).toBe("sem_permissao");
  });

  it("o médico só vê a própria agenda e não gere a clínica", async () => {
    await repo.entrarComo("medico");
    const agenda = await repo.consultas();
    expect(agenda.every((c) => c.medicoId === "m-joao")).toBe(true);
    expect(await codigo(repo.guardarEspecialidade({ nome: "Neurologia", descricao: "", icone: "outra", ordem: 9, activa: true }))).toBe("sem_permissao");
    expect(await codigo(repo.bloquear({ medicoId: "m-ana", inicio: instanteISO("2026-09-21", "08:00"), fim: instanteISO("2026-09-21", "09:00"), motivo: "reuniao", nota: "" }))).toBe("sem_permissao");
  });

  it("a receção confirma e o paciente é avisado", async () => {
    await repo.entrarComo("rececao");
    await repo.mudarEstado("c-tiago-pediatria", "confirmada");
    await repo.entrarComo("paciente");
    const aviso = (await repo.notificacoes()).find((n) => n.tipo === "confirmacao" && n.consultaId === "c-tiago-pediatria");
    expect(aviso?.corpo).toContain("de Tiago");
  });

  it("o médico é avisado da marcação e confirma-a", async () => {
    await repo.entrarComo("paciente");
    const [vaga] = await vagasDe("m-joao");
    const c = await repo.marcar({ pacienteId: "p-maria", medicoId: "m-joao", inicio: vaga.inicio });

    await repo.entrarComo("medico");
    const aviso = (await repo.notificacoes()).find((n) => n.consultaId === c.id);
    expect(aviso?.titulo).toBe("Nova consulta por confirmar");
    await repo.mudarEstado(c.id, "confirmada");

    await repo.entrarComo("paciente");
    const confirmacao = (await repo.notificacoes()).find((n) => n.tipo === "confirmacao" && n.consultaId === c.id);
    expect(confirmacao?.corpo).toMatch(/^Dr\. João Silva confirmou a consulta/);
  });

  it("o médico recusa com motivo: o paciente é avisado e o horário fica livre", async () => {
    await repo.entrarComo("paciente");
    const [vaga] = await vagasDe("m-joao");
    const c = await repo.marcar({ pacienteId: "p-maria", medicoId: "m-joao", inicio: vaga.inicio });
    expect(await codigo(repo.recusar(c.id, ""))).toBe("sem_permissao");

    await repo.entrarComo("rececao");
    expect(await codigo(repo.recusar(c.id, ""))).toBe("sem_permissao");

    await repo.entrarComo("medico");
    await repo.recusar(c.id, "Estarei no bloco operatório");
    const depois = (await repo.consulta(c.id))!;
    expect(depois.estado).toBe("cancelada");
    expect(depois.recusada).toBe(true);
    expect(await codigo(repo.recusar(c.id, ""))).toBe("estado_invalido");
    expect((await vagasDe("m-joao")).some((v) => v.inicio === vaga.inicio)).toBe(true);

    await repo.entrarComo("paciente");
    const aviso = (await repo.notificacoes()).find((n) => n.tipo === "cancelamento" && n.consultaId === c.id);
    expect(aviso?.titulo).toBe("Consulta não confirmada");
    expect(aviso?.corpo).toContain("Motivo: Estarei no bloco operatório.");
  });

  it("muda a palavra-passe só com a actual certa", async () => {
    await repo.entrarComo("paciente");
    expect(await codigo(repo.mudarSenha("nova-senha-1", "errada"))).toBe("A palavra-passe actual não está certa.");
    await repo.mudarSenha("nova-senha-1", "demo");
    await repo.sair();
    expect(await codigo(repo.entrar("maria@demo.ao", "demo"))).toBe("Email ou palavra-passe incorrectos.");
    expect((await repo.entrar("maria@demo.ao", "nova-senha-1")).nome).toBe("Maria Kiala");
  });
});
