import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { montarBloqueios, SEM_BLOQUEIOS, type MapaBloqueios } from './datas';
import type { Bloqueio } from './tipos';

/** Bloqueios de agenda num intervalo de datas. */
export function useBloqueios(inicio: string, fim: string) {
  const [lista, setLista] = useState<Bloqueio[]>([]);
  const [pronto, setPronto] = useState(false);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.from('bloqueios').select('*').gte('data', inicio).lte('data', fim);
    setLista((data as Bloqueio[]) ?? []);
    setPronto(true);
  }, [inicio, fim]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const mapa: MapaBloqueios = useMemo(() => (pronto ? montarBloqueios(lista) : SEM_BLOQUEIOS), [lista, pronto]);
  return { lista, mapa, pronto, recarregar };
}

/** Número de WhatsApp da equipe (só dígitos), usado no botão "Falar com a equipe". */
export function useWhatsappEquipe() {
  const [numero, setNumero] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from('configuracoes')
      .select('whatsapp_equipe')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setNumero(data?.whatsapp_equipe?.replace(/\D/g, '') || null));
  }, []);
  return numero;
}

/** Recarrega quando qualquer uma das tabelas mudar (tempo real do Supabase). */
export function useTempoReal(tabelas: string[], aoMudar: () => void) {
  const chave = tabelas.join(',');
  useEffect(() => {
    const canal = supabase.channel(`tempo-real-${chave}-${Math.random().toString(36).slice(2)}`);
    for (const tabela of chave.split(',')) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () => aoMudar());
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [chave, aoMudar]);
}
