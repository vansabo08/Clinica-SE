import { SUPABASE_PRODUCAO } from "./configuracao";
import type { Repositorio } from "./repositorio";

let instancia: Repositorio | null = null;

/**
 * Escolhe a fonte de dados.
 * - Em desenvolvimento: Supabase se houver VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 *   no .env.local; sem elas, a demonstração no navegador.
 * - No site publicado: sempre o Supabase da clínica (ver configuracao.ts).
 * - VITE_MODO=demo força a demonstração em qualquer caso.
 * Cada fonte é carregada à parte, para a outra não pesar no arranque.
 */
export async function iniciarRepositorio(): Promise<Repositorio> {
  if (instancia) return instancia;
  const producao = import.meta.env.PROD;
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || (producao ? SUPABASE_PRODUCAO.url : undefined);
  const chave = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || (producao ? SUPABASE_PRODUCAO.chaveAnon : undefined);
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
