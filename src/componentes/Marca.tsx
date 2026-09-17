import { cx } from "./ui";

export function Simbolo({ className, clara }: { className?: string; clara?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cx("shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill={clara ? "#FFFFFF" : "#16837A"} />
      <path d="M28 16h8v12h12v8H36v12h-8V36H16v-8h12z" fill={clara ? "#16837A" : "#FFFFFF"} />
      <path d="M40 16c6 0 10 3 10 10-6 0-10-3-10-10z" fill={clara ? "#7CCFC6" : "#7CCFC6"} />
    </svg>
  );
}

export function Marca({ className, clara, compacta }: { className?: string; clara?: boolean; compacta?: boolean }) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <Simbolo className="h-9 w-9" clara={clara} />
      <span className="leading-none">
        <span className={cx("block text-[11px] font-semibold uppercase tracking-[0.14em]", clara ? "text-white/70" : "text-grafite")}>Clínica</span>
        <span className={cx("mt-1 block whitespace-nowrap font-bold leading-5", compacta ? "text-[15px]" : "text-[17px]", clara ? "text-white" : "text-tinta")}>Sagrada Esperança</span>
      </span>
    </span>
  );
}
