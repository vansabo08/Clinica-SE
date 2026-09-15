import { CalendarX2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DetalheConsulta } from "../../componentes/agenda/DetalheConsulta";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Pagina } from "../../componentes/Shell";
import { Avatar, Botao, BotaoIcone, Esqueleto, EtiquetaEstado, Filtro, Segmentado, Vazio, cx } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { vagasDoDia } from "../../lib/disponibilidade";
import { BORDA_ESTADO, ESTADOS, MOTIVOS_BLOQUEIO, ORDEM_ESTADOS } from "../../lib/estados";
import {
  type Dia,
  DIAS_SEMANA_CURTOS,
  dataCurta,
  diaDaSemana,
  diaDe,
  diaRelativo,
  diasNoMes,
  hoje,
  horaDe,
  horaDeMinutos,
  inicioDaSemana,
  inicioDoMes,
  instanteISO,
  mesAno,
  minutosDe,
  somarDias,
} from "../../lib/tempo";
import { normalizar, plural } from "../../lib/texto";
import type { Bloqueio, ConsultaDetalhada, Especialidade, EstadoConsulta, HorarioTrabalho, Medico } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";
import { telefoneLegivel } from "../../lib/whatsapp";

type Vista = "dia" | "semana" | "mes";

const BORDA = BORDA_ESTADO;

const DIAS_CABECALHO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function tituloPeriodo(vista: Vista, dia: Dia, agora: Date) {
  if (vista === "mes") return mesAno(dia);
  if (vista === "semana") {
    const s = inicioDaSemana(dia);
    const e = somarDias(s, 6);
    return s.slice(0, 7) === e.slice(0, 7) ? `${Number(s.slice(8))} a ${Number(e.slice(8))} ${mesAno(e)}` : `${dataCurta(s)} a ${dataCurta(e)}`;
  }
  const r = diaRelativo(dia, agora);
  return ["Hoje", "Amanhã", "Ontem"].includes(r) ? `${r}, ${Number(dia.slice(8))} ${mesAno(dia).split(" ")[0]}` : r;
}

export function Agenda() {
  const [params, setParams] = useSearchParams();
  const agora = useAgora(30_000);
  const hojeD = hoje(agora);
  const avisar = useAviso();
  const montadaEm = useRef(Date.now());

  const dia = params.get("dia") ?? hojeD;
  const vista = (["semana", "mes"].includes(params.get("vista") ?? "") ? params.get("vista") : "dia") as Vista;
  const modo = params.get("modo") === "medicos" ? "medicos" : "lista";
  const consultaId = params.get("consulta");

  const [medicoId, setMedicoId] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState("");
  const [estado, setEstado] = useState<EstadoConsulta | "">("");
  const [pesquisa, setPesquisa] = useState("");
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);

  const mudar = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) n.delete(k);
          else n.set(k, v);
        }
        return n;
      },
      { replace: true },
    );

  // Vinda de uma notificação, só com o id: abrir no dia da consulta.
  useEffect(() => {
    if (!consultaId || params.get("dia")) return;
    repo()
      .consulta(consultaId)
      .then((c) => {
        if (c && diaDe(c.inicio) !== hojeD) mudar({ dia: diaDe(c.inicio) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId]);

  const [de, ate] = useMemo<[Dia, Dia]>(() => {
    if (vista === "semana") {
      const s = inicioDaSemana(dia);
      return [s, somarDias(s, 7)];
    }
    if (vista === "mes") {
      const s = inicioDoMes(dia);
      return [s, somarDias(s, diasNoMes(s))];
    }
    return [dia, somarDias(dia, 1)];
  }, [vista, dia]);

  const { dados: consultas } = useDados((r) => r.consultas({ de: instanteISO(de, "00:00"), ate: instanteISO(ate, "00:00") }), [de, ate], ["consultas"]);
  const { dados: base } = useDados(
    async (r) => {
      const [medicos, especialidades, horarios] = await Promise.all([r.medicos(), r.especialidades(), r.horarios()]);
      return { medicos, especialidades, horarios };
    },
    [],
    ["medicos", "especialidades", "horarios"],
  );
  const { dados: bloqueios } = useDados((r) => r.bloqueios({ de: instanteISO(de, "00:00"), ate: instanteISO(ate, "00:00") }), [de, ate], ["bloqueios"]);

  const q = normalizar(pesquisa);
  const qDigitos = pesquisa.replace(/\D/g, "");
  const filtradas = useMemo(
    () =>
      (consultas ?? []).filter(
        (c) =>
          (!medicoId || c.medicoId === medicoId) &&
          (!especialidadeId || c.especialidadeId === especialidadeId) &&
          (!q || normalizar(c.paciente.nome).includes(q) || (qDigitos.length >= 3 && c.paciente.telefone.includes(qDigitos))),
      ),
    [consultas, medicoId, especialidadeId, q, qDigitos],
  );
  const visiveis = estado ? filtradas.filter((c) => c.estado === estado) : filtradas;
  const contar = (e: EstadoConsulta) => filtradas.filter((c) => c.estado === e).length;

  const contadores: { chave: EstadoConsulta | ""; rotulo: string; valor: number }[] = [
    { chave: "", rotulo: vista === "dia" && dia === hojeD ? "Consultas hoje" : "Consultas", valor: filtradas.length },
    { chave: "confirmada", rotulo: "Confirmadas", valor: contar("confirmada") },
    { chave: "aguardando", rotulo: "Aguardando", valor: contar("aguardando") },
    { chave: "concluida", rotulo: "Concluídas", valor: contar("concluida") },
    { chave: "cancelada", rotulo: "Canceladas", valor: contar("cancelada") },
    { chave: "faltou", rotulo: "Faltaram", valor: contar("faltou") },
  ];

  function mover(n: 1 | -1) {
    const novo = vista === "dia" ? somarDias(dia, n) : vista === "semana" ? somarDias(dia, 7 * n) : n > 0 ? somarDias(inicioDoMes(dia), diasNoMes(dia)) : inicioDoMes(somarDias(inicioDoMes(dia), -1));
    mudar({ dia: novo === hojeD ? null : novo });
  }

  const abrirDia = (d: Dia, medico?: string) => {
    mudar({ dia: d === hojeD ? null : d, vista: null });
    if (medico) setMedicoId(medico);
  };

  async function confirmar(id: string) {
    setAConfirmar(id);
    try {
      await repo().mudarEstado(id, "confirmada");
      avisar("Presença confirmada.");
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAConfirmar(null);
    }
  }

  const filtrosActivos = !!(medicoId || especialidadeId || estado || pesquisa);
  const nomePeriodo = vista === "dia" ? "Dia" : vista === "semana" ? "Semana" : "Mês";
  const contemHoje = de <= hojeD && hojeD < ate;

  return (
    <Pagina largura="larga">
      <header>
        <h1 className="font-serif text-[2rem] leading-tight text-tinta lg:text-3xl">Agenda da Clínica</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
          <div className="-ml-2 flex items-center">
            <BotaoIcone rotulo={`${nomePeriodo} anterior`} onClick={() => mover(-1)}>
              <ChevronLeft />
            </BotaoIcone>
            <BotaoIcone rotulo={`${nomePeriodo} seguinte`} onClick={() => mover(1)}>
              <ChevronRight />
            </BotaoIcone>
          </div>
          <label className="relative cursor-pointer rounded-botao text-xl font-bold text-tinta hover:text-esperanca">
            {tituloPeriodo(vista, dia, agora)}
            <input
              type="date"
              value={dia}
              aria-label="Escolher data"
              onClick={(e) => e.currentTarget.showPicker?.()}
              onChange={(e) => e.target.value && mudar({ dia: e.target.value === hojeD ? null : e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          {!contemHoje && (
            <Botao variante="secundario" tamanho="sm" className="ml-1" onClick={() => mudar({ dia: null })}>
              Hoje
            </Botao>
          )}
          <Segmentado
            className="ml-auto"
            rotulo="Período"
            valor={vista}
            aoMudar={(v) => mudar({ vista: v === "dia" ? null : v })}
            opcoes={[
              { valor: "dia", rotulo: "Dia" },
              { valor: "semana", rotulo: "Semana" },
              { valor: "mes", rotulo: "Mês" },
            ]}
          />
        </div>
      </header>

      {/* Os contadores são também o filtro por estado. */}
      <div role="group" aria-label="Resumo por estado" className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-cartao border border-linha bg-linha sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        {contadores.map((c) => {
          const activo = estado === c.chave && (c.chave !== "" || !estado);
          return (
            <button
              key={c.rotulo}
              type="button"
              aria-pressed={c.chave ? estado === c.chave : undefined}
              onClick={() => setEstado(c.chave === "" || estado === c.chave ? "" : c.chave)}
              className={cx("flex flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors", activo && c.chave ? "bg-esperanca-50" : "bg-white hover:bg-papel")}
            >
              <span className="num text-[1.75rem] font-bold leading-9 text-tinta">{consultas ? c.valor : "·"}</span>
              <span className="flex items-center gap-1.5 text-sm text-grafite">
                {c.chave && <span className={cx("h-2 w-2 rounded-full", ESTADOS[c.chave].ponto)} aria-hidden="true" />}
                {c.rotulo}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite" aria-hidden="true" />
          <input
            type="search"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Pesquisar paciente"
            aria-label="Pesquisar paciente por nome ou telemóvel"
            className="h-10 w-full rounded-[10px] border border-linha-forte bg-white pl-9 pr-3 text-sm text-tinta placeholder:text-nevoa focus:border-esperanca focus:outline-none focus:ring-4 focus:ring-esperanca/10"
          />
        </div>
        <Filtro rotulo="Médico" value={medicoId} onChange={(e) => setMedicoId(e.target.value)} className="min-w-0 flex-1 sm:w-48 sm:flex-none">
          <option value="">Todos os médicos</option>
          {base?.medicos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.titulo} {m.nome}
            </option>
          ))}
        </Filtro>
        <Filtro rotulo="Especialidade" value={especialidadeId} onChange={(e) => setEspecialidadeId(e.target.value)} className="min-w-0 flex-1 sm:w-52 sm:flex-none">
          <option value="">Todas as especialidades</option>
          {base?.especialidades.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </Filtro>
        <Filtro rotulo="Estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoConsulta | "")} className="w-full sm:w-44">
          <option value="">Todos os estados</option>
          {ORDEM_ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADOS[e].rotulo}
            </option>
          ))}
        </Filtro>
        {filtrosActivos && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => {
              setMedicoId("");
              setEspecialidadeId("");
              setEstado("");
              setPesquisa("");
            }}
          >
            Limpar filtros
          </Botao>
        )}
        {vista === "dia" && (
          <Segmentado
            className="ml-auto"
            rotulo="Organizar"
            valor={modo}
            aoMudar={(v) => mudar({ modo: v === "lista" ? null : v })}
            opcoes={[
              { valor: "lista", rotulo: "Por horário" },
              { valor: "medicos", rotulo: "Por médico" },
            ]}
          />
        )}
      </div>

      {!consultas || !base || !bloqueios ? (
        <Esqueleto className="mt-4 h-96" />
      ) : vista === "dia" ? (
        modo === "lista" ? (
          <VistaLista consultas={visiveis} dia={dia} hojeD={hojeD} agora={agora} montadaEm={montadaEm.current} aConfirmar={aConfirmar} aoAbrir={(id) => mudar({ consulta: id })} aoConfirmar={confirmar} />
        ) : (
          <VistaMedicos
            dia={dia}
            hojeD={hojeD}
            agora={agora}
            consultas={visiveis}
            medicos={base.medicos.filter((m) => (!medicoId || m.id === medicoId) && (!especialidadeId || m.especialidadeId === especialidadeId))}
            horarios={base.horarios}
            bloqueios={bloqueios}
            aoAbrir={(id) => mudar({ consulta: id })}
          />
        )
      ) : vista === "semana" ? (
        <VistaSemana
          inicio={de}
          hojeD={hojeD}
          consultas={visiveis}
          medicos={base.medicos.filter((m) => (!medicoId || m.id === medicoId) && (!especialidadeId || m.especialidadeId === especialidadeId))}
          especialidades={base.especialidades}
          horarios={base.horarios}
          bloqueios={bloqueios}
          aoAbrirDia={abrirDia}
        />
      ) : (
        <VistaMes mes={de} hojeD={hojeD} consultas={visiveis} bloqueios={bloqueios} aoAbrirDia={abrirDia} />
      )}

      <DetalheConsulta consultaId={consultaId} aoFechar={() => mudar({ consulta: null })} papel="equipa" />
    </Pagina>
  );
}

// ------------------------------------------------------------
// Por horário
// ------------------------------------------------------------

function VistaLista({
  consultas,
  dia,
  hojeD,
  agora,
  montadaEm,
  aConfirmar,
  aoAbrir,
  aoConfirmar,
}: {
  consultas: ConsultaDetalhada[];
  dia: Dia;
  hojeD: Dia;
  agora: Date;
  montadaEm: number;
  aConfirmar: string | null;
  aoAbrir: (id: string) => void;
  aoConfirmar: (id: string) => void;
}) {
  if (!consultas.length)
    return (
      <div className="cartao mt-4">
        <Vazio icone={<CalendarX2 />} titulo="Sem consultas" texto="Não há consultas com estes filtros neste dia." />
      </div>
    );

  const agoraMs = agora.getTime();
  const indiceAgora = dia === hojeD ? consultas.findIndex((c) => Date.parse(c.inicio) > agoraMs) : -2;
  const linhas: ReactNode[] = [];
  consultas.forEach((c, i) => {
    if (i === indiceAgora) linhas.push(<LinhaAgora key="agora" agora={agora} />);
    linhas.push(
      <li key={c.id} className={cx(Date.parse(c.criadaEm) > montadaEm && "anim-destacar")}>
        <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <button type="button" onClick={() => aoAbrir(c.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] text-left sm:gap-5">
            <span className={cx("num w-[3.25rem] shrink-0 text-lg font-bold", c.estado === "cancelada" ? "text-nevoa line-through" : "text-tinta")}>{horaDe(c.inicio)}</span>
            <span className="grid min-w-0 flex-1 gap-0.5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-5">
              <span className="min-w-0">
                <span className="block truncate font-bold text-tinta">{c.paciente.nome}</span>
                <span className="block truncate text-sm text-grafite">{c.observacao || telefoneLegivel(c.paciente.telefone)}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar nome={`${c.medico.titulo} ${c.medico.nome}`} foto={c.medico.fotoUrl} tamanho="sm" className="hidden md:inline-flex" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-tinta">
                    {c.medico.titulo} {c.medico.nome}
                  </span>
                  <span className="hidden truncate text-xs text-grafite md:block">{c.especialidade.nome}</span>
                </span>
              </span>
              <EtiquetaEstado estado={c.estado} curto className="mt-1 w-fit sm:hidden" />
            </span>
          </button>
          <EtiquetaEstado estado={c.estado} curto className="hidden sm:inline-flex" />
          <div className="hidden w-[6.5rem] justify-end lg:flex">
            {c.estado === "aguardando" && Date.parse(c.inicio) > agoraMs && (
              <Botao tamanho="sm" variante="suave" aCarregar={aConfirmar === c.id} onClick={() => aoConfirmar(c.id)}>
                Confirmar
              </Botao>
            )}
          </div>
        </div>
      </li>,
    );
  });
  if (indiceAgora === -1) linhas.push(<LinhaAgora key="agora" agora={agora} />);

  return (
    <div className="cartao mt-4 overflow-hidden">
      <ul className="divide-y divide-linha">{linhas}</ul>
    </div>
  );
}

function LinhaAgora({ agora }: { agora: Date }) {
  return (
    <li className="flex items-center gap-3 px-4 py-1.5 sm:px-5" aria-label={`Agora, ${horaDe(agora)}`}>
      <span className="num w-[3.25rem] shrink-0 text-xs font-bold text-esperanca">{horaDe(agora)}</span>
      <span className="relative h-0.5 flex-1 rounded-full bg-esperanca" aria-hidden="true">
        <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-esperanca" />
      </span>
    </li>
  );
}

// ------------------------------------------------------------
// Por médico (colunas)
// ------------------------------------------------------------

const PX = 1.4; // píxeis por minuto

function VistaMedicos({
  dia,
  hojeD,
  agora,
  consultas,
  medicos,
  horarios,
  bloqueios,
  aoAbrir,
}: {
  dia: Dia;
  hojeD: Dia;
  agora: Date;
  consultas: ConsultaDetalhada[];
  medicos: Medico[];
  horarios: HorarioTrabalho[];
  bloqueios: Bloqueio[];
  aoAbrir: (id: string) => void;
}) {
  const ds = diaDaSemana(dia);
  const activas = consultas.filter((c) => c.estado !== "cancelada");
  const lista = medicos.filter((m) => (m.activo && horarios.some((h) => h.medicoId === m.id && h.diaSemana === ds)) || activas.some((c) => c.medicoId === m.id));

  if (!lista.length)
    return (
      <div className="cartao mt-4">
        <Vazio icone={<CalendarX2 />} titulo="Nenhum médico atende neste dia" texto="Mude de dia ou tire os filtros." />
      </div>
    );

  const periodos = horarios.filter((h) => h.diaSemana === ds && lista.some((m) => m.id === h.medicoId));
  const inicioMin = Math.floor(Math.min(8 * 60, ...periodos.map((p) => minutosDe(p.inicio)), ...activas.map((c) => minutosDe(horaDe(c.inicio)))) / 60) * 60;
  const fimMin = Math.ceil(Math.max(17 * 60, ...periodos.map((p) => minutosDe(p.fim)), ...activas.map((c) => minutosDe(horaDe(c.inicio)) + 60)) / 60) * 60;
  const altura = (fimMin - inicioMin) * PX;
  const origem = Date.parse(instanteISO(dia, horaDeMinutos(inicioMin)));
  const topo = (iso: string) => ((Date.parse(iso) - origem) / 60_000) * PX;
  const grelha = { backgroundImage: "linear-gradient(to bottom, #E3E9E6 1px, transparent 1px)", backgroundSize: `100% ${60 * PX}px` };
  const horas: number[] = [];
  for (let m = inicioMin; m < fimMin; m += 60) horas.push(m);
  const minutoAgora = minutosDe(horaDe(agora));

  return (
    <div className="cartao mt-4 max-h-[76vh] overflow-auto">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `3.5rem repeat(${lista.length}, minmax(11rem, 1fr))` }}>
        <div className="sticky left-0 top-0 z-30 border-b border-linha bg-white" />
        {lista.map((m) => {
          const n = activas.filter((c) => c.medicoId === m.id).length;
          return (
            <div key={m.id} className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-l border-linha bg-white px-3 py-2.5">
              <Avatar nome={`${m.titulo} ${m.nome}`} foto={m.fotoUrl} tamanho="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-tinta">
                  {m.titulo} {m.nome}
                </p>
                <p className="text-xs text-grafite">{plural(n, "consulta", "consultas")}</p>
              </div>
            </div>
          );
        })}

        <div className="sticky left-0 z-10 bg-white" style={{ height: altura }}>
          {horas.map((m, i) => (
            <span key={m} className={cx("num absolute right-2 text-xs text-grafite", i > 0 && "-translate-y-1/2")} style={{ top: (m - inicioMin) * PX + (i === 0 ? 2 : 0) }}>
              {horaDeMinutos(m)}
            </span>
          ))}
        </div>

        {lista.map((m) => (
          <div key={m.id} className="relative border-l border-linha bg-[#EEF2F0]" style={{ height: altura, ...grelha }}>
            {periodos
              .filter((p) => p.medicoId === m.id)
              .map((p) => {
                const t = (minutosDe(p.inicio) - inicioMin) * PX;
                return (
                  <div
                    key={p.id}
                    className="absolute inset-x-0 bg-white"
                    style={{ top: t, height: (minutosDe(p.fim) - minutosDe(p.inicio)) * PX, ...grelha, backgroundPosition: `0 ${-(t % (60 * PX))}px` }}
                  />
                );
              })}
            {bloqueios
              .filter((b) => b.medicoId === m.id || b.medicoId === null)
              .map((b) => {
                const t = Math.max(0, topo(b.inicio));
                const f = Math.min(altura, topo(b.fim));
                if (f <= t) return null;
                return (
                  <div
                    key={b.id}
                    className="absolute inset-x-1 rounded-[8px] px-2 py-1 text-xs font-semibold text-grafite"
                    style={{ top: t, height: f - t, backgroundImage: "repeating-linear-gradient(135deg, #E6EBE9 0 6px, #F4F7F5 6px 12px)" }}
                  >
                    {MOTIVOS_BLOQUEIO[b.motivo]}
                  </div>
                );
              })}
            {activas
              .filter((c) => c.medicoId === m.id)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => aoAbrir(c.id)}
                  title={`${horaDe(c.inicio)} ${c.paciente.nome}, ${ESTADOS[c.estado].rotulo}`}
                  className={cx("absolute inset-x-1 overflow-hidden rounded-[8px] border-l-[3px] px-2 py-0.5 text-left text-xs leading-4 transition-shadow hover:z-10 hover:shadow-flutua", ESTADOS[c.estado].etiqueta, BORDA[c.estado])}
                  style={{ top: topo(c.inicio) + 1, height: Math.max(((Date.parse(c.fim) - Date.parse(c.inicio)) / 60_000) * PX - 3, 18) }}
                >
                  <span className="num font-bold">{horaDe(c.inicio)}</span> <span className="font-semibold text-tinta">{c.paciente.nome}</span>
                </button>
              ))}
            {dia === hojeD && minutoAgora >= inicioMin && minutoAgora <= fimMin && (
              <div className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-esperanca" style={{ top: (minutoAgora - inicioMin) * PX }} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Semana: ocupação por médico e dia
// ------------------------------------------------------------

function BarraEstados({ consultas, className }: { consultas: Pick<ConsultaDetalhada, "estado">[]; className?: string }) {
  if (!consultas.length) return null;
  return (
    <span className={cx("flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full", className)} aria-hidden="true">
      {ORDEM_ESTADOS.map((e) => {
        const n = consultas.filter((c) => c.estado === e).length;
        return n ? <span key={e} className={cx("rounded-full", ESTADOS[e].ponto)} style={{ flexGrow: n }} /> : null;
      })}
    </span>
  );
}

function VistaSemana({
  inicio,
  hojeD,
  consultas,
  medicos,
  especialidades,
  horarios,
  bloqueios,
  aoAbrirDia,
}: {
  inicio: Dia;
  hojeD: Dia;
  consultas: ConsultaDetalhada[];
  medicos: Medico[];
  especialidades: Especialidade[];
  horarios: HorarioTrabalho[];
  bloqueios: Bloqueio[];
  aoAbrirDia: (d: Dia, medicoId?: string) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const lista = medicos.filter((m) => m.activo || consultas.some((c) => c.medicoId === m.id));
  const indisponiveis = bloqueios.map((b) => ({ medicoId: b.medicoId, inicio: b.inicio, fim: b.fim, tipo: "bloqueio" as const }));
  const porCelula = new Map<string, ConsultaDetalhada[]>();
  for (const c of consultas) {
    const k = `${c.medicoId}|${diaDe(c.inicio)}`;
    porCelula.set(k, [...(porCelula.get(k) ?? []), c]);
  }

  return (
    <div className="cartao mt-4 overflow-x-auto">
      <table className="w-full min-w-[48rem] border-collapse">
        <caption className="sr-only">Consultas por médico e por dia: marcadas sobre horários disponíveis</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-sm font-semibold text-grafite">
              Médico
            </th>
            {dias.map((d) => (
              <th key={d} scope="col" className="px-1 py-2">
                <button type="button" onClick={() => aoAbrirDia(d)} className={cx("w-full rounded-[10px] py-1.5 text-center transition-colors hover:bg-papel", d === hojeD ? "text-esperanca" : "text-tinta")}>
                  <span className="block text-xs font-semibold text-grafite">{DIAS_SEMANA_CURTOS[diaDaSemana(d)]}</span>
                  <span className="num block text-lg font-bold">{Number(d.slice(8))}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map((m) => (
            <tr key={m.id} className="border-t border-linha">
              <th scope="row" className="sticky left-0 z-10 max-w-[12rem] bg-white px-4 py-2 text-left font-normal">
                <span className="block truncate text-sm font-bold text-tinta">
                  {m.titulo} {m.nome}
                </span>
                <span className="block truncate text-xs text-grafite">{especialidades.find((e) => e.id === m.especialidadeId)?.nome}</span>
              </th>
              {dias.map((d) => {
                const cs = porCelula.get(`${m.id}|${d}`) ?? [];
                const marcadas = cs.filter((c) => c.estado !== "cancelada");
                const capacidade = vagasDoDia({ medico: m, horarios, indisponiveis, agora: new Date(0) }, d).filter((v) => v.estado !== "bloqueada").length;
                const ocupacao = capacidade ? marcadas.length / capacidade : 0;
                return (
                  <td key={d} className="px-1 py-1.5">
                    {capacidade === 0 && marcadas.length === 0 ? (
                      <span className="block h-14 rounded-[10px] bg-papel/70">
                        <span className="sr-only">Não atende</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => aoAbrirDia(d, m.id)}
                        aria-label={`${m.titulo} ${m.nome}, ${diaRelativo(d)}: ${marcadas.length} de ${capacidade} horários marcados`}
                        className={cx(
                          "flex h-14 w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border transition-colors hover:border-esperanca-300",
                          ocupacao >= 1 ? "border-esperanca-200 bg-esperanca-100" : ocupacao >= 0.6 ? "border-esperanca-100 bg-esperanca-50" : "border-linha bg-white",
                        )}
                      >
                        <span className="num text-sm font-bold text-tinta">
                          {marcadas.length}
                          <span className="font-normal text-grafite">/{capacidade}</span>
                        </span>
                        <BarraEstados consultas={cs} className="w-10" />
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-linha px-4 py-2.5 text-xs text-grafite">Consultas marcadas sobre horários disponíveis. Toque num dia para ver a agenda.</p>
    </div>
  );
}

// ------------------------------------------------------------
// Mês
// ------------------------------------------------------------

function VistaMes({ mes, hojeD, consultas, bloqueios, aoAbrirDia }: { mes: Dia; hojeD: Dia; consultas: ConsultaDetalhada[]; bloqueios: Bloqueio[]; aoAbrirDia: (d: Dia) => void }) {
  const vazios = (diaDaSemana(mes) + 6) % 7;
  const total = diasNoMes(mes);
  const porDia = new Map<Dia, ConsultaDetalhada[]>();
  for (const c of consultas) {
    const d = diaDe(c.inicio);
    porDia.set(d, [...(porDia.get(d) ?? []), c]);
  }

  return (
    <div className="cartao mt-4 p-2 sm:p-4">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {DIAS_CABECALHO.map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-semibold text-grafite">
            {d}
          </div>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <div key={`v${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const d = somarDias(mes, i);
          const cs = porDia.get(d) ?? [];
          const marcadas = cs.filter((c) => c.estado !== "cancelada").length;
          const feriado = bloqueios.find((b) => b.medicoId === null && diaDe(b.inicio) <= d && d < diaDe(b.fim));
          return (
            <button
              key={d}
              type="button"
              onClick={() => aoAbrirDia(d)}
              aria-label={`${diaRelativo(d)}: ${plural(marcadas, "consulta", "consultas")}${feriado ? `, ${feriado.nota || "feriado"}` : ""}`}
              className={cx(
                "flex min-h-[4.5rem] flex-col items-start rounded-[10px] border p-1.5 text-left transition-colors hover:border-esperanca-300 sm:min-h-[6.5rem] sm:p-2.5",
                d < hojeD ? "border-linha bg-papel/60" : "border-linha bg-white",
              )}
            >
              <span className={cx("num inline-flex h-6 min-w-6 items-center justify-center rounded-full text-sm font-bold", d === hojeD ? "bg-esperanca px-1.5 text-white" : "text-tinta")}>{i + 1}</span>
              {feriado && (
                <>
                  <span className="mt-1 hidden w-full truncate text-[11px] font-semibold text-estado-vermelho sm:block">{feriado.nota || "Feriado"}</span>
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-estado-vermelho sm:hidden" aria-hidden="true" />
                </>
              )}
              {marcadas > 0 && (
                <span className="mt-auto w-full">
                  <span className="num block text-base font-bold leading-6 text-tinta sm:text-xl">{marcadas}</span>
                  <span className="hidden text-xs text-grafite sm:block">consultas</span>
                  <BarraEstados consultas={cs} className="mt-1" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
