import {
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  Ellipsis,
  Hourglass,
  House,
  KeyRound,
  LogOut,
  MapPin,
  Plus,
  Settings,
  Shapes,
  Stethoscope,
  UserRound,
  Users,
  type LucideProps,
} from "lucide-react";
import { Suspense, lazy, useState, type ComponentType, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { repo } from "../lib/dados";
import { PAPEIS } from "../lib/estados";
import { ContextoNovoAgendamento, type PreenchimentoNovo } from "../lib/novoAgendamento";
import { useSessao } from "../lib/sessao";
import { useDados } from "../lib/usarDados";
import { mensagemDeErro, useAviso } from "./Aviso";
import { Folha } from "./Folha";
import { FolhaMudarSenha } from "./FolhaMudarSenha";
import { Marca, Simbolo } from "./Marca";
import { Avatar, Botao, BotaoIcone, Campo, Rodinha, cx } from "./ui";

const FolhaNovoAgendamento = lazy(() => import("../paginas/rececao/NovoAgendamento").then((m) => ({ default: m.FolhaNovoAgendamento })));

interface ItemNav {
  para?: string;
  aoCarregar?: () => void;
  rotulo: string;
  Icone: ComponentType<LucideProps>;
  contagem?: number;
  fim?: boolean;
  destaque?: boolean;
}

export const LARGURA_BARRA = "lg:pl-[272px]";

/** Contentor de página: margens, largura de leitura e espaço para a barra inferior. */
export function Pagina({ children, largura = "normal", className }: { children: ReactNode; largura?: "estreita" | "normal" | "larga"; className?: string }) {
  const max = { estreita: "max-w-2xl", normal: "max-w-5xl", larga: "max-w-[1400px]" }[largura];
  return <div className={cx("mx-auto w-full px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10", max, className)}>{children}</div>;
}

export function CarregandoPagina() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-esperanca" role="status" aria-label="A carregar">
      <Rodinha className="h-6 w-6" />
    </div>
  );
}

export function EcraArranque() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="A abrir">
      <Simbolo className="h-14 w-14 animate-pulse" />
    </div>
  );
}

// ------------------------------------------------------------
// Peças da navegação
// ------------------------------------------------------------

function Contagem({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return <span className={cx("num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-esperanca px-1.5 text-[11px] font-bold leading-none text-white", className)}>{n > 99 ? "99+" : n}</span>;
}

function LinkLateral({ item, escuro }: { item: ItemNav; escuro?: boolean }) {
  const classe = (activo: boolean) =>
    cx(
      "group flex h-11 w-full items-center gap-3 rounded-full px-4 text-left font-semibold transition-colors",
      escuro
        ? activo
          ? "bg-white text-esperanca-900 shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
          : "text-white/75 hover:bg-white/10 hover:text-white"
        : activo
          ? "bg-esperanca-50 text-esperanca-800"
          : "text-grafite hover:bg-papel hover:text-tinta",
    );
  const miolo = (activo: boolean) => (
    <>
      <item.Icone
        className={cx("h-5 w-5 shrink-0", activo ? "text-esperanca" : escuro ? "text-esperanca-300 group-hover:text-white" : "text-nevoa group-hover:text-grafite")}
        aria-hidden="true"
      />
      <span className="flex-1">{item.rotulo}</span>
      <Contagem n={item.contagem ?? 0} className={escuro && !activo ? "bg-esperanca-300 text-esperanca-900" : undefined} />
    </>
  );
  if (!item.para)
    return (
      <button type="button" onClick={item.aoCarregar} className={classe(false)}>
        {miolo(false)}
      </button>
    );
  return (
    <NavLink to={item.para} end={item.fim} className={({ isActive }) => classe(isActive)}>
      {({ isActive }) => miolo(isActive)}
    </NavLink>
  );
}

function CartaoUtilizador({ escuro }: { escuro?: boolean }) {
  const { utilizador, sair } = useSessao();
  const navigate = useNavigate();
  const [mudarSenha, setMudarSenha] = useState(false);
  if (!utilizador) return null;
  const nome = utilizador.papel === "medico" ? `Dr. ${utilizador.nome}` : utilizador.nome;
  return (
    <div className="flex items-center gap-2 px-1">
      <Avatar nome={utilizador.nome} tamanho="sm" />
      <div className="ml-1 min-w-0 flex-1">
        <p className={cx("truncate text-sm font-semibold", escuro ? "text-white" : "text-tinta")}>{nome}</p>
        <p className={cx("truncate text-xs", escuro ? "text-white/60" : "text-grafite")}>{PAPEIS[utilizador.papel]}</p>
      </div>
      <BotaoIcone rotulo="Mudar palavra-passe" className={escuro ? "text-white/70 hover:bg-white/10 hover:text-white" : undefined} onClick={() => setMudarSenha(true)}>
        <KeyRound />
      </BotaoIcone>
      <FolhaMudarSenha aberta={mudarSenha} aoFechar={() => setMudarSenha(false)} />
      <BotaoIcone
        rotulo="Sair"
        className={escuro ? "text-white/70 hover:bg-white/10 hover:text-white" : undefined}
        onClick={async () => {
          await sair();
          navigate("/", { replace: true });
        }}
      >
        <LogOut />
      </BotaoIcone>
    </div>
  );
}

function BarraLateral({ itens, secundarios, accao }: { itens: ItemNav[]; secundarios?: ItemNav[]; accao?: ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] p-3 lg:block">
      <div className="relative isolate flex h-full flex-col overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,#106B64_0%,#0C5751_55%,#083B37_100%)] px-4 pb-4 pt-6">
        <svg className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 text-white/[0.06]" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <Link to="/" className="rounded-full px-2 py-1" aria-label="Início">
          <Marca clara compacta />
        </Link>
        {accao && <div className="mt-7">{accao}</div>}
        <nav aria-label="Principal" className="-mx-1 mt-6 flex-1 overflow-y-auto px-1 sem-barra">
          <ul className="space-y-1">
            {itens.map((i) => (
              <li key={i.rotulo}>
                <LinkLateral item={i} escuro />
              </li>
            ))}
          </ul>
          {secundarios && secundarios.length > 0 && (
            <>
              <div className="mx-4 my-4 border-t border-white/10" />
              <ul className="space-y-1">
                {secundarios.map((i) => (
                  <li key={i.rotulo}>
                    <LinkLateral item={i} escuro />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
        <div className="mt-4 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-1">
          <CartaoUtilizador escuro />
        </div>
      </div>
    </aside>
  );
}

function BarraInferior({ itens }: { itens: ItemNav[] }) {
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="vidro mx-auto flex max-w-md items-stretch rounded-full px-2 py-1.5">
        {itens.map((i) => (
          <li key={i.rotulo} className="flex flex-1 justify-center">
            {i.destaque ? <ItemDestaque item={i} /> : <ItemInferior item={i} />}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ItemInferior({ item }: { item: ItemNav }) {
  const miolo = (activo: boolean) => (
    <>
      <span className="relative">
        <item.Icone className="h-[22px] w-[22px]" strokeWidth={activo ? 2.3 : 1.9} aria-hidden="true" />
        {!!item.contagem && <Contagem n={item.contagem} className="absolute -right-2.5 -top-1.5 h-4 min-w-4 px-1 text-[10px]" />}
      </span>
      <span>{item.rotulo}</span>
    </>
  );
  const classe = (activo: boolean) =>
    cx("flex h-14 w-full flex-col items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-colors", activo ? "text-esperanca" : "text-grafite");
  if (!item.para)
    return (
      <button type="button" onClick={item.aoCarregar} className={classe(false)}>
        {miolo(false)}
      </button>
    );
  return (
    <NavLink to={item.para} end={item.fim} className={({ isActive }) => classe(isActive)}>
      {({ isActive }) => miolo(isActive)}
    </NavLink>
  );
}

function ItemDestaque({ item }: { item: ItemNav }) {
  const miolo = (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-esperanca text-white shadow-botao ring-4 ring-white/80 transition-transform active:scale-95">
        <item.Icone className="h-7 w-7" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="text-[11px] font-bold text-esperanca">{item.rotulo}</span>
    </>
  );
  const classe = "-mt-7 flex flex-col items-center gap-1";
  if (!item.para)
    return (
      <button type="button" onClick={item.aoCarregar} className={classe}>
        {miolo}
      </button>
    );
  return (
    <Link to={item.para} className={classe}>
      {miolo}
    </Link>
  );
}

// ------------------------------------------------------------
// Paciente
// ------------------------------------------------------------

function useNaoLidas() {
  const { dados } = useDados((r) => r.notificacoes(), [], ["notificacoes"]);
  return dados?.filter((n) => !n.lidaEm).length ?? 0;
}

export function ShellPaciente() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const naoLidas = useNaoLidas();
  const noFluxo = pathname.startsWith("/marcar");

  const inicio: ItemNav = { para: "/inicio", rotulo: "Início", Icone: House };
  const consultas: ItemNav = { para: "/consultas", rotulo: "Consultas", Icone: CalendarDays };
  const notificacoes: ItemNav = { para: "/notificacoes", rotulo: "Notificações", Icone: Bell, contagem: naoLidas };
  const perfil: ItemNav = { para: "/perfil", rotulo: "Perfil", Icone: UserRound };

  return (
    <div className="min-h-dvh">
      <BarraLateral
        itens={[inicio, consultas, notificacoes, perfil]}
        secundarios={[
          { para: "/lista-de-espera", rotulo: "Lista de espera", Icone: Hourglass },
          { para: "/familiares", rotulo: "Meus familiares", Icone: Users },
          { para: "/clinica", rotulo: "A clínica", Icone: MapPin },
        ]}
        accao={
          <Botao variante="claro" tamanho="lg" larguraTotal icone={<Plus className="h-5 w-5" strokeWidth={2.5} />} onClick={() => navigate("/marcar")}>
            Marcar consulta
          </Botao>
        }
      />
      <main className={cx(LARGURA_BARRA, noFluxo ? "pb-10" : "pb-36 lg:pb-16")}>
        <Suspense fallback={<CarregandoPagina />}>
          <Outlet />
        </Suspense>
      </main>
      {!noFluxo && <BarraInferior itens={[inicio, consultas, { para: "/marcar", rotulo: "Marcar", Icone: Plus, destaque: true }, notificacoes, perfil]} />}
      <FolhaTelefone />
    </div>
  );
}

/** Contas criadas fora da aplicação (ex.: no painel do Supabase) podem não ter telemóvel — e a clínica precisa dele. */
function FolhaTelefone() {
  const { utilizador } = useSessao();
  const avisar = useAviso();
  const [dispensada, setDispensada] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const aberta = !!utilizador?.pacienteId && !utilizador.telefone && !dispensada;

  async function guardar() {
    const digitos = telefone.replace(/\D/g, "").replace(/^244/, "");
    if (digitos.length !== 9) return setErro("Escreva os 9 dígitos do telemóvel.");
    setAGuardar(true);
    try {
      await repo().actualizarPaciente(utilizador!.pacienteId!, { telefone: digitos });
      avisar("Telemóvel guardado.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Folha
      aberta={aberta}
      aoFechar={() => setDispensada(true)}
      titulo="Falta o seu telemóvel"
      descricao="A clínica usa-o para confirmar consultas e enviar lembretes."
      largura="sm"
      rodape={
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" tamanho="lg" onClick={() => setDispensada(true)}>
            Agora não
          </Botao>
          <Botao tamanho="lg" onClick={guardar} aCarregar={aGuardar}>
            Guardar
          </Botao>
        </div>
      }
    >
      <Campo
        rotulo="Telemóvel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="923 456 789"
        value={telefone}
        onChange={(e) => {
          setTelefone(e.target.value);
          setErro(null);
        }}
        erro={erro}
      />
    </Folha>
  );
}

// ------------------------------------------------------------
// Receção e médicos
// ------------------------------------------------------------

export function ShellClinica({ tipo }: { tipo: "equipa" | "medico" }) {
  const naoLidas = useNaoLidas();
  const [novo, setNovo] = useState<PreenchimentoNovo | null>(null);
  const [mais, setMais] = useState(false);
  const { pathname } = useLocation();
  const { dados: espera } = useDados((r) => (tipo === "equipa" ? r.listaEspera() : Promise.resolve([])), [tipo], ["espera"]);
  const emEspera = espera?.filter((e) => e.estado === "activa").length ?? 0;

  const abrirNovo = (p: PreenchimentoNovo = {}) => setNovo(p);

  const equipa: ItemNav[] = [
    { para: "/rececao", rotulo: "Agenda", Icone: CalendarDays, fim: true },
    { para: "/rececao/pacientes", rotulo: "Pacientes", Icone: Users },
    { para: "/rececao/medicos", rotulo: "Médicos", Icone: Stethoscope },
    { para: "/rececao/especialidades", rotulo: "Especialidades", Icone: Shapes },
    { para: "/rececao/lista-de-espera", rotulo: "Lista de espera", Icone: Hourglass, contagem: emEspera },
    { para: "/rececao/estatisticas", rotulo: "Estatísticas", Icone: ChartColumn },
  ];
  const equipaSecundarios: ItemNav[] = [
    { para: "/rececao/notificacoes", rotulo: "Notificações", Icone: Bell, contagem: naoLidas },
    { para: "/rececao/clinica", rotulo: "Dados da clínica", Icone: Settings },
  ];
  const medico: ItemNav[] = [
    { para: "/medico", rotulo: "Hoje", Icone: House, fim: true },
    { para: "/medico/agenda", rotulo: "Agenda", Icone: CalendarRange },
    { para: "/medico/disponibilidade", rotulo: "Disponibilidade", Icone: CalendarClock },
  ];

  const itensMais = tipo === "equipa" ? [...equipa.slice(2, 4), equipa[5], ...equipaSecundarios] : [];
  const inferior: ItemNav[] =
    tipo === "equipa"
      ? [equipa[0], equipa[1], { rotulo: "Novo", Icone: Plus, destaque: true, aoCarregar: () => abrirNovo() }, { ...equipa[4], rotulo: "Espera" }, { rotulo: "Mais", Icone: Ellipsis, aoCarregar: () => setMais(true), contagem: naoLidas }]
      : [...medico, { rotulo: "Conta", Icone: UserRound, aoCarregar: () => setMais(true) }];

  return (
    <ContextoNovoAgendamento.Provider value={abrirNovo}>
      <div className="min-h-dvh">
        <BarraLateral
          itens={tipo === "equipa" ? equipa : medico}
          secundarios={tipo === "equipa" ? equipaSecundarios : undefined}
          accao={
            tipo === "equipa" ? (
              <Botao variante="claro" tamanho="lg" larguraTotal icone={<Plus className="h-5 w-5" strokeWidth={2.5} />} onClick={() => abrirNovo()}>
                Novo agendamento
              </Botao>
            ) : undefined
          }
        />
        <main className={cx(LARGURA_BARRA, "pb-36 lg:pb-16")}>
          <Suspense fallback={<CarregandoPagina />}>
            <Outlet />
          </Suspense>
        </main>
        <BarraInferior itens={inferior} />

        <Folha aberta={mais} aoFechar={() => setMais(false)} titulo={tipo === "equipa" ? "Mais" : "A sua conta"} largura="sm">
          <ul className="-mx-2 space-y-1" onClick={() => setMais(false)}>
            {itensMais.map((i) => (
              <li key={i.rotulo}>
                <LinkLateral item={i} />
              </li>
            ))}
          </ul>
          <div className={cx("pt-4", itensMais.length > 0 && "mt-4 border-t border-linha")}>
            <CartaoUtilizador />
          </div>
        </Folha>

        {novo && (
          <Suspense fallback={null}>
            <FolhaNovoAgendamento key={pathname} inicial={novo} aoFechar={() => setNovo(null)} />
          </Suspense>
        )}
      </div>
    </ContextoNovoAgendamento.Provider>
  );
}
