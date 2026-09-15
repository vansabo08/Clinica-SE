import { CalendarDays, Stethoscope, UserRound, type LucideProps } from "lucide-react";
import { useState, type ComponentType, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { mensagemDeErro } from "../componentes/Aviso";
import { LogoGoogle } from "../componentes/icones";
import { Marca } from "../componentes/Marca";
import { Senha } from "../componentes/Senha";
import { EcraArranque } from "../componentes/Shell";
import { Botao, Campo, Rodinha } from "../componentes/ui";
import { casaDoPapel } from "../lib/rotas";
import { useSessao } from "../lib/sessao";
import { hoje } from "../lib/tempo";
import type { Papel } from "../lib/tipos";

const DEMOS: { papel: Papel; titulo: string; nome: string; Icone: ComponentType<LucideProps> }[] = [
  { papel: "paciente", titulo: "Paciente", nome: "Maria Kiala, mãe de dois", Icone: UserRound },
  { papel: "rececao", titulo: "Receção", nome: "Teresa Sambo, agenda da clínica", Icone: CalendarDays },
  { papel: "medico", titulo: "Médico", nome: "Dr. João Silva, cardiologia", Icone: Stethoscope },
];

export function Entrar() {
  const { utilizador, aCarregar, entrar, entrarComGoogle, criarConta, entrarComo, modo } = useSessao();
  const navigate = useNavigate();
  const destino = (useLocation().state as { de?: string } | null)?.de;
  const [aba, setAba] = useState<"entrar" | "criar">("entrar");
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState<string | null>(null);

  if (aCarregar) return <EcraArranque />;
  if (utilizador) return <Navigate to={destino ?? casaDoPapel(utilizador.papel)} replace />;

  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErro(null);
    },
  });

  async function correr(qual: string, accao: () => Promise<{ papel: Papel } | null>) {
    setErro(null);
    setAEnviar(qual);
    try {
      const u = await accao();
      if (u) navigate(destino ?? casaDoPapel(u.papel), { replace: true });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAEnviar(null);
    }
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    correr("form", () => (aba === "entrar" ? entrar(form.email, form.senha) : criarConta(form)));
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="hidden flex-col justify-between overflow-hidden bg-esperanca-800 p-12 lg:flex xl:p-16">
        <Marca clara />
        <div>
          <p className="max-w-lg font-serif text-[2.75rem] leading-[1.12] tracking-[-0.01em] text-white xl:text-[3.25rem]">Marque a sua consulta de forma rápida, simples e sem filas.</p>
          <div className="mt-14 max-w-[360px] -rotate-[4deg]" aria-hidden="true">
            <Senha medico="Dra. Ana Cardoso" especialidade="Clínica Geral" icone="estetoscopio" dia={hoje()} hora="10:20" estado="confirmada" />
          </div>
        </div>
        <p className="text-sm text-esperanca-200">Avenida Mortala Mohamed, Ilha de Luanda</p>
      </aside>

      <main className="flex flex-col px-5 pb-12 pt-8 sm:px-8 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-[420px]">
          <Marca className="lg:hidden" />
          <h1 className="mt-10 font-serif text-[2.25rem] leading-tight text-tinta lg:mt-0">{aba === "entrar" ? "Entrar" : "Criar conta"}</h1>
          <p className="mt-1.5 text-grafite">{aba === "entrar" ? "Veja e marque as suas consultas." : "Leva menos de um minuto."}</p>

          <Botao
            variante="secundario"
            tamanho="lg"
            larguraTotal
            className="mt-7"
            icone={<LogoGoogle className="h-5 w-5" />}
            aCarregar={aEnviar === "google"}
            onClick={() => correr("google", entrarComGoogle)}
          >
            Continuar com Google
          </Botao>

          <div className="my-6 flex items-center gap-3 text-sm text-grafite">
            <span className="h-px flex-1 bg-linha" />
            ou com email
            <span className="h-px flex-1 bg-linha" />
          </div>

          <form onSubmit={enviar} className="space-y-4" noValidate>
            {aba === "criar" && (
              <>
                <Campo rotulo="Nome completo" autoComplete="name" {...campo("nome")} />
                <Campo rotulo="Telemóvel" inputMode="tel" autoComplete="tel" placeholder="923 456 789" {...campo("telefone")} />
              </>
            )}
            <Campo rotulo="Email" type="email" autoComplete="email" inputMode="email" {...campo("email")} />
            <Campo
              rotulo="Palavra-passe"
              type="password"
              autoComplete={aba === "entrar" ? "current-password" : "new-password"}
              dica={aba === "criar" ? "Pelo menos 6 caracteres." : undefined}
              {...campo("senha")}
            />
            {erro && (
              <p role="alert" className="rounded-botao bg-estado-vermelho-fundo px-3.5 py-3 text-sm font-semibold text-estado-vermelho">
                {erro}
              </p>
            )}
            <Botao type="submit" tamanho="lg" larguraTotal aCarregar={aEnviar === "form"}>
              {aba === "entrar" ? "Entrar" : "Criar conta"}
            </Botao>
          </form>

          <p className="mt-5 text-center text-grafite">
            {aba === "entrar" ? "Primeira vez na clínica?" : "Já tem conta?"}{" "}
            <button
              type="button"
              className="font-semibold text-esperanca underline-offset-4 hover:underline"
              onClick={() => {
                setAba(aba === "entrar" ? "criar" : "entrar");
                setErro(null);
              }}
            >
              {aba === "entrar" ? "Criar conta" : "Entrar"}
            </button>
          </p>

          {modo === "demo" && entrarComo && (
            <section className="mt-10 rounded-cartao border border-dashed border-linha-forte p-4" aria-labelledby="titulo-demo">
              <h2 id="titulo-demo" className="font-bold text-tinta">
                Experimentar a demonstração
              </h2>
              <p className="mt-0.5 text-sm text-grafite">Os dados ficam neste navegador. Abra dois separadores para ver as vagas a desaparecer em tempo real.</p>
              <ul className="mt-3 space-y-2">
                {DEMOS.map((d) => (
                  <li key={d.papel}>
                    <button
                      type="button"
                      onClick={() => correr(d.papel, () => entrarComo(d.papel))}
                      disabled={aEnviar !== null}
                      className="flex w-full items-center gap-3 rounded-botao border border-linha bg-white px-3 py-2.5 text-left transition-colors hover:border-esperanca-300 disabled:opacity-60"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-esperanca-50 text-esperanca">
                        <d.Icone className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-tinta">Entrar como {d.titulo.toLowerCase()}</span>
                        <span className="block truncate text-sm text-grafite">{d.nome}</span>
                      </span>
                      {aEnviar === d.papel && <Rodinha className="text-esperanca" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
