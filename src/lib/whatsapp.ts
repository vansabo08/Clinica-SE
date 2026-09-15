// WhatsApp.
//
// Hoje: ligações wa.me, que abrem a conversa já escrita no telemóvel de
// quem carrega no botão. Não precisam de conta nem de aprovação.
//
// Amanhã: envio automático pela WhatsApp Business Cloud API. A interface
// EnviadorMensagens é o ponto de encaixe; a implementação vive na função
// supabase/functions/enviar-lembretes, que lê as notificações com
// canal = 'whatsapp' e enviada_em nula.

import type { Clinica, ConsultaDetalhada } from "./tipos";
import { dataLonga, diaDe, horaDe } from "./tempo";

/** 923 456 789 → 244923456789 */
export function numeroInternacional(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  if (d.startsWith("244")) return d;
  if (d.length === 9) return `244${d}`;
  return d;
}

/** 244923456789 → 923 456 789 */
export function telefoneLegivel(telefone: string): string {
  const d = telefone.replace(/\D/g, "").replace(/^244/, "");
  if (d.length !== 9) return telefone;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function linkWhatsApp(telefone: string, texto?: string): string {
  const base = `https://wa.me/${numeroInternacional(telefone)}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

export function linkTelefone(telefone: string): string {
  return `tel:+${numeroInternacional(telefone)}`;
}

const nomeMedico = (c: ConsultaDetalhada) => `${c.medico.titulo} ${c.medico.nome}`;
const primeiroNome = (nome: string) => nome.split(" ")[0];

export const mensagens = {
  agendar: (clinica: Clinica) => `Olá! Gostaria de marcar uma consulta na ${clinica.nome}.`,

  falar: (clinica: Clinica) => `Olá, ${clinica.nome}. Tenho uma questão sobre uma consulta.`,

  confirmacao: (c: ConsultaDetalhada, clinica: Clinica) =>
    `Olá, ${primeiroNome(c.paciente.nome)}. A sua consulta na ${clinica.nome} está confirmada.\n\n` +
    `${nomeMedico(c)} (${c.especialidade.nome})\n${dataLonga(diaDe(c.inicio))}, às ${horaDe(c.inicio)}\n${clinica.endereco}, ${clinica.cidade}\n\n` +
    `Se precisar de reagendar, responda a esta mensagem.`,

  lembrete: (c: Pick<ConsultaDetalhada, "inicio">, clinica: Pick<Clinica, "nome">) =>
    `Lembrete: você tem uma consulta amanhã às ${horaDe(c.inicio)} na ${clinica.nome}.`,

  sobreConsulta: (c: ConsultaDetalhada, clinica: Clinica) =>
    `Olá, ${clinica.nome}. Escrevo sobre a consulta de ${c.paciente.nome} com ${nomeMedico(c)} a ${dataLonga(diaDe(c.inicio))}, às ${horaDe(c.inicio)}.`,
};

// ------------------------------------------------------------
// Ponto de encaixe para a WhatsApp Business API
// ------------------------------------------------------------

export interface MensagemWhatsApp {
  para: string;
  /** Nome do modelo aprovado na Meta (ex.: lembrete_consulta). */
  modelo: string;
  parametros: string[];
  /** Texto equivalente, para registo e para quando não há modelo. */
  texto: string;
}

export interface EnviadorMensagens {
  enviar(mensagem: MensagemWhatsApp): Promise<{ id: string }>;
}
