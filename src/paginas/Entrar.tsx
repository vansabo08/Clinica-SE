import { CalendarDays, Mail, Stethoscope, UserRound, type LucideProps } from "lucide-react";
import { useState, type ComponentType, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../componentes/Aviso";
import { Marca } from "../componentes/Marca";
import { Senha } from "../componentes/Senha";
import { EcraArranque } from "../componentes/Shell";
import { Botao, Campo, Rodinha } from "../componentes/ui";
import { repo } from "../lib/dados";
import { demoPorLink, sairDaDemo } from "../lib/modo";
import { casaDoPapel } from "../lib/rotas";
import { useSessao } from "../lib/sessao";
import { hoje } from "../lib/tempo";
import type { Papel } from "../lib/tipos";

const DEMOS: { papel: Papel; titulo: string; nome: string; Icone: ComponentType<LucideProps> }[] = [
  { papel: "paciente", titulo: "Paciente", nome: "Maria Kiala, mãe de dois", Icone: UserRound },
  { papel: "rececao", titulo: "Receção", nome: "Teresa Sambo, agenda da clínica", Icone: CalendarDays },
  { papel: "medico", titulo: "Médico", nome: "Dr. João Silva, cardiologia", Icone: Stethoscope },
];

type Aba = "entrar" | "criar" | "recuperar";

const CABECALHOS: Record<Aba, { titulo: string; texto: string }> = {
  entrar: { titulo: "Entrar", texto: "Veja e marque as suas consultas." },
  criar: { titulo: "Criar conta", texto: "Leva menos de um minuto." },
  recuperar: { titulo: "Recuperar acesso", texto: "Escreva o email da conta. Enviamos um link para criar uma palavra-passe nova." },
};

/** O que se diz a quem chega pela entrada da receção ou do médico. */
const ENTRADA_EQUIPA: Partial<Record<Papel, { titulo: string; texto: string }>> = {
  rececao: { titulo: "Entrar na receção", texto: "Use a conta da receção para abrir a agenda da clínica." },
  medico: { titulo: "Entrar como médico", texto: "Use a sua conta de médico para ver a sua agenda." },
};

export function Entrar() {
  const { utilizador, aCarregar, entrar, criarConta, entrarComo, modo } = useSessao();
  const navigate = useNavigate();
  const avisar = useAviso();
  const estado = useLocation().state as { de?: string; recuperar?: boolean; perfil?: Papel } | null;
  const destino = estado?.de;
  const equipa = estado?.perfil ? ENTRADA_EQUIPA[estado.perfil] : undefined;
  const [aba, setAba] = useState<Aba>(estado?.recuperar ? "recuperar" : estado?.perfil === "paciente" ? "entrar" : "entrar");
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState<string | null>(null);
  const [linkEnviadoPara, setLinkEnviadoPara] = useState<string | null>(null);

  if (aCarregar) return <EcraArranque />;
  if (utilizador) return <Navigate to={destino ?? casaDoPapel(utilizador.papel)} replace />;

  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErro(null);
    },
  });

  function mudarAba(nova: Aba) {
    setAba(nova);
    setErro(null);
    setLinkEnviadoPara(null);
  }

  async function correr(qual: string, accao: () => Promise<{ papel: Papel }>) {
    setErro(null);
    setAEnviar(qual);
    try {
      const u = await accao();
      navigate(destino ?? casaDoPapel(u.papel), { replace: true });
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

  async function pedirLink(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAEnviar("recuperar");
    try {
      await repo().pedirNovaSenha(form.email);
      setLinkEnviadoPara(form.email.trim());
    } catch (x) {
      setErro(mensagemDeErro(x));
    } finally {
      setAEnviar(null);
    }
  }

  const cabecalho = aba === "entrar" && equipa ? equipa : CABECALHOS[aba];
  const mensagemErro = erro && (
    <p role="alert" className="rounded-botao bg-estado-vermelho-fundo px-3.5 py-3 text-sm font-semibold text-estado-vermelho">
      {erro}
    </p>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="hidden flex-col justify-between overflow-hidden bg-esperanca-800 p-12 lg:flex xl:p-16">
        <Link to="/" className="self-start rounded-botao" aria-label="Página inicial">
          <Marca clara />
        </Link>
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
          <Link to="/" className="inline-block rounded-botao lg:hidden" aria-label="Página inicial">
            <Marca />
          </Link>
          <h1 className="mt-10 font-serif text-[2.25rem] leading-tight text-tinta lg:mt-0">{cabecalho.titulo}</h1>
          <p className="mt-1.5 text-grafite">{cabecalho.texto}</p>

          {aba === "recuperar" ? (
            linkEnviadoPara ? (
              <div role="status" className="anim-surgir mt-7 flex gap-3 rounded-cartao border border-linha bg-white p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-esperanca-50 text-esperanca">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-tinta">Veja o seu email</p>
                  <p className="mt-1 text-grafite">
                    {modo === "demo"
                      ? "Na demonstração não é enviado email. Com a clínica ligada ao Supabase, chegava aqui o link para criar uma palavra-passe nova."
                      : `Se existir uma conta com ${linkEnviadoPara}, vai receber um link para criar uma palavra-passe nova. Abra-o neste dispositivo. Pode demorar alguns minutos; veja também o spam.`}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={pedirLink} className="mt-7 space-y-4" noValidate>
                <Campo rotulo="Email" type="email" autoComplete="email" inputMode="email" {...campo("email")} />
                {mensagemErro}
                <Botao type="submit" tamanho="lg" larguraTotal aCarregar={aEnviar === "recuperar"}>
                  Enviar link
                </Botao>
              </form>
            )
          ) : (
            <form onSubmit={enviar} className="mt-7 space-y-4" noValidate>
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
              {aba === "entrar" && (
                <div className="-mt-1 text-right">
                  <button type="button" onClick={() => mudarAba("recuperar")} className="text-sm font-semibold text-esperanca underline-offset-4 hover:underline">
                    Esqueci-me da palavra-passe
                  </button>
                </div>
              )}
              {mensagemErro}
              <Botao type="submit" tamanho="lg" larguraTotal aCarregar={aEnviar === "form"}>
                {aba === "entrar" ? "Entrar" : "Criar conta"}
              </Botao>
            </form>
          )}

          {aba === "entrar" && equipa ? (
            <p className="mt-5 text-center text-grafite">A conta é criada pela administração da clínica.</p>
          ) : (
            <p className="mt-5 text-center text-grafite">
              {aba === "entrar" ? "Primeira vez na clínica?" : aba === "criar" ? "Já tem conta?" : "Lembrou-se da palavra-passe?"}{" "}
              <button type="button" className="font-semibold text-esperanca underline-offset-4 hover:underline" onClick={() => mudarAba(aba === "entrar" ? "criar" : "entrar")}>
                {aba === "entrar" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          )}

          {modo === "demo" && entrarComo && (
            <section className="mt-10 rounded-cartao border border-dashed border-linha-forte p-4" aria-labelledby="titulo-demo">
              <h2 id="titulo-demo" className="font-bold text-tinta">
                Experimentar a demonstração
              </h2>
              <p className="mt-0.5 text-sm text-grafite">Os dados são fictícios e ficam neste navegador. Abra dois separadores para ver as vagas a desaparecer em tempo real.</p>
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
              {demoPorLink && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-3 text-sm">
                  <button
                    type="button"
                    onClick={async () => {
                      await repo().reporDemonstracao?.();
                      avisar("Os dados de demonstração voltaram ao início.");
                    }}
                    className="font-semibold text-esperanca underline-offset-4 hover:underline"
                  >
                    Repor os dados
                  </button>
                  <button type="button" onClick={sairDaDemo} className="font-semibold text-grafite underline-offset-4 hover:underline">
                    Sair da demonstração
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
