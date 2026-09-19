import { CalendarClock, CalendarX2, Check, Phone, X } from "lucide-react";
import { useState } from "react";
import type { Vaga } from "../../lib/disponibilidade";
import { repo } from "../../lib/dados";
import { ACCAO_PARA, ESTADOS_ALTERAVEIS, TRANSICOES, TRANSICOES_MEDICO } from "../../lib/estados";
import { primeiroNome } from "../../lib/sessao";
import { diaDe, diaRelativo, haQuanto, horaDe, idadeLegivel, quandoCurto } from "../../lib/tempo";
import type { Canal, EstadoConsulta } from "../../lib/tipos";
import { useAgora, useDados } from "../../lib/usarDados";
import { linkTelefone, linkWhatsApp, mensagens, telefoneLegivel } from "../../lib/whatsapp";
import { mensagemDeErro, useAviso } from "../Aviso";
import { Confirmacao, Folha } from "../Folha";
import { LogoWhatsApp } from "../icones";
import { EscolhaHorario } from "../marcacao/EscolhaHorario";
import { FolhaRecusar } from "./FolhaRecusar";
import { Botao, Esqueleto, EtiquetaEstado, Par, estiloBotao } from "../ui";

const CANAIS: Record<Canal, string> = {
  app: "Pela aplicação",
  rececao: "Na receção",
  telefone: "Por telefone",
  whatsapp: "Por WhatsApp",
};

const FEITO: Record<EstadoConsulta, string> = {
  aguardando: "Voltou a aguardar confirmação",
  confirmada: "Presença confirmada",
  em_atendimento: "Atendimento iniciado",
  concluida: "Consulta concluída",
  cancelada: "Consulta cancelada",
  faltou: "Falta registada",
};

/** Painel de uma consulta, para a receção e para o médico. */
export function DetalheConsulta({ consultaId, aoFechar, papel }: { consultaId: string | null; aoFechar: () => void; papel: "equipa" | "medico" }) {
  const avisar = useAviso();
  const agora = useAgora(60_000);
  const { dados } = useDados((r) => (consultaId ? r.consulta(consultaId) : Promise.resolve(null)), [consultaId], ["consultas"]);
  const { dados: clinica } = useDados((r) => r.clinica(), [], ["clinica"]);
  const { dados: medicos } = useDados((r) => r.medicos(), [], ["medicos"]);
  const [modo, setModo] = useState<"detalhe" | "reagendar">("detalhe");
  const [novaVaga, setNovaVaga] = useState<Vaga | null>(null);
  const [aMudar, setAMudar] = useState<string | null>(null);
  const [perguntarCancelar, setPerguntarCancelar] = useState(false);
  const [aRecusar, setARecusar] = useState(false);

  const c = dados && dados.id === consultaId ? dados : null;

  function fechar() {
    setModo("detalhe");
    setNovaVaga(null);
    aoFechar();
  }

  async function mudarEstado(estado: EstadoConsulta) {
    if (!c) return;
    setAMudar(estado);
    try {
      await repo().mudarEstado(c.id, estado);
      avisar(`${FEITO[estado]}: ${primeiroNome(c.paciente.nome)}, ${horaDe(c.inicio)}.`);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAMudar(null);
    }
  }

  async function reagendar() {
    if (!c || !novaVaga) return;
    setAMudar("reagendar");
    try {
      const n = await repo().reagendar(c.id, novaVaga.inicio);
      avisar(`Consulta reagendada para ${quandoCurto(n.inicio)}.`);
      setModo("detalhe");
      setNovaVaga(null);
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
      setNovaVaga(null);
    } finally {
      setAMudar(null);
    }
  }

  async function cancelar() {
    if (!c) return;
    setAMudar("cancelar");
    try {
      await repo().cancelar(c.id);
      setPerguntarCancelar(false);
      avisar("Consulta cancelada. O horário ficou livre.");
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAMudar(null);
    }
  }

  const comecou = c ? Date.parse(c.inicio) <= agora.getTime() : false;
  const transicoes = !c
    ? []
    : (papel === "medico" ? (TRANSICOES_MEDICO[c.estado] ?? []) : TRANSICOES[c.estado].filter((e) => e !== "cancelada")).filter((e) => e !== "faltou" || comecou);
  const alteravel = papel === "equipa" && !!c && ESTADOS_ALTERAVEIS.includes(c.estado) && !comecou;
  // O médico decide as consultas que ainda aguardam: confirmar ou recusar.
  const decidir = papel === "medico" && !!c && c.estado === "aguardando" && !comecou;
  const rotulo = (e: EstadoConsulta) => (papel === "medico" && e === "confirmada" ? "Confirmar consulta" : ACCAO_PARA[e]);
  const medico = c ? medicos?.find((m) => m.id === c.medicoId) : undefined;
  const idadeTexto = c ? idadeLegivel(c.paciente.dataNascimento) : null;

  return (
    <>
      <Folha
        aberta={!!consultaId}
        aoFechar={fechar}
        lado="direita"
        largura="md"
        titulo={!c ? "Consulta" : modo === "reagendar" ? "Reagendar consulta" : c.paciente.nome}
        descricao={c ? (modo === "reagendar" ? `${c.paciente.nome}. Agora: ${quandoCurto(c.inicio)}` : `${diaRelativo(diaDe(c.inicio))}, ${horaDe(c.inicio)} às ${horaDe(c.fim)}`) : undefined}
        antesDoTitulo={c && modo === "detalhe" ? <EtiquetaEstado estado={c.estado} recusada={c.recusada} className="mb-2" /> : undefined}
        rodape={
          !c ? undefined : modo === "detalhe" ? (
            transicoes.length > 0 || alteravel ? (
              <div className="flex flex-col gap-2">
                {decidir ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Botao tamanho="lg" variante="perigo-suave" className="border border-estado-vermelho/25" icone={<X className="h-5 w-5" />} onClick={() => setARecusar(true)}>
                        Recusar
                      </Botao>
                      <Botao tamanho="lg" icone={<Check className="h-5 w-5" />} aCarregar={aMudar === "confirmada"} onClick={() => mudarEstado("confirmada")}>
                        Confirmar
                      </Botao>
                    </div>
                    {transicoes.some((e) => e !== "confirmada") && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {transicoes
                          .filter((e) => e !== "confirmada")
                          .map((e) => (
                            <Botao key={e} variante="secundario" aCarregar={aMudar === e} onClick={() => mudarEstado(e)}>
                              {rotulo(e)}
                            </Botao>
                          ))}
                      </div>
                    )}
                  </>
                ) : transicoes.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {transicoes.map((e, i) => (
                      <Botao key={e} tamanho="lg" variante={i === 0 ? "primario" : "secundario"} aCarregar={aMudar === e} onClick={() => mudarEstado(e)} className={transicoes.length === 1 ? "sm:col-span-2" : undefined}>
                        {rotulo(e)}
                      </Botao>
                    ))}
                  </div>
                )}
                {alteravel && (
                  <div className="grid grid-cols-2 gap-2">
                    <Botao variante="secundario" icone={<CalendarClock className="h-5 w-5" />} onClick={() => setModo("reagendar")}>
                      Reagendar
                    </Botao>
                    <Botao variante="perigo-suave" icone={<CalendarX2 className="h-5 w-5" />} onClick={() => setPerguntarCancelar(true)}>
                      Cancelar consulta
                    </Botao>
                  </div>
                )}
              </div>
            ) : undefined
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-grafite">
                {novaVaga ? (
                  <>
                    Passa para <strong className="text-tinta">{quandoCurto(novaVaga.inicio)}</strong>
                  </>
                ) : (
                  "Escolha o novo horário."
                )}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Botao
                  variante="secundario"
                  onClick={() => {
                    setModo("detalhe");
                    setNovaVaga(null);
                  }}
                >
                  Voltar
                </Botao>
                <Botao disabled={!novaVaga} aCarregar={aMudar === "reagendar"} onClick={reagendar}>
                  Confirmar
                </Botao>
              </div>
            </div>
          )
        }
      >
        {!c ? (
          <Esqueleto className="h-64" />
        ) : modo === "reagendar" ? (
          medico ? (
            <EscolhaHorario medico={medico} ignorar={{ inicio: c.inicio }} vagaActual={c.inicio} seleccionada={novaVaga?.inicio} diaInicial={diaDe(c.inicio)} aoEscolher={setNovaVaga} />
          ) : (
            <Esqueleto className="h-64" />
          )
        ) : (
          <div className="space-y-5">
            {(idadeTexto || c.primeiraVez) && (
              <div className="flex flex-wrap gap-2 text-sm">
                {idadeTexto && <span className="rounded-full bg-papel px-2.5 py-1 font-semibold text-grafite">{idadeTexto}</span>}
                {c.primeiraVez && <span className="rounded-full bg-esperanca-50 px-2.5 py-1 font-semibold text-esperanca">Primeira consulta</span>}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <a href={linkTelefone(c.paciente.telefone)} className={estiloBotao({ variante: "secundario", tamanho: "sm" })}>
                <Phone aria-hidden="true" />
                <span className="num">{telefoneLegivel(c.paciente.telefone)}</span>
              </a>
              {papel === "equipa" && clinica && ESTADOS_ALTERAVEIS.includes(c.estado) && (
                <a href={linkWhatsApp(c.paciente.telefone, mensagens.confirmacao(c, clinica))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario", tamanho: "sm" })}>
                  <LogoWhatsApp />
                  Enviar confirmação pelo WhatsApp
                </a>
              )}
            </div>

            <dl className="divide-y divide-linha rounded-cartao border border-linha px-4">
              <Par rotulo="Médico">
                {c.medico.titulo} {c.medico.nome}
              </Par>
              <Par rotulo="Especialidade">{c.especialidade.nome}</Par>
              <Par rotulo="Hora">
                <span className="num">
                  {horaDe(c.inicio)} às {horaDe(c.fim)}
                </span>
              </Par>
              {c.observacao && <Par rotulo="Motivo">{c.observacao}</Par>}
              {papel === "equipa" && (
                <Par rotulo="Marcada">
                  {CANAIS[c.canal]}, {haQuanto(c.criadaEm, agora)}
                </Par>
              )}
              {c.reagendadaDe && <Par rotulo="Estava para">{quandoCurto(c.reagendadaDe, agora)}</Par>}
              {c.recusada && <Par rotulo="Recusada pelo médico">{c.motivoRecusa || "Sem motivo indicado"}</Par>}
            </dl>
          </div>
        )}
      </Folha>

      <FolhaRecusar consulta={aRecusar ? c : null} aoFechar={() => setARecusar(false)} />

      <Confirmacao
        aberta={perguntarCancelar}
        aoFechar={() => setPerguntarCancelar(false)}
        titulo="Tem certeza que deseja cancelar esta consulta?"
        texto={c ? `${c.paciente.nome}, ${quandoCurto(c.inicio)}. O horário fica livre e quem está na lista de espera é avisado.` : undefined}
        confirmar="Cancelar consulta"
        perigo
        aCarregar={aMudar === "cancelar"}
        aoConfirmar={cancelar}
      />
    </>
  );
}
