import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Carregando } from '../components/ui';

/**
 * Entrada automática pelo G7 OS: o G7 OS abre /entrar-g7#g7at=...&g7rt=... (sessão gerada pela edge function
 * sso-g7os). Aqui a sessão é ativada e a pessoa vai direto pro painel. Se algo falhar, cai no login normal.
 */
export default function EntrarG7() {
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get('g7at');
    const refresh_token = hash.get('g7rt');
    // tira os tokens da barra de endereço
    window.history.replaceState(null, '', window.location.pathname);
    if (!access_token || !refresh_token) return setDestino('/login');
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => setDestino(error ? '/login' : '/painel'))
      .catch(() => setDestino('/login'));
  }, []);

  if (!destino) return <Carregando />;
  return <Navigate to={destino} replace />;
}
