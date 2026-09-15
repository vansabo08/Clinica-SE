// Dados de demonstração.
//
// Gerados em relação ao dia de hoje, para que a agenda pareça viva em
// qualquer dia em que se abra a aplicação. O gerador é determinístico:
// a mesma data dá sempre os mesmos pacientes e consultas.

import type {
  Bloqueio,
  Canal,
  Clinica,
  Consulta,
  EntradaEspera,
  Especialidade,
  EstadoConsulta,
  Familiar,
  HorarioTrabalho,
  Medico,
  Notificacao,
  Paciente,
  Utilizador,
} from "../../tipos";
import { type Dia, diaDaSemana, diaDe, hoje, instanteISO, somarDias, somarMinutos } from "../../tempo";
import { vagasDoDia } from "../../disponibilidade";
import { textos } from "../../textos";

export const ESQUEMA_DEMO = 3;

export interface UtilizadorDemo extends Utilizador {
  senha: string;
}

export interface EstadoDemo {
  esquema: number;
  versao: number;
  criadoEm: string;
  ultimaMudanca: string[];
  utilizadores: UtilizadorDemo[];
  clinica: Clinica;
  especialidades: Especialidade[];
  medicos: Medico[];
  horarios: HorarioTrabalho[];
  bloqueios: Bloqueio[];
  pacientes: Paciente[];
  familiares: Familiar[];
  consultas: Consulta[];
  notificacoes: Notificacao[];
  espera: EntradaEspera[];
}

export const CONTAS_DEMO = {
  paciente: { id: "u-maria", email: "maria@demo.ao" },
  rececao: { id: "u-teresa", email: "rececao@demo.ao" },
  medico: { id: "u-joao", email: "joao.silva@demo.ao" },
  senha: "demo",
};

/** PRNG pequeno e determinístico (mulberry32). */
function gerador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FERIADOS_ANGOLA: [string, string][] = [
  ["01-01", "Dia de Ano Novo"],
  ["02-04", "Dia do Início da Luta Armada"],
  ["03-08", "Dia Internacional da Mulher"],
  ["03-23", "Dia da Libertação da África Austral"],
  ["04-04", "Dia da Paz"],
  ["05-01", "Dia do Trabalhador"],
  ["09-17", "Dia do Fundador da Nação e do Herói Nacional"],
  ["11-02", "Dia dos Finados"],
  ["11-11", "Dia da Independência Nacional"],
  ["12-25", "Dia de Natal"],
];

const ESPECIALIDADES: Especialidade[] = [
  ["esp-geral", "Clínica Geral", "Consultas de rotina, check-ups e primeiro diagnóstico.", "estetoscopio"],
  ["esp-pediatria", "Pediatria", "Bebés, crianças e adolescentes.", "bebe"],
  ["esp-gineco", "Ginecologia", "Saúde da mulher e planeamento familiar.", "flor"],
  ["esp-cardio", "Cardiologia", "Coração, tensão arterial e circulação.", "coracao"],
  ["esp-dermato", "Dermatologia", "Pele, cabelo e unhas.", "pele"],
  ["esp-odonto", "Odontologia", "Dentes, gengivas e higiene oral.", "dente"],
  ["esp-oftalmo", "Oftalmologia", "Visão e saúde dos olhos.", "olho"],
  ["esp-orto", "Ortopedia", "Ossos, articulações e músculos.", "osso"],
].map(([id, nome, descricao, icone], ordem) => ({ id, nome, descricao, icone, ordem, activa: true }));

type LinhaMedico = [id: string, titulo: "Dr." | "Dra.", nome: string, esp: string, dur: number, tel: string, activo?: boolean];

const MEDICOS: LinhaMedico[] = [
  ["m-joao", "Dr.", "João Silva", "esp-cardio", 30, "923111204"],
  ["m-helena", "Dra.", "Helena Costa", "esp-cardio", 30, "923111318"],
  ["m-ana", "Dra.", "Ana Cardoso", "esp-geral", 20, "923111422"],
  ["m-paulo", "Dr.", "Paulo Mendes", "esp-geral", 20, "923111536"],
  ["m-maria", "Dra.", "Maria Neto", "esp-pediatria", 30, "923111640"],
  ["m-mateus", "Dr.", "Mateus Chipenda", "esp-pediatria", 30, "923111754"],
  ["m-isabel", "Dra.", "Isabel Mbala", "esp-gineco", 30, "923111868"],
  ["m-nelson", "Dr.", "Nelson Bento", "esp-dermato", 30, "923111972"],
  ["m-luisa", "Dra.", "Luísa Tavares", "esp-odonto", 45, "923112086"],
  ["m-sofia", "Dra.", "Sofia Lemos", "esp-oftalmo", 30, "923112190"],
  ["m-adriano", "Dr.", "Adriano Van-Dúnem", "esp-orto", 30, "923112204"],
  ["m-rui", "Dr.", "Rui Gaspar", "esp-geral", 20, "923112318", false],
];

// [medico, dias da semana, início, fim]
const HORARIOS: [string, number[], string, string][] = [
  ["m-joao", [1, 2, 3, 4, 5], "08:00", "12:00"],
  ["m-joao", [1, 2, 3, 4, 5], "14:00", "17:00"],
  ["m-helena", [1, 3, 5], "08:00", "13:00"],
  ["m-ana", [1, 2, 3, 4, 5], "08:00", "13:00"],
  ["m-ana", [6], "08:00", "12:00"],
  ["m-paulo", [1, 2, 3, 4, 5], "13:00", "18:00"],
  ["m-maria", [1, 2, 3, 4, 5], "08:00", "12:00"],
  ["m-maria", [1, 2, 3, 4, 5], "14:00", "16:00"],
  ["m-mateus", [2, 4], "08:00", "12:00"],
  ["m-mateus", [6], "09:00", "12:00"],
  ["m-isabel", [1, 2, 4], "08:00", "12:00"],
  ["m-isabel", [1, 2, 4], "14:00", "17:00"],
  ["m-nelson", [2, 3, 5], "09:00", "12:00"],
  ["m-nelson", [2, 3, 5], "14:00", "16:00"],
  ["m-luisa", [1, 2, 3, 4, 5], "08:00", "12:30"],
  ["m-luisa", [1, 2, 3, 4, 5], "14:00", "17:00"],
  ["m-sofia", [3, 4], "08:00", "12:00"],
  ["m-adriano", [1, 3], "14:00", "18:00"],
  ["m-adriano", [5], "08:00", "12:00"],
  ["m-rui", [1, 2, 3, 4, 5], "08:00", "12:00"],
];

const NOMES = ["Paulo", "Carlos", "Ana", "Esperança", "Joana", "Fernando", "Rosa", "Helena", "Manuel", "Lurdes", "Augusto", "Célia", "Domingas", "Edson", "Filomena", "Gaspar", "Inês", "Jacinto", "Kátia", "Leonor", "Márcio", "Nádia", "Osvaldo", "Patrícia", "Quintino", "Rufino", "Sílvia", "Tomás", "Vanda", "Wilson", "Yolanda", "Zacarias", "Bernardo", "Dalva", "Emanuel", "Graça", "Teresa", "Victor", "Madalena", "Hélder", "Albertina", "Isabel", "Mário"];
const APELIDOS = ["Sebastião", "Manuel", "Domingos", "Nzinga", "Cassule", "Lukamba", "Ngola", "Fernandes", "Mbala", "Tchipa", "Kapenda", "Sousa", "Muanza", "Lopes", "Cambuta", "Chissola", "Pedro", "Quissanga", "Afonso", "Kalunga", "Miguel", "Tomé", "Samakuva", "Dias"];

const OBSERVACOES: Record<string, string[]> = {
  "esp-geral": ["Consulta de rotina", "Febre há três dias", "Revisão de análises"],
  "esp-pediatria": ["Vacinação e peso", "Tosse que não passa", "Consulta dos 6 meses"],
  "esp-gineco": ["Consulta anual", "Acompanhamento da gravidez", "Planeamento familiar"],
  "esp-cardio": ["Tensão alta", "Cansaço ao subir escadas", "Revisão do electrocardiograma"],
  "esp-dermato": ["Manchas na pele", "Queda de cabelo", "Sinal que mudou de cor"],
  "esp-odonto": ["Limpeza", "Dor de dentes", "Sangramento das gengivas"],
  "esp-oftalmo": ["Revisão dos óculos", "Vista cansada", "Olho vermelho"],
  "esp-orto": ["Dor no joelho", "Dor nas costas", "Entorse no tornozelo"],
};

const FAMILIA_KIALA = ["p-maria", "p-tiago", "p-luena", "p-domingos"];

export function criarSemente(agora: Date): EstadoDemo {
  const hojeD = hoje(agora);
  const agoraMs = agora.getTime();
  const rnd = gerador(Number(hojeD.replace(/-/g, "")));
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)];
  let seq = 0;
  const id = (prefixo: string) => `${prefixo}-${(++seq).toString(36).padStart(4, "0")}`;
  const iso = (ms: number) => new Date(ms).toISOString();
  const HORA = 3_600_000;
  const DIA = 24 * HORA;

  const clinica: Clinica = {
    nome: "Clínica Sagrada Esperança",
    endereco: "Avenida Mortala Mohamed",
    cidade: "Ilha de Luanda, Luanda",
    telefone: "923000000",
    whatsapp: "923000000",
    email: "marcacoes@sagradaesperanca.ao",
    horario: "Segunda a sexta, das 07:30 às 19:00\nSábado, das 08:00 às 13:00",
    latitude: -8.7925,
    longitude: 13.2236,
  };

  const medicos: Medico[] = MEDICOS.map(([mid, titulo, nome, esp, dur, tel, activo]) => ({
    id: mid,
    userId: mid === "m-joao" ? CONTAS_DEMO.medico.id : null,
    titulo,
    nome,
    especialidadeId: esp,
    telefone: tel,
    email: `${nome.split(" ")[0].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}@sagradaesperanca.ao`,
    fotoUrl: null,
    activo: activo ?? true,
    duracaoMin: dur,
    podeEditarDisponibilidade: mid === "m-joao",
  }));

  const horarios: HorarioTrabalho[] = HORARIOS.flatMap(([medicoId, dias, inicio, fim]) =>
    dias.map((diaSemana) => ({ id: id("h"), medicoId, diaSemana, inicio, fim })),
  );

  const trabalha = (medicoId: string, dia: Dia) => horarios.some((h) => h.medicoId === medicoId && h.diaSemana === diaDaSemana(dia));
  const proximoDiaDe = (medicoId: string, aPartirDe: Dia, sentido = 1) => {
    let d = aPartirDe;
    for (let i = 0; i < 14 && !trabalha(medicoId, d); i++) d = somarDias(d, sentido);
    return d;
  };

  // ---------------- Bloqueios ----------------
  const diaReuniao = proximoDiaDe("m-joao", somarDias(hojeD, 2));
  const diaFormacao = proximoDiaDe("m-maria", somarDias(hojeD, 3));
  const bloqueios: Bloqueio[] = [
    { id: id("b"), medicoId: "m-helena", inicio: instanteISO(hojeD, "00:00"), fim: instanteISO(somarDias(hojeD, 7), "00:00"), motivo: "ferias", nota: "Regressa na próxima semana" },
    { id: id("b"), medicoId: "m-joao", inicio: instanteISO(diaReuniao, "10:00"), fim: instanteISO(diaReuniao, "11:00"), motivo: "reuniao", nota: "Reunião clínica de cardiologia" },
    { id: id("b"), medicoId: "m-maria", inicio: instanteISO(diaFormacao, "15:00"), fim: instanteISO(diaFormacao, "16:00"), motivo: "ausencia", nota: "Formação no Hospital Pediátrico" },
  ];
  for (let i = 0; i <= 30; i++) {
    const d = somarDias(hojeD, i);
    const feriado = FERIADOS_ANGOLA.find(([md]) => d.slice(5) === md);
    if (feriado) {
      bloqueios.push({ id: id("b"), medicoId: null, inicio: instanteISO(d, "00:00"), fim: instanteISO(somarDias(d, 1), "00:00"), motivo: "feriado", nota: feriado[1] });
      break;
    }
  }

  // ---------------- Pacientes ----------------
  const pacientes: Paciente[] = [];
  const familiares: Familiar[] = [];
  const criadoHa = (dias: number) => iso(agoraMs - dias * DIA);

  pacientes.push(
    { id: "p-maria", userId: CONTAS_DEMO.paciente.id, nome: "Maria Kiala", telefone: "923456781", dataNascimento: "1991-05-12", lembreteWhatsapp: true, criadoEm: criadoHa(200) },
    { id: "p-tiago", userId: null, nome: "Tiago Kiala", telefone: "923456781", dataNascimento: "2019-03-08", lembreteWhatsapp: false, criadoEm: criadoHa(180) },
    { id: "p-luena", userId: null, nome: "Luena Kiala", telefone: "923456781", dataNascimento: "2022-01-20", lembreteWhatsapp: false, criadoEm: criadoHa(180) },
    { id: "p-domingos", userId: null, nome: "Domingos Kiala", telefone: "924318870", dataNascimento: "1988-11-02", lembreteWhatsapp: false, criadoEm: criadoHa(120) },
  );
  familiares.push(
    { id: "f-tiago", titularId: "p-maria", pacienteId: "p-tiago", parentesco: "filho" },
    { id: "f-luena", titularId: "p-maria", pacienteId: "p-luena", parentesco: "filha" },
    { id: "f-domingos", titularId: "p-maria", pacienteId: "p-domingos", parentesco: "esposo" },
  );

  const usados = new Set(pacientes.map((p) => p.nome));
  while (pacientes.length < 64) {
    const nome = `${escolher(NOMES)} ${escolher(APELIDOS)}`;
    if (usados.has(nome)) continue;
    usados.add(nome);
    const ano = 1950 + Math.floor(rnd() * 70);
    pacientes.push({
      id: id("p"),
      userId: null,
      nome,
      telefone: `9${escolher(["23", "24", "25", "27", "29", "31", "33", "35", "36", "37", "38", "44", "46", "48"])}${String(Math.floor(rnd() * 1_000_000)).padStart(6, "0")}`,
      dataNascimento: `${ano}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
      lembreteWhatsapp: rnd() < 0.6,
      criadoEm: criadoHa(10 + Math.floor(rnd() * 400)),
    });
  }
  const outrosPacientes = pacientes.filter((p) => !FAMILIA_KIALA.includes(p.id));

  // ---------------- Consultas ----------------
  const consultas: Consulta[] = [];
  const medicoPorId = new Map(medicos.map((m) => [m.id, m]));
  const reservadas = new Set<string>();
  const chave = (medicoId: string, inicio: string) => `${medicoId}|${inicio}`;

  const nova = (p: Partial<Consulta> & Pick<Consulta, "pacienteId" | "medicoId" | "inicio" | "estado">): Consulta => {
    const m = medicoPorId.get(p.medicoId)!;
    const inicioMs = Date.parse(p.inicio);
    const criadaEm = p.criadaEm ?? iso(Math.min(agoraMs - HORA, inicioMs - (1 + Math.floor(rnd() * 12)) * DIA));
    const c: Consulta = {
      id: p.id ?? id("c"),
      pacienteId: p.pacienteId,
      medicoId: p.medicoId,
      especialidadeId: m.especialidadeId,
      inicio: p.inicio,
      fim: somarMinutos(p.inicio, m.duracaoMin),
      estado: p.estado,
      observacao: p.observacao ?? (rnd() < 0.55 ? escolher(OBSERVACOES[m.especialidadeId]) : ""),
      canal: p.canal ?? (escolher(["app", "app", "app", "rececao", "rececao", "telefone", "whatsapp"]) as Canal),
      marcadaPor: null,
      criadaEm,
      confirmadaEm: ["confirmada", "em_atendimento", "concluida", "faltou"].includes(p.estado) ? iso(Math.min(agoraMs, Date.parse(criadaEm) + 6 * HORA)) : null,
      canceladaEm: p.estado === "cancelada" ? (p.canceladaEm ?? iso(Math.min(agoraMs - HORA, inicioMs - DIA))) : null,
      reagendadaDe: null,
    };
    consultas.push(c);
    if (c.estado !== "cancelada") reservadas.add(chave(c.medicoId, c.inicio));
    return c;
  };

  // As consultas da família Kiala (a conta de paciente da demonstração).
  const diaJoao = proximoDiaDe("m-joao", somarDias(hojeD, 4));
  const proximaMaria = nova({ id: "c-maria-cardio", pacienteId: "p-maria", medicoId: "m-joao", inicio: instanteISO(diaJoao, "14:30"), estado: "confirmada", canal: "app", observacao: "Palpitações ao fim do dia", criadaEm: iso(agoraMs - 3 * DIA) });
  const diaTiago = proximoDiaDe("m-maria", somarDias(hojeD, 9));
  const consultaTiago = nova({ id: "c-tiago-pediatria", pacienteId: "p-tiago", medicoId: "m-maria", inicio: instanteISO(diaTiago, "10:00"), estado: "aguardando", canal: "app", observacao: "Tosse que não passa", criadaEm: iso(agoraMs - 20 * HORA) });
  const consultaAna = nova({ pacienteId: "p-maria", medicoId: "m-ana", inicio: instanteISO(proximoDiaDe("m-ana", somarDias(hojeD, -30), -1), "09:00"), estado: "concluida", canal: "app", observacao: "Consulta de rotina" });
  nova({ pacienteId: "p-luena", medicoId: "m-mateus", inicio: instanteISO(proximoDiaDe("m-mateus", somarDias(hojeD, -45), -1), "09:00"), estado: "concluida", canal: "rececao", observacao: "Consulta dos 3 anos" });
  const canceladaMaria = nova({ pacienteId: "p-maria", medicoId: "m-nelson", inicio: instanteISO(proximoDiaDe("m-nelson", somarDias(hojeD, -12), -1), "10:00"), estado: "cancelada", canal: "app", observacao: "Manchas na pele" });
  nova({ pacienteId: "p-domingos", medicoId: "m-adriano", inicio: instanteISO(proximoDiaDe("m-adriano", somarDias(hojeD, -20), -1), "14:30"), estado: "faltou", canal: "telefone", observacao: "Dor nas costas" });

  // A vaga que abriu para a Maria na lista de espera de dermatologia.
  const diaEspera = proximoDiaDe("m-nelson", somarDias(hojeD, 2));
  const inicioVaga = instanteISO(diaEspera, "10:30");
  nova({ pacienteId: outrosPacientes[3].id, medicoId: "m-nelson", inicio: inicioVaga, estado: "cancelada", canal: "app", canceladaEm: iso(agoraMs - 3 * HORA) });
  reservadas.add(chave("m-nelson", inicioVaga)); // não voltar a encher esta vaga

  // O dia seguinte do Dr. João fica cheio, para se ver a lista de espera.
  const diaCheioJoao = proximoDiaDe("m-joao", somarDias(hojeD, 1));

  const indisponiveisBloqueio = bloqueios.map((b) => ({ medicoId: b.medicoId, inicio: b.inicio, fim: b.fim, tipo: "bloqueio" as const }));

  for (let d = -90; d <= 21; d++) {
    const dia = somarDias(hojeD, d);
    for (const m of medicos) {
      if (!m.activo && d >= 0) continue;
      const vagas = vagasDoDia({ medico: m, horarios, indisponiveis: indisponiveisBloqueio, agora: new Date(0) }, dia).filter((v) => v.estado === "livre");
      let taxa = d < 0 ? 0.38 : d === 0 ? 0.5 : d <= 3 ? 0.46 : d <= 7 ? 0.32 : d <= 14 ? 0.16 : 0.06;
      if ((m.id === "m-joao" && dia === diaCheioJoao) || (m.id === "m-nelson" && dia === diaEspera)) taxa = 1;

      for (const v of vagas) {
        if (reservadas.has(chave(m.id, v.inicio)) || rnd() > taxa) continue;
        const ini = Date.parse(v.inicio);
        const fim = Date.parse(v.fim);
        const r = rnd();
        let estado: EstadoConsulta;
        if (fim <= agoraMs) estado = r < 0.07 ? "cancelada" : r < 0.13 ? "faltou" : "concluida";
        else if (ini <= agoraMs) estado = "em_atendimento";
        else if (taxa === 1) estado = r < 0.3 ? "aguardando" : "confirmada";
        else if (d === 0) estado = r < 0.06 ? "cancelada" : r < 0.2 ? "aguardando" : "confirmada";
        else estado = r < 0.06 ? "cancelada" : r < (d <= 2 ? 0.28 : 0.5) ? "aguardando" : "confirmada";
        nova({ pacienteId: escolher(outrosPacientes).id, medicoId: m.id, inicio: v.inicio, estado });
      }
    }
  }
  consultas.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  // ---------------- Lista de espera ----------------
  const espera: EntradaEspera[] = [
    { id: "e-maria", pacienteId: "p-maria", especialidadeId: "esp-dermato", medicoId: "m-nelson", dataDesejada: diaEspera, estado: "activa", criadaEm: iso(agoraMs - 26 * HORA), ultimaVaga: inicioVaga, vagasOferecidas: 1 },
    { id: id("e"), pacienteId: outrosPacientes[7].id, especialidadeId: "esp-cardio", medicoId: "m-joao", dataDesejada: diaCheioJoao, estado: "activa", criadaEm: iso(agoraMs - 30 * HORA), ultimaVaga: null, vagasOferecidas: 0 },
    { id: id("e"), pacienteId: outrosPacientes[12].id, especialidadeId: "esp-cardio", medicoId: null, dataDesejada: diaCheioJoao, estado: "activa", criadaEm: iso(agoraMs - 9 * HORA), ultimaVaga: null, vagasOferecidas: 0 },
    { id: id("e"), pacienteId: outrosPacientes[18].id, especialidadeId: "esp-odonto", medicoId: "m-luisa", dataDesejada: somarDias(hojeD, 1), estado: "activa", criadaEm: iso(agoraMs - 50 * HORA), ultimaVaga: null, vagasOferecidas: 0 },
    { id: id("e"), pacienteId: outrosPacientes[25].id, especialidadeId: "esp-gineco", medicoId: null, dataDesejada: proximoDiaDe("m-isabel", somarDias(hojeD, 1)), estado: "activa", criadaEm: iso(agoraMs - 4 * HORA), ultimaVaga: null, vagasOferecidas: 0 },
  ];

  // ---------------- Notificações ----------------
  const notificacoes: Notificacao[] = [];
  const notificar = (userId: string, tipo: Notificacao["tipo"], t: { titulo: string; corpo: string }, quando: number, extra: Partial<Notificacao> = {}) =>
    notificacoes.push({
      id: id("n"),
      userId,
      tipo,
      titulo: t.titulo,
      corpo: t.corpo,
      consultaId: null,
      canal: "app",
      agendadaPara: iso(quando),
      enviadaEm: quando <= agoraMs ? iso(quando) : null,
      lidaEm: null,
      dados: null,
      ...extra,
    });
  const nomeM = (mid: string) => `${medicoPorId.get(mid)!.titulo} ${medicoPorId.get(mid)!.nome}`;
  const u = CONTAS_DEMO.paciente.id;

  notificar(u, "lembrete", textos.lembrete24h({ medico: nomeM("m-ana"), inicio: consultaAna.inicio, clinica: clinica.nome }), Date.parse(consultaAna.inicio) - DIA, { consultaId: consultaAna.id, lidaEm: consultaAna.inicio });
  notificar(u, "cancelamento", textos.cancelamento({ medico: nomeM("m-nelson"), inicio: canceladaMaria.inicio }), Date.parse(canceladaMaria.canceladaEm!), { consultaId: canceladaMaria.id, lidaEm: canceladaMaria.canceladaEm });
  notificar(u, "confirmacao", textos.confirmacao({ medico: nomeM("m-joao"), inicio: proximaMaria.inicio }), agoraMs - 2 * DIA, { consultaId: proximaMaria.id, lidaEm: iso(agoraMs - 2 * DIA + HORA) });
  notificar(u, "marcacao", textos.marcacao({ medico: nomeM("m-maria"), inicio: consultaTiago.inicio, paciente: "Tiago" }), Date.parse(consultaTiago.criadaEm), { consultaId: consultaTiago.id, lidaEm: iso(Date.parse(consultaTiago.criadaEm) + 60_000) });
  notificar(u, "vaga", textos.vaga({ medico: nomeM("m-nelson"), inicio: inicioVaga }), agoraMs - 3 * HORA, { dados: { medicoId: "m-nelson", especialidadeId: "esp-dermato", inicio: inicioVaga } });
  // Lembretes futuros da próxima consulta (aparecem 24 horas antes).
  const lembrete = textos.lembrete24h({ medico: nomeM("m-joao"), inicio: proximaMaria.inicio, clinica: clinica.nome });
  notificar(u, "lembrete", lembrete, Date.parse(proximaMaria.inicio) - DIA, { consultaId: proximaMaria.id });
  notificar(u, "lembrete", lembrete, Date.parse(proximaMaria.inicio) - DIA, { consultaId: proximaMaria.id, canal: "whatsapp" });

  // A receção recebe as marcações feitas pela aplicação nas últimas horas.
  consultas
    .filter((c) => c.canal === "app" && c.estado === "aguardando" && Date.parse(c.inicio) > agoraMs && !FAMILIA_KIALA.includes(c.pacienteId))
    .slice(0, 4)
    .forEach((c, i) => {
      const quando = agoraMs - (i + 1) * 47 * 60_000;
      c.criadaEm = iso(quando);
      const paciente = pacientes.find((p) => p.id === c.pacienteId)!;
      notificar(CONTAS_DEMO.rececao.id, "marcacao", textos.novaMarcacaoApp({ medico: nomeM(c.medicoId), inicio: c.inicio, pacienteNome: paciente.nome }), quando, {
        consultaId: c.id,
        lidaEm: i > 1 ? iso(quando + 600_000) : null,
      });
    });

  const utilizadores: UtilizadorDemo[] = [
    { id: CONTAS_DEMO.paciente.id, papel: "paciente", nome: "Maria Kiala", email: CONTAS_DEMO.paciente.email, telefone: "923456781", pacienteId: "p-maria", medicoId: null, senha: CONTAS_DEMO.senha },
    { id: CONTAS_DEMO.rececao.id, papel: "rececao", nome: "Teresa Sambo", email: CONTAS_DEMO.rececao.email, telefone: "923000010", pacienteId: null, medicoId: null, senha: CONTAS_DEMO.senha },
    { id: CONTAS_DEMO.medico.id, papel: "medico", nome: "João Silva", email: CONTAS_DEMO.medico.email, telefone: "923111204", pacienteId: null, medicoId: "m-joao", senha: CONTAS_DEMO.senha },
  ];

  return {
    esquema: ESQUEMA_DEMO,
    versao: 1,
    criadoEm: agora.toISOString(),
    ultimaMudanca: [],
    utilizadores,
    clinica,
    especialidades: ESPECIALIDADES,
    medicos,
    horarios,
    bloqueios,
    pacientes,
    familiares,
    consultas,
    notificacoes,
    espera,
  };
}

/** Avança a demonstração em semanas inteiras, para que os dias da semana batam certo. */
export function ajustarAoCalendario(e: EstadoDemo, agora: Date): boolean {
  const dias = Math.round((Date.parse(instanteISO(hoje(agora), "00:00")) - Date.parse(instanteISO(diaDe(e.criadoEm), "00:00"))) / 86_400_000);
  const semanas = Math.floor(dias / 7);
  if (semanas <= 0) return false;
  const delta = semanas * 7 * 86_400_000;
  const mover = (v: string | null) => (v ? new Date(Date.parse(v) + delta).toISOString() : v);

  e.criadoEm = mover(e.criadoEm)!;
  for (const c of e.consultas) {
    c.inicio = mover(c.inicio)!;
    c.fim = mover(c.fim)!;
    c.criadaEm = mover(c.criadaEm)!;
    c.confirmadaEm = mover(c.confirmadaEm);
    c.canceladaEm = mover(c.canceladaEm);
    c.reagendadaDe = mover(c.reagendadaDe);
  }
  for (const b of e.bloqueios) {
    b.inicio = mover(b.inicio)!;
    b.fim = mover(b.fim)!;
  }
  for (const n of e.notificacoes) {
    n.agendadaPara = mover(n.agendadaPara)!;
    n.enviadaEm = mover(n.enviadaEm);
    n.lidaEm = mover(n.lidaEm);
    if (n.dados?.inicio) n.dados.inicio = mover(n.dados.inicio)!;
  }
  for (const x of e.espera) {
    x.dataDesejada = somarDias(x.dataDesejada, semanas * 7);
    x.criadaEm = mover(x.criadaEm)!;
    x.ultimaVaga = mover(x.ultimaVaga);
  }
  return true;
}
