import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Ban, CalendarDays, CalendarRange, Inbox, LogOut, Settings, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTempoReal } from '../../lib/dados';
import { prepararSom, removerInscricao, renovarInscricao, tocarSom } from '../../lib/aparelho';
import { IconeNotificacoes, ModalAparelho, useNotificacoes } from '../../components/Aparelho';
import { Marca } from '../../components/comuns';
import { useToast } from '../../components/ui';

export default function PainelLayout() {
  const { nomeEquipe, sair } = useAuth();
  const { mostrar } = useToast();
  const [pendencias, setPendencias] = useState(0);
  const [aparelhoAberto, setAparelhoAberto] = useState(false);
  const { estado, setEstado } = useNotificacoes();

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

  // Aviso na tela (com som) quando chega pedido novo
  const avisar = useCallback(
    async (tipo: 'solicitacao' | 'pedido', registro: { cliente_id?: string | null; tipo?: string }) => {
      const { data } = await supabase
        .from('clientes')
        .select('empresa')
        .eq('id', registro.cliente_id ?? '')
        .maybeSingle();
      const empresa = (data as { empresa: string } | null)?.empresa ?? 'Um cliente';
      tocarSom();
      mostrar(
        tipo === 'solicitacao'
          ? `${empresa} pediu horário`
          : `${empresa} pediu para ${registro.tipo === 'cancelamento' ? 'cancelar' : 'remarcar'}`,
      );
    },
    [mostrar],
  );

  useEffect(() => {
    const canal = supabase
      .channel(`avisos-equipe-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacoes' }, (p) =>
        avisar('solicitacao', p.new as { cliente_id?: string | null }),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_alteracao' }, (p) =>
        avisar('pedido', p.new as { cliente_id?: string | null; tipo?: string }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [avisar]);

  useEffect(() => {
    renovarInscricao();
    const liberarSom = () => prepararSom();
    document.addEventListener('pointerdown', liberarSom, { once: true });
    return () => document.removeEventListener('pointerdown', liberarSom);
  }, []);

  const deslogar = async () => {
    await removerInscricao().catch(() => {});
    await sair();
  };

  const itens = [
    { para: '/painel', fim: true, texto: 'Solicitações', Icone: Inbox, contador: pendencias },
    { para: '/painel/agenda', texto: 'Agenda', Icone: CalendarDays },
    { para: '/painel/janelas', texto: 'Janelas', Icone: CalendarRange },
    { para: '/painel/clientes', texto: 'Clientes', Icone: Users },
    { para: '/painel/bloqueios', texto: 'Bloqueios', Icone: Ban },
    { para: '/painel/configuracoes', texto: 'Equipe e ajustes', Icone: Settings },
  ];

  const classeLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
      isActive ? 'bg-azul text-sobre' : 'text-apagado hover:bg-superficie2 hover:text-tinta'
    }`;

  const desligadas = estado !== null && estado !== 'ativo';

  const botaoNotificacoes = (
    <button
      onClick={() => setAparelhoAberto(true)}
      className="relative rounded-md p-2 text-apagado hover:bg-superficie2 hover:text-tinta cursor-pointer"
      aria-label={desligadas ? 'Notificações desligadas: ligar' : 'Notificações e app'}
    >
      <IconeNotificacoes estado={estado} />
      {desligadas && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ambar" aria-hidden />}
    </button>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-30 border-b border-linha bg-superficie lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Marca subtitulo="Painel da equipe" />
          <div className="flex items-center gap-1 lg:hidden">
            {botaoNotificacoes}
            <button
              onClick={deslogar}
              className="rounded-md p-2 text-apagado hover:bg-superficie2 hover:text-tinta cursor-pointer"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0" aria-label="Painel">
          {itens.map(({ para, fim, texto, Icone, contador }) => (
            <NavLink key={para} to={para} end={fim} className={classeLink}>
              <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className="flex-1">{texto}</span>
              {!!contador && (
                <span
                  className="numeros min-w-[22px] rounded-full bg-ambar px-1.5 py-0.5 text-center text-xs font-bold text-[#0A0A0A]"
                  aria-label={`${contador} pendentes`}
                >
                  {contador}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-linha p-4 lg:block">
          <button
            onClick={() => setAparelhoAberto(true)}
            className="mb-3 flex w-full items-center gap-2 rounded-lg border border-linha px-3 py-2 text-left text-sm font-semibold hover:bg-superficie2 cursor-pointer"
          >
            <IconeNotificacoes estado={estado} />
            <span className="flex-1">{desligadas ? 'Ligar notificações' : 'Notificações ligadas'}</span>
            {desligadas && <span className="h-2 w-2 rounded-full bg-ambar" aria-hidden />}
          </button>
          <p className="truncate text-sm font-semibold">{nomeEquipe}</p>
          <button
            onClick={deslogar}
            className="mt-2 flex items-center gap-2 text-sm text-apagado hover:text-tinta cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <ModalAparelho
        aberto={aparelhoAberto}
        aoFechar={() => setAparelhoAberto(false)}
        estado={estado}
        aoMudarEstado={setEstado}
      />
    </div>
  );
}
