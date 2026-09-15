// Gráficos simples, sem biblioteca.
//
// Regras (ver a skill de dataviz): uma cor por série, colunas finas com
// ponta arredondada e base recta, grelha em linha fina, dica ao passar o
// rato ou ao focar, e o mesmo conteúdo sempre disponível em tabela.

import { useState, type ReactNode } from "react";
import { cx } from "./ui";

export interface Ponto {
  rotulo: string;
  rotuloLongo: string;
  valor: number;
  detalhe?: string;
}

/** Máximo "redondo" e passo para 3–4 linhas de grelha. */
function escala(max: number) {
  if (max <= 0) return { topo: 4, passo: 1 };
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!;
  return { topo: Math.ceil(max / passo) * passo, passo };
}

const fmt = (n: number) => n.toLocaleString("pt-PT");

export function CartaoGrafico({
  titulo,
  descricao,
  tabela,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  tabela: { colunas: string[]; linhas: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  const [emTabela, setEmTabela] = useState(false);
  return (
    <section className={cx("cartao p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-tinta">{titulo}</h2>
          {descricao && <p className="text-sm text-grafite">{descricao}</p>}
        </div>
        <button type="button" onClick={() => setEmTabela((v) => !v)} aria-pressed={emTabela} className="shrink-0 rounded-botao text-sm font-semibold text-esperanca underline-offset-4 hover:underline">
          {emTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {emTabela ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-grafite">
              <tr>
                {tabela.colunas.map((c, i) => (
                  <th key={c} scope="col" className={cx("border-b border-linha py-2 font-semibold", i > 0 && "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {tabela.linhas.map((l, i) => (
                <tr key={i}>
                  {l.map((v, j) => (
                    <td key={j} className={cx("py-2", j > 0 ? "num text-right font-semibold text-tinta" : "text-tinta")}>
                      {typeof v === "number" ? fmt(v) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Dica({ ponto, esquerda }: { ponto: Ponto; esquerda: string }) {
  return (
    <div role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[14rem] -translate-x-1/2 rounded-[10px] bg-tinta px-3 py-2 text-sm text-white shadow-flutua" style={{ left: esquerda }}>
      <p className="num text-base font-bold">{fmt(ponto.valor)}</p>
      <p className="text-white/80">{ponto.rotuloLongo}</p>
      {ponto.detalhe && <p className="mt-0.5 text-xs text-white/70">{ponto.detalhe}</p>}
    </div>
  );
}

/** Colunas verticais para uma série no tempo. */
export function Colunas({ dados, cor, altura = 180, unidade }: { dados: Ponto[]; cor: string; altura?: number; unidade: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const { topo, passo } = escala(Math.max(...dados.map((d) => d.valor), 0));
  const linhas = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const saltar = dados.length > 16 ? Math.ceil(dados.length / 8) : 1;

  return (
    <div className="flex gap-3" onPointerLeave={() => setActivo(null)}>
      <div className="relative w-7 shrink-0" style={{ height: altura }} aria-hidden="true">
        {linhas.map((v) => (
          <span key={v} className="num absolute right-0 -translate-y-1/2 text-xs text-grafite" style={{ top: altura - (v / topo) * altura }}>
            {fmt(v)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: altura }}>
          {linhas.map((v) => (
            <div key={v} className={cx("absolute inset-x-0 h-px", v === 0 ? "bg-linha-forte" : "bg-linha")} style={{ top: altura - (v / topo) * altura }} aria-hidden="true" />
          ))}
          <div className="absolute inset-0 flex items-end">
            {dados.map((d, i) => (
              <button
                key={i}
                type="button"
                className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
                onPointerEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                aria-label={`${d.rotuloLongo}: ${fmt(d.valor)} ${unidade}`}
              >
                <span
                  className={cx("block w-[62%] max-w-6 rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-tinta group-focus-visible:ring-offset-2", activo !== null && activo !== i && "opacity-45")}
                  style={{ height: `${(d.valor / topo) * 100}%`, minHeight: d.valor > 0 ? 3 : 0, backgroundColor: cor }}
                />
              </button>
            ))}
          </div>
          {activo !== null && <Dica ponto={dados[activo]} esquerda={`${((activo + 0.5) / dados.length) * 100}%`} />}
        </div>
        <div className="mt-2 flex" aria-hidden="true">
          {dados.map((d, i) => (
            <span key={i} className="flex-1 truncate text-center text-xs text-grafite">
              {i % saltar === 0 ? d.rotulo : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Barras horizontais para comparar categorias (valor na ponta). */
export function Barras({ dados, cor, unidade }: { dados: { rotulo: string; valor: number }[]; cor: string; unidade: string }) {
  const max = Math.max(...dados.map((d) => d.valor), 1);
  return (
    <ul className="space-y-3">
      {dados.map((d) => (
        <li key={d.rotulo} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]" title={`${d.rotulo}: ${fmt(d.valor)} ${unidade}`}>
          <span className="truncate text-sm text-tinta">{d.rotulo}</span>
          <span className="flex items-center gap-2">
            <span className="block h-3.5 rounded-r-[4px]" style={{ width: `${(d.valor / max) * 88}%`, minWidth: d.valor ? 3 : 0, backgroundColor: cor }} />
            <span className="num text-sm font-semibold text-tinta">{fmt(d.valor)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Mapa de calor: uma cor, do claro ao escuro, com legenda da escala. */
export function MapaCalor({
  linhas,
  colunas,
  valor,
  rotuloCelula,
  rampa,
}: {
  linhas: string[];
  colunas: string[];
  valor: (linha: number, coluna: number) => number;
  rotuloCelula: (linha: number, coluna: number, v: number) => string;
  rampa: string[];
}) {
  const [activo, setActivo] = useState<{ l: number; c: number } | null>(null);
  let max = 0;
  linhas.forEach((_, l) => colunas.forEach((__, c) => (max = Math.max(max, valor(l, c)))));
  const cor = (v: number) => (v === 0 ? "#F1F4F2" : rampa[Math.min(rampa.length - 1, Math.floor((v / (max || 1)) * rampa.length - 1e-9))]);

  return (
    <div>
      <div className="overflow-x-auto pt-14">
        <div className="relative -mt-14 inline-grid min-w-full gap-[2px] pt-14" style={{ gridTemplateColumns: `2.75rem repeat(${colunas.length}, minmax(1.75rem, 1fr))` }} onPointerLeave={() => setActivo(null)}>
          <span />
          {colunas.map((c) => (
            <span key={c} className="num pb-1 text-center text-xs text-grafite" aria-hidden="true">
              {c}
            </span>
          ))}
          {linhas.map((l, li) => (
            <div key={l} className="contents">
              <span className="flex items-center text-xs font-semibold text-grafite">{l}</span>
              {colunas.map((_, ci) => {
                const v = valor(li, ci);
                const aqui = activo?.l === li && activo.c === ci;
                return (
                  <button
                    key={ci}
                    type="button"
                    aria-label={rotuloCelula(li, ci, v)}
                    onPointerEnter={() => setActivo({ l: li, c: ci })}
                    onFocus={() => setActivo({ l: li, c: ci })}
                    onBlur={() => setActivo(null)}
                    className={cx("relative h-8 rounded-[4px] transition-shadow", aqui && "ring-2 ring-tinta ring-offset-1")}
                    style={{ backgroundColor: cor(v) }}
                  >
                    {aqui && (
                      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-[10px] bg-tinta px-3 py-2 text-left text-sm text-white shadow-flutua">
                        {rotuloCelula(li, ci, v)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-grafite" aria-hidden="true">
        Menos
        <span className="flex gap-[2px]">
          {["#F1F4F2", ...rampa].map((c) => (
            <span key={c} className="h-3 w-5 rounded-[3px]" style={{ backgroundColor: c }} />
          ))}
        </span>
        Mais
      </div>
    </div>
  );
}
