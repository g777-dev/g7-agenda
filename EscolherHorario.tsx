import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBloqueios } from '../../lib/dados';
import { chaveSlot, hojeBR, motivoSlotFechado, somarDias } from '../../lib/datas';
import type { Gravacao, Periodo, Slot } from '../../lib/tipos';
import { Carregando, Modal } from '../ui';
import { SeletorSlots, type EstadoSlot } from '../SeletorSlots';

interface Props {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  /** Só permite escolher horários sem gravação */
  apenasLivres?: boolean;
  /** Gravação que está sendo movida (o horário dela aparece como "Horário atual") */
  ignorarId?: string;
  aoFechar: () => void;
  aoEscolher: (slot: Slot) => void;
}

const DIAS_A_FRENTE = 180;

export function EscolherHorarioModal({ aberto, titulo, descricao, apenasLivres, ignorarId, aoFechar, aoEscolher }: Props) {
  const hoje = hojeBR();
  const fim = somarDias(hoje, DIAS_A_FRENTE);
  const { mapa, pronto } = useBloqueios(hoje, fim);
  const [ocupados, setOcupados] = useState<Map<string, Gravacao> | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('gravacoes')
      .select('*, clientes(empresa, tipo)')
      .in('status', ['confirmada', 'realizada'])
      .gte('data', hoje)
      .lte('data', fim);
    const m = new Map<string, Gravacao>();
    for (const g of (data as Gravacao[]) ?? []) m.set(chaveSlot(g.data, g.periodo), g);
    setOcupados(m);
  }, [hoje, fim]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  const estadoSlot = (data: string, periodo: Periodo): EstadoSlot => {
    const fechado = motivoSlotFechado(data, periodo, mapa);
    if (fechado) return { estado: 'fechado', rotulo: fechado.length > 18 ? 'Bloqueado' : fechado };
    const g = ocupados?.get(chaveSlot(data, periodo));
    if (g) {
      if (g.id === ignorarId) return { estado: 'ocupado', rotulo: 'Horário atual' };
      const nome = g.clientes?.empresa ?? 'Ocupado';
      if (apenasLivres || g.status === 'realizada') return { estado: 'ocupado', rotulo: nome };
      return { estado: 'consulta', rotulo: nome };
    }
    return { estado: 'livre' };
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} largura="lg">
      {descricao && <p className="mb-4 text-sm text-apagado">{descricao}</p>}
      {!pronto || !ocupados ? (
        <Carregando />
      ) : (
        <SeletorSlots
          inicio={hoje}
          fim={fim}
          bloqueios={mapa}
          estadoSlot={estadoSlot}
          aoEscolher={(s) => {
            aoEscolher(s);
            aoFechar();
          }}
        />
      )}
      {!apenasLivres && (
        <p className="mt-3 text-xs text-apagado">
          Horários com nome de cliente já estão ocupados. Se escolher um deles, o sistema pergunta o que fazer com a gravação
          que está lá.
        </p>
      )}
    </Modal>
  );
}
