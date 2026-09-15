// Motor de disponibilidade.
//
// Funções puras: recebem o horário semanal do médico, os intervalos em que
// ele não pode receber ninguém (consultas e bloqueios) e o instante actual,
// e devolvem as vagas. A mesma regra vive na base de dados
// (supabase/migrations/0002_regras_de_agenda.sql) — aqui serve para desenhar
// a agenda sem esperar pelo servidor; lá é a palavra final.

import type { HorarioTrabalho, Indisponivel, Medico, ErroAgenda } from "./tipos";
import { type Dia, type Hora, diaDaSemana, diaDe, hoje, horaDeMinutos, instante, minutosDe, somarDias } from "./tempo";

export type EstadoVaga = "livre" | "ocupada" | "bloqueada" | "passada";

export interface Vaga {
  dia: Dia;
  hora: Hora;
  inicio: string;
  fim: string;
  estado: EstadoVaga;
}

export interface ContextoAgenda {
  medico: Pick<Medico, "id" | "activo" | "duracaoMin">;
  horarios: HorarioTrabalho[];
  indisponiveis: Indisponivel[];
  agora: Date;
  /** Uma consulta a ignorar (a que está a ser reagendada). */
  ignorar?: { inicio: string } | null;
}

export type CodigoErroAgenda = ErroAgenda["codigo"];

const ms = (iso: string) => Date.parse(iso);
const sobrepoe = (aIni: number, aFim: number, bIni: number, bFim: number) => aIni < bFim && bIni < aFim;

export function vagasDoDia(ctx: ContextoAgenda, dia: Dia): Vaga[] {
  const ds = diaDaSemana(dia);
  const dur = ctx.medico.duracaoMin;
  const agora = ctx.agora.getTime();
  const ignorarMs = ctx.ignorar ? ms(ctx.ignorar.inicio) : null;

  const periodos = ctx.horarios
    .filter((h) => h.medicoId === ctx.medico.id && h.diaSemana === ds)
    .sort((a, b) => minutosDe(a.inicio) - minutosDe(b.inicio));

  // Só interessa o que toca neste dia (com folga de um dia para bloqueios longos).
  const inicioDia = instante(dia, "00:00").getTime();
  const fimDia = inicioDia + 86_400_000;
  const relevantes = ctx.indisponiveis.filter(
    (i) =>
      (i.medicoId === ctx.medico.id || (i.tipo === "bloqueio" && i.medicoId === null)) &&
      sobrepoe(ms(i.inicio), ms(i.fim), inicioDia, fimDia) &&
      !(i.tipo === "consulta" && ignorarMs !== null && ms(i.inicio) === ignorarMs),
  );

  const vagas: Vaga[] = [];
  const vistas = new Set<string>();

  for (const p of periodos) {
    const fimPeriodo = minutosDe(p.fim);
    for (let m = minutosDe(p.inicio); m + dur <= fimPeriodo; m += dur) {
      const hora = horaDeMinutos(m);
      if (vistas.has(hora)) continue;
      vistas.add(hora);

      const ini = instante(dia, hora).getTime();
      const fim = ini + dur * 60_000;
      let estado: EstadoVaga = "livre";
      if (ini <= agora) estado = "passada";
      else if (relevantes.some((i) => i.tipo === "bloqueio" && sobrepoe(ini, fim, ms(i.inicio), ms(i.fim)))) estado = "bloqueada";
      else if (relevantes.some((i) => i.tipo === "consulta" && sobrepoe(ini, fim, ms(i.inicio), ms(i.fim)))) estado = "ocupada";

      vagas.push({ dia, hora, inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(), estado });
    }
  }

  return vagas.sort((a, b) => ms(a.inicio) - ms(b.inicio));
}

/** Só as vagas que um paciente pode escolher. */
export function vagasLivres(ctx: ContextoAgenda, dia: Dia): Vaga[] {
  if (!ctx.medico.activo) return [];
  return vagasDoDia(ctx, dia).filter((v) => v.estado === "livre");
}

export interface ResumoDia {
  dia: Dia;
  trabalha: boolean;
  livres: number;
}

export function resumoDias(ctx: ContextoAgenda, deDia: Dia, quantos: number): ResumoDia[] {
  const out: ResumoDia[] = [];
  for (let i = 0; i < quantos; i++) {
    const dia = somarDias(deDia, i);
    const todas = vagasDoDia(ctx, dia);
    out.push({
      dia,
      trabalha: todas.length > 0,
      livres: ctx.medico.activo ? todas.filter((v) => v.estado === "livre").length : 0,
    });
  }
  return out;
}

export function proximaVaga(ctx: ContextoAgenda, horizonteDias = 45): Vaga | null {
  const primeiro = hoje(ctx.agora);
  for (let i = 0; i < horizonteDias; i++) {
    const livre = vagasLivres(ctx, somarDias(primeiro, i))[0];
    if (livre) return livre;
  }
  return null;
}

/**
 * Diz porque é que um instante não pode ser marcado, ou null se pode.
 * Não sabe de pacientes — o conflito do próprio paciente é verificado à parte.
 */
export function validarMarcacao(ctx: ContextoAgenda, inicioISO: string): CodigoErroAgenda | null {
  if (!ctx.medico.activo) return "medico_inactivo";
  const alvo = ms(inicioISO);
  if (Number.isNaN(alvo)) return "fora_do_horario";
  if (alvo <= ctx.agora.getTime()) return "passado";

  const vaga = vagasDoDia(ctx, diaDe(inicioISO)).find((v) => ms(v.inicio) === alvo);
  if (!vaga) return "fora_do_horario";
  if (vaga.estado === "passada") return "passado";
  if (vaga.estado === "bloqueada") return "bloqueado";
  if (vaga.estado === "ocupada") return "ocupado";
  return null;
}

export const MENSAGENS_ERRO: Record<CodigoErroAgenda, string> = {
  passado: "Esse horário já passou. Escolha outro.",
  fora_do_horario: "O médico não atende a essa hora.",
  bloqueado: "Esse horário não está disponível.",
  ocupado: "Esse horário acabou de ser reservado. Escolha outro.",
  paciente_ocupado: "Esta pessoa já tem uma consulta marcada a essa hora.",
  medico_inactivo: "Este médico não está a receber marcações.",
  sem_permissao: "Não tem permissão para fazer isto.",
  nao_encontrada: "Não encontrámos esta consulta.",
  estado_invalido: "Esta consulta já não pode ser alterada.",
};

export function erroAgenda(codigo: CodigoErroAgenda): ErroAgenda {
  const e = new Error(MENSAGENS_ERRO[codigo]) as ErroAgenda;
  e.codigo = codigo;
  return e;
}

export function eErroAgenda(e: unknown): e is ErroAgenda {
  return e instanceof Error && typeof (e as ErroAgenda).codigo === "string";
}
