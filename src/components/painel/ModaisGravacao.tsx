import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, CircleCheck, CircleX, History, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { fmtData, fmtSlot, hojeBR, janelaClienteNovo, somarDias } from '../../lib/datas';
import { abrirAnexo } from '../../lib/anexos';
import type { Cliente, Gravacao, LocalTipo, Periodo, Slot, StatusGravacao } from '../../lib/tipos';
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
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
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
        aberto={!remarcando && !cancelando && !naoRealizada && !editando && !excluindo}
        aoFechar={aoFechar}
        titulo={cliente?.empresa ?? 'Gravação'}
        rodape={
          <>
            <Botao variante="fantasma" icone={<Trash2 className="h-4 w-4" />} onClick={() => setExcluindo(true)}>
              Excluir
            </Botao>
            <Botao variante="secundario" icone={<Pencil className="h-4 w-4" />} onClick={() => setEditando(true)}>
              Editar
            </Botao>
          {confirmada && (
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
          )}
          </>
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
      {editando && (
        <EditarGravacaoModal
          gravacao={gravacao}
          aoFechar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
            aoMudar();
            aoFechar();
          }}
        />
      )}
      <Modal
        aberto={excluindo}
        aoFechar={() => setExcluindo(false)}
        titulo={`Excluir gravação de ${cliente?.empresa ?? ''}?`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setExcluindo(false)}>
              Voltar
            </Botao>
            <Botao
              variante="perigo"
              icone={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                const { error } = await supabase.from('gravacoes').delete().eq('id', gravacao.id);
                if (error) return mostrar(mensagemErro(error), 'erro');
                mostrar('Gravação excluída.');
                setExcluindo(false);
                aoMudar();
                aoFechar();
              }}
            >
              Excluir de vez
            </Botao>
          </>
        }
      >
        <p className="text-sm">
          A gravação some da agenda e do histórico. Para manter o registro, prefira <strong>Cancelar</strong>.
        </p>
      </Modal>
    </>
  );
}

// ---------- Editar qualquer campo de uma gravação (data, período, local, status...) ----------

function EditarGravacaoModal({
  gravacao,
  aoFechar,
  aoSalvar,
}: {
  gravacao: Gravacao;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { mostrar } = useToast();
  const [data, setData] = useState(gravacao.data);
  const [periodo, setPeriodo] = useState<Periodo>(gravacao.periodo);
  const [local, setLocal] = useState<LocalTipo>(gravacao.local_tipo);
  const [endereco, setEndereco] = useState(gravacao.endereco ?? '');
  const [observacoes, setObservacoes] = useState(gravacao.observacoes ?? '');
  const [status, setStatus] = useState<StatusGravacao>(gravacao.status);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setErro(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro('Escolha uma data válida.');
    setSalvando(true);
    const { error } = await supabase.rpc('editar_gravacao', {
      p_gravacao_id: gravacao.id,
      p_data: data,
      p_periodo: periodo,
      p_local_tipo: local,
      p_endereco: local === 'cliente' ? endereco : '',
      p_observacoes: observacoes,
      p_status: status,
    });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    mostrar('Alterações salvas.');
    aoSalvar();
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Editar gravação${gravacao.clientes ? ` de ${gravacao.clientes.empresa}` : ''}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar alterações
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Data" htmlFor="eg-data">
            <Entrada id="eg-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Período" htmlFor="eg-periodo">
            <Selecao id="eg-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
              <option value="manha">Manhã (09:30–12:00)</option>
              <option value="tarde">Tarde (14:30–17:00)</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Local" htmlFor="eg-local">
            <Selecao id="eg-local" value={local} onChange={(e) => setLocal(e.target.value as LocalTipo)}>
              <option value="estudio">Estúdio da G7</option>
              <option value="cliente">No local do cliente</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Situação" htmlFor="eg-status">
            <Selecao id="eg-status" value={status} onChange={(e) => setStatus(e.target.value as StatusGravacao)}>
              <option value="confirmada">Confirmada</option>
              <option value="realizada">Realizada</option>
              <option value="nao_realizada">Não realizada</option>
              <option value="cancelada">Cancelada</option>
            </Selecao>
          </Campo>
        </div>
        {local === 'cliente' && (
          <Campo rotulo="Endereço" htmlFor="eg-endereco">
            <Entrada id="eg-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </Campo>
        )}
        <Campo rotulo="Observações" htmlFor="eg-obs">
          <AreaTexto id="eg-obs" rows={4} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Campo>
        <p className="text-xs text-apagado">
          A equipe pode escolher qualquer data, inclusive passada ou bloqueada. Só não deixa duas gravações no mesmo horário.
        </p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
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
