import { Ban, CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DetalheConsulta } from "../../componentes/agenda/DetalheConsulta";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Pagina } from "../../componentes/Shell";
import { Botao, BotaoIcone, Esqueleto, EtiquetaEstado, Vazio, cx } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { MOTIVOS_BLOQUEIO } from "../../lib/estados";
import { textoIntervalo } from "../../lib/horario";
import { primeiroNome, useUtilizador } from "../../lib/sessao";
import { dataLonga, diaRelativo, hoje, horaDe, idadeLegivel, instanteISO, saudacao, somarDias } from "../../lib/tempo";
import { plural } from "../../lib/texto";
import type { EstadoConsulta } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";

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
            <EtiquetaEstado estado={c.estado} curto />
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
              <ul className="cartao divide-y divide-linha overflow-hidden">{itens.map((i) => i.no)}</ul>
            )}
          </section>
        </>
      )}

      <DetalheConsulta consultaId={consultaId} aoFechar={() => setConsultaId(null)} papel="medico" />
    </Pagina>
  );
}
