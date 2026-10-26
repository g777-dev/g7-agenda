import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Ban, CalendarDays, Inbox, LogOut, Settings, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTempoReal } from '../../lib/dados';
import { Marca } from '../../components/comuns';

export default function PainelLayout() {
  const { nomeEquipe, sair } = useAuth();
  const [pendencias, setPendencias] = useState(0);

  const contar = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('pedidos_alteracao').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    ]);
    setPendencias((s.count ?? 0) + (p.count ?? 0));
  }, []);

  useEffect(() => {
    contar();
  }, [contar]);
  useTempoReal(['solicitacoes', 'pedidos_alteracao'], contar);

  const itens = [
    { para: '/painel', fim: true, texto: 'Solicitações', Icone: Inbox, contador: pendencias },
    { para: '/painel/agenda', texto: 'Agenda', Icone: CalendarDays },
    { para: '/painel/clientes', texto: 'Clientes', Icone: Users },
    { para: '/painel/bloqueios', texto: 'Bloqueios', Icone: Ban },
    { para: '/painel/configuracoes', texto: 'Equipe e ajustes', Icone: Settings },
  ];

  const estiloLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
      isActive ? 'bg-tinta text-superficie' : 'text-apagado hover:bg-superficie2 hover:text-tinta'
    }`;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-30 border-b border-linha bg-superficie lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Marca subtitulo="Painel da equipe" />
          <button onClick={sair} className="rounded-md p-2 text-apagado hover:bg-superficie2 hover:text-tinta lg:hidden cursor-pointer" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0" aria-label="Painel">
          {itens.map(({ para, fim, texto, Icone, contador }) => (
            <NavLink key={para} to={para} end={fim} className={estiloLink}>
              <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className="flex-1">{texto}</span>
              {!!contador && (
                <span className="numeros min-w-[22px] rounded-full bg-ambar px-1.5 py-0.5 text-center text-xs font-bold text-[#0F172A]" aria-label={`${contador} pendentes`}>
                  {contador}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-linha p-4 lg:block">
          <p className="truncate text-sm font-semibold">{nomeEquipe}</p>
          <button onClick={sair} className="mt-2 flex items-center gap-2 text-sm text-apagado hover:text-tinta cursor-pointer">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
