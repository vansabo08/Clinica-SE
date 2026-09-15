// Textos das notificações. As funções SQL de supabase/migrations escrevem
// os mesmos textos — se mudar aqui, mudar lá.

import { dataCurta, dataLonga, diaDe, horaDe } from "./tempo";

interface Base {
  medico: string; // "Dr. João Silva"
  inicio: string;
  paciente?: string; // só quando é um familiar
}

const para = (b: Base) => (b.paciente ? ` de ${b.paciente}` : "");

export const textos = {
  marcacao: (b: Base) => ({
    titulo: "Consulta agendada",
    corpo: `A consulta${para(b)} com ${b.medico} ficou marcada para ${dataLonga(diaDe(b.inicio))}, às ${horaDe(b.inicio)}. A clínica vai confirmar em breve.`,
  }),
  confirmacao: (b: Base) => ({
    titulo: "Consulta confirmada",
    corpo: `A clínica confirmou a consulta${para(b)} com ${b.medico} a ${dataLonga(diaDe(b.inicio))}, às ${horaDe(b.inicio)}.`,
  }),
  reagendamento: (b: Base) => ({
    titulo: "Consulta reagendada",
    corpo: `A consulta${para(b)} com ${b.medico} passou para ${dataLonga(diaDe(b.inicio))}, às ${horaDe(b.inicio)}.`,
  }),
  cancelamento: (b: Base) => ({
    titulo: "Consulta cancelada",
    corpo: `A consulta${para(b)} com ${b.medico} de ${dataCurta(diaDe(b.inicio))}, às ${horaDe(b.inicio)}, foi cancelada.`,
  }),
  lembrete24h: (b: Base & { clinica: string }) => ({
    titulo: "Consulta amanhã",
    corpo: `Lembrete: você tem uma consulta amanhã às ${horaDe(b.inicio)} na ${b.clinica}.`,
  }),
  lembreteHoje: (b: Base & { clinica: string }) => ({
    titulo: "Consulta hoje",
    corpo: `Lembrete: você tem uma consulta hoje às ${horaDe(b.inicio)} na ${b.clinica}.`,
  }),
  vaga: (b: Base) => ({
    titulo: "Abriu uma vaga",
    corpo: `Ficou livre um horário com ${b.medico} a ${dataCurta(diaDe(b.inicio))}, às ${horaDe(b.inicio)}. Quem marcar primeiro fica com ele.`,
  }),
  novaMarcacaoApp: (b: Base & { pacienteNome: string }) => ({
    titulo: "Nova marcação pela aplicação",
    corpo: `${b.pacienteNome} marcou consulta com ${b.medico} para ${dataCurta(diaDe(b.inicio))}, às ${horaDe(b.inicio)}. Falta confirmar.`,
  }),
};
