import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CalendarClock, CircleX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { chaveSlot, fmtSlot, hojeBR, motivoSlotFechado, somarDias } from '../../lib/datas';
import type { Gravacao, Periodo, Slot } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Carregando, Modal, Selo, useToast } from '../ui';
import { SeletorSlots, type EstadoSlot } from '../SeletorSlots';

/** Quantos dias para frente o painel mostra ao escolher horário */
const DIAS_A_FRENTE = 180;

// ---------- Modal que mostra a agenda para escolher um horário ----------

export function EscolherHorarioModal({
  aberto,
  titulo,
  descricao,
  apenasLivres,
  ignorarId,
  aoFechar,
  aoEscolher,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  apenasLivres?: boolean;
  ignorarId?: string;
  aoFechar: () => void;
  aoEscolher: (slot: Slot) => void;
}) {
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
    const motivo = motivoSlotFechado(data, periodo, mapa);
    if (motivo) return { estado: 'fechado', rotulo: motivo.length > 18 ? 'Bloqueado' : motivo };
    const g = ocupados?.get(chaveSlot(data, periodo));
    if (g) {
      if (g.id === ignorarId) return { estado: 'ocupado', rotulo: 'Horário atual' };
      const empresa = g.clientes?.empresa ?? 'Ocupado';
      return apenasLivres || g.status === 'realizada'
        ? { estado: 'ocupado', rotulo: empresa }
        : { estado: 'consulta', rotulo: empresa };
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
          aoEscolher={(slot) => {
            aoEscolher(slot);
            aoFechar();
          }}
        />
      )}
      {!apenasLivres && (
        <p className="mt-3 text-xs text-apagado">
          Horários com nome de cliente já estão ocupados. Se escolher um deles, o sistema pergunta o que fazer com a
          gravação que está lá.
        </p>
      )}
    </Modal>
  );
}

// ---------- Modal genérico que pede um motivo ----------

export function ModalMotivo({
  aberto,
  titulo,
  texto,
  rotuloBotao,
  perigo = true,
  opcional = false,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  texto?: string;
  rotuloBotao: string;
  perigo?: boolean;
  opcional?: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setMotivo('');
      setErro(null);
    }
  }, [aberto]);

  const confirmar = async () => {
    if (!opcional && !motivo.trim()) return setErro('Informe o motivo.');
    setEnviando(true);
    try {
      await aoConfirmar(motivo.trim());
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante={perigo ? 'perigo' : 'azul'} onClick={confirmar} carregando={enviando}>
            {rotuloBotao}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {texto && <p className="text-sm text-apagado">{texto}</p>}
        <Campo rotulo={opcional ? 'Motivo (opcional)' : 'Motivo'} htmlFor="motivo-modal" dica="Fica registrado no histórico.">
          <AreaTexto id="motivo-modal" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

// ---------- Busca a gravação que ocupa um slot ----------

export async function buscarOcupante(slot: Slot): Promise<Gravacao | null> {
  const { data } = await supabase
    .from('gravacoes')
    .select('*, clientes(*)')
    .eq('data', slot.data)
    .eq('periodo', slot.periodo)
    .in('status', ['confirmada', 'realizada'])
    .maybeSingle();
  return (data as Gravacao | null) ?? null;
}

// ---------- Conflito: agendar num horário que já tem gravação ----------

/**
 * `executar(slot, acao)` roda a ação se o horário estiver livre. Se estiver ocupado,
 * abre o modal perguntando se remarca ou cancela quem está lá e depois roda a ação.
 * Devolve true quando a ação rodou na hora.
 */
export function useConflito(): {
  executar: (slot: Slot, acao: () => Promise<void>) => Promise<boolean>;
  modal: ReactNode;
} {
  const { mostrar } = useToast();
  const [conflito, setConflito] = useState<{ ocupante: Gravacao; slot: Slot; acao: () => Promise<void> } | null>(
    null,
  );
  const [remarcando, setRemarcando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [movendo, setMovendo] = useState(false);

  const tentar = async (acao: () => Promise<void>) => {
    try {
      await acao();
      return true;
    } catch (e) {
      mostrar(mensagemErro(e), 'erro');
      return false;
    }
  };

  const executar = async (slot: Slot, acao: () => Promise<void>) => {
    const ocupante = await buscarOcupante(slot);
    if (!ocupante) return tentar(acao);
    if (ocupante.status === 'realizada') {
      mostrar('Esse horário tem uma gravação já realizada. Escolha outro.', 'erro');
      return false;
    }
    setConflito({ ocupante, slot, acao });
    return false;
  };

  const fechar = () => {
    setConflito(null);
    setRemarcando(false);
    setCancelando(false);
  };

  const remarcarOcupante = async (novo: Slot) => {
    if (!conflito) return;
    setMovendo(true);
    const moveu = await tentar(async () => {
      const { error } = await supabase.rpc('mover_gravacao', {
        p_gravacao_id: conflito.ocupante.id,
        p_data: novo.data,
        p_periodo: novo.periodo,
      });
      if (error) throw error;
    });
    if (moveu && (await tentar(conflito.acao))) fechar();
    setMovendo(false);
  };

  const cancelarOcupante = async (motivo: string) => {
    if (!conflito) return;
    const { error } = await supabase.rpc('cancelar_gravacao', {
      p_gravacao_id: conflito.ocupante.id,
      p_motivo: motivo,
    });
    if (error) throw error;
    if (await tentar(conflito.acao)) fechar();
  };

  const cliente = conflito?.ocupante.clientes;

  const modal = (
    <>
      <Modal aberto={!!conflito && !remarcando && !cancelando} aoFechar={fechar} titulo="Esse horário já está ocupado">
        {conflito && (
          <div className="space-y-4">
            <div className="rounded-lg border border-linha p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{cliente?.empresa}</p>
                <Selo tipo={cliente?.tipo === 'novo' ? 'novo' : 'recorrente'}>
                  {cliente?.tipo === 'novo' ? 'Novo' : 'Recorrente'}
                </Selo>
              </div>
              <p className="mt-1 text-sm text-apagado first-letter:uppercase">
                {fmtSlot(conflito.slot.data, conflito.slot.periodo)}
              </p>
            </div>
            <p className="text-sm">O que fazer com a gravação de {cliente?.empresa}?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Botao
                variante="secundario"
                tamanho="g"
                className="h-auto min-h-12 whitespace-normal py-2 text-center"
                icone={<CalendarClock className="h-4 w-4 shrink-0" />}
                carregando={movendo}
                onClick={() => setRemarcando(true)}
              >
                Remarcar {cliente?.empresa}
              </Botao>
              <Botao
                variante="perigo"
                tamanho="g"
                className="h-auto min-h-12 whitespace-normal py-2 text-center"
                icone={<CircleX className="h-4 w-4 shrink-0" />}
                onClick={() => setCancelando(true)}
              >
                Cancelar a gravação
              </Botao>
            </div>
          </div>
        )}
      </Modal>
      <EscolherHorarioModal
        aberto={remarcando}
        apenasLivres
        titulo={`Novo horário para ${cliente?.empresa ?? ''}`}
        descricao="Escolha um horário livre. Depois disso, o horário original fica com o novo agendamento."
        aoFechar={() => setRemarcando(false)}
        aoEscolher={remarcarOcupante}
      />
      <ModalMotivo
        aberto={cancelando}
        titulo={`Cancelar gravação de ${cliente?.empresa ?? ''}`}
        texto="Depois do cancelamento, o horário fica com o novo agendamento."
        rotuloBotao="Cancelar gravação"
        aoFechar={() => setCancelando(false)}
        aoConfirmar={cancelarOcupante}
      />
    </>
  );

  return { executar, modal };
}

// ---------- Mover gravação (com troca se o destino estiver ocupado) ----------

export function useMover(aoConcluir: () => void): {
  mover: (origem: Gravacao, destino: Slot) => Promise<void>;
  modal: ReactNode;
} {
  const { mostrar } = useToast();
  const [troca, setTroca] = useState<{ origem: Gravacao; destino: Gravacao } | null>(null);
  const [trocando, setTrocando] = useState(false);

  const mover = async (origem: Gravacao, destino: Slot) => {
    if (origem.data === destino.data && origem.periodo === destino.periodo) return;
    const ocupante = await buscarOcupante(destino);
    if (ocupante && ocupante.id !== origem.id) {
      if (ocupante.status !== 'confirmada') {
        mostrar('Esse horário tem uma gravação já realizada. Escolha outro.', 'erro');
        return;
      }
      setTroca({ origem, destino: ocupante });
      return;
    }
    const { error } = await supabase.rpc('mover_gravacao', {
      p_gravacao_id: origem.id,
      p_data: destino.data,
      p_periodo: destino.periodo,
    });
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Gravação remarcada.');
    aoConcluir();
  };

  const confirmarTroca = async () => {
    if (!troca) return;
    setTrocando(true);
    const { error } = await supabase.rpc('trocar_gravacoes', {
      p_gravacao_a: troca.origem.id,
      p_gravacao_b: troca.destino.id,
    });
    setTrocando(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Gravações trocadas de horário.');
    setTroca(null);
    aoConcluir();
  };

  const modal = (
    <Modal
      aberto={!!troca}
      aoFechar={() => setTroca(null)}
      titulo="Trocar os dois de horário?"
      rodape={
        <>
          <Botao variante="secundario" onClick={() => setTroca(null)}>
            Voltar
          </Botao>
          <Botao onClick={confirmarTroca} carregando={trocando}>
            Trocar horários
          </Botao>
        </>
      }
    >
      {troca && (
        <div className="space-y-3 text-sm">
          <p>
            Esse horário já está com {troca.destino.clientes?.empresa}. Se confirmar, os dois clientes trocam de lugar:
          </p>
          <ul className="space-y-2 rounded-lg border border-linha p-4">
            <li>
              <span className="font-semibold">{troca.origem.clientes?.empresa}</span> vai para{' '}
              <span>{fmtSlot(troca.destino.data, troca.destino.periodo)}</span>
            </li>
            <li>
              <span className="font-semibold">{troca.destino.clientes?.empresa}</span> vai para{' '}
              <span>{fmtSlot(troca.origem.data, troca.origem.periodo)}</span>
            </li>
          </ul>
        </div>
      )}
    </Modal>
  );

  return { mover, modal };
}
