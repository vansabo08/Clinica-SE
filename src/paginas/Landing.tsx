import { ArrowRight, CalendarDays, Check, ChevronDown, Clock, Mail, MapPin, Menu, Navigation, Phone, Stethoscope, UserRound, X, type LucideProps } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { mensagemDeErro, useAviso } from "../componentes/Aviso";
import { IconeEspecialidade, LogoWhatsApp } from "../componentes/icones";
import { Marca } from "../componentes/Marca";
import { EcraArranque } from "../componentes/Shell";
import { Botao, Rodinha, cx, estiloBotao } from "../componentes/ui";
import { repo } from "../lib/dados";
import { FOTOS } from "../lib/fotos";
import { linkComoChegar } from "../lib/mapa";
import { demoPorLink, sairDaDemo } from "../lib/modo";
import { casaDoPapel } from "../lib/rotas";
import { useContagem, useRevelar } from "../lib/revelar";
import { useSessao } from "../lib/sessao";
import { hoje, somarDias } from "../lib/tempo";
import type { Papel } from "../lib/tipos";
import { useDados } from "../lib/usarDados";
import { linkTelefone, linkWhatsApp, mensagens, telefoneLegivel } from "../lib/whatsapp";

const LIGACOES: [string, string][] = [
  ["#topo", "Início"],
  ["#sobre", "Sobre nós"],
  ["#especialidades", "Especialidades"],
  ["#contactos", "Contactos"],
];

const ENTRADAS: { papel: Papel; titulo: string; resumo: string; pontos: string[]; accao: string; demo: string; Icone: ComponentType<LucideProps> }[] = [
  {
    papel: "paciente",
    titulo: "Paciente",
    resumo: "Marque consultas para si ou para a família.",
    pontos: ["Marca em quatro passos, sem filas", "Reagenda ou cancela no telemóvel", "Recebe o lembrete na véspera"],
    accao: "Entrar ou criar conta",
    demo: "Maria Kiala, mãe de dois",
    Icone: UserRound,
  },
  {
    papel: "rececao",
    titulo: "Receção",
    resumo: "Organize o dia da clínica num só ecrã.",
    pontos: ["Agenda por horário ou por médico", "Confirma presenças e marca por telefone", "Gere médicos, horários e lista de espera"],
    accao: "Entrar na receção",
    demo: "Teresa Sambo, receção",
    Icone: CalendarDays,
  },
  {
    papel: "medico",
    titulo: "Médico",
    resumo: "Cada médico com a sua própria agenda.",
    pontos: ["Consultas do dia e quem vem a seguir", "Inicia e conclui atendimentos", "Marca ausências, se tiver permissão"],
    accao: "Entrar como médico",
    demo: "Dr. João Silva, cardiologia",
    Icone: Stethoscope,
  },
];

/** Atraso de entrada, para os elementos revelarem uns a seguir aos outros. */
const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as CSSProperties;
const depois = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function Numero({ valor, sufixo = "", className }: { valor: number | null; sufixo?: string; className?: string }) {
  const { ref, mostrado } = useContagem(valor ?? 0);
  return (
    <span ref={ref} className={className}>
      {valor === null ? "–" : `${mostrado}${sufixo}`}
    </span>
  );
}

/** O traço à mão por baixo das palavras em destaque. */
function Traco({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 24" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M4 17C62 8 150 3 316 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 21C110 14 190 12 280 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function Rato() {
  return (
    <svg viewBox="0 0 24 36" className="h-9 w-6" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="33" rx="10.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="10.5" y="7" width="3" height="7" rx="1.5" fill="currentColor" className="animate-bounce" />
    </svg>
  );
}

function Etiqueta({ children, clara }: { children: ReactNode; clara?: boolean }) {
  return (
    <span className={cx("inline-flex self-start items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold", clara ? "vidro-foto text-white" : "bg-esperanca-50 text-esperanca-700")}>
      <span className={cx("h-1.5 w-1.5 rounded-full", clara ? "bg-esperanca-300" : "bg-esperanca")} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Landing() {
  const { utilizador, aCarregar, modo, entrarComo } = useSessao();
  const navigate = useNavigate();
  const avisar = useAviso();
  const { dados } = useDados(
    async (r) => {
      // Sem sessão, a lista pública pode falhar (ex.: permissões por aplicar); a página abre na mesma.
      const [clinica, especialidades, medicos] = await Promise.all([r.clinica(), r.especialidades().catch(() => []), r.medicos().catch(() => [])]);
      return { clinica, especialidades, medicos: medicos.filter((m) => m.activo) };
    },
    [],
    ["clinica", "especialidades", "medicos"],
  );
  const revelar = useRevelar<HTMLDivElement>();
  const [aEntrar, setAEntrar] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [activa, setActiva] = useState<string | null>(null);
  const [pedido, setPedido] = useState({ especialidade: "", medico: "", dia: "" });

  useEffect(() => {
    if (!menu) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [menu]);

  if (aCarregar) return <EcraArranque />;
  // Quem já tem sessão vai para a sua página; na demonstração, quem acabou de entrar segue para onde pediu.
  if (utilizador && !aEntrar) return <Navigate to={casaDoPapel(utilizador.papel)} replace />;

  const demo = modo === "demo" && !!entrarComo;
  const clinica = dados?.clinica;
  const especialidades = (dados?.especialidades ?? []).filter((e) => dados?.medicos.some((m) => m.especialidadeId === e.id));
  const medicos = dados?.medicos ?? [];
  const escolhida = especialidades.find((e) => e.id === activa) ?? especialidades[0];
  const medicosDa = (id: string) => medicos.filter((m) => m.especialidadeId === id);
  const medicosDoPedido = pedido.especialidade ? medicosDa(pedido.especialidade) : medicos;

  /** Leva ao destino; na demonstração entra primeiro com a conta de exemplo. */
  async function abrir(papel: Papel, destino?: string, chave: string = papel) {
    setMenu(false);
    if (!demo) return destino ? navigate(destino) : navigate("/entrar", { state: { perfil: papel } });
    setAEntrar(chave);
    try {
      const u = await entrarComo!(papel);
      // aEntrar fica ligado: a mudança de rota chega depois e, sem ele, a página mandava para o início.
      navigate(destino ?? casaDoPapel(u.papel), { replace: true });
    } catch (e) {
      avisar(mensagemDeErro(e), "erro");
      setAEntrar(null);
    }
  }

  function marcar(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (pedido.especialidade) q.set("especialidade", pedido.especialidade);
    if (pedido.medico) q.set("medico", pedido.medico);
    if (pedido.dia) q.set("dia", pedido.dia);
    const texto = q.toString();
    abrir("paciente", `/marcar${texto ? `?${texto}` : ""}`, "barra");
  }

  const marcarAgora = (chave: string) => abrir("paciente", "/marcar", chave);
  const numeros: { valor: number | null; sufixo?: string; rotulo: string; destaque?: boolean }[] = [
    { valor: dados ? medicos.length : null, rotulo: medicos.length === 1 ? "Médico a receber marcações" : "Médicos a receber marcações" },
    { valor: dados ? especialidades.length : null, rotulo: "Especialidades", destaque: true },
    { valor: 24, sufixo: " h", rotulo: "Lembrete antes da consulta" },
  ];

  return (
    <div ref={revelar} className="min-h-dvh overflow-x-clip bg-white">
      {demo && demoPorLink && (
        <div className="bg-esperanca-900 text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 text-sm sm:px-8">
            <p className="font-semibold">Demonstração com dados fictícios. Nada do que fizer aqui chega à clínica.</p>
            <div className="flex gap-4">
              <button
                type="button"
                className="font-semibold text-esperanca-300 underline-offset-4 hover:underline"
                onClick={async () => {
                  await repo().reporDemonstracao?.();
                  avisar("Os dados de demonstração voltaram ao início.");
                }}
              >
                Repor os dados
              </button>
              <button type="button" className="font-semibold text-white/70 underline-offset-4 hover:underline" onClick={sairDaDemo}>
                Sair da demonstração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- Abertura */}
      <section id="topo" className="scroll-mt-4 px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-esperanca-800 sm:rounded-[40px]">
          <img src={FOTOS.abertura} alt="" fetchPriority="high" className="anim-zoom-lento absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,59,55,0.78)_0%,rgba(16,107,100,0.72)_50%,rgba(22,131,122,0.86)_100%)]" />

          <header className="anim-descer relative z-20 px-3 pt-3 sm:px-6 sm:pt-6">
            <div className="vidro-foto mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full py-2 pl-4 pr-2 sm:pl-6">
              <Link to="/" className="rounded-full" aria-label="Clínica Sagrada Esperança, página inicial">
                <Marca clara />
              </Link>
              <nav aria-label="Secções" className="hidden lg:block">
                <ul className="flex items-center gap-1">
                  {LIGACOES.map(([href, rotulo]) => (
                    <li key={href}>
                      <a href={href} className="rounded-full px-4 py-2 font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white">
                        {rotulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="flex items-center gap-1.5">
                <Link to="/entrar" className="hidden rounded-full px-4 py-2 font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex">
                  Entrar
                </Link>
                <Botao variante="claro" className="hidden sm:inline-flex" aCarregar={aEntrar === "topo"} onClick={() => marcarAgora("topo")}>
                  Marcar consulta
                </Botao>
                <button
                  type="button"
                  onClick={() => setMenu((m) => !m)}
                  aria-expanded={menu}
                  aria-controls="menu-movel"
                  aria-label={menu ? "Fechar menu" : "Abrir menu"}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-esperanca-800 lg:hidden"
                >
                  {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {menu && (
              <div id="menu-movel" className="anim-surgir absolute inset-x-3 top-[calc(100%+8px)] rounded-[24px] bg-white p-3 shadow-flutua sm:inset-x-6 lg:hidden">
                <ul>
                  {LIGACOES.map(([href, rotulo]) => (
                    <li key={href}>
                      <a href={href} onClick={() => setMenu(false)} className="flex h-12 items-center rounded-full px-4 text-lg font-semibold text-tinta hover:bg-esperanca-50">
                        {rotulo}
                      </a>
                    </li>
                  ))}
                  <li>
                    <Link to="/entrar" className="flex h-12 items-center rounded-full px-4 text-lg font-semibold text-tinta hover:bg-esperanca-50">
                      Entrar
                    </Link>
                  </li>
                </ul>
                <Botao larguraTotal tamanho="lg" className="mt-2" aCarregar={aEntrar === "menu"} onClick={() => marcarAgora("menu")}>
                  Marcar consulta
                </Botao>
              </div>
            )}
          </header>

          <div className="mx-auto max-w-4xl px-6 pb-44 pt-14 text-center sm:pb-64 sm:pt-20 lg:pb-72 lg:pt-24">
            <h1 className="anim-entrar text-[2.5rem] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-6xl lg:text-[4.5rem] lg:leading-[1.05]" style={depois(120)}>
              Um lugar seguro para{" "}
              <span className="relative inline-block whitespace-nowrap">
                cuidar de si
                <Traco className="absolute -bottom-2 left-0 h-3 w-full text-white sm:-bottom-4 sm:h-5" />
              </span>
            </h1>
            <p className="anim-entrar mx-auto mt-7 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl" style={depois(260)}>
              Marque a sua consulta de forma rápida, simples e sem filas. Escolha a especialidade, o médico e a hora; a clínica confirma e lembra-o na véspera.
            </p>
            <div className="anim-entrar mt-9 flex flex-wrap justify-center gap-3" style={depois(400)}>
              <Botao variante="vidro" tamanho="lg" className="pl-7 pr-2" aCarregar={aEntrar === "abertura"} onClick={() => marcarAgora("abertura")}>
                Marcar consulta
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-esperanca-800">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Botao>
              {clinica?.whatsapp && (
                <a href={linkWhatsApp(clinica.whatsapp, mensagens.agendar(clinica))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "fantasma-claro", tamanho: "lg" })}>
                  <LogoWhatsApp />
                  Agendar pelo WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- A equipa e a barra de marcação */}
      <div className="relative z-10 mx-auto -mt-32 flex max-w-4xl items-end justify-center gap-2.5 px-5 sm:-mt-52 sm:gap-5 lg:-mt-60" aria-hidden="true">
        {FOTOS.equipa.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            style={depois(520 + ([120, 0, 240][i] ?? 0))}
            className={cx(
              "anim-entrar-foto w-1/3 rounded-[22px] object-cover object-top shadow-flutua ring-4 ring-white sm:rounded-[32px] sm:ring-8",
              i === 1 ? "h-48 sm:h-[340px] lg:h-[380px]" : "h-40 sm:h-[280px] lg:h-[310px]",
            )}
          />
        ))}
      </div>

      <section aria-labelledby="titulo-barra" className="relative z-20 mx-auto -mt-10 max-w-5xl px-5 sm:-mt-16 sm:px-8">
        <h2 id="titulo-barra" className="sr-only">
          Marcar consulta
        </h2>
        <form onSubmit={marcar} className="anim-entrar rounded-[28px] bg-white p-3 shadow-flutua ring-1 ring-linha sm:rounded-full sm:p-2.5" style={depois(820)}>
          <div className="grid gap-1 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center sm:gap-0">
            <CampoBarra rotulo="Especialidade" icone={<Stethoscope />}>
              <select
                value={pedido.especialidade}
                onChange={(e) => setPedido({ ...pedido, especialidade: e.target.value, medico: "" })}
                className="w-full cursor-pointer appearance-none bg-transparent pr-6 font-semibold text-tinta focus:outline-none"
              >
                <option value="">Escolher</option>
                {especialidades.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </CampoBarra>
            <CampoBarra rotulo="Médico" icone={<UserRound />} divisoria>
              <select
                value={pedido.medico}
                onChange={(e) => setPedido({ ...pedido, medico: e.target.value })}
                className="w-full cursor-pointer appearance-none bg-transparent pr-6 font-semibold text-tinta focus:outline-none"
              >
                <option value="">Qualquer médico</option>
                {medicosDoPedido.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titulo} {m.nome}
                  </option>
                ))}
              </select>
            </CampoBarra>
            <CampoBarra rotulo="Dia" icone={<CalendarDays />} divisoria semSeta>
              <input
                type="date"
                value={pedido.dia}
                min={hoje()}
                max={somarDias(hoje(), 60)}
                onChange={(e) => setPedido({ ...pedido, dia: e.target.value })}
                className="num w-full cursor-pointer bg-transparent font-semibold text-tinta focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-60"
              />
            </CampoBarra>
            <Botao type="submit" variante="contorno" tamanho="lg" className="mt-2 sm:ml-2 sm:mt-0" aCarregar={aEntrar === "barra"}>
              Marcar consulta
            </Botao>
          </div>
        </form>
      </section>

      {/* ---------------------------------------------------------- Sobre nós, em números */}
      <section id="sobre" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div data-revelar="esquerda">
            <Etiqueta>Sobre nós</Etiqueta>
            <h2 className="mt-5 text-4xl font-bold leading-[1.12] tracking-[-0.015em] text-tinta sm:text-5xl">
              Cuidamos de si e da sua família,{" "}
              <span className="relative inline-block whitespace-nowrap text-esperanca">
                sem filas
                <Traco className="absolute -bottom-2 left-0 h-3 w-full text-esperanca-300" />
              </span>
            </h2>
            <p className="mt-6 text-lg leading-8 text-grafite">
              {clinica?.nome ?? "A Clínica Sagrada Esperança"} recebe pacientes de todas as idades{clinica?.cidade ? ` em ${clinica.cidade}` : ""}. A agenda é a mesma para quem marca no telemóvel, ao balcão ou pelo WhatsApp: nenhum horário é dado a duas pessoas.
            </p>
            <ul className="mt-7 space-y-3">
              {["Só vê as horas que estão mesmo livres", "A receção confirma cada marcação", "Pode marcar para os filhos e para os pais"].map((p) => (
                <li key={p} className="flex items-center gap-3 font-semibold text-tinta">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-esperanca text-white">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <ul className="flex flex-col items-center sm:flex-row sm:justify-center lg:justify-end">
            {numeros.map((n, i) => (
              <li
                key={n.rotulo}
                data-revelar="zoom"
                style={atraso(150 + i * 140)}
                className={cx(
                  "flex h-52 w-52 shrink-0 flex-col items-center justify-center rounded-full px-6 text-center sm:h-48 sm:w-48 xl:h-52 xl:w-52",
                  i > 0 && "-mt-6 sm:-ml-6 sm:mt-0",
                  n.destaque ? "relative z-10 bg-esperanca text-white shadow-botao" : "border-2 border-esperanca-200 bg-white/90 text-tinta backdrop-blur",
                )}
              >
                <Numero valor={n.valor} sufixo={n.sufixo} className={cx("num text-5xl font-bold tracking-[-0.02em]", !n.destaque && "text-esperanca")} />
                <span className={cx("mt-2 text-sm font-semibold leading-5", n.destaque ? "text-white/85" : "text-grafite")}>{n.rotulo}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- Especialidades sobre fotografia */}
      <section id="especialidades" className="scroll-mt-4 px-3 sm:px-5">
        <div data-revelar="zoom" className="relative isolate overflow-hidden rounded-[28px] bg-esperanca-800 sm:rounded-[40px]">
          <img src={FOTOS.especialidades} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,59,55,0.94)_0%,rgba(12,87,81,0.84)_48%,rgba(22,131,122,0.72)_100%)]" />

          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-24">
            <div data-revelar="esquerda" style={atraso(200)} className="flex flex-col">
              <Etiqueta clara>Especialidades</Etiqueta>
              <h2 className="mt-5 text-4xl font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-5xl">Veja o que temos para cuidar da sua saúde</h2>

              {escolhida ? (
                <div key={escolhida.id} className="anim-surgir mt-8 rounded-[28px] bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-esperanca">
                      <IconeEspecialidade icone={escolhida.icone} className="h-7 w-7" strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-2xl font-bold text-white">{escolhida.nome}</p>
                      <p className="text-white/70">
                        {medicosDa(escolhida.id).length} {medicosDa(escolhida.id).length === 1 ? "médico" : "médicos"}
                      </p>
                    </div>
                  </div>
                  {escolhida.descricao && <p className="mt-4 text-lg leading-7 text-white/85">{escolhida.descricao}</p>}
                  <p className="mt-3 text-white/70">{medicosDa(escolhida.id).map((m) => `${m.titulo} ${m.nome}`).join(" · ")}</p>
                  <Botao variante="claro" tamanho="lg" className="mt-6" aCarregar={aEntrar === "especialidade"} onClick={() => abrir("paciente", `/marcar?especialidade=${escolhida.id}`, "especialidade")}>
                    Marcar {escolhida.nome}
                    <ArrowRight />
                  </Botao>
                </div>
              ) : (
                <p className="mt-6 text-lg text-white/85">Clínica Geral, Pediatria, Cardiologia e mais. Entre para ver os médicos e as horas livres.</p>
              )}

              <div className="mt-auto hidden items-center gap-3 pt-12 text-white/70 lg:flex">
                <Rato />
                <span className="text-sm font-semibold">Escolha uma especialidade na lista</span>
              </div>
            </div>

            {especialidades.length > 0 && (
              <ul className="relative flex flex-col justify-center border-white/25 lg:items-end lg:border-r-2 lg:pr-8" aria-label="Especialidades">
                {especialidades.map((e, i) => {
                  const ligada = e.id === escolhida?.id;
                  return (
                    <li key={e.id} data-revelar="direita" style={atraso(250 + i * 60)} className="relative lg:text-right">
                      <button
                        type="button"
                        aria-pressed={ligada}
                        onClick={() => setActiva(e.id)}
                        onMouseEnter={() => setActiva(e.id)}
                        className={cx(
                          "py-2 text-left text-2xl font-bold tracking-[-0.01em] transition-colors duration-200 sm:text-[1.75rem] lg:py-2.5 lg:text-right lg:text-[2rem]",
                          ligada ? "text-white" : "text-white/45 hover:text-white/80",
                        )}
                      >
                        {e.nome}
                      </button>
                      <span
                        className={cx(
                          "absolute -right-[37px] top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 rounded-full border-[3px] border-esperanca-800 bg-white transition-opacity lg:block",
                          ligada ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- As três entradas */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="titulo-entradas">
        <div data-revelar className="text-center">
          <Etiqueta>Acesso</Etiqueta>
          <h2 id="titulo-entradas" className="mt-5 text-4xl font-bold leading-[1.12] tracking-[-0.015em] text-tinta sm:text-5xl">
            Uma agenda, três entradas
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-grafite">
            {demo ? "Escolha como quer experimentar. Cada entrada abre com uma conta de demonstração." : "Cada pessoa entra com a sua conta e vê só o que lhe diz respeito."}
          </p>
        </div>
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {ENTRADAS.map((e, i) => {
            const principal = e.papel === "paciente";
            return (
              <li key={e.papel} data-revelar style={atraso(i * 130)}>
                <div className={cx("levantar flex h-full flex-col rounded-[32px] p-7", principal ? "bg-esperanca text-white shadow-botao" : "border border-linha bg-papel text-tinta")}>
                <span className={cx("flex h-14 w-14 items-center justify-center rounded-full", principal ? "bg-white text-esperanca" : "bg-white text-esperanca ring-1 ring-linha")}>
                  <e.Icone className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-2xl font-bold">{e.titulo}</h3>
                <p className={cx("mt-1", principal ? "text-white/80" : "text-grafite")}>{e.resumo}</p>
                <ul className="mt-6 space-y-3">
                  {e.pontos.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <Check className={cx("mt-1 h-4 w-4 shrink-0", principal ? "text-esperanca-200" : "text-esperanca")} strokeWidth={3} aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <Botao
                    larguraTotal
                    tamanho="lg"
                    variante={principal ? "claro" : "contorno"}
                    aCarregar={aEntrar === e.papel}
                    disabled={aEntrar !== null && aEntrar !== e.papel}
                    onClick={() => abrir(e.papel)}
                  >
                    {demo ? `Experimentar como ${e.titulo.toLowerCase()}` : e.accao}
                  </Botao>
                  {demo && <p className={cx("mt-2 text-center text-sm", principal ? "text-white/75" : "text-grafite")}>{e.demo}</p>}
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------------------------------------------------------- Fecho */}
      <section className="px-3 sm:px-5" aria-labelledby="titulo-fecho">
        <div data-revelar="zoom" className="relative isolate overflow-hidden rounded-[28px] bg-esperanca-800 sm:rounded-[40px]">
          <img src={FOTOS.fecho} alt="" loading="lazy" className="absolute inset-y-0 right-0 -z-20 h-full w-full object-cover object-[70%_30%] lg:w-[64%]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0C5751_0%,#0C5751_36%,rgba(12,87,81,0.82)_55%,rgba(22,131,122,0.35)_100%)]" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-6 left-2 -z-10 select-none text-[7.5rem] font-extrabold leading-none tracking-[-0.04em] text-white/[0.07] sm:-bottom-12 sm:text-[13rem] lg:text-[17rem]"
          >
            Saúde
          </span>

          <div data-revelar="esquerda" style={atraso(250)} className="max-w-2xl px-6 py-16 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
            <h2 id="titulo-fecho" className="text-4xl font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-5xl">
              A sua saúde não pode esperar
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-white/80">Escolha o dia e a hora em menos de um minuto{clinica?.whatsapp ? ". Se preferir, fale connosco pelo WhatsApp." : ". A clínica confirma e lembra-o na véspera."}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Botao variante="claro" tamanho="lg" aCarregar={aEntrar === "fecho"} onClick={() => marcarAgora("fecho")}>
                Marcar consulta
                <ArrowRight />
              </Botao>
              {clinica?.whatsapp && (
                <a href={linkWhatsApp(clinica.whatsapp, mensagens.falar(clinica))} target="_blank" rel="noreferrer" className={estiloBotao({ variante: "vidro", tamanho: "lg" })}>
                  <LogoWhatsApp />
                  Falar connosco
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Contactos */}
      <footer id="contactos" className="scroll-mt-4">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr] lg:py-20">
          <div data-revelar>
            <Marca />
            <p className="mt-5 max-w-xs text-grafite">Consultas marcadas a tempo, com a confirmação da receção e o lembrete na véspera.</p>
            {clinica && (
              <a href={linkComoChegar(clinica.latitude, clinica.longitude)} target="_blank" rel="noreferrer" className={cx(estiloBotao({ variante: "contorno" }), "mt-6")}>
                <Navigation />
                Como chegar
              </a>
            )}
          </div>

          <div data-revelar style={atraso(120)}>
            <p className="text-lg font-bold text-tinta">Onde estamos</p>
            {clinica ? (
              <ul className="mt-4 space-y-3 text-grafite">
                {(clinica.endereco || clinica.cidade) && (
                  <LinhaContacto icone={<MapPin />}>
                    {clinica.endereco}
                    {clinica.endereco && clinica.cidade && <br />}
                    {clinica.cidade}
                  </LinhaContacto>
                )}
                {clinica.horario && (
                  <LinhaContacto icone={<Clock />}>
                    <span className="whitespace-pre-line">{clinica.horario}</span>
                  </LinhaContacto>
                )}
              </ul>
            ) : (
              <Rodinha className="mt-4 text-esperanca" />
            )}
          </div>

          {clinica && (clinica.telefone || clinica.whatsapp || clinica.email) && (
            <div data-revelar style={atraso(240)}>
              <p className="text-lg font-bold text-tinta">Contactos</p>
              <ul className="mt-4 space-y-3 text-grafite">
                {clinica.telefone && (
                  <LinhaContacto icone={<Phone />}>
                    <a href={linkTelefone(clinica.telefone)} className="num hover:text-esperanca">
                      {telefoneLegivel(clinica.telefone)}
                    </a>
                  </LinhaContacto>
                )}
                {clinica.whatsapp && (
                  <LinhaContacto icone={<LogoWhatsApp />}>
                    <a href={linkWhatsApp(clinica.whatsapp, mensagens.falar(clinica))} target="_blank" rel="noreferrer" className="hover:text-esperanca">
                      Falar pelo WhatsApp
                    </a>
                  </LinhaContacto>
                )}
                {clinica.email && (
                  <LinhaContacto icone={<Mail />}>
                    <a href={`mailto:${clinica.email}`} className="break-all hover:text-esperanca">
                      {clinica.email}
                    </a>
                  </LinhaContacto>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-linha">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-sm text-grafite sm:px-8">
            <p>© {new Date().getFullYear()} {clinica?.nome ?? "Clínica Sagrada Esperança"}</p>
            <p>Fotografias ilustrativas</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CampoBarra({ rotulo, icone, divisoria, semSeta, children }: { rotulo: string; icone: ReactNode; divisoria?: boolean; semSeta?: boolean; children: ReactNode }) {
  return (
    <label
      className={cx(
        "relative flex cursor-pointer items-center gap-3 rounded-[20px] px-4 py-2.5 transition-colors hover:bg-papel sm:rounded-full sm:px-5",
        divisoria && "sm:before:absolute sm:before:left-0 sm:before:top-1/2 sm:before:h-9 sm:before:w-px sm:before:-translate-y-1/2 sm:before:bg-linha",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-esperanca-50 text-esperanca [&_svg]:h-5 [&_svg]:w-5">{icone}</span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-grafite">{rotulo}</span>
        {children}
        {!semSeta && <ChevronDown className="pointer-events-none absolute bottom-0.5 right-0 h-4 w-4 text-grafite" aria-hidden="true" />}
      </span>
    </label>
  );
}

function LinhaContacto({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-esperanca-50 text-esperanca [&_svg]:h-4 [&_svg]:w-4">{icone}</span>
      <span className="min-w-0 pt-1">{children}</span>
    </li>
  );
}
