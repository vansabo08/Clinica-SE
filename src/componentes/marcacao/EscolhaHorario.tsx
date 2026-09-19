import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Hourglass } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { vagasDoDia, type ContextoAgenda, type Vaga } from "../../lib/disponibilidade";
import type { Medico } from "../../lib/tipos";
import {
  type Dia,
  DIAS_SEMANA_CURTOS,
  dataCurta,
  diaDaSemana,
  diaRelativo,
  diasNoMes,
  hoje,
  inicioDoMes,
  instanteISO,
  mesAno,
  somarDias,
} from "../../lib/tempo";
import { useAgora, useDados } from "../../lib/usarDados";
import { Botao, BotaoIcone, Esqueleto, Vazio, cx } from "../ui";

const HORIZONTE = 62;

type EstadoDia = "livre" | "cheio" | "fechado";

interface InfoDia {
  dia: Dia;
  estado: EstadoDia;
  livres: Vaga[];
}

export function EscolhaHorario({
  medico,
  ignorar,
  vagaActual,
  seleccionada,
  diaInicial,
  aoEscolher,
  aoListaEspera,
}: {
  medico: Medico;
  /** A consulta que está a ser reagendada: não conta como ocupada. */
  ignorar?: { inicio: string } | null;
  vagaActual?: string | null;
  /** Para quem escolhe e confirma no mesmo ecrã (receção): destaca a vaga escolhida. */
  seleccionada?: string | null;
  diaInicial?: Dia | null;
  aoEscolher: (v: Vaga) => void;
  aoListaEspera?: (dia: Dia) => void;
}) {
  const agora = useAgora(30_000);
  const hojeD = hoje(agora);

  const { dados } = useDados(
    async (r) => {
      const [horarios, indisponiveis] = await Promise.all([
        r.horarios(medico.id),
        r.indisponiveis(medico.id, instanteISO(hojeD, "00:00"), instanteISO(somarDias(hojeD, HORIZONTE), "00:00")),
      ]);
      return { horarios, indisponiveis };
    },
    [medico.id, hojeD],
    ["consultas", "bloqueios", "horarios"],
  );

  const dias = useMemo<InfoDia[]>(() => {
    if (!dados) return [];
    const ctx: ContextoAgenda = { medico, horarios: dados.horarios, indisponiveis: dados.indisponiveis, agora, ignorar };
    return Array.from({ length: HORIZONTE }, (_, i) => {
      const dia = somarDias(hojeD, i);
      const vagas = vagasDoDia(ctx, dia);
      const livres = medico.activo ? vagas.filter((v) => v.estado === "livre") : [];
      const aceita = vagas.some((v) => v.estado === "livre" || v.estado === "ocupada");
      return { dia, livres, estado: livres.length > 0 ? "livre" : aceita ? "cheio" : "fechado" };
    });
  }, [dados, medico, agora, hojeD, ignorar]);

  const porDia = useMemo(() => new Map(dias.map((d) => [d.dia, d])), [dias]);
  const [dia, setDia] = useState<Dia | null>(null);
  const [calendario, setCalendario] = useState(false);

  // Primeiro dia: o pedido, ou o primeiro com vagas.
  useEffect(() => {
    if (dia || !dias.length) return;
    const pedido = diaInicial ? porDia.get(diaInicial) : undefined;
    setDia(pedido && pedido.estado !== "fechado" ? pedido.dia : (dias.find((d) => d.estado === "livre")?.dia ?? hojeD));
  }, [dias, dia, diaInicial, porDia, hojeD]);

  const info = dia ? porDia.get(dia) : undefined;
  const livres = info?.livres ?? [];

  // Vagas que outra pessoa acabou de reservar: ficam riscadas uns instantes.
  const anteriores = useRef<{ dia: Dia | null; vagas: Map<string, Vaga> }>({ dia: null, vagas: new Map() });
  const [tiradas, setTiradas] = useState<Vaga[]>([]);
  const chaveLivres = livres.map((v) => v.inicio).join("|");
  useEffect(() => {
    const actuais = new Map(livres.map((v) => [v.inicio, v]));
    const antes = anteriores.current;
    if (antes.dia === dia) {
      const sumiram = [...antes.vagas.values()].filter((v) => !actuais.has(v.inicio) && Date.parse(v.inicio) > Date.now());
      if (sumiram.length) {
        setTiradas((t) => [...t, ...sumiram]);
        setTimeout(() => setTiradas((t) => t.filter((x) => !sumiram.includes(x))), 3200);
      }
    } else {
      setTiradas([]);
    }
    anteriores.current = { dia, vagas: actuais };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveLivres, dia]);

  const tira = useRef<HTMLDivElement>(null);
  function escolherDia(d: Dia) {
    setDia(d);
    setCalendario(false);
    requestAnimationFrame(() => tira.current?.querySelector<HTMLElement>(`[data-dia="${d}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }));
  }

  if (!dados || !dia) {
    return (
      <div aria-busy="true">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} className="h-[78px] w-[64px] shrink-0" />
          ))}
        </div>
        <Esqueleto className="mt-6 h-40" />
      </div>
    );
  }

  const semNada = dias.every((d) => d.estado === "fechado");
  const proximoLivre = dias.find((d) => d.dia > dia && d.estado === "livre");
  const visiveis = [...livres, ...tiradas.filter((t) => !livres.some((l) => l.inicio === t.inicio))].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const grupos = [
    { rotulo: "Manhã", vagas: visiveis.filter((v) => v.hora < "12:00") },
    { rotulo: "Tarde", vagas: visiveis.filter((v) => v.hora >= "12:00") },
  ].filter((g) => g.vagas.length);

  if (semNada) {
    return (
      <div className="cartao">
        <Vazio icone={<CalendarX2 />} titulo="Sem horários nas próximas semanas" texto="Este médico não tem agenda aberta nos próximos dois meses.">
          {aoListaEspera && (
            <Botao onClick={() => aoListaEspera(somarDias(hojeD, 1))} icone={<Hourglass className="h-5 w-5" />}>
              Entrar na lista de espera
            </Botao>
          )}
        </Vazio>
      </div>
    );
  }

  return (
    <div>
      {/* Tira de dias: hoje, amanhã e os próximos */}
      <div ref={tira} role="radiogroup" aria-label="Dia da consulta" className="sem-barra -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-1 sm:px-1">
        {dias.slice(0, 14).map((d) => (
          <BotaoDia key={d.dia} info={d} activo={d.dia === dia} hojeD={hojeD} aoEscolher={escolherDia} />
        ))}
        <button
          type="button"
          onClick={() => setCalendario((v) => !v)}
          aria-expanded={calendario}
          className={cx(
            "flex h-[78px] w-[64px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-cartao border text-xs font-semibold transition-colors",
            calendario ? "border-esperanca bg-esperanca-50 text-esperanca" : "border-linha bg-white text-grafite hover:border-esperanca-300",
          )}
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
          Mês
        </button>
      </div>

      {calendario && (
        <CalendarioMes
          className="anim-surgir mt-3"
          seleccionado={dia}
          hojeD={hojeD}
          ultimo={somarDias(hojeD, HORIZONTE - 1)}
          estadoDe={(d) => porDia.get(d)?.estado ?? "fechado"}
          aoEscolher={escolherDia}
        />
      )}

      <div aria-live="polite">
        <h3 className="mt-7 text-xl font-bold text-tinta">
          {diaRelativo(dia, agora)}
          {["Hoje", "Amanhã"].includes(diaRelativo(dia, agora)) && <span className="font-normal text-grafite">, {dataCurta(dia)}</span>}
        </h3>

        {tiradas.length > 0 && (
          <p className="mt-2 text-sm font-semibold text-estado-ambar">
            {tiradas.map((t) => t.hora).join(", ")} {tiradas.length === 1 ? "acabou de ser reservado" : "acabaram de ser reservados"} por outra pessoa.
          </p>
        )}

        {info?.estado === "livre" || tiradas.length > 0 ? (
          grupos.map((g) => (
            <div key={g.rotulo} className="mt-4">
              <p className="mb-2 text-sm font-semibold text-grafite">{g.rotulo}</p>
              <div className="anim-lista grid grid-cols-3 gap-2 sm:grid-cols-4">
                {g.vagas.map((v) => {
                  const tirada = !livres.some((l) => l.inicio === v.inicio);
                  const actual = v.inicio === vagaActual;
                  return (
                    <button
                      key={v.inicio}
                      type="button"
                      disabled={tirada || actual}
                      onClick={() => aoEscolher(v)}
                      className={cx(
                        "num relative h-12 rounded-vaga border text-base font-bold transition-[background-color,border-color,opacity,transform] duration-300",
                        tirada
                          ? "border-linha bg-papel text-nevoa line-through opacity-60"
                          : v.inicio === seleccionada
                            ? "border-esperanca bg-esperanca text-white"
                            : actual
                            ? "border-dashed border-esperanca-300 bg-esperanca-50 text-esperanca"
                            : "border-linha-forte bg-white text-tinta hover:border-esperanca hover:bg-esperanca-50 active:scale-[0.97]",
                      )}
                      aria-label={tirada ? `${v.hora}, acabou de ser reservado` : actual ? `${v.hora}, horário actual` : `Escolher ${v.hora}`}
                    >
                      {v.hora}
                      {actual && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-esperanca px-1.5 text-[10px] font-bold leading-4 text-white no-underline">actual</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="cartao mt-4">
            {info?.estado === "cheio" ? (
              <Vazio icone={<CalendarX2 />} titulo="Agenda cheia" texto="Não existem horários disponíveis para esta data.">
                {aoListaEspera && (
                  <Botao onClick={() => aoListaEspera(dia)} icone={<Hourglass className="h-5 w-5" />}>
                    Entrar na lista de espera
                  </Botao>
                )}
                {proximoLivre && (
                  <Botao variante="secundario" onClick={() => escolherDia(proximoLivre.dia)}>
                    Ver {DIAS_SEMANA_CURTOS[diaDaSemana(proximoLivre.dia)].toLowerCase()}, {dataCurta(proximoLivre.dia)}
                  </Botao>
                )}
              </Vazio>
            ) : (
              <Vazio icone={<CalendarX2 />} titulo="Sem atendimento neste dia" texto="O médico não atende nesta data.">
                {proximoLivre && (
                  <Botao variante="secundario" onClick={() => escolherDia(proximoLivre.dia)}>
                    Ver {DIAS_SEMANA_CURTOS[diaDaSemana(proximoLivre.dia)].toLowerCase()}, {dataCurta(proximoLivre.dia)}
                  </Botao>
                )}
              </Vazio>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoDia({ info, activo, hojeD, aoEscolher }: { info: InfoDia; activo: boolean; hojeD: Dia; aoEscolher: (d: Dia) => void }) {
  const { dia, estado } = info;
  const rotulo = dia === hojeD ? "Hoje" : dia === somarDias(hojeD, 1) ? "Amanhã" : DIAS_SEMANA_CURTOS[diaDaSemana(dia)];
  const fechado = estado === "fechado";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      data-dia={dia}
      disabled={fechado}
      onClick={() => aoEscolher(dia)}
      aria-label={`${diaRelativo(dia)}${estado === "cheio" ? ", agenda cheia" : fechado ? ", sem atendimento" : `, ${info.livres.length} horários`}`}
      className={cx(
        "flex h-[78px] w-[64px] shrink-0 snap-start flex-col items-center justify-center rounded-cartao border transition-colors duration-150",
        activo
          ? "border-esperanca bg-esperanca text-white"
          : fechado
            ? "border-transparent bg-transparent text-nevoa/70"
            : estado === "cheio"
              ? "border-dashed border-linha-forte bg-white/60 text-grafite hover:border-esperanca-300"
              : "border-linha bg-white text-tinta hover:border-esperanca-300",
      )}
    >
      <span className={cx("text-xs font-semibold", activo ? "text-esperanca-100" : fechado ? "" : "text-grafite")}>{rotulo}</span>
      <span className={cx("num text-xl font-bold leading-7", fechado && "line-through decoration-1")}>{Number(dia.slice(8))}</span>
      <span className="h-4 text-[10px] font-semibold leading-4">
        {estado === "livre" ? <span className={cx("mx-auto mt-1 block h-1.5 w-1.5 rounded-full", activo ? "bg-white" : "bg-esperanca")} /> : estado === "cheio" ? "cheio" : ""}
      </span>
    </button>
  );
}

export function CalendarioMes({
  seleccionado,
  hojeD,
  ultimo,
  estadoDe,
  aoEscolher,
  className,
}: {
  seleccionado: Dia | null;
  hojeD: Dia;
  ultimo: Dia;
  estadoDe: (d: Dia) => EstadoDia;
  aoEscolher: (d: Dia) => void;
  className?: string;
}) {
  const [mes, setMes] = useState(inicioDoMes(seleccionado ?? hojeD));
  const primeiroMes = inicioDoMes(hojeD);
  const ultimoMes = inicioDoMes(ultimo);
  const vazios = (diaDaSemana(mes) + 6) % 7; // semanas a começar à segunda
  const total = diasNoMes(mes);
  const mudar = (n: number) => setMes(inicioDoMes(somarDias(mes, n > 0 ? total : -1)));

  return (
    <div className={cx("cartao p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <BotaoIcone rotulo="Mês anterior" onClick={() => mudar(-1)} disabled={mes <= primeiroMes}>
          <ChevronLeft />
        </BotaoIcone>
        <p className="font-bold text-tinta">{mesAno(mes)}</p>
        <BotaoIcone rotulo="Mês seguinte" onClick={() => mudar(1)} disabled={mes >= ultimoMes}>
          <ChevronRight />
        </BotaoIcone>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <span key={d} className="pb-1 text-xs font-semibold text-grafite">
            {d}
          </span>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const d = somarDias(mes, i);
          const fora = d < hojeD || d > ultimo;
          const estado = fora ? "fechado" : estadoDe(d);
          const activo = d === seleccionado;
          return (
            <button
              key={d}
              type="button"
              disabled={estado === "fechado"}
              onClick={() => aoEscolher(d)}
              aria-pressed={activo}
              aria-label={`${diaRelativo(d)}${estado === "cheio" ? ", agenda cheia" : estado === "fechado" ? ", indisponível" : ""}`}
              className={cx(
                "num relative flex h-11 flex-col items-center justify-center rounded-vaga text-[15px] font-semibold transition-colors",
                activo
                  ? "bg-esperanca text-white"
                  : estado === "livre"
                    ? "text-tinta hover:bg-esperanca-50"
                    : estado === "cheio"
                      ? "text-grafite ring-1 ring-inset ring-dashed ring-linha-forte hover:bg-papel"
                      : "text-nevoa/60",
                d === hojeD && !activo && "ring-1 ring-inset ring-esperanca-300",
              )}
            >
              {Number(d.slice(8))}
              {estado === "livre" && <span className={cx("absolute bottom-1.5 h-1 w-1 rounded-full", activo ? "bg-white" : "bg-esperanca")} />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-grafite">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-esperanca" /> Com horários
        </span>
        <span>Dias apagados: sem atendimento ou já passados</span>
      </p>
    </div>
  );
}
