import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { repo } from "./dados";
import type { Repositorio, Tabela } from "./dados/repositorio";

/**
 * Lê dados e volta a ler sozinho quando as tabelas indicadas mudam —
 * nesta aba, noutra aba ou no servidor. Mantém os dados anteriores
 * enquanto recarrega, para a interface não piscar.
 */
export function useDados<T>(carregar: (r: Repositorio) => Promise<T>, deps: DependencyList, tabelas?: Tabela[]) {
  const [dados, setDados] = useState<T | undefined>(undefined);
  const [erro, setErro] = useState<Error | null>(null);
  const [carregando, setCarregando] = useState(true);
  const fn = useRef(carregar);
  fn.current = carregar;
  const pedido = useRef(0);

  const recarregar = useCallback(() => {
    const n = ++pedido.current;
    fn.current(repo()).then(
      (d) => {
        if (n !== pedido.current) return;
        setDados(d);
        setErro(null);
        setCarregando(false);
      },
      (e: unknown) => {
        if (n !== pedido.current) return;
        setErro(e instanceof Error ? e : new Error(String(e)));
        setCarregando(false);
      },
    );
  }, []);

  useEffect(() => {
    setCarregando(true);
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const chave = tabelas ? tabelas.join(",") : "*";
  useEffect(() => {
    const lista = chave === "*" ? null : chave.split(",");
    return repo().aoMudar((mudadas) => {
      if (!lista || mudadas.some((t) => lista.includes(t))) recarregar();
    });
  }, [chave, recarregar]);

  return { dados, erro, carregando, recarregar };
}

/** O relógio, a bater de tempos a tempos (para "agora" e vagas que passam). */
export function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

export function useMedia(consulta: string) {
  const [corresponde, setCorresponde] = useState(() => typeof window !== "undefined" && window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const ouvir = () => setCorresponde(m.matches);
    ouvir();
    m.addEventListener("change", ouvir);
    return () => m.removeEventListener("change", ouvir);
  }, [consulta]);
  return corresponde;
}
