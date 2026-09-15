import { describe, expect, it } from "vitest";
import { proximaVaga, resumoDias, vagasDoDia, vagasLivres, validarMarcacao, type ContextoAgenda } from "./disponibilidade";
import { instanteISO } from "./tempo";
import type { HorarioTrabalho, Indisponivel } from "./tipos";

const SEGUNDA = "2026-09-14";
const SEXTA = "2026-09-18";

const horarios: HorarioTrabalho[] = [
  { id: "h1", medicoId: "m1", diaSemana: 5, inicio: "08:00", fim: "12:00" },
  { id: "h2", medicoId: "m1", diaSemana: 5, inicio: "14:00", fim: "17:00" },
  { id: "h3", medicoId: "m1", diaSemana: 1, inicio: "08:00", fim: "10:00" },
];

function ctx(extra: Partial<ContextoAgenda> = {}): ContextoAgenda {
  return {
    medico: { id: "m1", activo: true, duracaoMin: 30 },
    horarios,
    indisponiveis: [],
    agora: new Date(instanteISO(SEGUNDA, "09:05")),
    ...extra,
  };
}

const consulta = (dia: string, ini: string, fim: string, medicoId = "m1"): Indisponivel => ({ medicoId, inicio: instanteISO(dia, ini), fim: instanteISO(dia, fim), tipo: "consulta" });
const bloqueio = (dia: string, ini: string, fim: string, medicoId: string | null = "m1"): Indisponivel => ({ medicoId, inicio: instanteISO(dia, ini), fim: instanteISO(dia, fim), tipo: "bloqueio" });

describe("vagasDoDia", () => {
  it("gera vagas dentro dos períodos sem passar do fim", () => {
    const vagas = vagasDoDia(ctx(), SEXTA);
    expect(vagas.map((v) => v.hora)).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);
  });

  it("não inventa vagas em dias sem horário", () => {
    expect(vagasDoDia(ctx(), "2026-09-15")).toEqual([]);
  });

  it("guarda os instantes no fuso de Luanda (UTC+1)", () => {
    const v = vagasDoDia(ctx(), SEXTA).find((x) => x.hora === "14:30")!;
    expect(v.inicio).toBe("2026-09-18T13:30:00.000Z");
    expect(v.fim).toBe("2026-09-18T14:00:00.000Z");
  });

  it("marca como passadas as vagas que já começaram", () => {
    const vagas = vagasDoDia(ctx(), SEGUNDA);
    expect(vagas.map((v) => [v.hora, v.estado])).toEqual([
      ["08:00", "passada"],
      ["08:30", "passada"],
      ["09:00", "passada"],
      ["09:30", "livre"],
    ]);
  });

  it("uma consulta ocupa a vaga do seu médico e não a de outro", () => {
    const c = ctx({ indisponiveis: [consulta(SEXTA, "09:00", "09:30"), consulta(SEXTA, "10:00", "10:30", "m2")] });
    const livres = vagasLivres(c, SEXTA).map((v) => v.hora);
    expect(livres).not.toContain("09:00");
    expect(livres).toContain("10:00");
  });

  it("uma consulta que atravessa duas vagas ocupa as duas", () => {
    const c = ctx({ indisponiveis: [consulta(SEXTA, "09:15", "10:00")] });
    const estados = Object.fromEntries(vagasDoDia(c, SEXTA).map((v) => [v.hora, v.estado]));
    expect(estados["09:00"]).toBe("ocupada");
    expect(estados["09:30"]).toBe("ocupada");
    expect(estados["10:00"]).toBe("livre");
  });

  it("bloqueios do médico e da clínica inteira nunca aparecem como livres", () => {
    const c = ctx({ indisponiveis: [bloqueio(SEXTA, "08:00", "09:00"), bloqueio(SEXTA, "14:00", "17:00", null), bloqueio(SEXTA, "11:00", "12:00", "m2")] });
    const livres = vagasLivres(c, SEXTA).map((v) => v.hora);
    expect(livres).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("um médico inactivo não tem vagas livres", () => {
    expect(vagasLivres(ctx({ medico: { id: "m1", activo: false, duracaoMin: 30 } }), SEXTA)).toEqual([]);
  });
});

describe("validarMarcacao", () => {
  it("aceita uma vaga livre", () => {
    expect(validarMarcacao(ctx(), instanteISO(SEXTA, "14:30"))).toBeNull();
  });

  it("recusa o passado", () => {
    expect(validarMarcacao(ctx(), instanteISO(SEGUNDA, "08:30"))).toBe("passado");
  });

  it("recusa horas fora do horário ou desalinhadas com a duração", () => {
    expect(validarMarcacao(ctx(), instanteISO(SEXTA, "12:00"))).toBe("fora_do_horario");
    expect(validarMarcacao(ctx(), instanteISO(SEXTA, "08:15"))).toBe("fora_do_horario");
    expect(validarMarcacao(ctx(), instanteISO("2026-09-15", "09:00"))).toBe("fora_do_horario");
  });

  it("recusa vagas ocupadas e bloqueadas", () => {
    const c = ctx({ indisponiveis: [consulta(SEXTA, "09:00", "09:30"), bloqueio(SEXTA, "10:00", "11:00")] });
    expect(validarMarcacao(c, instanteISO(SEXTA, "09:00"))).toBe("ocupado");
    expect(validarMarcacao(c, instanteISO(SEXTA, "10:30"))).toBe("bloqueado");
  });

  it("recusa médico inactivo", () => {
    expect(validarMarcacao(ctx({ medico: { id: "m1", activo: false, duracaoMin: 30 } }), instanteISO(SEXTA, "09:00"))).toBe("medico_inactivo");
  });

  it("ao reagendar ignora a própria consulta", () => {
    const c = ctx({ indisponiveis: [consulta(SEXTA, "14:30", "15:00")], ignorar: { inicio: instanteISO(SEXTA, "14:30") } });
    expect(validarMarcacao(c, instanteISO(SEXTA, "14:30"))).toBeNull();
  });
});

describe("resumo e próxima vaga", () => {
  it("encontra a primeira vaga livre a partir de agora", () => {
    expect(proximaVaga(ctx())?.inicio).toBe(instanteISO(SEGUNDA, "09:30"));
  });

  it("distingue dias sem horário de dias cheios", () => {
    const c = ctx({ indisponiveis: [consulta(SEXTA, "08:00", "12:00"), consulta(SEXTA, "14:00", "17:00")] });
    const r = Object.fromEntries(resumoDias(c, SEGUNDA, 5).map((d) => [d.dia, d]));
    expect(r["2026-09-15"]).toMatchObject({ trabalha: false, livres: 0 });
    expect(r[SEXTA]).toMatchObject({ trabalha: true, livres: 0 });
  });
});
