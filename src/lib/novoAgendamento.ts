import { createContext, useContext } from "react";
import type { Dia } from "./tempo";

export interface PreenchimentoNovo {
  pacienteId?: string;
  especialidadeId?: string;
  medicoId?: string;
  dia?: Dia;
}

export const ContextoNovoAgendamento = createContext<(p?: PreenchimentoNovo) => void>(() => {});

/** Abre a folha "Novo agendamento" da receção, com o que já se sabe preenchido. */
export const useNovoAgendamento = () => useContext(ContextoNovoAgendamento);
