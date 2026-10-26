import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Botao, Carregando } from './components/ui';
import { Marca } from './components/comuns';
import Login from './pages/Login';
import RedefinirSenha from './pages/RedefinirSenha';
import ClienteInicio from './pages/cliente/ClienteInicio';
import Solicitar from './pages/cliente/Solicitar';
import PainelLayout from './pages/painel/PainelLayout';
import Solicitacoes from './pages/painel/Solicitacoes';
import Agenda from './pages/painel/Agenda';
import Clientes from './pages/painel/Clientes';
import Bloqueios from './pages/painel/Bloqueios';
import Configuracoes from './pages/painel/Configuracoes';

function SemAcesso() {
  const { sair } = useAuth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Marca />
      <h1 className="titulo text-2xl font-extrabold">Seu acesso não está ativo</h1>
      <p className="max-w-sm text-sm text-apagado">
        Seu cadastro foi desativado ou ainda não foi liberado. Fale com a equipe da G7 para reativar.
      </p>
      <Botao variante="secundario" onClick={sair}>
        Sair
      </Botao>
    </main>
  );
}

function Protegida({ papel, children }: { papel: 'admin' | 'cliente'; children: ReactNode }) {
  const { sessao, papel: atual, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/login" replace />;
  if (!atual) return <SemAcesso />;
  if (atual !== papel) return <Navigate to={atual === 'admin' ? '/painel' : '/'} replace />;
  return <>{children}</>;
}

function RotaLogin() {
  const { sessao, papel, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (sessao && papel) return <Navigate to={papel === 'admin' ? '/painel' : '/'} replace />;
  if (sessao && !papel) return <SemAcesso />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RotaLogin />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/" element={<Protegida papel="cliente"><ClienteInicio /></Protegida>} />
      <Route path="/solicitar" element={<Protegida papel="cliente"><Solicitar /></Protegida>} />
      <Route path="/painel" element={<Protegida papel="admin"><PainelLayout /></Protegida>}>
        <Route index element={<Solicitacoes />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="bloqueios" element={<Bloqueios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
