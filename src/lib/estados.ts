import type { EstadoConsulta, MotivoBloqueio, Papel, Parentesco } from "./tipos";

interface InfoEstado {
  rotulo: string;
  curto: string;
  /** Classes do ponto e da etiqueta. */
  ponto: string;
  etiqueta: string;
}

export const ESTADOS: Record<EstadoConsulta, InfoEstado> = {
  aguardando: {
    rotulo: "Aguardando confirmação",
    curto: "Aguardando",
    ponto: "bg-estado-ambar",
    etiqueta: "bg-estado-ambar-fundo text-estado-ambar",
  },
  confirmada: {
    rotulo: "Confirmada",
    curto: "Confirmada",
    ponto: "bg-estado-verde",
    etiqueta: "bg-estado-verde-fundo text-estado-verde",
  },
  em_atendimento: {
    rotulo: "Em atendimento",
    curto: "Em atendimento",
    ponto: "bg-estado-azul",
    etiqueta: "bg-estado-azul-fundo text-estado-azul",
  },
  concluida: {
    rotulo: "Concluída",
    curto: "Concluída",
    ponto: "bg-estado-cinza",
    etiqueta: "bg-estado-cinza-fundo text-estado-cinza",
  },
  cancelada: {
    rotulo: "Cancelada",
    curto: "Cancelada",
    ponto: "bg-estado-vermelho",
    etiqueta: "bg-estado-vermelho-fundo text-estado-vermelho",
  },
  faltou: {
    rotulo: "Faltou",
    curto: "Faltou",
    ponto: "bg-estado-escuro",
    etiqueta: "bg-estado-escuro-fundo text-estado-escuro",
  },
};

/** Barra lateral dos blocos de consulta nas grelhas de agenda. */
export const BORDA_ESTADO: Record<EstadoConsulta, string> = {
  aguardando: "border-estado-ambar",
  confirmada: "border-estado-verde",
  em_atendimento: "border-estado-azul",
  concluida: "border-estado-cinza",
  cancelada: "border-estado-vermelho",
  faltou: "border-estado-escuro",
};

export const ORDEM_ESTADOS: EstadoConsulta[] = ["aguardando", "confirmada", "em_atendimento", "concluida", "cancelada", "faltou"];

/** Estados em que a consulta ainda vai acontecer e pode ser mexida pelo paciente. */
export const ESTADOS_ALTERAVEIS: EstadoConsulta[] = ["aguardando", "confirmada"];

/** O que a receção pode fazer a partir de cada estado. */
export const TRANSICOES: Record<EstadoConsulta, EstadoConsulta[]> = {
  aguardando: ["confirmada", "em_atendimento", "faltou", "cancelada"],
  confirmada: ["em_atendimento", "aguardando", "faltou", "cancelada"],
  em_atendimento: ["concluida", "confirmada"],
  concluida: ["em_atendimento"],
  faltou: ["confirmada"],
  cancelada: [],
};

/** O que o médico pode fazer na sua agenda. */
export const TRANSICOES_MEDICO: Partial<Record<EstadoConsulta, EstadoConsulta[]>> = {
  aguardando: ["confirmada", "em_atendimento", "faltou"],
  confirmada: ["em_atendimento", "faltou"],
  em_atendimento: ["concluida"],
};

/** Motivos rápidos para o médico recusar uma consulta. */
export const MOTIVOS_RECUSA = ["Não estarei disponível nesse horário", "A consulta não é da minha especialidade", "Preciso de mais tempo para este caso"];

/** Nome da acção que leva a cada estado (verbo no botão). */
export const ACCAO_PARA: Record<EstadoConsulta, string> = {
  aguardando: "Voltar a aguardar",
  confirmada: "Confirmar presença",
  em_atendimento: "Iniciar atendimento",
  concluida: "Marcar como concluída",
  cancelada: "Cancelar consulta",
  faltou: "Marcar falta",
};

export const MOTIVOS_BLOQUEIO: Record<MotivoBloqueio, string> = {
  ferias: "Férias",
  reuniao: "Reunião",
  ausencia: "Ausência",
  intervalo: "Intervalo",
  feriado: "Feriado",
};

export const PARENTESCOS: Record<Parentesco, string> = {
  filho: "Filho",
  filha: "Filha",
  esposo: "Esposo",
  esposa: "Esposa",
  mae: "Mãe",
  pai: "Pai",
  outro: "Outro familiar",
};

export const PAPEIS: Record<Papel, string> = {
  paciente: "Paciente",
  rececao: "Receção",
  admin: "Administração",
  medico: "Médico",
};

export const eEquipa = (p: Papel | undefined | null) => p === "rececao" || p === "admin";
