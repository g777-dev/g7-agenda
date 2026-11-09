import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, CircleCheck, CircleX, History, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { fmtData, fmtSlot, hojeBR, janelaClienteNovo, somarDias } from '../../lib/datas';
import { abrirAnexo } from '../../lib/anexos';
import type { Cliente, Gravacao, Slot } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal, Selecao, Selo, useToast } from '../ui';
import { ResumoHorario } from '../comuns';
import { EscolherHorarioModal, ModalMotivo, useConflito, useMover } from './acoes';

// ---------- Detalhes de uma gravação (painel) ----------

export function GravacaoModal({
  gravacao,
  aoFechar,
  aoMudar,
}: {
  gravacao: Gravacao | null;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { mostrar } = useToast();
  const [remarcando, setRemarcando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [naoRealizada, setNaoRealizada] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const { mover, modal: modalMover } = useMover(() => {
    aoMudar();
    aoFechar();
  });

  if (!gravacao) return null;

  const cliente = gravacao.clientes;
  const confirmada = gravacao.status === 'confirmada';
  const jaPassou = confirmada && gravacao.data <= hojeBR();

  const marcarRealizada = async () => {
    setMarcando(true);
    const { error } = await supabase.rpc('marcar_realizada', { p_gravacao_id: gravacao.id });
    setMarcando(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar(
      cliente?.tipo === 'novo'
        ? 'Gravação realizada. O cliente agora é recorrente.'
        : 'Gravação marcada como realizada.',
    );
    aoMudar();
    aoFechar();
  };

  const marcarNaoRealizada = async (motivo: string) => {
    const { error } = await supabase.rpc('marcar_nao_realizada', {
      p_gravacao_id: gravacao.id,
      p_motivo: motivo,
    });
    if (error) throw error;
    mostrar('Gravação marcada como não realizada.');
    aoMudar();
    aoFechar();
  };

  const cancelar = async (motivo: string) => {
    const { error } = await supabase.rpc('cancelar_gravacao', {
      p_gravacao_id: gravacao.id,
      p_motivo: motivo,
    });
    if (error) throw error;
    mostrar('Gravação cancelada.');
    aoMudar();
    aoFechar();
  };

  return (
    <>
      <Modal
        aberto={!remarcando && !cancelando && !naoRealizada}
        aoFechar={aoFechar}
        titulo={cliente?.empresa ?? 'Gravação'}
        rodape={
          confirmada ? (
            <>
              <Botao variante="perigo" icone={<CircleX className="h-4 w-4" />} onClick={() => setCancelando(true)}>
                Cancelar
              </Botao>
              <Botao
                variante="secundario"
                icone={<CalendarClock className="h-4 w-4" />}
                onClick={() => setRemarcando(true)}
              >
                Remarcar
              </Botao>
              {jaPassou && (
                <>
                  <Botao variante="perigo" icone={<Ban className="h-4 w-4" />} onClick={() => setNaoRealizada(true)}>
                    Não realizada
                  </Botao>
                  <Botao icone={<CircleCheck className="h-4 w-4" />} carregando={marcando} onClick={marcarRealizada}>
                    Realizada
                  </Botao>
                </>
              )}
            </>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Selo tipo={cliente?.tipo === 'novo' ? 'novo' : 'recorrente'}>
              {cliente?.tipo === 'novo' ? 'Cliente novo' : 'Recorrente'}
            </Selo>
            {gravacao.status === 'realizada' && <Selo tipo="sucesso">Realizada</Selo>}
            {gravacao.status === 'nao_realizada' && <Selo tipo="erro">Não realizada</Selo>}
            {gravacao.status === 'cancelada' && <Selo tipo="erro">Cancelada</Selo>}
          </div>

          <ResumoHorario data={gravacao.data} periodo={gravacao.periodo} tamanho="g" />

          <dl className="grid gap-3 rounded-lg bg-superficie2 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-apagado">Contato</dt>
              <dd className="font-medium">{cliente?.nome_contato}</dd>
            </div>
            <div>
              <dt className="text-apagado">WhatsApp</dt>
              <dd className="font-medium">
                {cliente?.whatsapp ? (
                  <a
                    className="text-azul-tinta underline"
                    href={`https://wa.me/${cliente.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {cliente.whatsapp}
                  </a>
                ) : (
                  'Não informado'
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-apagado">Usuário</dt>
              <dd className="numeros font-medium">{cliente?.usuario}</dd>
            </div>
          </dl>

          {gravacao.observacoes && (
            <div>
              <p className="text-sm font-semibold">Observações do cliente</p>
              <p className="mt-1 whitespace-pre-line text-sm text-apagado">{gravacao.observacoes}</p>
            </div>
          )}

          {gravacao.anexo_path && (
            <button
              onClick={() => gravacao.anexo_path && abrirAnexo(gravacao.anexo_path)}
              className="flex w-full items-center gap-2 rounded-lg border border-linha p-3 text-left text-sm hover:border-azul cursor-pointer"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-azul" aria-hidden />
              <span className="truncate font-medium">{gravacao.anexo_nome ?? 'Arquivo do cliente'}</span>
            </button>
          )}

          {gravacao.motivo_nao_realizada && (
            <Aviso tipo="erro" titulo="Motivo de não ter sido realizada">
              {gravacao.motivo_nao_realizada}
            </Aviso>
          )}
          {gravacao.motivo_cancelamento && (
            <Aviso tipo="erro" titulo="Motivo do cancelamento">
              {gravacao.motivo_cancelamento}
            </Aviso>
          )}
          {gravacao.ultima_alteracao && (
            <p className="flex items-center gap-1.5 text-xs text-apagado">
              <History className="h-3.5 w-3.5" aria-hidden /> {gravacao.ultima_alteracao}
            </p>
          )}
        </div>
      </Modal>

      <EscolherHorarioModal
        aberto={remarcando}
        titulo={`Remarcar ${cliente?.empresa ?? ''}`}
        ignorarId={gravacao.id}
        aoFechar={() => setRemarcando(false)}
        aoEscolher={(slot) => mover(gravacao, slot)}
      />
      <ModalMotivo
        aberto={naoRealizada}
        titulo={`${cliente?.empresa ?? 'Gravação'} não realizada`}
        texto="Use quando a gravação estava marcada mas não aconteceu (cliente faltou, imprevisto etc.)."
        rotuloBotao="Marcar como não realizada"
        opcional
        aoFechar={() => setNaoRealizada(false)}
        aoConfirmar={marcarNaoRealizada}
      />
      <ModalMotivo
        aberto={cancelando}
        titulo={`Cancelar gravação de ${cliente?.empresa ?? ''}`}
        rotuloBotao="Cancelar gravação"
        aoFechar={() => setCancelando(false)}
        aoConfirmar={cancelar}
      />
      {modalMover}
    </>
  );
}

// ---------- Agendar direto pelo painel ----------

export function NovaGravacaoModal({
  aberto,
  slotInicial,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  slotInicial?: Slot | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { mostrar } = useToast();
  const conflito = useConflito();
  const hoje = hojeBR();
  const { mapa } = useBloqueios(somarDias(hoje, -60), somarDias(hoje, 200));
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [escolhendo, setEscolhendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setBusca('');
    setClienteId('');
    setSlot(slotInicial ?? null);
    setObservacoes('');
    setErro(null);
    supabase
      .from('clientes')
      .select('*')
      .eq('ativo', true)
      .order('empresa')
      .then(({ data }) => setClientes((data as Cliente[]) ?? []));
  }, [aberto, slotInicial]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) => `${c.empresa} ${c.nome_contato} ${c.email}`.toLowerCase().includes(termo));
  }, [clientes, busca]);

  const cliente = clientes.find((c) => c.id === clienteId);
  const janela =
    cliente?.tipo === 'novo' && cliente.data_onboarding ? janelaClienteNovo(cliente.data_onboarding, mapa) : null;
  const foraDoPrazo = janela && slot && (slot.data < janela.inicio || slot.data > janela.fim);

  const salvar = async () => {
    setErro(null);
    if (!cliente) return setErro('Escolha o cliente.');
    if (!slot) return setErro('Escolha o horário.');
    setSalvando(true);
    await conflito.executar(slot, async () => {
      const { error } = await supabase.rpc('agendar_direto', {
        p_cliente_id: cliente.id,
        p_data: slot.data,
        p_periodo: slot.periodo,
        p_local_tipo: 'estudio',
        p_endereco: null,
        p_observacoes: observacoes,
      });
      if (error) throw error;
      mostrar(`Gravação de ${cliente.empresa} agendada.`);
      aoSalvar();
      aoFechar();
    });
    setSalvando(false);
  };

  return (
    <>
      <Modal
        aberto={aberto && !escolhendo}
        aoFechar={aoFechar}
        titulo="Nova gravação"
        rodape={
          <>
            <Botao variante="secundario" onClick={aoFechar}>
              Voltar
            </Botao>
            <Botao onClick={salvar} carregando={salvando}>
              Agendar gravação
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-apagado">A gravação entra confirmada na hora, sem o cliente precisar pedir.</p>
          <Campo rotulo="Cliente" htmlFor="busca-cliente">
            <Entrada
              id="busca-cliente"
              placeholder="Buscar por empresa, contato ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Selecao
              aria-label="Cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="mt-2"
            >
              <option value="">Selecione o cliente</option>
              {filtrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.empresa} ({c.nome_contato}){c.tipo === 'novo' ? ', novo' : ''}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Horário">
            <div className="flex flex-wrap items-center gap-3">
              {slot && <p className="text-sm font-medium first-letter:uppercase">{fmtSlot(slot.data, slot.periodo)}</p>}
              <Botao
                variante="secundario"
                tamanho="p"
                icone={<CalendarClock className="h-4 w-4" />}
                onClick={() => setEscolhendo(true)}
              >
                {slot ? 'Trocar horário' : 'Escolher horário'}
              </Botao>
            </div>
          </Campo>
          {foraDoPrazo && janela && (
            <Aviso tipo="atencao" titulo="Fora do prazo do cliente novo">
              A janela deste cliente vai de {fmtData(janela.inicio)} a {fmtData(janela.fim)}. Você ainda pode agendar,
              mas o prazo de 7 dias úteis não será cumprido.
            </Aviso>
          )}
          <Campo rotulo="Observações (opcional)" htmlFor="obs-nova">
            <AreaTexto id="obs-nova" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </div>
      </Modal>
      <EscolherHorarioModal
        aberto={escolhendo}
        titulo="Escolher horário"
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={setSlot}
      />
      {conflito.modal}
    </>
  );
}
