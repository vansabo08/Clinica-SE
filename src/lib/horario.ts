import type { Bloqueio, HorarioTrabalho } from "./tipos";
import { DIAS_SEMANA_CURTOS, dataCurta, diaDe, diaRelativo, horaDe, somarDias } from "./tempo";
import { juntarNomes } from "./texto";

/** "Seg a Sex" + "08:00 às 17:00"; "Seg, Qua e Sex" + "08:00 às 13:00". */
export function resumoHorario(horarios: Pick<HorarioTrabalho, "diaSemana" | "inicio" | "fim">[]): { dias: string; horas: string } | null {
  if (!horarios.length) return null;
  const posicao = (d: number) => (d + 6) % 7; // segunda primeiro
  const dias = [...new Set(horarios.map((h) => h.diaSemana))].sort((a, b) => posicao(a) - posicao(b));
  const partes: string[] = [];
  for (let i = 0; i < dias.length; ) {
    let j = i;
    while (j + 1 < dias.length && posicao(dias[j + 1]) === posicao(dias[j]) + 1) j++;
    if (j - i >= 2) partes.push(`${DIAS_SEMANA_CURTOS[dias[i]]} a ${DIAS_SEMANA_CURTOS[dias[j]]}`);
    else for (let k = i; k <= j; k++) partes.push(DIAS_SEMANA_CURTOS[dias[k]]);
    i = j + 1;
  }
  const inicio = horarios.map((h) => h.inicio).sort()[0];
  const fim = horarios.map((h) => h.fim).sort().reverse()[0];
  return { dias: juntarNomes(partes), horas: `${inicio} às ${fim}` };
}

/** Texto curto de um bloqueio: "Hoje, 10:00 às 11:00", "17 Set", "14 Set a 20 Set". */
export function textoIntervalo(b: Pick<Bloqueio, "inicio" | "fim">): string {
  const di = diaDe(b.inicio);
  const df = diaDe(b.fim);
  const hi = horaDe(b.inicio);
  const hf = horaDe(b.fim);
  if (hi === "00:00" && hf === "00:00") {
    const ultimo = somarDias(df, -1);
    return di === ultimo ? diaRelativo(di) : `${dataCurta(di)} a ${dataCurta(ultimo)}`;
  }
  if (di === df) return `${diaRelativo(di)}, ${hi} às ${hf}`;
  return `${dataCurta(di)}, ${hi} a ${dataCurta(df)}, ${hf}`;
}
