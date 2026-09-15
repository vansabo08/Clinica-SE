import { CalendarDays, Check, Navigation, Phone, Plus, Stethoscope, UserRound, type LucideProps } from "lucide-react";
import { useState, type ComponentType } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../componentes/Aviso";
import { LogoWhatsApp } from "../componentes/icones";
import { Marca } from "../componentes/Marca";
import { Senha } from "../componentes/Senha";
import { EcraArranque } from "../componentes/Shell";
import { Botao, cx, estiloBotao } from "../componentes/ui";
import { repo } from "../lib/dados";
import { linkComoChegar } from "../lib/mapa";
import { demoPorLink, sairDaDemo } from "../lib/modo";
import { casaDoPapel } from "../lib/rotas";
import { useSessao } from "../lib/sessao";
import { hoje, somarDias } from "../lib/tempo";
import type { Papel } from "../lib/tipos";
import { useDados } from "../lib/usarDados";
import { linkTelefone, linkWhatsApp, mensagens, telefoneLegivel } from "../lib/whatsapp";

const ENTRADAS: {
  papel: Papel;
  titulo: string;
  resumo: string;
  pontos: string[];
  accao: string;
  demo: string;
  Icone: ComponentType<LucideProps>;
}[] = [
  {
    papel: "paciente",
    titulo: "Paciente",
    resumo: "Para quem marca consultas, para si ou para a família.",
    pontos: ["Marca em quatro passos, sem filas", "Reagenda ou cancela no telemóvel", "Recebe o lembrete na véspera"],
    accao: "Entrar ou criar conta",
    demo: "Maria Kiala, mãe de dois",
    Icone: UserRound,
  },
  {
    papel: "rececao",
    titulo: "Receção",
    resumo: "Para quem organiza o dia da clínica.",
    pontos: ["Agenda do dia por horário ou por médico", "Confirma presenças e marca por telefone", "Gere médicos, horários e lista de espera"],
    accao: "Entrar na receção",
    demo: "Teresa Sambo, receção",
    Icone: CalendarDays,
  },
  {
    papel: "medico",
    titulo: "Médico",
    resumo: "Para cada médico, com a sua própria conta.",
    pontos: ["Vê as consultas do dia e quem vem a seguir", "Inicia e conclui atendimentos", "Marca ausências, se tiver permissão"],
    accao: "Entrar como médico",
    demo: "Dr. João Silva, cardiologia",
    Icone: Stethoscope,
  },
];

const PASSOS: [string, string][] = [
  ["Especialidade", "Clínica Geral, Pediatria, Cardiologia e as restantes."],
  ["Médico", "Cada médico mostra logo o próximo horário livre."],
  ["Dia e hora", "Só aparecem as horas que estão mesmo livres."],
  ["Confirmar", "Para si ou para um familiar. A clínica confirma."],
];

export function Landing() {
  const { utilizador, aCarregar, modo, entrarComo } = useSessao();
  const navigate = useNavigate();
  const avisar = useAviso();
  const { dados: clinica } = useDados((r) => r.clinica(), [], ["clinica"]);
  const [aEntrar, setAEntrar] = useState<Papel | null>(null);

  if (aCarregar) return <EcraArranque />;
  if (utilizador) return <Navigate to={casaDoPapel(utilizador.papel)} replace />;

  const demo = modo === "demo" && !!entrarComo;

  async function abrir(papel: Papel) {
    if (!demo) return navigate("/entrar", { state: { perfil: papel } });
    setAEntrar(papel);
    try {
      const u = await entrarComo!(papel);
      navigate(casaDoPapel(u.papel), { replace: true });
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
    } finally {
      setAEntrar(null);
    }
  }

  return (
    <div className="min-h-dvh bg-papel">
      {demo && demoPorLink && (
        <div className="border-b border-esperanca-200 bg-esperanca-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5 text-sm sm:px-8">
            <p className="font-semibold text-esperanca-800">Demonstração com dados fictícios. Nada do que fizer aqui chega à clínica.</p>
            <div className="flex gap-4">
              <button
                type="button"
                className="font-semibold text-esperanca underline-offset-4 hover:underline"
                onClick={async () => {
                  await repo().reporDemonstracao?.();
                  avisar("Os dados de demonstração voltaram ao início.");
                }}
              >
                Repor os dados
              </button>
              <button type="button" className="font-semibold text-grafite underline-offset-4 hover:underline" onClick={sairDaDemo}>
                Sair da demonstração
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link to="/" className="rounded-botao" aria-label="Clínica Sagrada Esperança, página inicial">
          <Marca />
        </Link>
        <Link to="/entrar" className={estiloBotao({ variante: "secundario" })}>
          Entrar
        </Link>
      </header>

      <main>
        {/* Abertura: a promessa e a senha que substitui a fila */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pb-24 lg:pt-10">
          <div>
            <h1 className="max-w-2xl font-serif text-[2.75rem] leading-[1.04] tracking-[-0.02em] text-tinta sm:text-6xl lg:text-[4.25rem]">
              Marque a sua consulta de forma rápida, simples e sem filas.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-grafite">Escolha a especialidade, o médico e a hora no telemóvel. A clínica confirma e lembra-o na véspera.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Botao tamanho="xl" icone={<Plus className="h-6 w-6" strokeWidth={2.5} />} aCarregar={aEntrar === "paciente"} onClick={() => abrir("paciente")}>
                Marcar consulta
              </Botao>
              {clinica?.whatsapp && (
                <a href={linkWhatsApp(clinica.whatsapp, mensagens.agendar(clinica))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "secundario", tamanho: "xl" })}>
                  <LogoWhatsApp />
                  Agendar pelo WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[380px] lg:mr-0" aria-hidden="true">
            <div className="mx-1 h-3 rounded-full bg-tinta shadow-[inset_0_2px_3px_rgba(0,0,0,0.5)]" />
            <div className="ranhura -mt-1.5">
              <div className="anim-imprimir" style={{ animationDelay: "350ms" }}>
                <Senha medico="Dr. João Silva" especialidade="Cardiologia" icone="coracao" dia={somarDias(hoje(), 3)} hora="14:30" estado="confirmada" />
              </div>
            </div>
          </div>
        </section>

        {/* As três entradas */}
        <section className="border-y border-linha bg-white" aria-labelledby="titulo-entradas">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 id="titulo-entradas" className="font-serif text-4xl leading-tight text-tinta">
              Uma agenda, três entradas
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-grafite">
              {demo ? "Escolha como quer experimentar. Cada entrada abre com uma conta de demonstração." : "Cada pessoa entra com a sua conta e vê só o que lhe diz respeito."}
            </p>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {ENTRADAS.map((e) => (
                <li key={e.papel} className="flex flex-col rounded-cartao border border-linha bg-papel p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-esperanca-50 text-esperanca">
                    <e.Icone className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-tinta">{e.titulo}</h3>
                  <p className="mt-1 text-grafite">{e.resumo}</p>
                  <ul className="mt-5 space-y-2.5">
                    {e.pontos.map((p) => (
                      <li key={p} className="flex gap-2.5 text-tinta">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-esperanca" strokeWidth={2.5} aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <Botao larguraTotal tamanho="lg" variante={e.papel === "paciente" ? "primario" : "secundario"} aCarregar={aEntrar === e.papel} disabled={aEntrar !== null && aEntrar !== e.papel} onClick={() => abrir(e.papel)}>
                      {demo ? `Experimentar como ${e.titulo.toLowerCase()}` : e.accao}
                    </Botao>
                    {demo && <p className="mt-2 text-center text-sm text-grafite">{e.demo}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Como se marca */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20" aria-labelledby="titulo-passos">
          <h2 id="titulo-passos" className="font-serif text-4xl leading-tight text-tinta">
            Como se marca
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map(([titulo, texto], i) => (
              <li key={titulo} className="border-t-2 border-esperanca pt-4">
                <span className="text-sm font-bold text-esperanca">Passo {i + 1}</span>
                <p className="mt-1 text-lg font-bold text-tinta">{titulo}</p>
                <p className="mt-1 text-grafite">{texto}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="bg-esperanca-800 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
          <div>
            <Marca clara />
            {clinica && (
              <>
                <p className="mt-5 text-esperanca-100">
                  {clinica.endereco}
                  {clinica.endereco && <br />}
                  {clinica.cidade}
                </p>
                <a href={linkComoChegar(clinica.latitude, clinica.longitude)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 font-semibold text-white underline-offset-4 hover:underline">
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Como chegar
                </a>
              </>
            )}
          </div>
          {clinica?.horario && (
            <div>
              <p className="font-bold">Horário</p>
              <p className="mt-2 whitespace-pre-line text-esperanca-100">{clinica.horario}</p>
            </div>
          )}
          {clinica && (clinica.telefone || clinica.whatsapp || clinica.email) && (
            <div>
              <p className="font-bold">Contactos</p>
              <ul className="mt-2 space-y-2 text-esperanca-100">
                {clinica.telefone && (
                  <li>
                    <a href={linkTelefone(clinica.telefone)} className="num inline-flex items-center gap-2 hover:text-white">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      {telefoneLegivel(clinica.telefone)}
                    </a>
                  </li>
                )}
                {clinica.whatsapp && (
                  <li>
                    <a href={linkWhatsApp(clinica.whatsapp, mensagens.falar(clinica))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                      <LogoWhatsApp className="h-4 w-4" />
                      Falar pelo WhatsApp
                    </a>
                  </li>
                )}
                {clinica.email && (
                  <li>
                    <a href={`mailto:${clinica.email}`} className={cx("hover:text-white")}>
                      {clinica.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
