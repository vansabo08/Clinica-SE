// Repositório de demonstração.
//
// Guarda tudo no localStorage e aplica as mesmas regras e permissões que a
// base de dados aplica no Supabase (RLS + funções). Duas abas abertas são
// dois "dispositivos": uma marcação numa aba tira a vaga da outra no mesmo
// instante, através do evento `storage`.

import type {
  DadosEspecialidade,
  DadosMedico,
  FiltroConsultas,
  NovaConsulta,
  NovaConta,
  PeriodoTrabalho,
  Repositorio,
  Tabela,
} from "../repositorio";
import type {
  Bloqueio,
  Clinica,
  Consulta,
  ConsultaDetalhada,
  EntradaEsperaDetalhada,
  Especialidade,
  EstadoConsulta,
  FamiliarDetalhado,
  HorarioTrabalho,
  Indisponivel,
  Medico,
  Notificacao,
  Paciente,
  PacienteResumo,
  Papel,
  Parentesco,
  Utilizador,
} from "../../tipos";
import { CONTAS_DEMO, ESQUEMA_DEMO, ajustarAoCalendario, criarSemente, type EstadoDemo, type UtilizadorDemo } from "./semente";
import { type ContextoAgenda, erroAgenda, validarMarcacao } from "../../disponibilidade";
import { ESTADOS_ALTERAVEIS, TRANSICOES, TRANSICOES_MEDICO, eEquipa } from "../../estados";
import { textos } from "../../textos";
import { type Dia, diaDe, minutosDe, somarMinutos } from "../../tempo";

const CHAVE = "cse-demo";
const CHAVE_SESSAO = "cse-demo-sessao";
const HORA = 3_600_000;
export const TODAS_TABELAS: Tabela[] = ["sessao", "clinica", "especialidades", "medicos", "horarios", "bloqueios", "consultas", "pacientes", "familiares", "espera", "notificacoes"];

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const pausa = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());
const copia = <T,>(v: T): T => structuredClone(v);
export const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const sobrepoe = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) =>
  Date.parse(a.inicio) < Date.parse(b.fim) && Date.parse(b.inicio) < Date.parse(a.fim);
const ocupaAgenda = (estado: EstadoConsulta) => estado === "aguardando" || estado === "confirmada" || estado === "em_atendimento";

interface Opcoes {
  relogio?: () => Date;
  persistir?: boolean;
  latenciaMs?: number;
}

export class RepositorioDemo implements Repositorio {
  readonly modo = "demo" as const;
  private e: EstadoDemo;
  private sessaoMemoria: string | null = null;
  private readonly ouvintes = new Set<(t: Tabela[]) => void>();
  private readonly relogio: () => Date;
  private readonly persistir: boolean;
  private readonly latencia: number;

  constructor(opcoes: Opcoes = {}) {
    this.relogio = opcoes.relogio ?? (() => new Date());
    this.persistir = opcoes.persistir ?? typeof localStorage !== "undefined";
    this.latencia = opcoes.latenciaMs ?? 0;

    const guardado = this.lerGuardado();
    if (guardado) {
      this.e = guardado;
      if (ajustarAoCalendario(this.e, this.relogio())) this.gravar([]);
    } else {
      this.e = criarSemente(this.relogio());
      this.gravar([]);
    }

    if (this.persistir && typeof window !== "undefined") {
      window.addEventListener("storage", (ev) => {
        if (ev.key !== CHAVE) return;
        const fresco = this.lerGuardado();
        if (!fresco) return;
        this.e = fresco;
        const mudou = (fresco.ultimaMudanca as Tabela[]).filter((t) => t !== "sessao");
        this.emitir(mudou.length ? mudou : TODAS_TABELAS);
      });
    }
  }

  // ------------------------------------------------------------
  // Armazenamento e eventos
  // ------------------------------------------------------------

  private lerGuardado(): EstadoDemo | null {
    if (!this.persistir) return null;
    try {
      const texto = localStorage.getItem(CHAVE);
      if (!texto) return null;
      const e = JSON.parse(texto) as EstadoDemo;
      return e.esquema === ESQUEMA_DEMO ? e : null;
    } catch {
      return null;
    }
  }

  private gravar(tabelas: Tabela[]) {
    this.e.versao += 1;
    this.e.ultimaMudanca = tabelas;
    if (!this.persistir) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.e));
    } catch {
      // Sem espaço ou bloqueado: a demonstração continua só em memória.
    }
  }

  private emitir(tabelas: Tabela[]) {
    for (const o of this.ouvintes) o(tabelas);
  }

  /** Aplica uma alteração num rascunho: ou passa toda, ou não passa nada. */
  private async mudar<T>(tabelas: Tabela[], fn: (e: EstadoDemo) => T): Promise<T> {
    await pausa(this.latencia);
    const fresco = this.lerGuardado();
    if (fresco && fresco.versao > this.e.versao) this.e = fresco;
    const rascunho = copia(this.e);
    const resultado = fn(rascunho);
    this.e = rascunho;
    this.gravar(tabelas);
    this.emitir(tabelas);
    return resultado;
  }

  aoMudar(ouvinte: (tabelas: Tabela[]) => void) {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  async reporDemonstracao() {
    this.e = criarSemente(this.relogio());
    this.gravar(TODAS_TABELAS);
    this.emitir(TODAS_TABELAS);
  }

  // ------------------------------------------------------------
  // Sessão
  // ------------------------------------------------------------

  private get idSessao(): string | null {
    if (!this.persistir) return this.sessaoMemoria;
    try {
      return sessionStorage.getItem(CHAVE_SESSAO);
    } catch {
      return this.sessaoMemoria;
    }
  }

  private set idSessao(id: string | null) {
    this.sessaoMemoria = id;
    if (!this.persistir) return;
    try {
      if (id) sessionStorage.setItem(CHAVE_SESSAO, id);
      else sessionStorage.removeItem(CHAVE_SESSAO);
    } catch {
      /* fica em memória */
    }
  }

  private eu(): UtilizadorDemo | null {
    const id = this.idSessao;
    return id ? (this.e.utilizadores.find((u) => u.id === id) ?? null) : null;
  }

  private exigir(...papeis: Papel[]): UtilizadorDemo {
    const u = this.eu();
    if (!u || (papeis.length > 0 && !papeis.includes(u.papel))) throw erroAgenda("sem_permissao");
    return u;
  }

  private exigirEquipa() {
    return this.exigir("rececao", "admin");
  }

  private publico(u: UtilizadorDemo): Utilizador {
    return { id: u.id, papel: u.papel, nome: u.nome, email: u.email, telefone: u.telefone, pacienteId: u.pacienteId, medicoId: u.medicoId };
  }

  async sessaoActual() {
    const u = this.eu();
    return u ? this.publico(u) : null;
  }

  async entrar(email: string, senha: string) {
    await pausa(this.latencia);
    const u = this.e.utilizadores.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.senha === senha);
    if (!u) throw new Error("Email ou palavra-passe incorrectos.");
    this.idSessao = u.id;
    this.emitir(["sessao"]);
    return this.publico(u);
  }

  async entrarComo(papel: Papel) {
    const id = papel === "paciente" ? CONTAS_DEMO.paciente.id : papel === "medico" ? CONTAS_DEMO.medico.id : CONTAS_DEMO.rececao.id;
    const u = this.e.utilizadores.find((x) => x.id === id)!;
    this.idSessao = u.id;
    this.emitir(["sessao"]);
    return this.publico(u);
  }

  async criarConta(d: NovaConta) {
    const email = d.email.trim().toLowerCase();
    const telefone = d.telefone.replace(/\D/g, "");
    if (!d.nome.trim()) throw new Error("Escreva o seu nome.");
    if (telefone.length < 9) throw new Error("O número de telemóvel precisa de 9 dígitos.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Esse email não parece completo.");
    if (d.senha.length < 6) throw new Error("A palavra-passe precisa de pelo menos 6 caracteres.");

    const u = await this.mudar(["pacientes"], (e) => {
      if (e.utilizadores.some((x) => x.email === email)) throw new Error("Já existe uma conta com este email. Entre com ela.");
      const userId = uid();
      const pacienteId = uid();
      e.pacientes.push({ id: pacienteId, userId, nome: d.nome.trim(), telefone, dataNascimento: null, lembreteWhatsapp: true, criadoEm: this.agoraISO() });
      const novo: UtilizadorDemo = { id: userId, papel: "paciente", nome: d.nome.trim(), email, telefone, pacienteId, medicoId: null, senha: d.senha };
      e.utilizadores.push(novo);
      return novo;
    });
    this.idSessao = u.id;
    this.emitir(["sessao"]);
    return this.publico(u);
  }

  async sair() {
    this.idSessao = null;
    this.emitir(["sessao"]);
  }

  // ------------------------------------------------------------
  // Regras partilhadas
  // ------------------------------------------------------------

  private agora() {
    return this.relogio();
  }

  private agoraISO() {
    return this.relogio().toISOString();
  }

  /** O próprio paciente e os familiares que ele gere. */
  private idsDoTitular(e: EstadoDemo, u: UtilizadorDemo): string[] {
    if (!u.pacienteId) return [];
    return [u.pacienteId, ...e.familiares.filter((f) => f.titularId === u.pacienteId).map((f) => f.pacienteId)];
  }

  private podeMexerNoPaciente(e: EstadoDemo, u: UtilizadorDemo, pacienteId: string) {
    if (eEquipa(u.papel)) return true;
    return u.papel === "paciente" && this.idsDoTitular(e, u).includes(pacienteId);
  }

  private titularDe(e: EstadoDemo, pacienteId: string): Paciente | null {
    const p = e.pacientes.find((x) => x.id === pacienteId);
    if (!p) return null;
    if (p.userId) return p;
    const f = e.familiares.find((x) => x.pacienteId === pacienteId);
    return f ? (e.pacientes.find((x) => x.id === f.titularId) ?? null) : null;
  }

  private userDoPaciente(e: EstadoDemo, pacienteId: string) {
    return this.titularDe(e, pacienteId)?.userId ?? null;
  }

  private nomeMedico(e: EstadoDemo, medicoId: string) {
    const m = e.medicos.find((x) => x.id === medicoId);
    return m ? `${m.titulo} ${m.nome}` : "o médico";
  }

  private baseTexto(e: EstadoDemo, c: Pick<Consulta, "pacienteId" | "medicoId" | "inicio">) {
    const p = e.pacientes.find((x) => x.id === c.pacienteId);
    return { medico: this.nomeMedico(e, c.medicoId), inicio: c.inicio, paciente: p && !p.userId ? p.nome.split(" ")[0] : undefined };
  }

  private notificar(e: EstadoDemo, userId: string | null, tipo: Notificacao["tipo"], t: { titulo: string; corpo: string }, extra: Partial<Notificacao> = {}) {
    if (!userId) return;
    const agora = this.agoraISO();
    e.notificacoes.push({ id: uid(), userId, tipo, titulo: t.titulo, corpo: t.corpo, consultaId: null, canal: "app", agendadaPara: agora, enviadaEm: agora, lidaEm: null, dados: null, ...extra });
  }

  /** 24 horas antes; se já faltar menos, 2 horas antes. Mais uma cópia para WhatsApp. */
  private criarLembretes(e: EstadoDemo, c: Consulta) {
    const userId = this.userDoPaciente(e, c.pacienteId);
    if (!userId) return;
    const agora = this.agora().getTime();
    const ini = Date.parse(c.inicio);
    const base = { ...this.baseTexto(e, c), clinica: e.clinica.nome };
    let quando: number;
    let t: { titulo: string; corpo: string };
    if (ini - 24 * HORA > agora) {
      quando = ini - 24 * HORA;
      t = textos.lembrete24h(base);
    } else if (ini - 2 * HORA > agora) {
      quando = ini - 2 * HORA;
      t = textos.lembreteHoje(base);
    } else return;
    const agendadaPara = new Date(quando).toISOString();
    this.notificar(e, userId, "lembrete", t, { consultaId: c.id, agendadaPara, enviadaEm: null });
    if (this.titularDe(e, c.pacienteId)?.lembreteWhatsapp) {
      this.notificar(e, userId, "lembrete", t, { consultaId: c.id, agendadaPara, enviadaEm: null, canal: "whatsapp" });
    }
  }

  private apagarLembretes(e: EstadoDemo, consultaId: string) {
    const agora = this.agora().getTime();
    e.notificacoes = e.notificacoes.filter((n) => !(n.consultaId === consultaId && n.tipo === "lembrete" && Date.parse(n.agendadaPara) > agora));
  }

  /** Um horário ficou livre: avisar quem está na lista de espera para esse dia. */
  private oferecerVaga(e: EstadoDemo, c: Pick<Consulta, "medicoId" | "especialidadeId" | "inicio">) {
    if (Date.parse(c.inicio) <= this.agora().getTime()) return;
    const dia = diaDe(c.inicio);
    const entradas = e.espera
      .filter((x) => x.estado === "activa" && x.especialidadeId === c.especialidadeId && (x.medicoId === null || x.medicoId === c.medicoId) && x.dataDesejada === dia)
      .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
    for (const x of entradas) {
      x.ultimaVaga = c.inicio;
      x.vagasOferecidas += 1;
      this.notificar(e, this.userDoPaciente(e, x.pacienteId), "vaga", textos.vaga({ medico: this.nomeMedico(e, c.medicoId), inicio: c.inicio }), {
        dados: { medicoId: c.medicoId, especialidadeId: c.especialidadeId, inicio: c.inicio },
      });
    }
  }

  private indisponiveisDe(e: EstadoDemo, medicoId: string, de?: string, ate?: string): Indisponivel[] {
    const dentro = (x: { inicio: string; fim: string }) => (!de || Date.parse(x.fim) > Date.parse(de)) && (!ate || Date.parse(x.inicio) < Date.parse(ate));
    return [
      ...e.consultas
        .filter((c) => c.medicoId === medicoId && c.estado !== "cancelada" && dentro(c))
        .map((c) => ({ medicoId, inicio: c.inicio, fim: c.fim, tipo: "consulta" as const })),
      ...e.bloqueios
        .filter((b) => (b.medicoId === medicoId || b.medicoId === null) && dentro(b))
        .map((b) => ({ medicoId: b.medicoId, inicio: b.inicio, fim: b.fim, tipo: "bloqueio" as const })),
    ];
  }

  private contexto(e: EstadoDemo, medico: Medico, ignorar?: Consulta | null): ContextoAgenda {
    return { medico, horarios: e.horarios, indisponiveis: this.indisponiveisDe(e, medico.id), agora: this.agora(), ignorar: ignorar ? { inicio: ignorar.inicio } : null };
  }

  private conflitoPaciente(e: EstadoDemo, pacienteId: string, janela: { inicio: string; fim: string }, ignorarId?: string) {
    return e.consultas.some((c) => c.id !== ignorarId && c.pacienteId === pacienteId && ocupaAgenda(c.estado) && sobrepoe(c, janela));
  }

  private primeiraConcluida(e: EstadoDemo) {
    const m = new Map<string, number>();
    for (const c of e.consultas) {
      if (c.estado !== "concluida") continue;
      const t = Date.parse(c.inicio);
      if (!m.has(c.pacienteId) || t < m.get(c.pacienteId)!) m.set(c.pacienteId, t);
    }
    return m;
  }

  private detalhar(e: EstadoDemo, c: Consulta, u: UtilizadorDemo | null, primeira = this.primeiraConcluida(e)): ConsultaDetalhada {
    const p = e.pacientes.find((x) => x.id === c.pacienteId)!;
    const m = e.medicos.find((x) => x.id === c.medicoId)!;
    const esp = e.especialidades.find((x) => x.id === c.especialidadeId)!;
    const fam = u?.pacienteId ? e.familiares.find((f) => f.titularId === u.pacienteId && f.pacienteId === c.pacienteId) : undefined;
    const antes = primeira.get(c.pacienteId);
    return {
      ...copia(c),
      paciente: { id: p.id, nome: p.nome, telefone: p.telefone, dataNascimento: p.dataNascimento },
      medico: { id: m.id, titulo: m.titulo, nome: m.nome, fotoUrl: m.fotoUrl },
      especialidade: { id: esp.id, nome: esp.nome, icone: esp.icone },
      parentesco: fam?.parentesco ?? null,
      primeiraVez: antes === undefined || antes >= Date.parse(c.inicio),
    };
  }

  // ------------------------------------------------------------
  // Clínica, especialidades, médicos
  // ------------------------------------------------------------

  async clinica(): Promise<Clinica> {
    return copia(this.e.clinica);
  }

  async guardarClinica(c: Clinica) {
    this.exigirEquipa();
    await this.mudar(["clinica"], (e) => {
      e.clinica = copia(c);
    });
  }

  async especialidades(): Promise<Especialidade[]> {
    return copia(this.e.especialidades.filter((x) => x.activa)).sort((a, b) => a.ordem - b.ordem);
  }

  async guardarEspecialidade(d: DadosEspecialidade) {
    this.exigirEquipa();
    const nome = d.nome.trim();
    if (!nome) throw new Error("Dê um nome à especialidade.");
    return this.mudar(["especialidades"], (e) => {
      if (d.id) {
        const x = e.especialidades.find((s) => s.id === d.id);
        if (!x) throw erroAgenda("nao_encontrada");
        Object.assign(x, d, { nome });
        return copia(x);
      }
      const nova: Especialidade = { ...d, id: uid(), nome, ordem: e.especialidades.length, activa: true };
      e.especialidades.push(nova);
      return copia(nova);
    });
  }

  async removerEspecialidade(id: string) {
    this.exigirEquipa();
    await this.mudar(["especialidades"], (e) => {
      const n = e.medicos.filter((m) => m.especialidadeId === id && m.activo).length;
      if (n > 0) throw new Error(`Há ${n} ${n === 1 ? "médico" : "médicos"} nesta especialidade. Mude-os de especialidade antes de a remover.`);
      if (e.consultas.some((c) => c.especialidadeId === id)) {
        const x = e.especialidades.find((s) => s.id === id);
        if (x) x.activa = false; // o histórico continua a apontar para ela
      } else {
        e.especialidades = e.especialidades.filter((s) => s.id !== id);
      }
    });
  }

  async medicos(): Promise<Medico[]> {
    return copia(this.e.medicos).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }

  async guardarMedico(d: DadosMedico) {
    this.exigirEquipa();
    if (!d.nome.trim()) throw new Error("Escreva o nome do médico.");
    if (d.duracaoMin < 10) throw new Error("Cada consulta precisa de pelo menos 10 minutos.");
    return this.mudar(["medicos"], (e) => {
      if (d.id) {
        const m = e.medicos.find((x) => x.id === d.id);
        if (!m) throw erroAgenda("nao_encontrada");
        Object.assign(m, d, { nome: d.nome.trim() });
        return copia(m);
      }
      const novo: Medico = { ...d, nome: d.nome.trim(), id: uid(), userId: null };
      e.medicos.push(novo);
      return copia(novo);
    });
  }

  /** Na demonstração não sai email nenhum; só se valida o pedido. */
  async convidarMedico(medicoId: string) {
    this.exigirEquipa();
    const m = this.e.medicos.find((x) => x.id === medicoId);
    if (!m) throw erroAgenda("nao_encontrada");
    if (!/^\S+@\S+\.\S+$/.test(m.email)) throw new Error("Falta um email válido para este médico.");
    await pausa(this.latencia);
    return { enviado: false };
  }

  private podeGerirAgendaDe(u: UtilizadorDemo, medicoId: string | null) {
    if (eEquipa(u.papel)) return true;
    if (u.papel !== "medico" || medicoId === null || u.medicoId !== medicoId) return false;
    return this.e.medicos.find((m) => m.id === medicoId)?.podeEditarDisponibilidade ?? false;
  }

  async horarios(medicoId?: string): Promise<HorarioTrabalho[]> {
    return copia(this.e.horarios.filter((h) => !medicoId || h.medicoId === medicoId));
  }

  async guardarHorarios(medicoId: string, periodos: PeriodoTrabalho[]) {
    const u = this.exigir();
    if (!this.podeGerirAgendaDe(u, medicoId)) throw erroAgenda("sem_permissao");
    for (const p of periodos) {
      if (minutosDe(p.inicio) >= minutosDe(p.fim)) throw new Error("Cada período tem de acabar depois de começar.");
      for (const q of periodos) {
        if (p !== q && p.diaSemana === q.diaSemana && minutosDe(p.inicio) < minutosDe(q.fim) && minutosDe(q.inicio) < minutosDe(p.fim)) {
          throw new Error("Há períodos sobrepostos no mesmo dia.");
        }
      }
    }
    await this.mudar(["horarios"], (e) => {
      e.horarios = [...e.horarios.filter((h) => h.medicoId !== medicoId), ...periodos.map((p) => ({ ...p, id: uid(), medicoId }))];
    });
  }

  async bloqueios(f: { medicoId?: string; de?: string; ate?: string } = {}): Promise<Bloqueio[]> {
    const u = this.exigir();
    if (u.papel === "paciente") return [];
    return copia(
      this.e.bloqueios.filter(
        (b) =>
          (!f.medicoId || b.medicoId === f.medicoId || b.medicoId === null) &&
          (!f.de || Date.parse(b.fim) > Date.parse(f.de)) &&
          (!f.ate || Date.parse(b.inicio) < Date.parse(f.ate)),
      ),
    ).sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  async bloquear(b: Omit<Bloqueio, "id">) {
    const u = this.exigir();
    if (!this.podeGerirAgendaDe(u, b.medicoId)) throw erroAgenda("sem_permissao");
    if (Date.parse(b.inicio) >= Date.parse(b.fim)) throw new Error("O bloqueio tem de acabar depois de começar.");
    return this.mudar(["bloqueios"], (e) => {
      const novo: Bloqueio = { ...b, id: uid() };
      e.bloqueios.push(novo);
      return copia(novo);
    });
  }

  async desbloquear(id: string) {
    const u = this.exigir();
    const b = this.e.bloqueios.find((x) => x.id === id);
    if (!b) return;
    if (!this.podeGerirAgendaDe(u, b.medicoId)) throw erroAgenda("sem_permissao");
    await this.mudar(["bloqueios"], (e) => {
      e.bloqueios = e.bloqueios.filter((x) => x.id !== id);
    });
  }

  async indisponiveis(medicoId: string, de: string, ate: string) {
    this.exigir();
    return this.indisponiveisDe(this.e, medicoId, de, ate);
  }

  // ------------------------------------------------------------
  // Consultas
  // ------------------------------------------------------------

  async consultas(f: FiltroConsultas = {}): Promise<ConsultaDetalhada[]> {
    const u = this.exigir();
    const e = this.e;
    let lista = e.consultas;
    if (u.papel === "paciente") {
      const ids = new Set(this.idsDoTitular(e, u));
      lista = lista.filter((c) => ids.has(c.pacienteId));
    } else if (u.papel === "medico") {
      lista = lista.filter((c) => c.medicoId === u.medicoId);
    }
    const de = f.de ? Date.parse(f.de) : null;
    const ate = f.ate ? Date.parse(f.ate) : null;
    lista = lista.filter(
      (c) =>
        (de === null || Date.parse(c.inicio) >= de) &&
        (ate === null || Date.parse(c.inicio) < ate) &&
        (!f.medicoId || c.medicoId === f.medicoId) &&
        (!f.pacienteId || c.pacienteId === f.pacienteId),
    );
    const primeira = this.primeiraConcluida(e);
    return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio)).map((c) => this.detalhar(e, c, u, primeira));
  }

  async consulta(id: string) {
    const u = this.exigir();
    const c = this.e.consultas.find((x) => x.id === id);
    if (!c) return null;
    const pode =
      eEquipa(u.papel) ||
      (u.papel === "medico" && c.medicoId === u.medicoId) ||
      (u.papel === "paciente" && this.idsDoTitular(this.e, u).includes(c.pacienteId));
    return pode ? this.detalhar(this.e, c, u) : null;
  }

  async marcar(n: NovaConsulta) {
    const u = this.exigir("paciente", "rececao", "admin");
    return this.mudar(["consultas", "notificacoes", "espera"], (e) => {
      if (!this.podeMexerNoPaciente(e, u, n.pacienteId)) throw erroAgenda("sem_permissao");
      const medico = e.medicos.find((m) => m.id === n.medicoId);
      if (!medico) throw erroAgenda("nao_encontrada");

      const inicio = new Date(n.inicio).toISOString();
      const codigo = validarMarcacao(this.contexto(e, medico), inicio);
      if (codigo) throw erroAgenda(codigo);
      const fim = somarMinutos(inicio, medico.duracaoMin);
      if (this.conflitoPaciente(e, n.pacienteId, { inicio, fim })) throw erroAgenda("paciente_ocupado");

      const equipa = eEquipa(u.papel);
      const agora = this.agoraISO();
      const estado: EstadoConsulta = equipa && n.estado === "confirmada" ? "confirmada" : "aguardando";
      const c: Consulta = {
        id: uid(),
        pacienteId: n.pacienteId,
        medicoId: medico.id,
        especialidadeId: medico.especialidadeId,
        inicio,
        fim,
        estado,
        observacao: (n.observacao ?? "").trim(),
        canal: n.canal ?? (equipa ? "rececao" : "app"),
        marcadaPor: u.id,
        criadaEm: agora,
        confirmadaEm: estado === "confirmada" ? agora : null,
        canceladaEm: null,
        reagendadaDe: null,
      };
      e.consultas.push(c);

      const base = this.baseTexto(e, c);
      this.notificar(e, this.userDoPaciente(e, c.pacienteId), estado === "confirmada" ? "confirmacao" : "marcacao", estado === "confirmada" ? textos.confirmacao(base) : textos.marcacao(base), { consultaId: c.id });
      this.criarLembretes(e, c);
      if (!equipa) {
        const pacienteNome = e.pacientes.find((p) => p.id === c.pacienteId)!.nome;
        for (const s of e.utilizadores.filter((x) => eEquipa(x.papel))) {
          this.notificar(e, s.id, "marcacao", textos.novaMarcacaoApp({ ...base, pacienteNome }), { consultaId: c.id });
        }
      }
      const dia = diaDe(inicio);
      for (const x of e.espera) {
        if (x.estado === "activa" && x.pacienteId === c.pacienteId && x.especialidadeId === c.especialidadeId && x.dataDesejada === dia) x.estado = "marcada";
      }
      return this.detalhar(e, c, u);
    });
  }

  private consultaAlteravel(e: EstadoDemo, u: UtilizadorDemo, id: string): Consulta {
    const c = e.consultas.find((x) => x.id === id);
    if (!c) throw erroAgenda("nao_encontrada");
    if (!this.podeMexerNoPaciente(e, u, c.pacienteId)) throw erroAgenda("sem_permissao");
    if (!ESTADOS_ALTERAVEIS.includes(c.estado)) throw erroAgenda("estado_invalido");
    return c;
  }

  async reagendar(id: string, novoInicio: string) {
    const u = this.exigir("paciente", "rececao", "admin");
    return this.mudar(["consultas", "notificacoes", "espera"], (e) => {
      const c = this.consultaAlteravel(e, u, id);
      const medico = e.medicos.find((m) => m.id === c.medicoId)!;
      const inicio = new Date(novoInicio).toISOString();
      if (inicio === c.inicio) return this.detalhar(e, c, u);

      const codigo = validarMarcacao(this.contexto(e, medico, c), inicio);
      if (codigo) throw erroAgenda(codigo);
      const fim = somarMinutos(inicio, medico.duracaoMin);
      if (this.conflitoPaciente(e, c.pacienteId, { inicio, fim }, c.id)) throw erroAgenda("paciente_ocupado");

      const antiga = { medicoId: c.medicoId, especialidadeId: c.especialidadeId, inicio: c.inicio };
      c.reagendadaDe = c.inicio;
      c.inicio = inicio;
      c.fim = fim;
      if (!eEquipa(u.papel)) {
        c.estado = "aguardando";
        c.confirmadaEm = null;
      }
      this.apagarLembretes(e, c.id);
      this.criarLembretes(e, c);
      this.notificar(e, this.userDoPaciente(e, c.pacienteId), "reagendamento", textos.reagendamento(this.baseTexto(e, c)), { consultaId: c.id });
      this.oferecerVaga(e, antiga);
      return this.detalhar(e, c, u);
    });
  }

  async cancelar(id: string) {
    const u = this.exigir("paciente", "rececao", "admin");
    await this.mudar(["consultas", "notificacoes", "espera"], (e) => {
      const c = this.consultaAlteravel(e, u, id);
      c.estado = "cancelada";
      c.canceladaEm = this.agoraISO();
      this.apagarLembretes(e, c.id);
      this.notificar(e, this.userDoPaciente(e, c.pacienteId), "cancelamento", textos.cancelamento(this.baseTexto(e, c)), { consultaId: c.id });
      this.oferecerVaga(e, c);
    });
  }

  async mudarEstado(id: string, estado: EstadoConsulta) {
    if (estado === "cancelada") return this.cancelar(id);
    const u = this.exigir("rececao", "admin", "medico");
    await this.mudar(["consultas", "notificacoes"], (e) => {
      const c = e.consultas.find((x) => x.id === id);
      if (!c) throw erroAgenda("nao_encontrada");
      let permitidos: EstadoConsulta[];
      if (u.papel === "medico") {
        if (c.medicoId !== u.medicoId) throw erroAgenda("sem_permissao");
        permitidos = TRANSICOES_MEDICO[c.estado] ?? [];
      } else {
        permitidos = TRANSICOES[c.estado];
      }
      if (!permitidos.includes(estado)) throw erroAgenda("estado_invalido");
      c.estado = estado;
      if (estado === "confirmada" && !c.confirmadaEm) {
        c.confirmadaEm = this.agoraISO();
        this.notificar(e, this.userDoPaciente(e, c.pacienteId), "confirmacao", textos.confirmacao(this.baseTexto(e, c)), { consultaId: c.id });
      }
    });
  }

  // ------------------------------------------------------------
  // Pacientes e familiares
  // ------------------------------------------------------------

  async pacientes(pesquisa = ""): Promise<PacienteResumo[]> {
    const u = this.exigir();
    const e = this.e;
    let lista = e.pacientes;
    let consultas = e.consultas;
    if (u.papel === "paciente") {
      const ids = new Set(this.idsDoTitular(e, u));
      lista = lista.filter((p) => ids.has(p.id));
    } else if (u.papel === "medico") {
      consultas = consultas.filter((c) => c.medicoId === u.medicoId);
      const ids = new Set(consultas.map((c) => c.pacienteId));
      lista = lista.filter((p) => ids.has(p.id));
    }
    const q = normalizar(pesquisa.trim());
    const qDigitos = pesquisa.replace(/\D/g, "");
    if (q) lista = lista.filter((p) => normalizar(p.nome).includes(q) || (qDigitos.length >= 3 && p.telefone.includes(qDigitos)));

    const agora = this.agora().getTime();
    const porPaciente = new Map<string, Consulta[]>();
    for (const c of consultas) {
      const arr = porPaciente.get(c.pacienteId);
      if (arr) arr.push(c);
      else porPaciente.set(c.pacienteId, [c]);
    }
    return lista
      .map((p) => {
        const cs = porPaciente.get(p.id) ?? [];
        let proxima: string | null = null;
        let ultima: string | null = null;
        for (const c of cs) {
          const t = Date.parse(c.inicio);
          if (t > agora && ESTADOS_ALTERAVEIS.includes(c.estado) && (!proxima || c.inicio < proxima)) proxima = c.inicio;
          if (t <= agora && c.estado !== "cancelada" && (!ultima || c.inicio > ultima)) ultima = c.inicio;
        }
        return { ...copia(p), proximaConsulta: proxima, ultimoAgendamento: ultima, totalConsultas: cs.filter((c) => c.estado !== "cancelada").length };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }

  async criarPaciente(d: { nome: string; telefone: string; dataNascimento?: Dia | null }) {
    this.exigirEquipa();
    const nome = d.nome.trim();
    const telefone = d.telefone.replace(/\D/g, "");
    if (!nome) throw new Error("Escreva o nome do paciente.");
    if (telefone.length < 9) throw new Error("O número de telemóvel precisa de 9 dígitos.");
    return this.mudar(["pacientes"], (e) => {
      const existe = e.pacientes.find((p) => p.telefone === telefone && normalizar(p.nome) === normalizar(nome));
      if (existe) return copia(existe);
      const p: Paciente = { id: uid(), userId: null, nome, telefone, dataNascimento: d.dataNascimento ?? null, lembreteWhatsapp: true, criadoEm: this.agoraISO() };
      e.pacientes.push(p);
      return copia(p);
    });
  }

  async meuPaciente() {
    const u = this.eu();
    if (!u?.pacienteId) return null;
    const p = this.e.pacientes.find((x) => x.id === u.pacienteId);
    return p ? copia(p) : null;
  }

  async actualizarPaciente(id: string, dados: Partial<Pick<Paciente, "nome" | "telefone" | "dataNascimento" | "lembreteWhatsapp">>) {
    const u = this.exigir();
    if (!this.podeMexerNoPaciente(this.e, u, id)) throw erroAgenda("sem_permissao");
    await this.mudar(["pacientes", "sessao"], (e) => {
      const p = e.pacientes.find((x) => x.id === id);
      if (!p) throw erroAgenda("nao_encontrada");
      Object.assign(p, dados);
      if (dados.nome !== undefined) p.nome = dados.nome.trim();
      if (dados.telefone !== undefined) p.telefone = dados.telefone.replace(/\D/g, "");
      const usr = p.userId ? e.utilizadores.find((x) => x.id === p.userId) : undefined;
      if (usr) {
        usr.nome = p.nome;
        usr.telefone = p.telefone;
      }
    });
  }

  async familiares(): Promise<FamiliarDetalhado[]> {
    const u = this.eu();
    if (!u?.pacienteId) return [];
    return this.e.familiares
      .filter((f) => f.titularId === u.pacienteId)
      .map((f) => ({ ...copia(f), paciente: copia(this.e.pacientes.find((p) => p.id === f.pacienteId)!) }));
  }

  async adicionarFamiliar(d: { nome: string; parentesco: Parentesco; dataNascimento?: Dia | null }) {
    const u = this.exigir("paciente");
    const nome = d.nome.trim();
    if (!nome) throw new Error("Escreva o nome do familiar.");
    return this.mudar(["familiares", "pacientes"], (e) => {
      const titular = e.pacientes.find((p) => p.id === u.pacienteId)!;
      const p: Paciente = { id: uid(), userId: null, nome, telefone: titular.telefone, dataNascimento: d.dataNascimento ?? null, lembreteWhatsapp: false, criadoEm: this.agoraISO() };
      const f = { id: uid(), titularId: titular.id, pacienteId: p.id, parentesco: d.parentesco };
      e.pacientes.push(p);
      e.familiares.push(f);
      return { ...copia(f), paciente: copia(p) };
    });
  }

  async removerFamiliar(id: string) {
    const u = this.exigir("paciente");
    await this.mudar(["familiares"], (e) => {
      const f = e.familiares.find((x) => x.id === id && x.titularId === u.pacienteId);
      if (!f) throw erroAgenda("nao_encontrada");
      const agora = this.agora().getTime();
      if (e.consultas.some((c) => c.pacienteId === f.pacienteId && ESTADOS_ALTERAVEIS.includes(c.estado) && Date.parse(c.inicio) > agora)) {
        throw new Error("Este familiar tem consultas marcadas. Cancele-as antes de o remover.");
      }
      e.familiares = e.familiares.filter((x) => x.id !== id);
    });
  }

  // ------------------------------------------------------------
  // Lista de espera
  // ------------------------------------------------------------

  async listaEspera(): Promise<EntradaEsperaDetalhada[]> {
    const u = this.exigir();
    const e = this.e;
    let lista = e.espera.filter((x) => x.estado !== "removida");
    if (u.papel === "paciente") {
      const ids = new Set(this.idsDoTitular(e, u));
      lista = lista.filter((x) => ids.has(x.pacienteId));
    } else if (!eEquipa(u.papel)) {
      return [];
    }
    return lista
      .map((x) => {
        const p = e.pacientes.find((y) => y.id === x.pacienteId)!;
        const esp = e.especialidades.find((y) => y.id === x.especialidadeId)!;
        const m = x.medicoId ? e.medicos.find((y) => y.id === x.medicoId) : undefined;
        return {
          ...copia(x),
          paciente: { id: p.id, nome: p.nome, telefone: p.telefone },
          especialidade: { id: esp.id, nome: esp.nome },
          medico: m ? { id: m.id, titulo: m.titulo, nome: m.nome } : null,
        };
      })
      .sort((a, b) => a.dataDesejada.localeCompare(b.dataDesejada) || a.criadaEm.localeCompare(b.criadaEm));
  }

  async entrarListaEspera(d: { pacienteId: string; especialidadeId: string; medicoId: string | null; dataDesejada: Dia }) {
    const u = this.exigir("paciente", "rececao", "admin");
    await this.mudar(["espera"], (e) => {
      if (!this.podeMexerNoPaciente(e, u, d.pacienteId)) throw erroAgenda("sem_permissao");
      const repetida = e.espera.some(
        (x) => x.estado === "activa" && x.pacienteId === d.pacienteId && x.especialidadeId === d.especialidadeId && x.medicoId === d.medicoId && x.dataDesejada === d.dataDesejada,
      );
      if (repetida) return;
      e.espera.push({ id: uid(), ...d, estado: "activa", criadaEm: this.agoraISO(), ultimaVaga: null, vagasOferecidas: 0 });
    });
  }

  async sairListaEspera(id: string) {
    const u = this.exigir("paciente", "rececao", "admin");
    await this.mudar(["espera"], (e) => {
      const x = e.espera.find((y) => y.id === id);
      if (!x) throw erroAgenda("nao_encontrada");
      if (!this.podeMexerNoPaciente(e, u, x.pacienteId)) throw erroAgenda("sem_permissao");
      x.estado = "removida";
    });
  }

  // ------------------------------------------------------------
  // Notificações
  // ------------------------------------------------------------

  async notificacoes(): Promise<Notificacao[]> {
    const u = this.eu();
    if (!u) return [];
    const agora = this.agora().getTime();
    return copia(this.e.notificacoes.filter((n) => n.userId === u.id && n.canal === "app" && Date.parse(n.agendadaPara) <= agora)).sort((a, b) =>
      b.agendadaPara.localeCompare(a.agendadaPara),
    );
  }

  async marcarLida(id?: string) {
    const u = this.exigir();
    await this.mudar(["notificacoes"], (e) => {
      const agora = this.agoraISO();
      for (const n of e.notificacoes) {
        if (n.userId === u.id && !n.lidaEm && (!id || n.id === id) && n.agendadaPara <= agora) n.lidaEm = agora;
      }
    });
  }
}
