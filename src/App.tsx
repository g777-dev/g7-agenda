import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Botao, Carregando } from './components/ui';
import { Marca } from './components/comuns';
import type { Papel } from './lib/tipos';
import Login from './pages/Login';
import ClienteInicio from './pages/cliente/ClienteInicio';
import Solicitar from './pages/cliente/Solicitar';
import PainelLayout from './pages/painel/PainelLayout';
import Solicitacoes from './pages/painel/Solicitacoes';
import Agenda from './pages/painel/Agenda';
import Janelas from './pages/painel/Janelas';
import Clientes from './pages/painel/Clientes';
import Bloqueios from './pages/painel/Bloqueios';
import Configuracoes from './pages/painel/Configuracoes';

function SemAcesso() {
  const { sair } = useAuth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Marca />
      <h1 className="titulo text-2xl font-bold">Seu acesso não está ativo</h1>
      <p className="max-w-sm text-sm text-apagado">Fale com a equipe G7 para reativar o seu acesso.</p>
      <Botao variante="secundario" onClick={sair}>
        Sair
      </Botao>
    </main>
  );
}

function Protegida({ papel, children }: { papel: Papel; children: ReactNode }) {
  const { sessao, papel: atual, carregando } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to={`/login?voltar=${encodeURIComponent(local.pathname)}`} replace />;
  if (!atual) return <SemAcesso />;
  if (atual !== papel) return <Navigate to={atual === 'admin' ? '/painel' : '/'} replace />;
  return <>{children}</>;
}

function RotaLogin() {
  const { sessao, papel, carregando } = useAuth();
  const [parametros] = useSearchParams();
  if (carregando) return <Carregando />;
  if (sessao && papel) {
    // Cliente que abriu o link de agendamento antes de entrar volta para ele
    const voltar = parametros.get('voltar');
    if (papel === 'cliente' && voltar?.startsWith('/agendar')) return <Navigate to={voltar} replace />;
    return <Navigate to={papel === 'admin' ? '/painel' : '/'} replace />;
  }
  if (sessao && !papel) return <SemAcesso />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RotaLogin />} />
      <Route path="/" element={<Protegida papel="cliente"><ClienteInicio /></Protegida>} />
      <Route path="/agendar" element={<Protegida papel="cliente"><Solicitar /></Protegida>} />
      <Route path="/agendar/:mes" element={<Protegida papel="cliente"><Solicitar /></Protegida>} />
      <Route path="/solicitar" element={<Navigate to="/agendar" replace />} />
      <Route path="/painel" element={<Protegida papel="admin"><PainelLayout /></Protegida>}>
        <Route index element={<Solicitacoes />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="janelas" element={<Janelas />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="bloqueios" element={<Bloqueios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
