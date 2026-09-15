import type { Repositorio } from "./repositorio";

let instancia: Repositorio | null = null;

/**
 * Escolhe a fonte de dados. Com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * usa o Supabase; sem elas, a demonstração no navegador. Cada uma é
 * carregada à parte, para a outra não pesar no arranque.
 */
export async function iniciarRepositorio(): Promise<Repositorio> {
  if (instancia) return instancia;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const forcarDemo = import.meta.env.VITE_MODO === "demo";
  if (url && chave && !forcarDemo) {
    const { RepositorioSupabase } = await import("./supabase/repositorio");
    instancia = new RepositorioSupabase(url, chave);
  } else {
    const { RepositorioDemo } = await import("./demo/loja");
    instancia = new RepositorioDemo({ latenciaMs: 140 });
  }
  return instancia;
}

export function repo(): Repositorio {
  if (!instancia) throw new Error("O repositório ainda não foi iniciado.");
  return instancia;
}
