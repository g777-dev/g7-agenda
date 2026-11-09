import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { montarBloqueios, SEM_BLOQUEIOS, type MapaBloqueios } from './datas';
import type { Apresentacao, Bloqueio } from './tipos';

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

/** Apresentação da videomaker (texto e foto editáveis em Equipe e ajustes). */
export function useApresentacao() {
  const [dados, setDados] = useState<Apresentacao | null>(null);
  useEffect(() => {
    // RPC pública: a apresentação aparece até na tela de login, antes do cliente entrar
    supabase
      .rpc('apresentacao_publica')
      .then(({ data }) => setDados(((data as Apresentacao[] | null) ?? [])[0] ?? null));
  }, []);
  return dados;
}

/** Envia uma foto para o armazenamento público "fotos" e devolve o endereço dela. */
export async function enviarFoto(arquivo: File): Promise<{ url?: string; error?: string }> {
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const caminho = `apresentacao/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('fotos').upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
  if (error) return { error: error.message };
  return { url: supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl };
}
