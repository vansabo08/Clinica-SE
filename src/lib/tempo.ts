// Tempo da clínica.
//
// A clínica fica em Luanda (WAT, UTC+1, sem hora de verão). Por isso o
// desvio é fixo e não precisamos de bibliotecas de fusos: guardamos
// instantes em UTC (ISO) e convertemos com uma soma.

export const FUSO = "Africa/Luanda";
const DESVIO_MIN = 60;

/** Dia civil em Luanda, no formato YYYY-MM-DD. */
export type Dia = string;
/** Hora de parede em Luanda, no formato HH:MM. */
export type Hora = string;

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_SEMANA_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const pad = (n: number) => String(n).padStart(2, "0");

function relogioLuanda(instante: Date | string) {
  const t = typeof instante === "string" ? Date.parse(instante) : instante.getTime();
  return new Date(t + DESVIO_MIN * 60_000);
}

export function diaDe(instante: Date | string): Dia {
  const d = relogioLuanda(instante);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function horaDe(instante: Date | string): Hora {
  const d = relogioLuanda(instante);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** O instante (UTC) que corresponde a um dia e hora de parede em Luanda. */
export function instante(dia: Dia, hora: Hora): Date {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return new Date(Date.UTC(a, m - 1, d, h, mi) - DESVIO_MIN * 60_000);
}

export function instanteISO(dia: Dia, hora: Hora): string {
  return instante(dia, hora).toISOString();
}

export function hoje(agora: Date = new Date()): Dia {
  return diaDe(agora);
}

export function somarDias(dia: Dia, n: number): Dia {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function somarMinutos(iso: string, min: number): string {
  return new Date(Date.parse(iso) + min * 60_000).toISOString();
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(dia: Dia): number {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function minutosDe(hora: Hora): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function horaDeMinutos(min: number): Hora {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function diferencaDias(de: Dia, ate: Dia): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function inicioDaSemana(dia: Dia): Dia {
  // Semanas começam à segunda-feira.
  const ds = diaDaSemana(dia);
  return somarDias(dia, ds === 0 ? -6 : 1 - ds);
}

export function inicioDoMes(dia: Dia): Dia {
  return `${dia.slice(0, 7)}-01`;
}

export function diasNoMes(dia: Dia): number {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

// ------------------------------------------------------------
// Formatação
// ------------------------------------------------------------

const partes = (dia: Dia) => dia.split("-").map(Number) as [number, number, number];

/** 18 Setembro 2026 */
export function dataLonga(dia: Dia): string {
  const [a, m, d] = partes(dia);
  return `${d} ${MESES[m - 1]} ${a}`;
}

/** 18 Set */
export function dataCurta(dia: Dia): string {
  const [, m, d] = partes(dia);
  return `${d} ${MESES_CURTOS[m - 1]}`;
}

/** Setembro 2026 */
export function mesAno(dia: Dia): string {
  const [a, m] = partes(dia);
  return `${MESES[m - 1]} ${a}`;
}

export function nomeMesCurto(dia: Dia): string {
  return MESES_CURTOS[partes(dia)[1] - 1];
}

export function nomeDiaSemana(dia: Dia): string {
  return DIAS_SEMANA[diaDaSemana(dia)];
}

/** Hoje · Amanhã · Sexta, 18 Setembro */
export function diaRelativo(dia: Dia, agora: Date = new Date()): string {
  const diff = diferencaDias(hoje(agora), dia);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const [, m, d] = partes(dia);
  return `${nomeDiaSemana(dia)}, ${d} ${MESES[m - 1]}`;
}

/** Hoje às 14:30 · Amanhã às 09:00 · Sex, 18 Set às 10:00 */
export function quandoCurto(iso: string, agora: Date = new Date()): string {
  const dia = diaDe(iso);
  const diff = diferencaDias(hoje(agora), dia);
  const hora = horaDe(iso);
  if (diff === 0) return `Hoje às ${hora}`;
  if (diff === 1) return `Amanhã às ${hora}`;
  return `${DIAS_SEMANA_CURTOS[diaDaSemana(dia)]}, ${dataCurta(dia)} às ${hora}`;
}

/** agora mesmo · há 5 min · há 3 h · ontem · 12 Set */
export function haQuanto(iso: string, agora: Date = new Date()): string {
  const min = Math.round((agora.getTime() - Date.parse(iso)) / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60 && diaDe(iso) === hoje(agora)) return `há ${Math.round(min / 60)} h`;
  if (diferencaDias(diaDe(iso), hoje(agora)) === 1) return "ontem";
  return dataCurta(diaDe(iso));
}

export function saudacao(agora: Date = new Date()): string {
  const h = Number(horaDe(agora).slice(0, 2));
  if (h < 12) return "Bom dia";
  if (h < 19) return "Boa tarde";
  return "Boa noite";
}

export function idade(dataNascimento: Dia | null | undefined, agora: Date = new Date()): number | null {
  if (!dataNascimento) return null;
  const [a, m, d] = partes(dataNascimento);
  const [ha, hm, hd] = partes(hoje(agora));
  let anos = ha - a;
  if (hm < m || (hm === m && hd < d)) anos -= 1;
  return anos;
}

/** "7 anos", "1 ano", "menos de 1 ano" — ou null sem data. */
export function idadeLegivel(dataNascimento: Dia | null | undefined, agora: Date = new Date()): string | null {
  const anos = idade(dataNascimento, agora);
  if (anos === null) return null;
  if (anos < 1) return "menos de 1 ano";
  return anos === 1 ? "1 ano" : `${anos} anos`;
}
