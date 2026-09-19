import { Ban, CalendarX2, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DetalheConsulta } from "../../componentes/agenda/DetalheConsulta";
import { FolhaRecusar } from "../../componentes/agenda/FolhaRecusar";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Pagina, usePorConfirmar } from "../../componentes/Shell";
import { Botao, BotaoIcone, Esqueleto, EtiquetaEstado, Vazio, cx } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { MOTIVOS_BLOQUEIO } from "../../lib/estados";
import { textoIntervalo } from "../../lib/horario";
import { primeiroNome, useUtilizador } from "../../lib/sessao";
import { DIAS_SEMANA_CURTOS, dataLonga, diaDaSemana, diaDe, diaRelativo, hoje, horaDe, idadeLegivel, instanteISO, nomeMesCurto, saudacao, somarDias } from "../../lib/tempo";
import { plural } from "../../lib/texto";
import type { ConsultaDetalhada, EstadoConsulta } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";

type Resposta = "confirmada" | "recusada";
const VISIVEIS = 5;

/** As consultas que aguardam o "sim" do médico, de hoje em diante. */
function PorConfirmar({ medicoId, aoAbrir }: { medicoId: string; aoAbrir: (id: string) => void }) {
  const avisar = useAviso();
  const pendentes = usePorConfirmar(medicoId);
  // As respondidas ficam um instante no sítio, com o resultado, antes de sair.
  const [respondidas, setRespondidas] = useState<{ c: ConsultaDetalhada; como: Resposta }[]>([]);
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);
  const [aRecusar, setARecusar] = useState<ConsultaDetalhada | null>(null);
  const [todas, setTodas] = useState(false);

  function responder(c: ConsultaDetalhada, como: Resposta) {
    setRespondidas((r) => [...r.filter((x) => x.c.id !== c.id), { c, como }]);
    setTimeout(() => setRespondidas((r) => r.filter((x) => x.c.id !== c.id)), 1700);
  }

  async function confirmar(c: ConsultaDetalhada) {
    setAConfirmar(c.id);
    try {
      await repo().mudarEstado(c.id, "confirmada");
      responder(c, "confirmada");
      avisar(`Consulta de ${primeiroNome(c.paciente.nome)} confirmada. O paciente foi avisado.`);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAConfirmar(null);
    }
  }

  const jaRespondidas = new Set(respondidas.map((r) => r.c.id));
  const abertas = pendentes.filter((c) => !jaRespondidas.has(c.id));
  const itens = [...abertas.map((c) => ({ c, como: null as Resposta | null })), ...respondidas].sort((a, b) => a.c.inicio.localeCompare(b.c.inicio));
  if (itens.length === 0) return null;
  const visiveis = todas ? itens : itens.slice(0, VISIVEIS);

  return (
    <section className="mt-6" aria-labelledby="titulo-por-confirmar">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-por-confirmar" className="flex items-center gap-2 text-lg font-bold text-tinta">
          Por confirmar
          {abertas.length > 0 && (
            <span key={abertas.length} className="num anim-pop inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-estado-ambar px-2 text-xs font-bold text-white">
              {abertas.length}
            </span>
          )}
        </h2>
        <p className="text-sm text-grafite">O paciente é avisado da sua resposta.</p>
      </div>
      <ul className="anim-lista space-y-2.5">
        {visiveis.map(({ c, como }) => {
          const dia = diaDe(c.inicio);
          return (
            <li
              key={c.id}
              className={cx(
                "rounded-[24px] border bg-white p-4 shadow-suave transition-colors duration-300 sm:p-5",
                como === "confirmada" ? "anim-sair border-estado-verde/40 bg-estado-verde-fundo/60" : como === "recusada" ? "anim-sair border-estado-vermelho/30 bg-estado-vermelho-fundo/50" : "border-linha",
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button type="button" onClick={() => aoAbrir(c.id)} className="group flex min-w-0 flex-1 items-center gap-4 text-left">
                  <span className="flex w-14 shrink-0 flex-col items-center rounded-[16px] bg-esperanca-50 py-2 text-esperanca-800">
                    <span className="text-[11px] font-bold uppercase tracking-wide">{DIAS_SEMANA_CURTOS[diaDaSemana(dia)]}</span>
                    <span className="num text-xl font-bold leading-6">{Number(dia.slice(8))}</span>
                    <span className="text-[11px] font-semibold">{nomeMesCurto(dia)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-bold text-tinta group-hover:text-esperanca">{c.paciente.nome}</span>
                    <span className="block text-sm text-grafite">
                      <span className="num font-semibold text-tinta">{horaDe(c.inicio)}</span>
                      {["Hoje", "Amanhã"].includes(diaRelativo(dia)) ? `, ${diaRelativo(dia).toLowerCase()}` : ""}
                      {c.primeiraVez ? ", primeira consulta" : ""}
                    </span>
                    {c.observacao && <span className="mt-0.5 block truncate text-sm text-grafite">{c.observacao}</span>}
                  </span>
                </button>
                {como ? (
                  <p className={cx("anim-surgir flex items-center gap-2 font-bold", como === "confirmada" ? "text-estado-verde" : "text-estado-vermelho")}>
                    {como === "confirmada" ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /> : <X className="h-5 w-5" strokeWidth={3} aria-hidden="true" />}
                    {como === "confirmada" ? "Confirmada" : "Recusada"}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Botao variante="perigo-suave" className="border border-estado-vermelho/20" icone={<X className="h-4 w-4" />} disabled={aConfirmar === c.id} onClick={() => setARecusar(c)}>
                      Recusar
                    </Botao>
                    <Botao icone={<Check className="h-4 w-4" />} aCarregar={aConfirmar === c.id} onClick={() => confirmar(c)}>
                      Confirmar
                    </Botao>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {itens.length > VISIVEIS && (
        <Botao variante="fantasma" className="mt-2" onClick={() => setTodas(!todas)}>
          {todas ? "Mostrar só as próximas" : `Ver as ${itens.length} por confirmar`}
        </Botao>
      )}
      <FolhaRecusar consulta={aRecusar} aoFechar={() => setARecusar(null)} aoRecusar={(c) => responder(c, "recusada")} />
    </section>
  );
}

const COR_PROGRESSO: Partial<Record<EstadoConsulta, string>> = {
  concluida: "bg-esperanca",
  em_atendimento: "bg-estado-azul",
  faltou: "bg-estado-escuro",
};

export function Hoje() {
  const u = useUtilizador();
  const avisar = useAviso();
  const agora = useAgora(30_000);
  const hojeD = hoje(agora);
  const [params, setParams] = useSearchParams();
  const dia = params.get("dia") ?? hojeD;
  const [consultaId, setConsultaId] = useState<string | null>(null);
  const [aMudar, setAMudar] = useState<EstadoConsulta | null>(null);

  // Vindo de um aviso: abre logo a consulta.
  const consultaPedida = params.get("consulta");
  useEffect(() => {
    if (!consultaPedida) return;
    setConsultaId(consultaPedida);
    const resto = new URLSearchParams(params);
    resto.delete("consulta");
    setParams(resto, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaPedida]);

  const intervalo = { de: instanteISO(dia, "00:00"), ate: instanteISO(somarDias(dia, 1), "00:00") };
  const { dados: consultas } = useDados((r) => r.consultas({ medicoId: u.medicoId!, ...intervalo }), [dia], ["consultas"]);
  const { dados: bloqueios } = useDados((r) => r.bloqueios({ medicoId: u.medicoId!, ...intervalo }), [dia], ["bloqueios"]);
  const { dados: medico } = useDados((r) => r.medicos().then((l) => l.find((m) => m.id === u.medicoId) ?? null), [], ["medicos"]);

  const lista = (consultas ?? []).filter((c) => c.estado !== "cancelada");
  const atendidas = lista.filter((c) => c.estado === "concluida").length;
  const faltas = lista.filter((c) => c.estado === "faltou").length;
  const actual =
    lista.find((c) => c.estado === "em_atendimento") ??
    (dia === hojeD ? lista.find((c) => (c.estado === "confirmada" || c.estado === "aguardando") && Date.parse(c.fim) > agora.getTime() - 30 * 60_000) : undefined);

  const irPara = (d: string) => setParams(d === hojeD ? {} : { dia: d }, { replace: true });

  async function mudar(estado: EstadoConsulta) {
    if (!actual) return;
    setAMudar(estado);
    try {
      await repo().mudarEstado(actual.id, estado);
      const nome = primeiroNome(actual.paciente.nome);
      avisar(estado === "concluida" ? `Consulta de ${nome} concluída.` : estado === "faltou" ? "Falta registada." : `Atendimento de ${nome} iniciado.`);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAMudar(null);
    }
  }

  const relativo = diaRelativo(dia, agora);
  const itens: { inicio: string; no: ReactNode }[] = [
    ...(consultas ?? []).map((c) => ({
      inicio: c.inicio,
      no: (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => setConsultaId(c.id)}
            className={cx("flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-esperanca-50/60 sm:px-5", c.id === actual?.id && "bg-esperanca-50")}
          >
            <span className={cx("num w-[3.25rem] shrink-0 text-lg font-bold", c.estado === "cancelada" ? "text-nevoa line-through" : "text-tinta")}>{horaDe(c.inicio)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-tinta">{c.paciente.nome}</span>
              <span className="block truncate text-sm text-grafite">{c.observacao || (c.primeiraVez ? "Primeira consulta" : "Sem motivo indicado")}</span>
            </span>
            <EtiquetaEstado estado={c.estado} recusada={c.recusada} curto />
          </button>
        </li>
      ),
    })),
    ...(bloqueios ?? []).map((b) => ({
      inicio: b.inicio,
      no: (
        <li key={b.id} className="flex items-center gap-4 bg-papel/60 px-4 py-3 sm:px-5">
          <span className="flex w-[3.25rem] shrink-0 justify-center">
            <Ban className="h-5 w-5 text-grafite" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-grafite">{MOTIVOS_BLOQUEIO[b.motivo]}</span>
            <span className="block truncate text-sm text-grafite">
              {textoIntervalo(b)}
              {b.nota && `, ${b.nota}`}
            </span>
          </span>
        </li>
      ),
    })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <Pagina>
      <p className="text-grafite">
        {saudacao(agora)}, {medico ? `${medico.titulo} ${primeiroNome(medico.nome)}` : primeiroNome(u.nome)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="font-serif text-[2.5rem] leading-tight text-tinta">{relativo}</h1>
        <div className="flex items-center">
          <BotaoIcone rotulo="Dia anterior" onClick={() => irPara(somarDias(dia, -1))}>
            <ChevronLeft />
          </BotaoIcone>
          <BotaoIcone rotulo="Dia seguinte" onClick={() => irPara(somarDias(dia, 1))}>
            <ChevronRight />
          </BotaoIcone>
        </div>
        {dia !== hojeD && (
          <Botao variante="secundario" tamanho="sm" onClick={() => irPara(hojeD)}>
            Hoje
          </Botao>
        )}
      </div>
      <p className="text-grafite">{dataLonga(dia)}</p>

      <PorConfirmar medicoId={u.medicoId!} aoAbrir={setConsultaId} />

      {!consultas ? (
        <Esqueleto className="mt-6 h-72" />
      ) : (
        <>
          {lista.length > 0 && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-tinta">
                  {atendidas} de {plural(lista.length, "consulta atendida", "consultas atendidas")}
                </p>
                {faltas > 0 && <p className="text-sm text-grafite">{plural(faltas, "falta", "faltas")}</p>}
              </div>
              <div className="mt-2 flex h-2 gap-0.5" role="img" aria-label={`${atendidas} atendidas, ${faltas} faltas, ${lista.length - atendidas - faltas} por atender`}>
                {lista.map((c) => (
                  <span key={c.id} className={cx("flex-1 rounded-full", COR_PROGRESSO[c.estado] ?? "bg-linha")} />
                ))}
              </div>
            </div>
          )}

          {actual && (
            <section className="anim-surgir mt-6 rounded-senha bg-esperanca-800 p-5 text-white sm:p-7" aria-label="Paciente actual">
              <p className="text-sm font-semibold text-esperanca-200">
                {actual.estado === "em_atendimento"
                  ? "Em atendimento"
                  : Date.parse(actual.inicio) <= agora.getTime()
                    ? `Marcada para as ${horaDe(actual.inicio)}`
                    : `A seguir, às ${horaDe(actual.inicio)}`}
              </p>
              <p className="mt-2 font-serif text-[2rem] leading-tight">{actual.paciente.nome}</p>
              <p className="mt-1 text-esperanca-100">
                {[idadeLegivel(actual.paciente.dataNascimento), actual.primeiraVez ? "primeira consulta na clínica" : null].filter(Boolean).join(", ") || "Sem data de nascimento"}
              </p>
              {actual.observacao && (
                <p className="mt-4 rounded-botao bg-white/10 px-4 py-3">
                  <span className="block text-sm text-esperanca-200">Motivo</span>
                  {actual.observacao}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {actual.estado === "em_atendimento" ? (
                  <Botao variante="claro" tamanho="lg" aCarregar={aMudar === "concluida"} onClick={() => mudar("concluida")}>
                    Marcar como concluída
                  </Botao>
                ) : (
                  <>
                    <Botao variante="claro" tamanho="lg" aCarregar={aMudar === "em_atendimento"} onClick={() => mudar("em_atendimento")}>
                      Iniciar atendimento
                    </Botao>
                    {Date.parse(actual.inicio) <= agora.getTime() && (
                      <Botao variante="fantasma-claro" tamanho="lg" aCarregar={aMudar === "faltou"} onClick={() => mudar("faltou")}>
                        Marcar falta
                      </Botao>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          <section className="mt-8" aria-labelledby="titulo-dia">
            <h2 id="titulo-dia" className="mb-3 text-lg font-bold text-tinta">
              Agenda do dia
            </h2>
            {itens.length === 0 ? (
              <div className="cartao">
                <Vazio icone={<CalendarX2 />} titulo="Sem consultas neste dia" texto="As marcações aparecem aqui assim que são feitas, sem recarregar." />
              </div>
            ) : (
              <ul className="cartao anim-lista divide-y divide-linha overflow-hidden">{itens.map((i) => i.no)}</ul>
            )}
          </section>
        </>
      )}

      <DetalheConsulta consultaId={consultaId} aoFechar={() => setConsultaId(null)} papel="medico" />
    </Pagina>
  );
}
