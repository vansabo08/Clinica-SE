// Demonstração para clientes: https://clinica-se.vercel.app/demo
//
// Abrir /demo liga a demonstração neste navegador — dados fictícios, guardados
// só aqui — mesmo no site publicado, que normalmente usa o Supabase. Fica
// ligada até carregar em "Sair da demonstração" no ecrã de entrada.

const CHAVE = "cse-modo";

function lerPedido(): boolean {
  if (typeof window === "undefined") return false;
  const pediuAgora = window.location.pathname.replace(/\/+$/, "") === "/demo";
  try {
    if (pediuAgora) localStorage.setItem(CHAVE, "demo");
    return localStorage.getItem(CHAVE) === "demo";
  } catch {
    return pediuAgora; // sem armazenamento: vale só para esta visita
  }
}

/** A demonstração foi ligada pelo link /demo (e não por falta de configuração). */
export const demoPorLink = lerPedido();

export function sairDaDemo() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: nada a limpar */
  }
  window.location.assign("/");
}
