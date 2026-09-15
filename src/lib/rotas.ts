import type { Papel } from "./tipos";

/** A página de entrada de cada tipo de utilizador. */
export function casaDoPapel(papel: Papel) {
  if (papel === "paciente") return "/inicio";
  if (papel === "medico") return "/medico";
  return "/rececao";
}
