/** Para pesquisar sem se preocupar com acentos nem maiúsculas: "Sebastião" = "sebastiao". */
export const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "Oftalmologia, Ortopedia e Pediatria" */
export const juntarNomes = (nomes: string[]) => (nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`);
