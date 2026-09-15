import { ChartColumn } from "lucide-react";
import { useMemo, useState } from "react";
import { Barras, CartaoGrafico, Colunas, MapaCalor, type Ponto } from "../../componentes/graficos";
import { Pagina } from "../../componentes/Shell";
import { CabecalhoPagina, Esqueleto, Segmentado, Vazio } from "../../componentes/ui";
import { type Dia, DIAS_SEMANA, dataCurta, diaDaSemana, diaDe, diaRelativo, hoje, horaDe, inicioDaSemana, inicioDoMes, instanteISO, mesAno, nomeMesCurto, somarDias } from "../../lib/tempo";
import type { ConsultaDetalhada } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";

type Periodo = "dias" | "semanas" | "meses";

// Cores de série: o verde da marca para consultas; as cores de estado para
// cancelamentos e faltas (é o que elas já significam no resto da aplicação).
const COR_CONSULTAS = "#0F5C4A";
const COR_CANCELAMENTOS = "#B23A32";
const COR_FALTAS = "#2C3230";
// Rampa sequencial de um só tom, do claro ao escuro.
const RAMPA_VERDE = ["#CFE5DA", "#9FCBB5", "#62A386", "#2F7A60", "#0F5C4A"];

const PERIODOS: Record<Periodo, { rotulo: string; descricao: string; quantos: number }> = {
  dias: { rotulo: "Por dia", descricao: "Últimos 14 dias", quantos: 14 },
  semanas: { rotulo: "Por semana", descricao: "Últimas 12 semanas", quantos: 12 },
  meses: { rotulo: "Por mês", descricao: "Últimos 6 meses", quantos: 6 },
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

export function Estatisticas() {
  const agora = useAgora(5 * 60_000);
  const hojeD = hoje(agora);
  const [periodo, setPeriodo] = useState<Periodo>("dias");
  const { dados: consultas } = useDados((r) => r.consultas({ de: instanteISO(somarDias(inicioDoMes(hojeD), -160), "00:00"), ate: instanteISO(somarDias(hojeD, 1), "00:00") }), [hojeD], ["consultas"]);

  const e = useMemo(() => {
    if (!consultas) return null;
    const { quantos } = PERIODOS[periodo];

    // Os baldes do período, do mais antigo ao mais recente.
    let chaves: Dia[];
    let chaveDe: (d: Dia) => Dia;
    let rotulos: (k: Dia) => { rotulo: string; rotuloLongo: string };
    if (periodo === "dias") {
      chaves = Array.from({ length: quantos }, (_, i) => somarDias(hojeD, i - quantos + 1));
      chaveDe = (d) => d;
      rotulos = (k) => ({ rotulo: String(Number(k.slice(8))), rotuloLongo: diaRelativo(k, agora) });
    } else if (periodo === "semanas") {
      const actual = inicioDaSemana(hojeD);
      chaves = Array.from({ length: quantos }, (_, i) => somarDias(actual, (i - quantos + 1) * 7));
      chaveDe = inicioDaSemana;
      rotulos = (k) => ({ rotulo: dataCurta(k), rotuloLongo: `Semana de ${dataCurta(k)}` });
    } else {
      chaves = [];
      let m = inicioDoMes(hojeD);
      for (let i = 0; i < quantos; i++) {
        chaves.unshift(m);
        m = inicioDoMes(somarDias(m, -1));
      }
      chaveDe = inicioDoMes;
      rotulos = (k) => ({ rotulo: nomeMesCurto(k), rotuloLongo: mesAno(k) });
    }

    const inicio = chaves[0];
    const noPeriodo = consultas.filter((c) => diaDe(c.inicio) >= inicio && diaDe(c.inicio) <= hojeD);
    const porBalde = new Map<Dia, ConsultaDetalhada[]>(chaves.map((k) => [k, []]));
    for (const c of noPeriodo) porBalde.get(chaveDe(diaDe(c.inicio)))?.push(c);

    const serie = (filtro: (c: ConsultaDetalhada) => boolean, detalhe?: (cs: ConsultaDetalhada[]) => string): Ponto[] =>
      chaves.map((k) => {
        const cs = porBalde.get(k) ?? [];
        return { ...rotulos(k), valor: cs.filter(filtro).length, detalhe: detalhe?.(cs) };
      });

    const marcadas = noPeriodo.filter((c) => c.estado !== "cancelada");
    const concluidas = noPeriodo.filter((c) => c.estado === "concluida").length;
    const faltas = noPeriodo.filter((c) => c.estado === "faltou").length;
    const canceladas = noPeriodo.length - marcadas.length;

    const contar = (chave: (c: ConsultaDetalhada) => string) => {
      const m = new Map<string, number>();
      for (const c of marcadas) m.set(chave(c), (m.get(chave(c)) ?? 0) + 1);
      return [...m.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor);
    };

    // Horários mais procurados: dia da semana × hora.
    const diasSemana = [1, 2, 3, 4, 5, 6];
    const horas = new Set<number>();
    const grelha = new Map<string, number>();
    for (const c of marcadas) {
      const h = Number(horaDe(c.inicio).slice(0, 2));
      const ds = diaDaSemana(diaDe(c.inicio));
      if (ds === 0) continue;
      horas.add(h);
      grelha.set(`${ds}|${h}`, (grelha.get(`${ds}|${h}`) ?? 0) + 1);
    }
    const listaHoras = [...horas].sort((a, b) => a - b);
    const horaMin = listaHoras[0] ?? 8;
    const horaMax = listaHoras[listaHoras.length - 1] ?? 17;
    const colunasHoras = Array.from({ length: horaMax - horaMin + 1 }, (_, i) => horaMin + i);

    return {
      total: marcadas.length,
      concluidas,
      faltas,
      canceladas,
      todas: noPeriodo.length,
      realizadas: concluidas + faltas,
      consultas: serie((c) => c.estado !== "cancelada", (cs) => `${cs.filter((c) => c.estado === "concluida").length} concluídas, ${cs.filter((c) => c.estado === "faltou").length} faltas`),
      cancelamentos: serie((c) => c.estado === "cancelada"),
      faltasSerie: serie((c) => c.estado === "faltou"),
      especialidades: contar((c) => c.especialidade.nome),
      medicos: contar((c) => `${c.medico.titulo} ${c.medico.nome}`).slice(0, 8),
      diasSemana,
      colunasHoras,
      grelha,
    };
  }, [consultas, periodo, hojeD, agora]);

  const tabelaSerie = (s: Ponto[], nome: string) => ({ colunas: ["Período", nome], linhas: s.map((p) => [p.rotuloLongo, p.valor]) });
  const nomeBalde = periodo === "dias" ? "dia" : periodo === "semanas" ? "semana" : "mês";

  return (
    <Pagina largura="larga">
      <CabecalhoPagina titulo="Estatísticas" texto={PERIODOS[periodo].descricao} />

      {/* Um só filtro, por cima de tudo o que ele muda. */}
      <Segmentado rotulo="Período" valor={periodo} aoMudar={setPeriodo} opcoes={(Object.keys(PERIODOS) as Periodo[]).map((p) => ({ valor: p, rotulo: PERIODOS[p].rotulo }))} />

      {!e ? (
        <Esqueleto className="mt-6 h-[36rem]" />
      ) : e.todas === 0 ? (
        <div className="cartao mt-6">
          <Vazio icone={<ChartColumn />} titulo="Ainda sem consultas neste período" texto="Os números aparecem assim que houver marcações." />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-cartao border border-linha bg-linha lg:grid-cols-4">
            {[
              { rotulo: "Consultas", valor: e.total, nota: `${e.concluidas} concluídas` },
              { rotulo: "Cancelamentos", valor: e.canceladas, nota: `${pct(e.canceladas, e.todas)} das marcações` },
              { rotulo: "Faltas", valor: e.faltas, nota: `${pct(e.faltas, e.realizadas)} das consultas que já passaram` },
              { rotulo: "Especialidade mais procurada", valor: e.especialidades[0]?.rotulo ?? "Nenhuma", nota: e.especialidades[0] ? `${e.especialidades[0].valor} consultas` : "" },
            ].map((t) => (
              <div key={t.rotulo} className="bg-white px-5 py-4">
                <dt className="text-sm text-grafite">{t.rotulo}</dt>
                <dd className={typeof t.valor === "number" ? "mt-1 text-[2rem] font-bold leading-10 text-tinta" : "mt-1 truncate text-xl font-bold leading-10 text-tinta"}>
                  {typeof t.valor === "number" ? t.valor.toLocaleString("pt-PT") : t.valor}
                </dd>
                <dd className="text-sm text-grafite">{t.nota}</dd>
              </div>
            ))}
          </dl>

          <CartaoGrafico titulo={`Consultas por ${nomeBalde}`} descricao="Marcações que não foram canceladas" tabela={tabelaSerie(e.consultas, "Consultas")}>
            <Colunas dados={e.consultas} cor={COR_CONSULTAS} altura={200} unidade="consultas" />
          </CartaoGrafico>

          <div className="grid gap-4 lg:grid-cols-2">
            <CartaoGrafico titulo="Cancelamentos" descricao={`Por ${nomeBalde}`} tabela={tabelaSerie(e.cancelamentos, "Cancelamentos")}>
              <Colunas dados={e.cancelamentos} cor={COR_CANCELAMENTOS} altura={140} unidade="cancelamentos" />
            </CartaoGrafico>
            <CartaoGrafico titulo="Faltas" descricao={`Por ${nomeBalde}`} tabela={tabelaSerie(e.faltasSerie, "Faltas")}>
              <Colunas dados={e.faltasSerie} cor={COR_FALTAS} altura={140} unidade="faltas" />
            </CartaoGrafico>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CartaoGrafico titulo="Especialidades mais procuradas" tabela={{ colunas: ["Especialidade", "Consultas"], linhas: e.especialidades.map((x) => [x.rotulo, x.valor]) }}>
              <Barras dados={e.especialidades} cor={COR_CONSULTAS} unidade="consultas" />
            </CartaoGrafico>
            <CartaoGrafico titulo="Médicos com mais consultas" tabela={{ colunas: ["Médico", "Consultas"], linhas: e.medicos.map((x) => [x.rotulo, x.valor]) }}>
              <Barras dados={e.medicos} cor={COR_CONSULTAS} unidade="consultas" />
            </CartaoGrafico>
          </div>

          <CartaoGrafico
            titulo="Horários mais procurados"
            descricao="Consultas por dia da semana e hora de início"
            tabela={{
              colunas: ["Dia", ...e.colunasHoras.map((h) => `${h}h`)],
              linhas: e.diasSemana.map((ds) => [DIAS_SEMANA[ds], ...e.colunasHoras.map((h) => e.grelha.get(`${ds}|${h}`) ?? 0)]),
            }}
          >
            <MapaCalor
              linhas={e.diasSemana.map((ds) => DIAS_SEMANA[ds].slice(0, 3))}
              colunas={e.colunasHoras.map((h) => `${h}h`)}
              valor={(l, c) => e.grelha.get(`${e.diasSemana[l]}|${e.colunasHoras[c]}`) ?? 0}
              rotuloCelula={(l, c, v) => `${DIAS_SEMANA[e.diasSemana[l]]}, ${String(e.colunasHoras[c]).padStart(2, "0")}:00: ${v} ${v === 1 ? "consulta" : "consultas"}`}
              rampa={RAMPA_VERDE}
            />
          </CartaoGrafico>
        </div>
      )}
    </Pagina>
  );
}
