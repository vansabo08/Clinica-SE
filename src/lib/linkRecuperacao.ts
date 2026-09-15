// Lido no arranque, antes de o Supabase limpar o endereço: diz se a página
// abriu a partir do email "Esqueci-me da palavra-passe" e se o link veio com erro
// (por exemplo, expirado ou já usado).

const hash = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1));
const query = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

export const linkRecuperacao = {
  valido: hash.get("type") === "recovery",
  erro: hash.get("error_code") ?? query.get("error_code"),
};
