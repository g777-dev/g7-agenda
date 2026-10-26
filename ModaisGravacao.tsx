import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, History, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { fmtData, fmtSlot, hojeBR, janelaClienteNovo, somarDias } from '../../lib/datas';
import type { Cliente, Gravacao, LocalTipo, Slot } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal, Selecao, Selo, useToast } from '../ui';
import { LocalGravacao, ResumoHorario } from '../comuns';
import { EscolherHorarioModal } from './EscolherHorario';
import { ModalMotivo, useConflito, useMover } from './acoes';

// ---------- Detalhes de uma gravação ----------

export function GravacaoModal({ gravacao, aoFechar, aoMudar }: {
  gravacao: Gravacao | null;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { mostrar } = useToast();
  const [escolhendo, setEscolhendo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const { mover, modal: modalTroca } = useMover(() => {
    aoMudar();
    aoFechar();
  });

  if (!gravacao) return null;
  const c = gravacao.clientes;
  const confirmada = gravacao.status === 'confirmada';
  const jaPodeRealizar = confirmada && gravacao.data <= hojeBR();

  const marcarRealizada = async () => {
    setMarcando(true);
    const { error } = await supabase.rpc('marcar_realizada', { p_gravacao_id: gravacao.id });
    setMarcando(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar(c?.tipo === 'novo' ? 'Gravação realizada. O cliente agora é recorrente.' : 'Gravação marcada como realizada.');
    aoMudar();
    aoFechar();
  };

  const cancelar = async (motivo: string) => {
    const { error } = await supabase.rpc('cancelar_gravacao', { p_gravacao_id: gravacao.id, p_motivo: motivo });
    if (error) throw error;
    mostrar('Gravação cancelada.');
    aoMudar();
    aoFechar();
  };

  return (
    <>
      <Modal
        aberto={!escolhendo && !cancelando}
        aoFechar={aoFechar}
        titulo={c?.empresa ?? 'Gravação'}
        rodape={
          confirmada ? (
            <>
              <Botao variante="perigo" icone={<XCircle className="h-4 w-4" />} onClick={() => setCancelando(true)}>Cancelar</Botao>
              <Botao variante="secundario" icone={<CalendarClock className="h-4 w-4" />} onClick={() => setEscolhendo(true)}>Remarcar</Botao>
              {jaPodeRealizar && (
                <Botao icone={<CheckCircle2 className="h-4 w-4" />} carregando={marcando} onClick={marcarRealizada}>Marcar como realizada</Botao>
              )}
            </>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Selo tipo={c?.tipo === 'novo' ? 'novo' : 'recorrente'}>{c?.tipo === 'novo' ? 'Cliente novo' : 'Recorrente'}</Selo>
            {gravacao.status === 'realizada' && <Selo tipo="sucesso">Realizada</Selo>}
            {gravacao.status === 'cancelada' && <Selo tipo="erro">Cancelada</Selo>}
          </div>
          <ResumoHorario data={gravacao.data} periodo={gravacao.periodo} tamanho="g" />
          <LocalGravacao tipo={gravacao.local_tipo} endereco={gravacao.endereco} />
          <dl className="grid gap-3 rounded-lg bg-superficie2 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-apagado">Contato</dt>
              <dd className="font-medium">{c?.nome_contato}</dd>
            </div>
            <div>
              <dt className="text-apagado">WhatsApp</dt>
              <dd className="font-medium">
                {c?.whatsapp ? (
                  <a className="text-azul-tinta underline" href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                    {c.whatsapp}
                  </a>
                ) : (
                  'Não informado'
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-apagado">E-mail</dt>
              <dd className="break-all font-medium">{c?.email}</dd>
            </div>
          </dl>
          {gravacao.observacoes && (
            <div>
              <p className="text-sm font-semibold">Observações do cliente</p>
              <p className="mt-1 whitespace-pre-line text-sm text-apagado">{gravacao.observacoes}</p>
            </div>
          )}
          {gravacao.motivo_cancelamento && (
            <Aviso tipo="erro" titulo="Motivo do cancelamento">{gravacao.motivo_cancelamento}</Aviso>
          )}
          {gravacao.ultima_alteracao && (
            <p className="flex items-center gap-1.5 text-xs text-apagado">
              <History className="h-3.5 w-3.5" aria-hidden /> {gravacao.ultima_alteracao}
            </p>
          )}
        </div>
      </Modal>

      <EscolherHorarioModal
        aberto={escolhendo}
        titulo={`Remarcar ${c?.empresa ?? ''}`}
        ignorarId={gravacao.id}
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={(slot) => mover(gravacao, slot)}
      />
      <ModalMotivo
        aberto={cancelando}
        titulo={`Cancelar gravação de ${c?.empresa ?? ''}`}
        rotuloBotao="Cancelar gravação"
        aoFechar={() => setCancelando(false)}
        aoConfirmar={cancelar}
      />
      {modalTroca}
    </>
  );
}

// ---------- Agendar direto para um cliente ----------

export function NovaGravacaoModal({ aberto, slotInicial, aoFechar, aoSalvar }: {
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
  const [localTipo, setLocalTipo] = useState<LocalTipo>('estudio');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [escolhendo, setEscolhendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setBusca('');
    setClienteId('');
    setSlot(slotInicial ?? null);
    setLocalTipo('estudio');
    setEndereco('');
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
    const b = busca.trim().toLowerCase();
    if (!b) return clientes;
    return clientes.filter((c) => `${c.empresa} ${c.nome_contato} ${c.email}`.toLowerCase().includes(b));
  }, [clientes, busca]);

  const cliente = clientes.find((c) => c.id === clienteId);
  const janela = cliente?.tipo === 'novo' && cliente.data_onboarding ? janelaClienteNovo(cliente.data_onboarding, mapa) : null;
  const foraDaJanela = janela && slot && (slot.data < janela.inicio || slot.data > janela.fim);

  const salvar = async () => {
    setErro(null);
    if (!cliente) return setErro('Escolha o cliente.');
    if (!slot) return setErro('Escolha o horário.');
    if (localTipo === 'cliente' && !endereco.trim()) return setErro('Informe o endereço da gravação.');
    setSalvando(true);
    await conflito.executar(slot, async () => {
      const { error } = await supabase.rpc('agendar_direto', {
        p_cliente_id: cliente.id,
        p_data: slot.data,
        p_periodo: slot.periodo,
        p_local_tipo: localTipo,
        p_endereco: localTipo === 'cliente' ? endereco : null,
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
            <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
            <Botao onClick={salvar} carregando={salvando}>Agendar gravação</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-apagado">A gravação entra confirmada na hora, sem o cliente precisar pedir.</p>
          <Campo rotulo="Cliente" htmlFor="busca-cliente">
            <Entrada id="busca-cliente" placeholder="Buscar por empresa, contato ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Selecao aria-label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="mt-2">
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
              <Botao variante="secundario" tamanho="p" icone={<CalendarClock className="h-4 w-4" />} onClick={() => setEscolhendo(true)}>
                {slot ? 'Trocar horário' : 'Escolher horário'}
              </Botao>
            </div>
          </Campo>

          {foraDaJanela && janela && (
            <Aviso tipo="atencao" titulo="Fora do prazo do cliente novo">
              A janela deste cliente vai de {fmtData(janela.inicio)} a {fmtData(janela.fim)}. Você ainda pode agendar, mas o
              prazo de 7 dias úteis não será cumprido.
            </Aviso>
          )}

          <Campo rotulo="Local" htmlFor="local">
            <Selecao id="local" value={localTipo} onChange={(e) => setLocalTipo(e.target.value as LocalTipo)}>
              <option value="estudio">Estúdio da agência</option>
              <option value="cliente">Endereço do cliente</option>
            </Selecao>
          </Campo>
          {localTipo === 'cliente' && (
            <Campo rotulo="Endereço" htmlFor="end">
              <Entrada id="end" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro e cidade" />
            </Campo>
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
