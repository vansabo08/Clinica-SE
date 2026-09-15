import { clsx } from "clsx";
import { Check, ChevronDown } from "lucide-react";
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ESTADOS } from "../lib/estados";
import type { EstadoConsulta } from "../lib/tipos";

export const cx = clsx;

// ------------------------------------------------------------
// Botões
// ------------------------------------------------------------

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "suave" | "perigo-suave" | "claro" | "fantasma-claro";
type Tamanho = "sm" | "md" | "lg" | "xl";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-esperanca text-white shadow-botao hover:bg-esperanca-700",
  /** Sobre fundo verde-escuro. */
  claro: "bg-white text-esperanca-800 hover:bg-esperanca-50",
  "fantasma-claro": "text-white hover:bg-white/10",
  secundario: "border border-linha-forte bg-white text-tinta hover:border-esperanca-300 hover:bg-esperanca-50",
  fantasma: "text-esperanca hover:bg-esperanca-50",
  suave: "bg-esperanca-50 text-esperanca hover:bg-esperanca-100",
  perigo: "bg-estado-vermelho text-white hover:bg-[#962f28]",
  "perigo-suave": "text-estado-vermelho hover:bg-estado-vermelho-fundo",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-9 rounded-[10px] px-3 text-sm",
  md: "h-11 rounded-botao px-4 text-base",
  lg: "h-[52px] rounded-botao px-5 text-base",
  xl: "h-16 rounded-cartao px-6 text-lg",
};

/** O aspecto de um botão, para ligações (<a>) que se comportam como botões. */
export function estiloBotao({ variante = "primario", tamanho = "md", larguraTotal, className }: { variante?: Variante; tamanho?: Tamanho; larguraTotal?: boolean; className?: string } = {}) {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-suave active:scale-[0.98] [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0",
    TAMANHOS[tamanho],
    VARIANTES[variante],
    larguraTotal && "w-full",
    className,
  );
}

export interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  aCarregar?: boolean;
  icone?: ReactNode;
  larguraTotal?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante = "primario", tamanho = "md", aCarregar, icone, larguraTotal, className, children, disabled, type = "button", ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || aCarregar}
      aria-busy={aCarregar || undefined}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-suave active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        TAMANHOS[tamanho],
        VARIANTES[variante],
        larguraTotal && "w-full",
        className,
      )}
      {...resto}
    >
      {aCarregar ? <Rodinha /> : icone}
      {children}
    </button>
  );
});

export function BotaoIcone({
  rotulo,
  className,
  children,
  type = "button",
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type={type}
      aria-label={rotulo}
      title={rotulo}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-grafite transition-colors hover:bg-esperanca-50 hover:text-tinta disabled:opacity-40 [&_svg]:h-5 [&_svg]:w-5",
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

export function Rodinha({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ------------------------------------------------------------
// Campos
// ------------------------------------------------------------

const baseCampo =
  "w-full rounded-botao border bg-white px-3.5 text-tinta transition-colors placeholder:text-nevoa focus:border-esperanca focus:outline-none focus:ring-4 focus:ring-esperanca/10 disabled:bg-papel disabled:text-grafite";

interface PropsRotulo {
  rotulo: string;
  dica?: string;
  erro?: string | null;
  rotuloEscondido?: boolean;
}

function Envolvente({ id, rotulo, dica, erro, rotuloEscondido, className, children }: PropsRotulo & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={cx("mb-1.5 block text-sm font-semibold text-tinta", rotuloEscondido && "sr-only")}>
        {rotulo}
      </label>
      {children}
      {(erro || dica) && (
        <p id={`${id}-nota`} className={cx("mt-1.5 text-sm", erro ? "text-estado-vermelho" : "text-grafite")}>
          {erro || dica}
        </p>
      )}
    </div>
  );
}

export function Campo({ rotulo, dica, erro, rotuloEscondido, id, className, ...resto }: InputHTMLAttributes<HTMLInputElement> & PropsRotulo) {
  const auto = useId();
  const i = id ?? auto;
  return (
    <Envolvente id={i} rotulo={rotulo} dica={dica} erro={erro} rotuloEscondido={rotuloEscondido} className={className}>
      <input
        id={i}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro || dica ? `${i}-nota` : undefined}
        className={cx(baseCampo, "h-12", erro ? "border-estado-vermelho" : "border-linha-forte")}
        {...resto}
      />
    </Envolvente>
  );
}

export function AreaTexto({ rotulo, dica, erro, rotuloEscondido, id, className, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & PropsRotulo) {
  const auto = useId();
  const i = id ?? auto;
  return (
    <Envolvente id={i} rotulo={rotulo} dica={dica} erro={erro} rotuloEscondido={rotuloEscondido} className={className}>
      <textarea id={i} rows={3} className={cx(baseCampo, "py-3 leading-6", erro ? "border-estado-vermelho" : "border-linha-forte")} {...resto} />
    </Envolvente>
  );
}

export function Seleccao({ rotulo, dica, erro, rotuloEscondido, id, className, children, ...resto }: SelectHTMLAttributes<HTMLSelectElement> & PropsRotulo) {
  const auto = useId();
  const i = id ?? auto;
  return (
    <Envolvente id={i} rotulo={rotulo} dica={dica} erro={erro} rotuloEscondido={rotuloEscondido} className={className}>
      <div className="relative">
        <select id={i} className={cx(baseCampo, "h-12 appearance-none pr-10", erro ? "border-estado-vermelho" : "border-linha-forte")} {...resto}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite" aria-hidden="true" />
      </div>
    </Envolvente>
  );
}

/** Filtro compacto (sem rótulo visível), para barras de filtros. */
export function Filtro({ rotulo, className, children, ...resto }: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  return (
    <div className={cx("relative", className)}>
      <select
        aria-label={rotulo}
        className="h-10 w-full appearance-none rounded-[10px] border border-linha-forte bg-white pl-3 pr-9 text-sm font-semibold text-tinta focus:border-esperanca focus:outline-none focus:ring-4 focus:ring-esperanca/10"
        {...resto}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite" aria-hidden="true" />
    </div>
  );
}

export function Interruptor({ ligado, aoMudar, rotulo, descricao, disabled }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; descricao?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p id={id} className="font-semibold text-tinta">
          {rotulo}
        </p>
        {descricao && <p className="text-sm text-grafite">{descricao}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => aoMudar(!ligado)}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
          ligado ? "bg-esperanca" : "bg-linha-forte",
        )}
      >
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-suave", ligado ? "translate-x-6" : "translate-x-1")} />
      </button>
    </div>
  );
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  larguraTotal,
  className,
}: {
  opcoes: { valor: T; rotulo: ReactNode }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
  larguraTotal?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cx("inline-flex gap-1 rounded-botao bg-[#E8EEEB] p-1", larguraTotal && "flex w-full", className)}>
      {opcoes.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => aoMudar(o.valor)}
            className={cx(
              "h-9 whitespace-nowrap rounded-[9px] px-3.5 text-sm font-semibold transition-colors duration-150",
              larguraTotal && "flex-1",
              activo ? "bg-white text-tinta shadow-[0_1px_2px_rgba(16,42,35,0.1),0_0_0_1px_rgba(16,42,35,0.04)]" : "text-grafite hover:text-tinta",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Escolha entre opções como botões grandes (parentesco, motivo, título). */
export function Fichas<T extends string>({ opcoes, valor, aoMudar, rotulo }: { opcoes: { valor: T; rotulo: string }[]; valor: T | null; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-tinta">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const activo = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => aoMudar(o.valor)}
              className={cx(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                activo ? "border-esperanca bg-esperanca text-white" : "border-linha-forte bg-white text-tinta hover:border-esperanca-300",
              )}
            >
              {activo && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------------------
// Pequenas peças
// ------------------------------------------------------------

export function EtiquetaEstado({ estado, curto, className }: { estado: EstadoConsulta; curto?: boolean; className?: string }) {
  const info = ESTADOS[estado];
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", info.etiqueta, className)}>
      {estado === "concluida" ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      ) : (
        <span className={cx("h-2 w-2 rounded-full", info.ponto)} aria-hidden="true" />
      )}
      {curto ? info.curto : info.rotulo}
    </span>
  );
}

const TONS_AVATAR = [
  "bg-[#E0EEE7] text-[#0B4B3C]",
  "bg-[#E4EBF3] text-[#2B4766]",
  "bg-[#F0EBE2] text-[#654C2C]",
  "bg-[#EAE6F1] text-[#4D3E6E]",
  "bg-[#E1EEEE] text-[#1E5B5B]",
];

export function iniciais(nome: string) {
  const partes = nome.replace(/^(Dra?\.)\s+/, "").split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ nome, foto, tamanho = "md", className }: { nome: string; foto?: string | null; tamanho?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const dim = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl" }[tamanho];
  let soma = 0;
  for (const ch of nome) soma += ch.charCodeAt(0);
  if (foto) return <img src={foto} alt="" className={cx("shrink-0 rounded-full object-cover", dim, className)} />;
  return (
    <span aria-hidden="true" className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", dim, TONS_AVATAR[soma % TONS_AVATAR.length], className)}>
      {iniciais(nome)}
    </span>
  );
}

export function Vazio({ icone, titulo, texto, children, className }: { icone?: ReactNode; titulo: string; texto?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-10 text-center", className)}>
      {icone && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-esperanca-50 text-esperanca [&_svg]:h-6 [&_svg]:w-6">{icone}</div>}
      <h3 className="font-serif text-2xl text-tinta">{titulo}</h3>
      {texto && <p className="mt-1.5 max-w-sm text-grafite">{texto}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-cartao bg-[#E6ECE9]", className)} aria-hidden="true" />;
}

export function CabecalhoPagina({ titulo, texto, accoes, antes }: { titulo: string; texto?: ReactNode; accoes?: ReactNode; antes?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
      <div className="min-w-0">
        {antes}
        <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.01em] text-tinta lg:text-3xl">{titulo}</h1>
        {texto && <div className="mt-1.5 text-grafite">{texto}</div>}
      </div>
      {accoes && <div className="flex flex-wrap items-center gap-2">{accoes}</div>}
    </header>
  );
}

export function Seccao({ titulo, accao, children, className }: { titulo: string; accao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-tinta">{titulo}</h2>
        {accao}
      </div>
      {children}
    </section>
  );
}

/** Linha "rótulo — valor" num resumo. */
export function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-grafite">{rotulo}</dt>
      <dd className="text-right font-semibold text-tinta">{children}</dd>
    </div>
  );
}
