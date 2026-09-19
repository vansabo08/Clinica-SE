import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Revela ao rolar os elementos com `data-revelar` dentro do elemento que
 * recebe a ref. Sem IntersectionObserver (ou sem JavaScript) fica tudo à vista,
 * porque só se esconde depois de a classe `com-revelar` entrar.
 * Os elementos que aparecem mais tarde (dados a chegar) também são seguidos.
 */
export function useRevelar<T extends HTMLElement>() {
  const limpar = useRef<(() => void) | null>(null);

  return useCallback((raiz: T | null) => {
    limpar.current?.();
    limpar.current = null;
    if (!raiz || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("revelado");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const seguir = () => raiz.querySelectorAll<HTMLElement>("[data-revelar]:not(.revelado)").forEach((el) => io.observe(el));
    const mo = new MutationObserver(seguir);

    raiz.classList.add("com-revelar");
    seguir();
    mo.observe(raiz, { childList: true, subtree: true });
    limpar.current = () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}

/** Conta de 0 até ao valor quando fica visível. */
export function useContagem(valor: number, duracaoMs = 1400) {
  const [mostrado, setMostrado] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const alvo = useRef<HTMLElement | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    alvo.current = el;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setVisivel(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
  }, []);

  useEffect(() => {
    if (!visivel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setMostrado(valor);
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      setMostrado(Math.round(valor * (1 - Math.pow(1 - t, 3))));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [visivel, valor, duracaoMs]);

  return { ref, mostrado };
}
