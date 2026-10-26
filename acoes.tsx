import { useEffect, useState } from 'react';
import { CalendarClock, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { fmtSlot } from '../../lib/datas';
import type { Gravacao, Slot } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Modal, Selo, useToast } from '../ui';
import { EscolherHorarioModal } from './EscolherHorario';

// ---------- Modal genérico que pede um motivo ----------

export function ModalMotivo({ aberto, titulo, texto, rotuloBotao, perigo = true, aoFechar, aoConfirmar }: {
  aberto: boolean;
  titulo: string;
  texto?: string;
  rotuloBotao: string;
  perigo?: boolean;
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
    if (!motivo.trim()) return setErro('Informe o motivo.');
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
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao variante={perigo ? 'perigo' : 'azul'} onClick={confirmar} carregando={enviando}>{rotuloBotao}</Botao>
        </>
      }
    >
      <div className="space-y-4">
        {texto && <p className="text-sm text-apagado">{texto}</p>}
        <Campo rotulo="Motivo" htmlFor="motivo-modal" dica="O cliente vê este motivo no sistema.">
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
  return (data as Gravacao) ?? null;
}

// ---------- Conflito: o horário escolhido já tem cliente ----------

/**
 * Executa uma ação (aprovar, agendar) num horário. Se o horário já tiver uma
 * gravação confirmada, pergunta antes o que fazer com ela: remarcar ou cancelar.
 */
export function useConflito() {
  const { mostrar } = useToast();
  const [conflito, setConflito] = useState<{ ocupante: Gravacao; slot: Slot; acao: () => Promise<void> } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);

  const rodar = async (acao: () => Promise<void>) => {
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
    if (!ocupante) return rodar(acao);
    if (ocupante.status === 'realizada') {
      mostrar('Esse horário tem uma gravação já realizada. Escolha outro.', 'erro');
      return false;
    }
    setConflito({ ocupante, slot, acao });
    return false;
  };

  const fechar = () => {
    setConflito(null);
    setEscolhendo(false);
    setCancelando(false);
  };

  const remarcarOcupanteE = async (novo: Slot) => {
    if (!conflito) return;
    setTrabalhando(true);
    const ok = await rodar(async () => {
      const { error } = await supabase.rpc('mover_gravacao', {
        p_gravacao_id: conflito.ocupante.id,
        p_data: novo.data,
        p_periodo: novo.periodo,
      });
      if (error) throw error;
    });
    if (ok && (await rodar(conflito.acao))) fechar();
    setTrabalhando(false);
  };

  const cancelarOcupanteE = async (motivo: string) => {
    if (!conflito) return;
    const { error } = await supabase.rpc('cancelar_gravacao', { p_gravacao_id: conflito.ocupante.id, p_motivo: motivo });
    if (error) throw error;
    if (await rodar(conflito.acao)) fechar();
  };

  const c = conflito?.ocupante.clientes;

  const modal = (
    <>
      <Modal aberto={!!conflito && !escolhendo && !cancelando} aoFechar={fechar} titulo="Esse horário já está ocupado">
        {conflito && (
          <div className="space-y-4">
            <div className="rounded-lg border border-linha p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{c?.empresa}</p>
                <Selo tipo={c?.tipo === 'novo' ? 'novo' : 'recorrente'}>{c?.tipo === 'novo' ? 'Novo' : 'Recorrente'}</Selo>
              </div>
              <p className="mt-1 text-sm text-apagado first-letter:uppercase">{fmtSlot(conflito.slot.data, conflito.slot.periodo)}</p>
            </div>
            <p className="text-sm">O que fazer com a gravação de {c?.empresa}?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Botao variante="secundario" tamanho="g" className="h-auto min-h-12 whitespace-normal py-2 text-center" icone={<CalendarClock className="h-4 w-4 shrink-0" />} carregando={trabalhando} onClick={() => setEscolhendo(true)}>
                Remarcar {c?.empresa}
              </Botao>
              <Botao variante="perigo" tamanho="g" className="h-auto min-h-12 whitespace-normal py-2 text-center" icone={<XCircle className="h-4 w-4 shrink-0" />} onClick={() => setCancelando(true)}>
                Cancelar a gravação
              </Botao>
            </div>
          </div>
        )}
      </Modal>
      <EscolherHorarioModal
        aberto={escolhendo}
        apenasLivres
        titulo={`Novo horário para ${c?.empresa ?? ''}`}
        descricao="Escolha um horário livre. Depois disso, o horário original fica com o novo agendamento."
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={remarcarOcupanteE}
      />
      <ModalMotivo
        aberto={cancelando}
        titulo={`Cancelar gravação de ${c?.empresa ?? ''}`}
        texto="Depois do cancelamento, o horário fica com o novo agendamento."
        rotuloBotao="Cancelar gravação"
        aoFechar={() => setCancelando(false)}
        aoConfirmar={cancelarOcupanteE}
      />
    </>
  );

  return { executar, modal };
}

// ---------- Mover uma gravação existente (remarcar ou trocar) ----------

export function useMover(aoConcluir: () => void) {
  const { mostrar } = useToast();
  const [troca, setTroca] = useState<{ origem: Gravacao; destino: Gravacao } | null>(null);
  const [trocando, setTrocando] = useState(false);

  const mover = async (gravacao: Gravacao, slot: Slot) => {
    if (gravacao.data === slot.data && gravacao.periodo === slot.periodo) return;
    const ocupante = await buscarOcupante(slot);
    if (ocupante && ocupante.id !== gravacao.id) {
      if (ocupante.status !== 'confirmada') {
        mostrar('Esse horário tem uma gravação já realizada. Escolha outro.', 'erro');
        return;
      }
      setTroca({ origem: gravacao, destino: ocupante });
      return;
    }
    const { error } = await supabase.rpc('mover_gravacao', {
      p_gravacao_id: gravacao.id,
      p_data: slot.data,
      p_periodo: slot.periodo,
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
          <Botao variante="secundario" onClick={() => setTroca(null)}>Voltar</Botao>
          <Botao onClick={confirmarTroca} carregando={trocando}>Trocar horários</Botao>
        </>
      }
    >
      {troca && (
        <div className="space-y-3 text-sm">
          <p>Esse horário já está com {troca.destino.clientes?.empresa}. Se confirmar, os dois clientes trocam de lugar:</p>
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
