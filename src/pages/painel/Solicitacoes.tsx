import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Paperclip, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios, useTempoReal } from '../../lib/dados';
import {
  chaveSlot,
  diaUtilN,
  diasUteisAte,
  fmtCriadoEm,
  fmtData,
  fmtSlot,
  hojeBR,
  janelaClienteNovo,
  motivoSlotFechado,
  somarDias,
  type MapaBloqueios,
} from '../../lib/datas';
import { abrirAnexo } from '../../lib/anexos';
import type { Cliente, Gravacao, PedidoAlteracao, Periodo, Slot, Solicitacao } from '../../lib/tipos';
import { Aviso, Botao, Cartao, Carregando, Selo, Vazio, useToast } from '../../components/ui';
import { EscolherHorarioModal, ModalMotivo, useConflito, useMover } from '../../components/painel/acoes';

interface Alerta {
  cliente: Cliente;
  tipo: 'atencao' | 'erro';
  titulo: string;
  texto: string;
}

export default function Solicitacoes() {
  const { mostrar } = useToast();
  const hoje = hojeBR();
  const { mapa, pronto } = useBloqueios(somarDias(hoje, -40), somarDias(hoje, 200));
  const conflito = useConflito();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [pedidos, setPedidos] = useState<PedidoAlteracao[]>([]);
  const [novos, setNovos] = useState<Cliente[]>([]);
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [comPedido, setComPedido] = useState<Set<string>>(new Set());
  const [carregado, setCarregado] = useState(false);
  const [outroHorario, setOutroHorario] = useState<Solicitacao | null>(null);
  const [recusando, setRecusando] = useState<Solicitacao | null>(null);
  const [remarcando, setRemarcando] = useState<PedidoAlteracao | null>(null);
  const [cancelando, setCancelando] = useState<PedidoAlteracao | null>(null);
  const [aprovando, setAprovando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [s, p, c, g] = await Promise.all([
      supabase.from('solicitacoes').select('*, clientes(*)').eq('status', 'pendente').order('created_at'),
      supabase
        .from('pedidos_alteracao')
        .select('*, clientes(*), gravacoes(*)')
        .eq('status', 'pendente')
        .order('created_at'),
      supabase.from('clientes').select('*').eq('tipo', 'novo').eq('ativo', true),
      supabase
        .from('gravacoes')
        .select('*, clientes(empresa, tipo)')
        .in('status', ['confirmada', 'realizada'])
        .gte('data', hojeBR()),
    ]);
    const lista = (s.data as Solicitacao[]) ?? [];
    setSolicitacoes(lista);
    setPedidos((p.data as PedidoAlteracao[]) ?? []);
    setNovos((c.data as Cliente[]) ?? []);
    setGravacoes((g.data as Gravacao[]) ?? []);
    setComPedido(new Set(lista.map((x) => x.cliente_id)));
    setCarregado(true);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useTempoReal(['solicitacoes', 'pedidos_alteracao', 'gravacoes'], carregar);

  const { mover, modal: modalMover } = useMover(carregar);

  const ocupacao = useMemo(() => {
    const m = new Map<string, Gravacao>();
    for (const g of gravacoes) m.set(chaveSlot(g.data, g.periodo), g);
    return m;
  }, [gravacoes]);

  const pedidosPorSlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of solicitacoes)
      for (const chave of [chaveSlot(s.opcao1_data, s.opcao1_periodo), chaveSlot(s.opcao2_data, s.opcao2_periodo)])
        m.set(chave, (m.get(chave) ?? 0) + 1);
    return m;
  }, [solicitacoes]);

  const fila = useMemo(() => {
    const prazo = (s: Solicitacao) =>
      s.clientes?.tipo === 'novo' && s.clientes.data_onboarding
        ? janelaClienteNovo(s.clientes.data_onboarding, mapa).fim
        : null;
    return [...solicitacoes].sort((a, b) => {
      const pa = prazo(a);
      const pb = prazo(b);
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      if (pa && pb && pa !== pb) return pa < pb ? -1 : 1;
      return a.created_at < b.created_at ? -1 : 1;
    });
  }, [solicitacoes, mapa]);

  const alertas = useMemo(() => {
    if (!pronto) return [];
    const comGravacao = new Set(gravacoes.map((g) => g.cliente_id));
    const lista: Alerta[] = [];
    for (const c of novos) {
      if (!c.data_onboarding) {
        lista.push({
          cliente: c,
          tipo: 'atencao',
          titulo: `${c.empresa}: sem data de onboarding`,
          texto: 'Cadastre a data de onboarding para liberar o agendamento deste cliente.',
        });
        continue;
      }
      if (comGravacao.has(c.id)) continue;
      const janela = janelaClienteNovo(c.data_onboarding, mapa);
      const cobrarEm = diaUtilN(c.data_onboarding, 3, mapa);
      if (janela.fim < hoje) {
        lista.push({
          cliente: c,
          tipo: 'erro',
          titulo: `${c.empresa}: prazo vencido em ${fmtData(janela.fim)}`,
          texto: 'O cliente novo está sem gravação confirmada. Agende direto pela Agenda.',
        });
      } else if (!comPedido.has(c.id) && hoje >= cobrarEm) {
        lista.push({
          cliente: c,
          tipo: 'atencao',
          titulo: `${c.empresa} ainda não pediu horário`,
          texto: `A janela vai de ${fmtData(janela.inicio)} a ${fmtData(janela.fim)}. Vale chamar o cliente ou agendar direto.`,
        });
      } else if (diasUteisAte(janela.fim, mapa) <= 1) {
        lista.push({
          cliente: c,
          tipo: 'erro',
          titulo: `${c.empresa}: prazo vence em ${fmtData(janela.fim)}`,
          texto: 'Ainda não há gravação confirmada para este cliente novo.',
        });
      }
    }
    return lista;
  }, [novos, gravacoes, comPedido, mapa, pronto, hoje]);

  const aprovar = async (s: Solicitacao, slot: Slot) => {
    setAprovando(s.id);
    await conflito.executar(slot, async () => {
      const { error } = await supabase.rpc('aprovar_solicitacao', {
        p_solicitacao_id: s.id,
        p_data: slot.data,
        p_periodo: slot.periodo,
      });
      if (error) throw error;
      mostrar(`Gravação de ${s.clientes?.empresa} confirmada.`);
      carregar();
    });
    setAprovando(null);
  };

  const recusar = async (motivo: string) => {
    if (!recusando) return;
    const { error } = await supabase.rpc('recusar_solicitacao', {
      p_solicitacao_id: recusando.id,
      p_motivo: motivo,
    });
    if (error) throw error;
    mostrar('Solicitação recusada.');
    carregar();
  };

  const resolver = async (p: PedidoAlteracao) => {
    const { error } = await supabase.rpc('resolver_pedido', { p_pedido_id: p.id });
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Pedido marcado como resolvido.');
    carregar();
  };

  const cancelarGravacao = async (motivo: string) => {
    if (!cancelando) return;
    const { error } = await supabase.rpc('cancelar_gravacao', {
      p_gravacao_id: cancelando.gravacao_id,
      p_motivo: motivo,
    });
    if (error) throw error;
    mostrar('Gravação cancelada.');
    carregar();
  };

  if (!carregado || !pronto) return <Carregando />;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="titulo text-3xl font-bold">Solicitações</h1>
      <p className="mt-1 text-apagado">Clientes novos aparecem primeiro, do prazo mais curto para o mais longo.</p>

      {alertas.length > 0 && (
        <section className="mt-6 space-y-2" aria-label="Alertas">
          {alertas.map((a) => (
            <Aviso key={a.cliente.id} tipo={a.tipo} titulo={a.titulo}>
              {a.texto}
            </Aviso>
          ))}
        </section>
      )}

      {pedidos.length > 0 && (
        <section className="mt-8">
          <h2 className="titulo mb-3 text-xl font-bold">Pedidos de cancelamento e remarcação</h2>
          <div className="space-y-3">
            {pedidos.map((p) => (
              <Cartao key={p.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{p.clientes?.empresa}</p>
                  <Selo tipo={p.tipo === 'cancelamento' ? 'erro' : 'pendente'}>
                    {p.tipo === 'cancelamento' ? 'Quer cancelar' : 'Quer remarcar'}
                  </Selo>
                  <span className="text-xs text-apagado">pedido em {fmtCriadoEm(p.created_at)}</span>
                </div>
                {p.gravacoes && (
                  <p className="mt-1 text-sm first-letter:uppercase">
                    {fmtSlot(p.gravacoes.data, p.gravacoes.periodo)}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-line rounded-lg bg-superficie2 p-3 text-sm">{p.motivo}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Botao tamanho="p" icone={<CalendarClock className="h-4 w-4" />} onClick={() => setRemarcando(p)}>
                    Remarcar
                  </Botao>
                  <Botao tamanho="p" variante="perigo" onClick={() => setCancelando(p)}>
                    Cancelar gravação
                  </Botao>
                  <Botao tamanho="p" variante="fantasma" onClick={() => resolver(p)}>
                    Marcar como resolvido
                  </Botao>
                </div>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="titulo mb-3 text-xl font-bold">Fila de aprovação</h2>
        {fila.length === 0 ? (
          <Vazio titulo="Nenhuma solicitação pendente" texto="Quando um cliente pedir horário, ele aparece aqui." />
        ) : (
          <div className="space-y-3">
            {fila.map((s) => (
              <CartaoSolicitacao
                key={s.id}
                s={s}
                mapa={mapa}
                ocupacao={ocupacao}
                pedidosPorSlot={pedidosPorSlot}
                ocupado={aprovando === s.id}
                aoAprovar={(slot) => aprovar(s, slot)}
                aoOutroHorario={() => setOutroHorario(s)}
                aoRecusar={() => setRecusando(s)}
              />
            ))}
          </div>
        )}
      </section>

      <EscolherHorarioModal
        aberto={!!outroHorario}
        titulo={`Outro horário para ${outroHorario?.clientes?.empresa ?? ''}`}
        descricao="A gravação fica confirmada direto no horário que você escolher."
        aoFechar={() => setOutroHorario(null)}
        aoEscolher={(slot) => {
          if (outroHorario) aprovar(outroHorario, slot);
        }}
      />
      <EscolherHorarioModal
        aberto={!!remarcando}
        titulo={`Remarcar ${remarcando?.clientes?.empresa ?? ''}`}
        ignorarId={remarcando?.gravacao_id}
        aoFechar={() => setRemarcando(null)}
        aoEscolher={(slot) => {
          if (remarcando?.gravacoes) mover({ ...remarcando.gravacoes, clientes: remarcando.clientes }, slot);
        }}
      />
      <ModalMotivo
        aberto={!!recusando}
        titulo={`Recusar solicitação de ${recusando?.clientes?.empresa ?? ''}`}
        rotuloBotao="Recusar solicitação"
        aoFechar={() => setRecusando(null)}
        aoConfirmar={recusar}
      />
      <ModalMotivo
        aberto={!!cancelando}
        titulo={`Cancelar gravação de ${cancelando?.clientes?.empresa ?? ''}`}
        rotuloBotao="Cancelar gravação"
        aoFechar={() => setCancelando(null)}
        aoConfirmar={cancelarGravacao}
      />
      {conflito.modal}
      {modalMover}
    </div>
  );
}

function CartaoSolicitacao({
  s,
  mapa,
  ocupacao,
  pedidosPorSlot,
  ocupado,
  aoAprovar,
  aoOutroHorario,
  aoRecusar,
}: {
  s: Solicitacao;
  mapa: MapaBloqueios;
  ocupacao: Map<string, Gravacao>;
  pedidosPorSlot: Map<string, number>;
  ocupado: boolean;
  aoAprovar: (slot: Slot) => void;
  aoOutroHorario: () => void;
  aoRecusar: () => void;
}) {
  const cliente = s.clientes;
  const janela =
    cliente?.tipo === 'novo' && cliente.data_onboarding ? janelaClienteNovo(cliente.data_onboarding, mapa) : null;
  const faltam = janela ? diasUteisAte(janela.fim, mapa) : null;
  const opcoes: { rotulo: string; data: string; periodo: Periodo }[] = [
    { rotulo: '1ª opção', data: s.opcao1_data, periodo: s.opcao1_periodo },
    { rotulo: '2ª opção', data: s.opcao2_data, periodo: s.opcao2_periodo },
  ];

  return (
    <Cartao className={`p-4 ${janela ? 'border-l-4 border-l-ambar' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-bold">{cliente?.empresa}</p>
        {janela ? (
          <Selo tipo="novo">
            Novo, prazo {fmtData(janela.fim).slice(0, 5)}
            {faltam !== null &&
              (faltam > 0
                ? ` (faltam ${faltam} ${faltam === 1 ? 'dia útil' : 'dias úteis'})`
                : ' (vence hoje ou já venceu)')}
          </Selo>
        ) : (
          <Selo tipo="recorrente">Recorrente</Selo>
        )}
      </div>
      <p className="text-sm text-apagado">
        {cliente?.nome_contato}, pedido em {fmtCriadoEm(s.created_at)}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {opcoes.map((o) => {
          const chave = chaveSlot(o.data, o.periodo);
          const bloqueio = motivoSlotFechado(o.data, o.periodo, mapa);
          const gravacao = ocupacao.get(chave);
          const outros = (pedidosPorSlot.get(chave) ?? 1) - 1;
          let situacao = { texto: 'Livre', cor: 'text-verde-tinta' };
          if (bloqueio) situacao = { texto: `Bloqueado: ${bloqueio}`, cor: 'text-vermelho-tinta' };
          else if (gravacao)
            situacao = {
              texto: `Confirmado para ${gravacao.clientes?.empresa} (${gravacao.clientes?.tipo === 'novo' ? 'novo' : 'recorrente'})`,
              cor: 'text-ambar-tinta',
            };
          return (
            <div key={o.rotulo} className="flex flex-col justify-between gap-2 rounded-lg border border-linha p-3">
              <div>
                <p className="text-xs font-semibold text-apagado">{o.rotulo}</p>
                <p className="text-sm font-semibold first-letter:uppercase">{fmtSlot(o.data, o.periodo)}</p>
                <p className={`mt-1 text-xs font-semibold ${situacao.cor}`}>{situacao.texto}</p>
                {outros > 0 && (
                  <p className="text-xs text-apagado">
                    Mais {outros} {outros === 1 ? 'solicitação pede' : 'solicitações pedem'} este horário
                  </p>
                )}
              </div>
              <Botao
                tamanho="p"
                variante={gravacao ? 'secundario' : 'azul'}
                icone={<Check className="h-4 w-4" />}
                disabled={!!bloqueio}
                carregando={ocupado}
                onClick={() => aoAprovar({ data: o.data, periodo: o.periodo })}
              >
                Aprovar {o.rotulo}
              </Botao>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1">
        {s.observacoes && <p className="whitespace-pre-line text-sm text-apagado">Obs.: {s.observacoes}</p>}
        {s.anexo_path && (
          <button
            onClick={() => s.anexo_path && abrirAnexo(s.anexo_path)}
            className="flex items-center gap-1.5 text-sm font-medium text-azul-tinta hover:underline cursor-pointer"
          >
            <Paperclip className="h-4 w-4" aria-hidden /> {s.anexo_nome ?? 'Arquivo do cliente'}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-linha pt-3">
        <Botao
          tamanho="p"
          variante="secundario"
          icone={<CalendarClock className="h-4 w-4" />}
          onClick={aoOutroHorario}
        >
          Definir outro horário
        </Botao>
        <Botao tamanho="p" variante="perigo" icone={<X className="h-4 w-4" />} onClick={aoRecusar}>
          Recusar
        </Botao>
      </div>
    </Cartao>
  );
}
