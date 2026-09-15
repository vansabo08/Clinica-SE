// Tipos de domínio. Espelham as tabelas de supabase/migrations
// (em camelCase do lado da aplicação, snake_case na base de dados).

import type { Dia, Hora } from "./tempo";

export type Papel = "paciente" | "rececao" | "admin" | "medico";

export type EstadoConsulta =
  | "aguardando"
  | "confirmada"
  | "em_atendimento"
  | "concluida"
  | "cancelada"
  | "faltou";

export type Canal = "app" | "rececao" | "telefone" | "whatsapp";

export interface Utilizador {
  id: string;
  papel: Papel;
  nome: string;
  email: string;
  telefone: string;
  /** Preenchido quando o utilizador é paciente. */
  pacienteId: string | null;
  /** Preenchido quando o utilizador é médico. */
  medicoId: string | null;
}

export interface Paciente {
  id: string;
  userId: string | null;
  nome: string;
  telefone: string;
  dataNascimento: Dia | null;
  lembreteWhatsapp: boolean;
  criadoEm: string;
}

export type Parentesco = "filho" | "filha" | "esposo" | "esposa" | "mae" | "pai" | "outro";

export interface Familiar {
  id: string;
  titularId: string;
  pacienteId: string;
  parentesco: Parentesco;
}

export interface Especialidade {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  ordem: number;
  activa: boolean;
}

export interface Medico {
  id: string;
  userId: string | null;
  titulo: "Dr." | "Dra.";
  nome: string;
  especialidadeId: string;
  telefone: string;
  email: string;
  fotoUrl: string | null;
  activo: boolean;
  duracaoMin: number;
  podeEditarDisponibilidade: boolean;
}

/** Um período de trabalho semanal. Um dia pode ter vários (manhã e tarde). */
export interface HorarioTrabalho {
  id: string;
  medicoId: string;
  diaSemana: number; // 0 = domingo
  inicio: Hora;
  fim: Hora;
}

export type MotivoBloqueio = "ferias" | "reuniao" | "ausencia" | "intervalo" | "feriado";

export interface Bloqueio {
  id: string;
  /** null = toda a clínica (ex.: feriado). */
  medicoId: string | null;
  inicio: string;
  fim: string;
  motivo: MotivoBloqueio;
  nota: string;
}

export interface Consulta {
  id: string;
  pacienteId: string;
  medicoId: string;
  especialidadeId: string;
  inicio: string;
  fim: string;
  estado: EstadoConsulta;
  observacao: string;
  canal: Canal;
  marcadaPor: string | null;
  criadaEm: string;
  confirmadaEm: string | null;
  canceladaEm: string | null;
  reagendadaDe: string | null;
}

export type TipoNotificacao = "lembrete" | "marcacao" | "confirmacao" | "reagendamento" | "cancelamento" | "vaga";
export type CanalNotificacao = "app" | "whatsapp" | "sms";

export interface Notificacao {
  id: string;
  userId: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  consultaId: string | null;
  canal: CanalNotificacao;
  /** Quando deve aparecer / ser enviada. */
  agendadaPara: string;
  enviadaEm: string | null;
  lidaEm: string | null;
  /** Dados extra (ex.: a vaga oferecida). */
  dados: { medicoId?: string; especialidadeId?: string; inicio?: string } | null;
}

export type EstadoEspera = "activa" | "marcada" | "removida";

export interface EntradaEspera {
  id: string;
  pacienteId: string;
  especialidadeId: string;
  medicoId: string | null;
  dataDesejada: Dia;
  estado: EstadoEspera;
  criadaEm: string;
  ultimaVaga: string | null;
  vagasOferecidas: number;
}

export interface Clinica {
  nome: string;
  endereco: string;
  cidade: string;
  telefone: string;
  whatsapp: string;
  email: string;
  horario: string;
  latitude: number;
  longitude: number;
}

// ------------------------------------------------------------
// Vistas compostas que a interface consome
// ------------------------------------------------------------

export interface ConsultaDetalhada extends Consulta {
  paciente: Pick<Paciente, "id" | "nome" | "telefone" | "dataNascimento">;
  medico: Pick<Medico, "id" | "titulo" | "nome" | "fotoUrl">;
  especialidade: Pick<Especialidade, "id" | "nome" | "icone">;
  /** Parentesco, quando a consulta é de um familiar do utilizador. */
  parentesco: Parentesco | null;
  /** Número de consultas anteriores do paciente na clínica (para o médico). */
  primeiraVez: boolean;
}

export interface PacienteResumo extends Paciente {
  proximaConsulta: string | null;
  ultimoAgendamento: string | null;
  totalConsultas: number;
}

export interface FamiliarDetalhado extends Familiar {
  paciente: Paciente;
}

export interface EntradaEsperaDetalhada extends EntradaEspera {
  paciente: Pick<Paciente, "id" | "nome" | "telefone">;
  especialidade: Pick<Especialidade, "id" | "nome">;
  medico: Pick<Medico, "id" | "titulo" | "nome"> | null;
}

/** Intervalo em que um médico não pode receber ninguém. Não diz quem nem porquê. */
export interface Indisponivel {
  medicoId: string | null;
  inicio: string;
  fim: string;
  tipo: "consulta" | "bloqueio";
}

export interface ErroAgenda extends Error {
  codigo:
    | "passado"
    | "fora_do_horario"
    | "bloqueado"
    | "ocupado"
    | "paciente_ocupado"
    | "medico_inactivo"
    | "sem_permissao"
    | "nao_encontrada"
    | "estado_invalido";
}
