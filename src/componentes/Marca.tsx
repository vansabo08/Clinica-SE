import { cx } from "./ui";

export function Simbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx("shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0F5C4A" />
      <path d="M28 16h8v12h12v8H36v12h-8V36H16v-8h12z" fill="#fff" />
      <path d="M40 16c6 0 10 3 10 10-6 0-10-3-10-10z" fill="#8CC0A9" />
    </svg>
  );
}

export function Marca({ className, clara }: { className?: string; clara?: boolean }) {
  return (
    <span className={cx("flex items-center gap-3", className)}>
      <Simbolo className="h-10 w-10" />
      <span className="leading-none">
        <span className={cx("block text-[13px] font-semibold", clara ? "text-esperanca-200" : "text-grafite")}>Clínica</span>
        <span className={cx("mt-0.5 block font-serif text-[21px] leading-6", clara ? "text-white" : "text-tinta")}>Sagrada Esperança</span>
      </span>
    </span>
  );
}
