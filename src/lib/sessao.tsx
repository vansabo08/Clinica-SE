import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { repo } from "./dados";
import type { NovaConta } from "./dados/repositorio";
import type { Papel, Utilizador } from "./tipos";

interface ValorSessao {
  utilizador: Utilizador | null;
  aCarregar: boolean;
  modo: "demo" | "supabase";
  entrar(email: string, senha: string): Promise<Utilizador>;
  entrarComGoogle(): Promise<Utilizador | null>;
  criarConta(d: NovaConta): Promise<Utilizador>;
  entrarComo?: (papel: Papel) => Promise<Utilizador>;
  sair(): Promise<void>;
}

const Contexto = createContext<ValorSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    let vivo = true;
    const ler = () =>
      repo()
        .sessaoActual()
        .then((u) => {
          if (!vivo) return;
          setUtilizador(u);
          setACarregar(false);
        });
    ler();
    const parar = repo().aoMudar((t) => {
      if (t.includes("sessao")) ler();
    });
    return () => {
      vivo = false;
      parar();
    };
  }, []);

  const valor = useMemo<ValorSessao>(() => {
    const r = repo();
    return {
      utilizador,
      aCarregar,
      modo: r.modo,
      entrar: (email, senha) => r.entrar(email, senha),
      entrarComGoogle: () => r.entrarComGoogle(),
      criarConta: (d) => r.criarConta(d),
      entrarComo: r.entrarComo ? (p) => r.entrarComo!(p) : undefined,
      sair: () => r.sair(),
    };
  }, [utilizador, aCarregar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const v = useContext(Contexto);
  if (!v) throw new Error("useSessao fora do ProvedorSessao");
  return v;
}

/** Para ecrãs que só existem com sessão iniciada. */
export function useUtilizador(): Utilizador {
  const { utilizador } = useSessao();
  if (!utilizador) throw new Error("Sem sessão");
  return utilizador;
}

export const primeiroNome = (nome: string) => nome.split(" ")[0];
