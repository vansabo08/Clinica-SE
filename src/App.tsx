import { lazy } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { ProvedorAvisos } from "./componentes/Aviso";
import { EcraArranque, ShellClinica, ShellPaciente } from "./componentes/Shell";
import { casaDoPapel } from "./lib/rotas";
import { ProvedorSessao, useSessao } from "./lib/sessao";
import type { Papel } from "./lib/tipos";

// O paciente é quem abre a aplicação no telemóvel: as páginas dele vêm no
// primeiro pacote. As da receção e do médico só se carregam quando precisas.
import { Entrar } from "./paginas/Entrar";
// Estática de propósito: lê o endereço do link de recuperação logo no arranque.
import { NovaSenha } from "./paginas/NovaSenha";
import { Inicio } from "./paginas/paciente/Inicio";
import { Marcar } from "./paginas/paciente/Marcar";

const nomeado = <T extends Record<string, unknown>>(carregar: () => Promise<T>, nome: keyof T) =>
  lazy(() => carregar().then((m) => ({ default: m[nome] as React.ComponentType })));

const Consultas = nomeado(() => import("./paginas/paciente/Consultas"), "Consultas");
const ConsultaPaciente = nomeado(() => import("./paginas/paciente/ConsultaPaciente"), "ConsultaPaciente");
const Notificacoes = nomeado(() => import("./paginas/Notificacoes"), "Notificacoes");
const Perfil = nomeado(() => import("./paginas/paciente/Perfil"), "Perfil");
const Familiares = nomeado(() => import("./paginas/paciente/Familiares"), "Familiares");
const ListaEsperaPaciente = nomeado(() => import("./paginas/paciente/ListaEspera"), "ListaEsperaPaciente");
const ClinicaInfo = nomeado(() => import("./paginas/paciente/Clinica"), "ClinicaInfo");

const Agenda = nomeado(() => import("./paginas/rececao/Agenda"), "Agenda");
const Pacientes = nomeado(() => import("./paginas/rececao/Pacientes"), "Pacientes");
const Medicos = nomeado(() => import("./paginas/rececao/Medicos"), "Medicos");
const MedicoDetalhe = nomeado(() => import("./paginas/rececao/MedicoDetalhe"), "MedicoDetalhe");
const Especialidades = nomeado(() => import("./paginas/rececao/Especialidades"), "Especialidades");
const ListaEsperaRececao = nomeado(() => import("./paginas/rececao/ListaEspera"), "ListaEsperaRececao");
const Estatisticas = nomeado(() => import("./paginas/rececao/Estatisticas"), "Estatisticas");
const DefinicoesClinica = nomeado(() => import("./paginas/rececao/DefinicoesClinica"), "DefinicoesClinica");

const Hoje = nomeado(() => import("./paginas/medico/Hoje"), "Hoje");
const AgendaMedico = nomeado(() => import("./paginas/medico/AgendaMedico"), "AgendaMedico");
const Disponibilidade = nomeado(() => import("./paginas/medico/Disponibilidade"), "Disponibilidade");

function Guarda({ papeis }: { papeis: Papel[] }) {
  const { utilizador, aCarregar } = useSessao();
  const { pathname, search } = useLocation();
  if (aCarregar) return <EcraArranque />;
  if (!utilizador) return <Navigate to="/entrar" replace state={{ de: pathname + search }} />;
  if (!papeis.includes(utilizador.papel)) return <Navigate to={casaDoPapel(utilizador.papel)} replace />;
  return <Outlet />;
}

function Inicial() {
  const { utilizador, aCarregar } = useSessao();
  if (aCarregar) return <EcraArranque />;
  return <Navigate to={utilizador ? casaDoPapel(utilizador.papel) : "/entrar"} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <ProvedorAvisos>
          <Routes>
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/nova-palavra-passe" element={<NovaSenha />} />

            <Route element={<Guarda papeis={["paciente"]} />}>
              <Route element={<ShellPaciente />}>
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/marcar" element={<Marcar />} />
                <Route path="/consultas" element={<Consultas />} />
                <Route path="/consultas/:id" element={<ConsultaPaciente />} />
                <Route path="/notificacoes" element={<Notificacoes />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/familiares" element={<Familiares />} />
                <Route path="/lista-de-espera" element={<ListaEsperaPaciente />} />
                <Route path="/clinica" element={<ClinicaInfo />} />
              </Route>
            </Route>

            <Route element={<Guarda papeis={["rececao", "admin"]} />}>
              <Route element={<ShellClinica tipo="equipa" />}>
                <Route path="/rececao" element={<Agenda />} />
                <Route path="/rececao/pacientes" element={<Pacientes />} />
                <Route path="/rececao/medicos" element={<Medicos />} />
                <Route path="/rececao/medicos/:id" element={<MedicoDetalhe />} />
                <Route path="/rececao/especialidades" element={<Especialidades />} />
                <Route path="/rececao/lista-de-espera" element={<ListaEsperaRececao />} />
                <Route path="/rececao/estatisticas" element={<Estatisticas />} />
                <Route path="/rececao/notificacoes" element={<Notificacoes />} />
                <Route path="/rececao/clinica" element={<DefinicoesClinica />} />
              </Route>
            </Route>

            <Route element={<Guarda papeis={["medico"]} />}>
              <Route element={<ShellClinica tipo="medico" />}>
                <Route path="/medico" element={<Hoje />} />
                <Route path="/medico/agenda" element={<AgendaMedico />} />
                <Route path="/medico/disponibilidade" element={<Disponibilidade />} />
              </Route>
            </Route>

            <Route path="*" element={<Inicial />} />
          </Routes>
        </ProvedorAvisos>
      </ProvedorSessao>
    </BrowserRouter>
  );
}
