// O contrato entre a interface e os dados.
//
// Há duas implementações: a de demonstração (dados no navegador, com as
// mesmas regras e permissões simuladas) e a do Supabase. A interface nunca
// sabe qual está a usar.

import type {
  Bloqueio,
  Canal,
  Clinica,
  ConsultaDetalhada,
  EntradaEsperaDetalhada,
  Especialidade,
  EstadoConsulta,
  FamiliarDetalhado,
  HorarioTrabalho,
  Indisponivel,
  Medico,
  Notificacao,
  Paciente,
  PacienteResumo,
  Papel,
  Parentesco,
  Utilizador,
} from "../tipos";
import type { Dia } from "../tempo";

export type Tabela =
  | "sessao"
  | "clinica"
  | "especialidades"
  | "medicos"
  | "horarios"
  | "bloqueios"
  | "consultas"
  | "pacientes"
  | "familiares"
  | "espera"
  | "notificacoes";

export interface FiltroConsultas {
  de?: string;
  ate?: string;
  medicoId?: string;
  pacienteId?: string;
}

export interface NovaConsulta {
  pacienteId: string;
  medicoId: string;
  inicio: string;
  observacao?: string;
  canal?: Canal;
  /** Só a equipa pode marcar já confirmada. */
  estado?: Extract<EstadoConsulta, "aguardando" | "confirmada">;
}

export interface NovaConta {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
}

export type DadosMedico = Omit<Medico, "id" | "userId"> & { id?: string };
export type DadosEspecialidade = Omit<Especialidade, "id"> & { id?: string };
export type PeriodoTrabalho = Pick<HorarioTrabalho, "diaSemana" | "inicio" | "fim">;

export interface Repositorio {
  readonly modo: "demo" | "supabase";

  /** Avisa quando algo muda — nesta aba, noutra aba ou no servidor. */
  aoMudar(ouvinte: (tabelas: Tabela[]) => void): () => void;

  // Sessão
  sessaoActual(): Promise<Utilizador | null>;
  entrar(email: string, senha: string): Promise<Utilizador>;
  criarConta(dados: NovaConta): Promise<Utilizador>;
  sair(): Promise<void>;
  /** Só no modo demonstração. */
  entrarComo?(papel: Papel): Promise<Utilizador>;
  /** Só no modo demonstração: volta aos dados iniciais. */
  reporDemonstracao?(): Promise<void>;

  // Clínica
  clinica(): Promise<Clinica>;
  guardarClinica(c: Clinica): Promise<void>;

  // Especialidades e médicos
  especialidades(): Promise<Especialidade[]>;
  guardarEspecialidade(e: DadosEspecialidade): Promise<Especialidade>;
  removerEspecialidade(id: string): Promise<void>;

  medicos(): Promise<Medico[]>;
  guardarMedico(m: DadosMedico): Promise<Medico>;
  /** Envia ao médico um convite por email para criar a conta e ver a própria agenda. */
  convidarMedico(medicoId: string): Promise<{ enviado: boolean }>;

  horarios(medicoId?: string): Promise<HorarioTrabalho[]>;
  guardarHorarios(medicoId: string, periodos: PeriodoTrabalho[]): Promise<void>;

  bloqueios(filtro?: { medicoId?: string; de?: string; ate?: string }): Promise<Bloqueio[]>;
  bloquear(b: Omit<Bloqueio, "id">): Promise<Bloqueio>;
  desbloquear(id: string): Promise<void>;

  /** Quando o médico não pode receber ninguém. Não diz quem nem porquê. */
  indisponiveis(medicoId: string, de: string, ate: string): Promise<Indisponivel[]>;

  // Consultas
  consultas(filtro?: FiltroConsultas): Promise<ConsultaDetalhada[]>;
  consulta(id: string): Promise<ConsultaDetalhada | null>;
  marcar(nova: NovaConsulta): Promise<ConsultaDetalhada>;
  reagendar(id: string, novoInicio: string): Promise<ConsultaDetalhada>;
  cancelar(id: string): Promise<void>;
  mudarEstado(id: string, estado: EstadoConsulta): Promise<void>;

  // Pacientes e familiares
  pacientes(pesquisa?: string): Promise<PacienteResumo[]>;
  criarPaciente(p: { nome: string; telefone: string; dataNascimento?: Dia | null }): Promise<Paciente>;
  meuPaciente(): Promise<Paciente | null>;
  actualizarPaciente(id: string, dados: Partial<Pick<Paciente, "nome" | "telefone" | "dataNascimento" | "lembreteWhatsapp">>): Promise<void>;

  familiares(): Promise<FamiliarDetalhado[]>;
  adicionarFamiliar(f: { nome: string; parentesco: Parentesco; dataNascimento?: Dia | null }): Promise<FamiliarDetalhado>;
  removerFamiliar(id: string): Promise<void>;

  // Lista de espera
  listaEspera(): Promise<EntradaEsperaDetalhada[]>;
  entrarListaEspera(e: { pacienteId: string; especialidadeId: string; medicoId: string | null; dataDesejada: Dia }): Promise<void>;
  sairListaEspera(id: string): Promise<void>;

  // Notificações
  notificacoes(): Promise<Notificacao[]>;
  marcarLida(id?: string): Promise<void>;
}
