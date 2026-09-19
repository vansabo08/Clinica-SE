import { useEffect, useRef, useState } from "react";
import { tocarNotificacao } from "./som";
import type { Notificacao, Papel } from "./tipos";
import { useDados } from "./usarDados";

/** Para onde leva um aviso: a consulta, se tiver uma; senão a lista de avisos. */
export function destinoNotificacao(n: Pick<Notificacao, "consultaId">, papel: Papel | undefined): string {
  if (papel === "paciente") return n.consultaId ? `/consultas/${n.consultaId}` : "/notificacoes";
  if (papel === "medico") return n.consultaId ? `/medico?consulta=${n.consultaId}` : "/medico/notificacoes";
  return n.consultaId ? `/rececao?consulta=${n.consultaId}` : "/rececao/notificacoes";
}

export interface Chegada {
  n: Notificacao;
  /** Quantas chegaram ao mesmo tempo, além desta. */
  mais: number;
  chave: number;
}

/**
 * Os avisos da pessoa, ao vivo. Quando chega um novo — desta aba, de outra
 * ou do servidor — toca o som e devolve-o em `chegada` para se mostrar.
 * Os que já existiam ao abrir a aplicação não tocam.
 */
export function useNotificacoesAoVivo() {
  const { dados, recarregar } = useDados((r) => r.notificacoes(), [], ["notificacoes"]);
  const vistas = useRef<Set<string> | null>(null);
  const [chegada, setChegada] = useState<Chegada | null>(null);

  useEffect(() => {
    if (!dados) return;
    if (!vistas.current) {
      vistas.current = new Set(dados.map((n) => n.id));
      return;
    }
    const novas = dados.filter((n) => !n.lidaEm && !vistas.current!.has(n.id));
    for (const n of dados) vistas.current.add(n.id);
    if (novas.length === 0) return;
    tocarNotificacao();
    setChegada({ n: novas[0], mais: novas.length - 1, chave: Date.now() });
  }, [dados]);

  // Os lembretes aparecem à hora marcada, sem nada mudar na agenda.
  useEffect(() => {
    const t = setInterval(recarregar, 60_000);
    return () => clearInterval(t);
  }, [recarregar]);

  const naoLidas = dados?.filter((n) => !n.lidaEm).length ?? 0;

  // O número de avisos por ler também no separador do navegador.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = naoLidas ? `(${naoLidas > 99 ? "99+" : naoLidas}) ${base}` : base;
    return () => {
      document.title = document.title.replace(/^\(\d+\+?\) /, "");
    };
  }, [naoLidas]);

  return { naoLidas, chegada, fecharChegada: () => setChegada(null) };
}
