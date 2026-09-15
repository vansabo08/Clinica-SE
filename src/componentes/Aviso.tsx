import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { eErroAgenda } from "../lib/disponibilidade";

type TipoAviso = "ok" | "erro";
type Avisar = (texto: string, tipo?: TipoAviso) => void;

const Contexto = createContext<Avisar>(() => {});

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<{ id: number; texto: string; tipo: TipoAviso }[]>([]);

  const avisar = useCallback<Avisar>((texto, tipo = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "erro" ? 6000 : 4200);
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {avisos.map((a) => (
          <div key={a.id} role={a.tipo === "erro" ? "alert" : "status"} className="vidro anim-surgir pointer-events-auto flex max-w-md items-start gap-2.5 rounded-botao px-4 py-3 font-semibold text-tinta">
            {a.tipo === "erro" ? (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-estado-vermelho" aria-hidden="true" />
            ) : (
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-esperanca" aria-hidden="true" />
            )}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export const useAviso = () => useContext(Contexto);

export function mensagemDeErro(e: unknown): string {
  if (eErroAgenda(e)) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Não foi possível concluir. Verifique a ligação e tente de novo.";
}
