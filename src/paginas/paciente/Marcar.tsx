import { ArrowLeft, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { EscolhaEspecialidade } from "../../componentes/marcacao/EscolhaEspecialidade";
import { EscolhaHorario } from "../../componentes/marcacao/EscolhaHorario";
import { EscolhaMedico } from "../../componentes/marcacao/EscolhaMedico";
import { Senha } from "../../componentes/Senha";
import { CarregandoPagina } from "../../componentes/Shell";
import { AreaTexto, Avatar, Botao, BotaoIcone, Campo, Esqueleto, Fichas, Par, Vazio, cx } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { eErroAgenda } from "../../lib/disponibilidade";
import { PARENTESCOS } from "../../lib/estados";
import { primeiroNome, useUtilizador } from "../../lib/sessao";
import { dataLonga, diaDe, horaDe, quandoCurto } from "../../lib/tempo";
import type { ConsultaDetalhada, Parentesco } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";
import { paraQuem } from "./Inicio";

type Passo = "especialidade" | "medico" | "horario" | "confirmar" | "sucesso";

const TITULOS: Record<Passo, string> = {
  especialidade: "Especialidade",
  medico: "Médico",
  horario: "Dia e hora",
  confirmar: "Confirmar",
  sucesso: "",
};

export function Marcar() {
  const u = useUtilizador();
  const navigate = useNavigate();
  const avisar = useAviso();
  const [params] = useSearchParams();
  const idReagendar = params.get("reagendar");
  const notificacaoVaga = params.get("vaga");
  const paraParam = params.get("para");

  const { dados: base } = useDados(
    async (r) => {
      const [especialidades, medicos, familiares, clinica] = await Promise.all([r.especialidades(), r.medicos(), r.familiares(), r.clinica()]);
      return { especialidades, medicos, familiares, clinica };
    },
    [],
    ["especialidades", "medicos", "familiares", "clinica"],
  );
  const { dados: original, carregando: aCarregarOriginal } = useDados((r) => (idReagendar ? r.consulta(idReagendar) : Promise.resolve(null)), [idReagendar], []);

  const passos: Passo[] = idReagendar ? ["horario", "confirmar"] : ["especialidade", "medico", "horario", "confirmar"];
  const [passo, setPasso] = useState<Passo>(() => {
    if (idReagendar) return "horario";
    if (params.get("medico") && params.get("inicio")) return "confirmar";
    if (params.get("medico")) return "horario";
    if (params.get("especialidade")) return "medico";
    return "especialidade";
  });
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [especialidadeId, setEspecialidadeId] = useState<string | null>(params.get("especialidade"));
  const [medicoId, setMedicoId] = useState<string | null>(params.get("medico"));
  const [inicio, setInicio] = useState<string | null>(params.get("inicio"));

  const paraFamiliar = !!paraParam && paraParam !== u.pacienteId;
  const [para, setPara] = useState<"eu" | "familiar">(paraFamiliar ? "familiar" : "eu");
  const [familiarId, setFamiliarId] = useState<string | null>(paraFamiliar ? paraParam : null);
  const [novoFamiliar, setNovoFamiliar] = useState<{ nome: string; parentesco: Parentesco | null } | null>(null);
  const [comObservacao, setComObservacao] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erroTelefone, setErroTelefone] = useState<string | null>(null);
  const [erroPara, setErroPara] = useState<string | null>(null);
  const [alertaHorario, setAlertaHorario] = useState<string | null>(null);
  const [aConfirmar, setAConfirmar] = useState(false);
  const [resultado, setResultado] = useState<ConsultaDetalhada | null>(null);

  useEffect(() => {
    if (!original) return;
    setMedicoId(original.medicoId);
    setEspecialidadeId(original.especialidadeId);
  }, [original]);

  if (!base || (idReagendar && aCarregarOriginal && !original)) return <CarregandoPagina />;

  if (idReagendar && !original) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <Vazio titulo="Não encontrámos esta consulta" texto="Pode já ter sido cancelada ou pertencer a outra conta.">
          <Botao onClick={() => navigate("/consultas")}>Ver as minhas consultas</Botao>
        </Vazio>
      </div>
    );
  }

  const medico = base.medicos.find((m) => m.id === medicoId) ?? null;
  const especialidade = base.especialidades.find((e) => e.id === (especialidadeId ?? medico?.especialidadeId)) ?? null;
  // Um parâmetro inválido (médico que já não existe) volta ao princípio.
  const passoReal: Passo = (passo === "horario" || passo === "confirmar") && !medico ? "especialidade" : passo === "medico" && !especialidade ? "especialidade" : passo;
  const indice = passos.indexOf(passoReal);

  function ir(p: Passo, d: 1 | -1 = 1) {
    setDireccao(d);
    setPasso(p);
    window.scrollTo({ top: 0 });
  }

  function voltar() {
    if (passoReal === "confirmar") return ir("horario", -1);
    if (passoReal === "horario" && !idReagendar) return ir(especialidade ? "medico" : "especialidade", -1);
    if (passoReal === "medico") return ir("especialidade", -1);
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
    else navigate("/inicio");
  }

  async function adicionarFamiliar() {
    if (!novoFamiliar?.nome.trim() || !novoFamiliar.parentesco) return setErroPara("Escreva o nome e escolha o parentesco.");
    try {
      const f = await repo().adicionarFamiliar({ nome: novoFamiliar.nome, parentesco: novoFamiliar.parentesco });
      setFamiliarId(f.pacienteId);
      setNovoFamiliar(null);
      setErroPara(null);
    } catch (e) {
      setErroPara(mensagemDeErro(e));
    }
  }

  async function confirmar() {
    if (!medico || !inicio) return;
    const pacienteId = idReagendar ? original!.pacienteId : para === "eu" ? u.pacienteId : familiarId;
    if (!pacienteId) return setErroPara("Escolha para quem é a consulta.");
    const digitos = telefone.replace(/\D/g, "").replace(/^244/, "");
    if (!u.telefone && digitos.length !== 9) return setErroTelefone("Escreva os 9 dígitos do telemóvel.");

    setAConfirmar(true);
    try {
      if (!u.telefone) await repo().actualizarPaciente(u.pacienteId!, { telefone: digitos });
      const c = idReagendar
        ? await repo().reagendar(idReagendar, inicio)
        : await repo().marcar({ pacienteId, medicoId: medico.id, inicio, observacao: comObservacao ? observacao : "", canal: "app" });
      if (notificacaoVaga) repo().marcarLida(notificacaoVaga).catch(() => undefined);
      setResultado(c);
      ir("sucesso");
    } catch (e) {
      if (eErroAgenda(e) && ["ocupado", "passado", "bloqueado", "fora_do_horario"].includes(e.codigo)) {
        setAlertaHorario(e.message);
        setInicio(null);
        ir("horario", -1);
      } else {
        avisar(mensagemDeErro(e), "erro");
      }
    } finally {
      setAConfirmar(false);
    }
  }

  const nomeMedico = medico ? `${medico.titulo} ${medico.nome}` : "";

  return (
    <div className="min-h-dvh">
      {passoReal !== "sucesso" && (
        <header className="sticky top-0 z-20 border-b border-linha/70 bg-papel/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-2 sm:px-4">
            <BotaoIcone rotulo="Voltar" onClick={voltar}>
              <ArrowLeft />
            </BotaoIcone>
            <div className="min-w-0 flex-1 text-center">
              <p className="font-bold leading-5 text-tinta">{idReagendar ? "Reagendar consulta" : "Marcar consulta"}</p>
              <p className="text-xs text-grafite">
                Passo {indice + 1} de {passos.length}, {TITULOS[passoReal].toLowerCase()}
              </p>
            </div>
            <BotaoIcone rotulo="Fechar" onClick={() => navigate("/inicio")}>
              <X />
            </BotaoIcone>
          </div>
          <div className="mx-auto flex max-w-2xl gap-1.5 px-4 pb-3" aria-hidden="true">
            {passos.map((p, i) => (
              <span key={p} className={cx("h-1 flex-1 rounded-full transition-colors duration-500", i <= indice ? "bg-esperanca" : "bg-linha")} />
            ))}
          </div>
        </header>
      )}

      <div key={passoReal} className={cx("mx-auto max-w-2xl px-4 pt-6 sm:px-6", direccao === 1 ? "anim-passo-frente" : "anim-passo-tras")}>
        {passoReal === "especialidade" && (
          <>
            <h1 className="font-serif text-[2rem] leading-tight text-tinta">Que consulta precisa?</h1>
            <p className="mt-1.5 text-grafite">Na dúvida, comece por Clínica Geral.</p>
            <div className="mt-6">
              <EscolhaEspecialidade
                especialidades={base.especialidades}
                medicos={base.medicos}
                aoEscolher={(e) => {
                  setEspecialidadeId(e.id);
                  if (medico?.especialidadeId !== e.id) setMedicoId(null);
                  ir("medico");
                }}
              />
            </div>
          </>
        )}

        {passoReal === "medico" && especialidade && (
          <>
            <h1 className="font-serif text-[2rem] leading-tight text-tinta">{especialidade.nome}</h1>
            <p className="mt-1.5 text-grafite">Escolha o médico, ou toque no próximo horário para marcar já.</p>
            <div className="mt-6">
              <EscolhaMedico
                medicos={base.medicos.filter((m) => m.especialidadeId === especialidade.id)}
                especialidade={especialidade}
                aoEscolher={(m) => {
                  setMedicoId(m.id);
                  setInicio(null);
                  ir("horario");
                }}
                aoEscolherVaga={(m, v) => {
                  setMedicoId(m.id);
                  setInicio(v.inicio);
                  ir("confirmar");
                }}
              />
            </div>
          </>
        )}

        {passoReal === "horario" && medico && (
          <>
            <h1 className="font-serif text-[2rem] leading-tight text-tinta">Quando lhe dá jeito?</h1>
            <div className="mt-4 flex items-center gap-3 rounded-cartao border border-linha bg-white p-3 pr-2">
              <Avatar nome={nomeMedico} foto={medico.fotoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-tinta">{nomeMedico}</p>
                <p className="truncate text-sm text-grafite">{especialidade?.nome}</p>
              </div>
              {!idReagendar && (
                <Botao variante="fantasma" tamanho="sm" onClick={() => ir(especialidade ? "medico" : "especialidade", -1)}>
                  Trocar
                </Botao>
              )}
            </div>
            {original && <p className="mt-3 text-sm text-grafite">Horário actual: {quandoCurto(original.inicio)}. Fica livre quando confirmar o novo.</p>}
            {alertaHorario && (
              <p role="alert" className="mt-4 rounded-botao bg-estado-ambar-fundo px-3.5 py-3 font-semibold text-estado-ambar">
                {alertaHorario}
              </p>
            )}
            <div className="mt-6">
              <EscolhaHorario
                medico={medico}
                ignorar={original ? { inicio: original.inicio } : null}
                vagaActual={original?.inicio}
                diaInicial={inicio ? diaDe(inicio) : original ? diaDe(original.inicio) : null}
                aoEscolher={(v) => {
                  setInicio(v.inicio);
                  setAlertaHorario(null);
                  ir("confirmar");
                }}
                aoListaEspera={
                  idReagendar
                    ? undefined
                    : (dia) => navigate(`/lista-de-espera?nova=1&especialidade=${medico.especialidadeId}&medico=${medico.id}&dia=${dia}${para === "familiar" && familiarId ? `&para=${familiarId}` : ""}`)
                }
              />
            </div>
          </>
        )}

        {passoReal === "confirmar" && medico && inicio && (
          <div className="pb-6">
            <h1 className="font-serif text-[2rem] leading-tight text-tinta">{idReagendar ? "Confirmar reagendamento" : "Confirmar consulta"}</h1>

            <dl className="cartao mt-6 divide-y divide-linha px-5">
              {original && (
                <Par rotulo="Antes">
                  <span className="text-grafite line-through">{quandoCurto(original.inicio)}</span>
                </Par>
              )}
              <Par rotulo="Especialidade">{especialidade?.nome}</Par>
              <Par rotulo="Médico">{nomeMedico}</Par>
              <Par rotulo="Data">{dataLonga(diaDe(inicio))}</Par>
              <Par rotulo="Hora">
                <span className="num text-xl text-esperanca">{horaDe(inicio)}</span>
              </Par>
              <Par rotulo="Clínica">
                <span className="block">{base.clinica.nome}</span>
                <span className="block text-sm font-normal text-grafite">{base.clinica.endereco}</span>
              </Par>
            </dl>

            {!idReagendar && (
              <fieldset className="mt-7">
                <legend className="mb-3 text-lg font-bold text-tinta">Consulta para</legend>
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                  <Opcao activo={para === "eu"} aoEscolher={() => setPara("eu")} titulo="Eu" detalhe={u.nome} />
                  <Opcao
                    activo={para === "familiar"}
                    aoEscolher={() => {
                      setPara("familiar");
                      if (!familiarId && base.familiares.length === 1) setFamiliarId(base.familiares[0].pacienteId);
                      if (!base.familiares.length) setNovoFamiliar({ nome: "", parentesco: null });
                    }}
                    titulo="Familiar"
                    detalhe={base.familiares.length ? base.familiares.map((f) => primeiroNome(f.paciente.nome)).join(", ") : "Filho, filha, cônjuge…"}
                  />
                </div>

                {para === "familiar" && (
                  <div className="anim-surgir mt-3 rounded-cartao border border-linha bg-white p-4">
                    {base.familiares.length > 0 && (
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Familiar">
                        {base.familiares.map((f) => {
                          const activo = familiarId === f.pacienteId;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              role="radio"
                              aria-checked={activo}
                              onClick={() => {
                                setFamiliarId(f.pacienteId);
                                setErroPara(null);
                              }}
                              className={cx(
                                "inline-flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 font-semibold transition-colors",
                                activo ? "border-esperanca bg-esperanca text-white" : "border-linha-forte bg-white text-tinta hover:border-esperanca-300",
                              )}
                            >
                              <Avatar nome={f.paciente.nome} tamanho="sm" />
                              {primeiroNome(f.paciente.nome)}
                              <span className={cx("text-sm font-normal", activo ? "text-esperanca-100" : "text-grafite")}>{PARENTESCOS[f.parentesco].toLowerCase()}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {novoFamiliar ? (
                      <div className={cx("space-y-4", base.familiares.length > 0 && "mt-4 border-t border-linha pt-4")}>
                        <Campo rotulo="Nome do familiar" value={novoFamiliar.nome} onChange={(e) => setNovoFamiliar({ ...novoFamiliar, nome: e.target.value })} autoComplete="off" />
                        <Fichas
                          rotulo="Parentesco"
                          opcoes={Object.entries(PARENTESCOS).map(([valor, rotulo]) => ({ valor: valor as Parentesco, rotulo }))}
                          valor={novoFamiliar.parentesco}
                          aoMudar={(p) => setNovoFamiliar({ ...novoFamiliar, parentesco: p })}
                        />
                        <div className="flex gap-2">
                          <Botao variante="suave" onClick={adicionarFamiliar}>
                            Adicionar
                          </Botao>
                          {base.familiares.length > 0 && (
                            <Botao variante="fantasma" onClick={() => setNovoFamiliar(null)}>
                              Cancelar
                            </Botao>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Botao variante="fantasma" tamanho="sm" className="mt-3 -ml-2" icone={<UserPlus className="h-4 w-4" />} onClick={() => setNovoFamiliar({ nome: "", parentesco: null })}>
                        Adicionar familiar
                      </Botao>
                    )}
                  </div>
                )}
                {erroPara && (
                  <p role="alert" className="mt-2 text-sm font-semibold text-estado-vermelho">
                    {erroPara}
                  </p>
                )}
              </fieldset>
            )}

            {!u.telefone && (
              <Campo
                className="mt-6"
                rotulo="O seu telemóvel"
                dica="Para a clínica confirmar a consulta."
                inputMode="tel"
                autoComplete="tel"
                placeholder="923 456 789"
                value={telefone}
                onChange={(e) => {
                  setTelefone(e.target.value);
                  setErroTelefone(null);
                }}
                erro={erroTelefone}
              />
            )}

            {!idReagendar &&
              (comObservacao ? (
                <AreaTexto
                  className="anim-surgir mt-6"
                  rotulo="Observação para o médico"
                  dica="Opcional. Por exemplo: febre há três dias."
                  maxLength={200}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  autoFocus
                />
              ) : (
                <button type="button" onClick={() => setComObservacao(true)} className="mt-5 font-semibold text-esperanca underline-offset-4 hover:underline">
                  Adicionar uma observação para o médico
                </button>
              ))}

            <div className="sticky bottom-0 -mx-4 mt-8 border-t border-linha/70 bg-papel/90 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Botao tamanho="xl" larguraTotal aCarregar={aConfirmar} onClick={confirmar}>
                {idReagendar ? "Confirmar reagendamento" : "Confirmar consulta"}
              </Botao>
            </div>
          </div>
        )}

        {passoReal === "sucesso" && resultado && (
          <div className="mx-auto max-w-md pb-12 pt-6">
            <div className="text-center">
              <div className="anim-surgir mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-esperanca text-white">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" className="anim-tracar" style={{ animationDelay: "150ms" }} />
                </svg>
              </div>
              <h1 className="mt-5 font-serif text-[2.5rem] leading-tight text-tinta">{idReagendar ? "Consulta reagendada!" : "Consulta agendada!"}</h1>
              <p className="mt-2 text-lg text-grafite">{idReagendar ? "O horário anterior ficou livre para outra pessoa." : "Preparamos tudo para o seu atendimento."}</p>
            </div>

            {/* A senha sai da ranhura, como das máquinas de senhas — só que sem fila. */}
            <div className="mt-9">
              <div className="mx-1 h-3 rounded-full bg-tinta shadow-[inset_0_2px_3px_rgba(0,0,0,0.5)]" aria-hidden="true" />
              <div className="ranhura -mt-1.5">
                <div className="anim-imprimir" style={{ animationDelay: "450ms" }}>
                  <Senha
                    medico={`${resultado.medico.titulo} ${resultado.medico.nome}`}
                    fotoMedico={resultado.medico.fotoUrl}
                    especialidade={resultado.especialidade.nome}
                    icone={resultado.especialidade.icone}
                    dia={diaDe(resultado.inicio)}
                    hora={horaDe(resultado.inicio)}
                    estado={resultado.estado}
                    paraQuem={paraQuem(resultado)}
                  />
                </div>
              </div>
            </div>

            <div className="-mt-4 grid gap-2 sm:grid-cols-2">
              <Botao tamanho="lg" onClick={() => navigate(`/consultas/${resultado.id}`, { replace: true })}>
                Ver consulta
              </Botao>
              <Botao tamanho="lg" variante="secundario" onClick={() => navigate("/inicio", { replace: true })}>
                Voltar para início
              </Botao>
            </div>
            {resultado.estado === "aguardando" && (
              <p className="mt-5 text-center text-sm text-grafite">
                A clínica confirma em breve. Recebe o aviso aqui e um lembrete 24 horas antes. <Link to="/notificacoes" className="font-semibold text-esperanca">Notificações</Link>
              </p>
            )}
          </div>
        )}

        {passoReal === "sucesso" && !resultado && <Esqueleto className="h-80" />}
      </div>
    </div>
  );
}

function Opcao({ activo, aoEscolher, titulo, detalhe }: { activo: boolean; aoEscolher: () => void; titulo: string; detalhe?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={aoEscolher}
      className={cx("flex w-full items-center gap-3 rounded-botao border px-4 py-3 text-left transition-colors", activo ? "border-esperanca bg-esperanca-50" : "border-linha-forte bg-white hover:border-esperanca-300")}
    >
      <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", activo ? "border-esperanca" : "border-linha-forte")}>
        {activo && <span className="h-2.5 w-2.5 rounded-full bg-esperanca" />}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-tinta">{titulo}</span>
        {detalhe && <span className="block truncate text-sm text-grafite">{detalhe}</span>}
      </span>
    </button>
  );
}
