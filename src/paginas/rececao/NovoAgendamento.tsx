import { ArrowLeft, Check, Search, UserPlus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../../componentes/Aviso";
import { Folha } from "../../componentes/Folha";
import { LogoWhatsApp } from "../../componentes/icones";
import { EscolhaEspecialidade } from "../../componentes/marcacao/EscolhaEspecialidade";
import { EscolhaHorario } from "../../componentes/marcacao/EscolhaHorario";
import { EscolhaMedico } from "../../componentes/marcacao/EscolhaMedico";
import { AreaTexto, Avatar, Botao, Campo, Esqueleto, Par, Segmentado, estiloBotao } from "../../componentes/ui";
import { repo } from "../../lib/dados";
import { eErroAgenda } from "../../lib/disponibilidade";
import type { PreenchimentoNovo } from "../../lib/novoAgendamento";
import { dataLonga, diaDe, horaDe, quandoCurto } from "../../lib/tempo";
import type { Canal, ConsultaDetalhada } from "../../lib/tipos";
import { useDados } from "../../lib/usarDados";
import { linkWhatsApp, mensagens, telefoneLegivel } from "../../lib/whatsapp";

type Passo = "paciente" | "especialidade" | "medico" | "horario" | "confirmar" | "feito";
const PASSOS: Passo[] = ["paciente", "especialidade", "medico", "horario", "confirmar"];
const NOMES: Record<Passo, string> = { paciente: "Paciente", especialidade: "Especialidade", medico: "Médico", horario: "Data e horário", confirmar: "Confirmar", feito: "" };

interface PacienteEscolhido {
  id: string;
  nome: string;
  telefone: string;
}

/** O "Novo agendamento" da receção: Paciente → Especialidade → Médico → Data → Horário → Confirmar. */
export function FolhaNovoAgendamento({ inicial, aoFechar }: { inicial: PreenchimentoNovo; aoFechar: () => void }) {
  const avisar = useAviso();
  const navigate = useNavigate();
  const { dados: base } = useDados(
    async (r) => {
      const [especialidades, medicos, clinica] = await Promise.all([r.especialidades(), r.medicos(), r.clinica()]);
      return { especialidades, medicos, clinica };
    },
    [],
    ["especialidades", "medicos", "clinica"],
  );
  const { dados: pacienteInicial } = useDados((r) => (inicial.pacienteId ? r.pacientes().then((l) => l.find((p) => p.id === inicial.pacienteId) ?? null) : Promise.resolve(null)), [inicial.pacienteId], []);

  const [escolhido, setEscolhido] = useState<PacienteEscolhido | null>(null);
  const paciente = escolhido ?? (pacienteInicial ? { id: pacienteInicial.id, nome: pacienteInicial.nome, telefone: pacienteInicial.telefone } : null);
  const [especialidadeId, setEspecialidadeId] = useState<string | null>(inicial.especialidadeId ?? null);
  const [medicoId, setMedicoId] = useState<string | null>(inicial.medicoId ?? null);
  const [inicio, setInicio] = useState<string | null>(null);
  const depoisDoPaciente = (): Passo => (medicoId ? "horario" : especialidadeId ? "medico" : "especialidade");
  const [passo, setPasso] = useState<Passo>(inicial.pacienteId ? depoisDoPaciente() : "paciente");

  const [estado, setEstado] = useState<"confirmada" | "aguardando">("confirmada");
  const [canal, setCanal] = useState<Canal>("rececao");
  const [observacao, setObservacao] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [feita, setFeita] = useState<ConsultaDetalhada | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const adiada = useDeferredValue(pesquisa);
  const { dados: resultados } = useDados((r) => r.pacientes(adiada), [adiada], ["pacientes"]);
  const [novo, setNovo] = useState<{ nome: string; telefone: string; nascimento: string } | null>(null);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  const medico = base?.medicos.find((m) => m.id === medicoId) ?? null;
  const especialidade = base?.especialidades.find((e) => e.id === (especialidadeId ?? medico?.especialidadeId)) ?? null;
  const indice = PASSOS.indexOf(passo);

  function escolherPaciente(p: PacienteEscolhido) {
    setEscolhido(p);
    setPasso(depoisDoPaciente());
  }

  async function registarPaciente() {
    if (!novo) return;
    setErroNovo(null);
    try {
      const p = await repo().criarPaciente({ nome: novo.nome, telefone: novo.telefone, dataNascimento: novo.nascimento || null });
      setNovo(null);
      escolherPaciente({ id: p.id, nome: p.nome, telefone: p.telefone });
    } catch (e) {
      setErroNovo(mensagemDeErro(e));
    }
  }

  async function confirmar() {
    if (!paciente || !medico || !inicio) return;
    setAGuardar(true);
    try {
      const c = await repo().marcar({ pacienteId: paciente.id, medicoId: medico.id, inicio, estado, canal, observacao });
      setFeita(c);
      setPasso("feito");
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
      if (eErroAgenda(e) && ["ocupado", "passado", "bloqueado", "fora_do_horario"].includes(e.codigo)) {
        setInicio(null);
        setPasso("horario");
      }
    } finally {
      setAGuardar(false);
    }
  }

  const resumo = [paciente?.nome, especialidade?.nome, medico ? `${medico.titulo} ${medico.nome}` : null, inicio ? quandoCurto(inicio) : null].filter(Boolean).join(", ");

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      largura="lg"
      titulo={passo === "feito" ? "Consulta marcada" : "Novo agendamento"}
      antesDoTitulo={
        passo !== "feito" ? (
          <p className="mb-1 text-sm font-semibold text-esperanca">
            Passo {indice + 1} de {PASSOS.length}: {NOMES[passo]}
          </p>
        ) : undefined
      }
      descricao={passo !== "feito" && resumo ? resumo : undefined}
      rodape={
        passo === "confirmar" ? (
          <Botao tamanho="lg" larguraTotal aCarregar={aGuardar} onClick={confirmar}>
            Confirmar agendamento
          </Botao>
        ) : passo === "feito" && feita && base ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={linkWhatsApp(feita.paciente.telefone, mensagens.confirmacao(feita, base.clinica))} target="_blank" rel="noreferrer" className={estiloBotao({ tamanho: "lg", className: "sm:col-span-2" })}>
              <LogoWhatsApp />
              Enviar confirmação pelo WhatsApp
            </a>
            <Botao
              variante="secundario"
              tamanho="lg"
              onClick={() => {
                aoFechar();
                navigate(`/rececao?dia=${diaDe(feita.inicio)}&consulta=${feita.id}`);
              }}
            >
              Ver na agenda
            </Botao>
            <Botao variante="secundario" tamanho="lg" onClick={aoFechar}>
              Fechar
            </Botao>
          </div>
        ) : undefined
      }
    >
      {indice > 0 && passo !== "feito" && (
        <button type="button" onClick={() => setPasso(PASSOS[indice - 1])} className="mb-4 inline-flex items-center gap-1.5 rounded-botao text-sm font-semibold text-grafite hover:text-tinta">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </button>
      )}

      {!base ? (
        <Esqueleto className="h-72" />
      ) : passo === "paciente" ? (
        novo ? (
          <div className="space-y-4">
            <Campo rotulo="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus autoComplete="off" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Telemóvel" inputMode="tel" placeholder="923 456 789" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
              <Campo rotulo="Data de nascimento" type="date" dica="Opcional." value={novo.nascimento} onChange={(e) => setNovo({ ...novo, nascimento: e.target.value })} />
            </div>
            {erroNovo && (
              <p role="alert" className="text-sm font-semibold text-estado-vermelho">
                {erroNovo}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Botao onClick={registarPaciente}>Registar e continuar</Botao>
              <Botao variante="fantasma" onClick={() => setNovo(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-grafite" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                placeholder="Nome ou telemóvel"
                aria-label="Pesquisar paciente por nome ou telemóvel"
                className="h-12 w-full rounded-botao border border-linha-forte bg-white pl-12 pr-3 text-tinta placeholder:text-nevoa focus:border-esperanca focus:outline-none focus:ring-4 focus:ring-esperanca/10"
              />
            </div>
            <ul className="mt-3 divide-y divide-linha overflow-hidden rounded-cartao border border-linha">
              {(resultados ?? []).slice(0, 8).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => escolherPaciente({ id: p.id, nome: p.nome, telefone: p.telefone })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-esperanca-50/60">
                    <Avatar nome={p.nome} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-tinta">{p.nome}</span>
                      <span className="num block text-sm text-grafite">{telefoneLegivel(p.telefone)}</span>
                    </span>
                    {p.proximaConsulta && <span className="hidden text-sm text-grafite sm:block">Próxima: {quandoCurto(p.proximaConsulta)}</span>}
                  </button>
                </li>
              ))}
              {resultados && resultados.length === 0 && <li className="px-4 py-6 text-center text-grafite">Nenhum paciente encontrado com “{pesquisa}”.</li>}
            </ul>
            <Botao
              variante="secundario"
              className="mt-3"
              icone={<UserPlus className="h-5 w-5" />}
              onClick={() => {
                const soDigitos = /^[\d\s+]+$/.test(pesquisa.trim());
                setNovo({ nome: soDigitos ? "" : pesquisa, telefone: soDigitos ? pesquisa : "", nascimento: "" });
              }}
            >
              Registar novo paciente
            </Botao>
          </>
        )
      ) : passo === "especialidade" ? (
        <EscolhaEspecialidade
          especialidades={base.especialidades}
          medicos={base.medicos}
          aoEscolher={(e) => {
            setEspecialidadeId(e.id);
            if (medico?.especialidadeId !== e.id) setMedicoId(null);
            setPasso("medico");
          }}
        />
      ) : passo === "medico" && especialidade ? (
        <EscolhaMedico
          medicos={base.medicos.filter((m) => m.especialidadeId === especialidade.id)}
          especialidade={especialidade}
          aoEscolher={(m) => {
            setMedicoId(m.id);
            setInicio(null);
            setPasso("horario");
          }}
          aoEscolherVaga={(m, v) => {
            setMedicoId(m.id);
            setInicio(v.inicio);
            setPasso("confirmar");
          }}
        />
      ) : passo === "horario" && medico && paciente ? (
        <EscolhaHorario
          medico={medico}
          diaInicial={inicial.dia ?? null}
          seleccionada={inicio}
          aoEscolher={(v) => {
            setInicio(v.inicio);
            setPasso("confirmar");
          }}
          aoListaEspera={async (dia) => {
            try {
              await repo().entrarListaEspera({ pacienteId: paciente.id, especialidadeId: medico.especialidadeId, medicoId: medico.id, dataDesejada: dia });
              avisar(`${paciente.nome} ficou na lista de espera.`);
              aoFechar();
            } catch (e) {
              avisar(mensagemDeErro(e), "erro");
            }
          }}
        />
      ) : passo === "confirmar" && paciente && medico && inicio ? (
        <div>
          <dl className="divide-y divide-linha rounded-cartao border border-linha px-4">
            <Par rotulo="Paciente">{paciente.nome}</Par>
            <Par rotulo="Especialidade">{especialidade?.nome}</Par>
            <Par rotulo="Médico">
              {medico.titulo} {medico.nome}
            </Par>
            <Par rotulo="Data">{dataLonga(diaDe(inicio))}</Par>
            <Par rotulo="Hora">
              <span className="num text-xl text-esperanca">{horaDe(inicio)}</span>
            </Par>
          </dl>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Estado</p>
              <Segmentado
                rotulo="Estado"
                larguraTotal
                valor={estado}
                aoMudar={setEstado}
                opcoes={[
                  { valor: "confirmada", rotulo: "Confirmada" },
                  { valor: "aguardando", rotulo: "Por confirmar" },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Pedido feito</p>
              <Segmentado
                rotulo="Pedido feito"
                larguraTotal
                valor={canal}
                aoMudar={setCanal}
                opcoes={[
                  { valor: "rececao", rotulo: "Na receção" },
                  { valor: "telefone", rotulo: "Telefone" },
                  { valor: "whatsapp", rotulo: "WhatsApp" },
                ]}
              />
            </div>
          </div>
          <AreaTexto className="mt-5" rotulo="Motivo da consulta" dica="Opcional. O médico vê esta nota." maxLength={200} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
      ) : passo === "feito" && feita ? (
        <div className="py-4 text-center">
          <div className="anim-surgir mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-esperanca text-white">
            <Check className="h-7 w-7" strokeWidth={2.6} aria-hidden="true" />
          </div>
          <p className="mt-4 text-lg text-tinta">
            <strong>{feita.paciente.nome}</strong> com {feita.medico.titulo} {feita.medico.nome}
          </p>
          <p className="num text-grafite">
            {dataLonga(diaDe(feita.inicio))}, às {horaDe(feita.inicio)}
          </p>
        </div>
      ) : (
        <Esqueleto className="h-72" />
      )}
    </Folha>
  );
}
