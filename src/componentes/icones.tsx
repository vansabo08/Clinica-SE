import { Baby, Bone, Eye, Flower2, HeartPulse, ScanFace, Shapes, Stethoscope, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";

/** O Lucide não tem dente; desenhado com as mesmas regras de traço. */
function Dente({ size = 24, strokeWidth = 2, className }: LucideProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7.5 3C5 3 3.5 5 3.5 7.3c0 1.9.8 3.2 1.4 4.6.7 1.7.9 3.5 1.3 5.4.4 1.9 1 3.7 2.1 3.7 1.4 0 1.6-2.5 2-4.4.3-1.1.8-1.6 1.7-1.6s1.4.5 1.7 1.6c.4 1.9.6 4.4 2 4.4 1.1 0 1.7-1.8 2.1-3.7.4-1.9.6-3.7 1.3-5.4.6-1.4 1.4-2.7 1.4-4.6C20.5 5 19 3 16.5 3c-1.9 0-2.8 1-4.5 1S9.4 3 7.5 3z" />
    </svg>
  );
}

export const ICONES_ESPECIALIDADE: Record<string, { rotulo: string; Icone: ComponentType<LucideProps> }> = {
  estetoscopio: { rotulo: "Estetoscópio", Icone: Stethoscope },
  bebe: { rotulo: "Bebé", Icone: Baby },
  flor: { rotulo: "Flor", Icone: Flower2 },
  coracao: { rotulo: "Coração", Icone: HeartPulse },
  pele: { rotulo: "Rosto", Icone: ScanFace },
  dente: { rotulo: "Dente", Icone: Dente },
  olho: { rotulo: "Olho", Icone: Eye },
  osso: { rotulo: "Osso", Icone: Bone },
  outra: { rotulo: "Outra", Icone: Shapes },
};

export function IconeEspecialidade({ icone, ...props }: { icone: string } & LucideProps) {
  const { Icone } = ICONES_ESPECIALIDADE[icone] ?? ICONES_ESPECIALIDADE.outra;
  return <Icone aria-hidden="true" {...props} />;
}

export function LogoGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

export function LogoWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.9 9.9 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.29z" />
    </svg>
  );
}
