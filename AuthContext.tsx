import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Cliente } from '../lib/tipos';

type Papel = 'admin' | 'cliente' | null;

interface AuthEstado {
  sessao: Session | null;
  papel: Papel;
  cliente: Cliente | null;
  nomeEquipe: string | null;
  carregando: boolean;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const AuthCtx = createContext<AuthEstado | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [papel, setPapel] = useState<Papel>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nomeEquipe, setNomeEquipe] = useState<string | null>(null);
  const [perfilPronto, setPerfilPronto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setSessaoPronta(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova);
      setSessaoPronta(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const usuarioId = sessao?.user.id ?? null;
  const email = sessao?.user.email?.toLowerCase() ?? null;

  const carregarPerfil = useCallback(async () => {
    if (!usuarioId) {
      setPapel(null);
      setCliente(null);
      setNomeEquipe(null);
      setPerfilPronto(true);
      return;
    }
    const { data: papeis } = await supabase.from('user_roles').select('role').eq('user_id', usuarioId);
    const lista = (papeis ?? []).map((p: { role: string }) => p.role);

    if (lista.includes('admin')) {
      const { data: membro } = await supabase.from('equipe').select('nome').eq('email', email ?? '').maybeSingle();
      setPapel('admin');
      setNomeEquipe(membro?.nome ?? email);
      setCliente(null);
    } else if (lista.includes('cliente')) {
      const { data: c } = await supabase.from('clientes').select('*').eq('user_id', usuarioId).maybeSingle();
      setPapel(c && c.ativo ? 'cliente' : null);
      setCliente(c ?? null);
      setNomeEquipe(null);
    } else {
      setPapel(null);
      setCliente(null);
    }
    setPerfilPronto(true);
  }, [usuarioId, email]);

  useEffect(() => {
    setPerfilPronto(false);
    carregarPerfil();
  }, [carregarPerfil]);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        sessao,
        papel,
        cliente,
        nomeEquipe,
        carregando: !sessaoPronta || !perfilPronto,
        recarregarPerfil: carregarPerfil,
        sair,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
