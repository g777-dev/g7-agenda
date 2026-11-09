import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useAuth } from '../../contexts/AuthContext';
import { useBloqueios, useTempoReal, useWhatsappEquipe, useApresentacao } from '../../lib/dados';
import { CartaoApresentacao } from '../../components/Apresentacao';
import {
  aindaPodeAlterar,
  fmtCriadoEm,
  fmtData,
  fmtMes,
  fmtSlot,
  hojeBR,
  janelaClienteNovo,
  mesDe,
  somarDias,
} from '../../lib/datas';
import type { Gravacao, Janela, PedidoAlteracao, Solicitacao } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Cartao, Carregando, Modal, Selo, Vazio, useToast } from '../../components/ui';
import { AvisoCancelamento, BotaoWhatsapp, Marca, ResumoHorario } from '../../components/comuns';

export function LayoutCliente({ children }: { children: ReactNode }) {
  const { cliente, sair } = useAuth();
  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-30 border-b border-linha bg-superficie/95 backdrop-blur"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Link to="/" aria-label="Início">
            <Marca subtitulo={cliente?.empresa} />
          </Link>
          <Botao variante="fantasma" tamanho="p" onClick={sair} icone={<LogOut className="h-4 w-4" />}>
            Sair
          </Botao>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}

const STATUS_SOLICITACAO: Record<
  Solicitacao['status'],
  { texto: string; tipo: 'pendente' | 'sucesso' | 'erro' | 'neutro' }
> = {
  pendente: { texto: 'Em análise', tipo: 'pendente' },
  aprovada: { texto: 'Aprovada', tipo: 'sucesso' },
  recusada: { texto: 'Recusada', tipo: 'erro' },
  cancelada: { texto: 'Cancelada', tipo: 'neutro' },
};

export default function ClienteInicio() {
  const { cliente } = useAuth();
  const { mostrar } = useToast();
  const whatsapp = useWhatsappEquipe();
  const apresentacao = useApresentacao();
  const hoje = hojeBR();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [pedidos, setPedidos] = useState<PedidoAlteracao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [janelas, setJanelas] = useState<Janela[]>([]);
  const [pedindo, setPedindo] = useState<Gravacao | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const base = cliente?.data_onboarding ?? hoje;
  const { mapa } = useBloqueios(base, somarDias(base, 40));

  const carregar = useCallback(async () => {
    if (!cliente) return;
    const [s, g, p, j] = await Promise.all([
      supabase
        .from('solicitacoes')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('gravacoes')
        .select('*')
        .eq('cliente_id', cliente.id)
        .eq('status', 'confirmada')
        .gte('data', hojeBR())
        .order('data')
        .order('periodo'),
      supabase.from('pedidos_alteracao').select('*').eq('cliente_id', cliente.id).eq('status', 'pendente'),
      supabase.from('janelas').select('*').eq('aberta', true).gte('mes', mesDe(hojeBR())).order('mes'),
    ]);
    setJanelas((j.data as Janela[]) ?? []);
    setSolicitacoes((s.data as Solicitacao[]) ?? []);
    setGravacoes((g.data as Gravacao[]) ?? []);
    setPedidos((p.data as PedidoAlteracao[]) ?? []);
    setCarregando(false);
  }, [cliente]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useTempoReal(['solicitacoes', 'gravacoes', 'pedidos_alteracao'], carregar);

  const cancelarSolicitacao = async (id: string) => {
    setCancelando(id);
    const { error } = await supabase.rpc('cancelar_solicitacao', { p_solicitacao_id: id });
    setCancelando(null);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Solicitação cancelada.');
    carregar();
  };

  if (!cliente) return null;
  if (carregando)
    return (
      <LayoutCliente>
        <Carregando />
      </LayoutCliente>
    );

  const pendente = solicitacoes.find((s) => s.status === 'pendente');
  const historico = solicitacoes.filter((s) => s.status !== 'pendente');
  const proxima = gravacoes[0];
  const outras = gravacoes.slice(1);
  const janela =
    cliente.tipo === 'novo' && cliente.data_onboarding ? janelaClienteNovo(cliente.data_onboarding, mapa) : null;

  return (
    <LayoutCliente>
      <h1 className="titulo text-3xl font-bold">Olá, {cliente.nome_contato.split(' ')[0]}</h1>
      <p className="mt-1 text-apagado">Aqui você agenda e acompanha suas gravações com a G7.</p>

      <div className="mt-6 space-y-5">
        {apresentacao?.apresentacao_ativa && <CartaoApresentacao dados={apresentacao} />}
        {janela && !proxima && janela.fim >= hoje && (
          <Aviso tipo="info" titulo={`Sua gravação precisa acontecer até ${fmtData(janela.fim)}`}>
            Escolha um horário entre {fmtData(janela.inicio)} e {fmtData(janela.fim)}. Os primeiros dias depois do
            onboarding são o tempo da nossa equipe preparar o planejamento.
          </Aviso>
        )}

        {proxima && (
          <CartaoGravacao
            gravacao={proxima}
            destaque
            pedido={pedidos.find((p) => p.gravacao_id === proxima.id)}
            whatsapp={whatsapp}
            aoPedir={() => setPedindo(proxima)}
          />
        )}

        {pendente && (
          <Cartao className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="titulo text-xl font-bold">Solicitação em análise</h2>
              <Selo tipo="pendente">Em análise</Selo>
            </div>
            <p className="mt-1 text-sm text-apagado">
              Enviada em {fmtCriadoEm(pendente.created_at)}. Acompanhe o status da sua solicitação aqui no sistema.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-semibold">1ª opção</dt>
                <dd className="first-letter:uppercase">{fmtSlot(pendente.opcao1_data, pendente.opcao1_periodo)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-semibold">2ª opção</dt>
                <dd className="first-letter:uppercase">{fmtSlot(pendente.opcao2_data, pendente.opcao2_periodo)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <Botao
                variante="perigo"
                tamanho="p"
                carregando={cancelando === pendente.id}
                onClick={() => cancelarSolicitacao(pendente.id)}
              >
                Cancelar solicitação
              </Botao>
            </div>
          </Cartao>
        )}

        {!pendente &&
          (cliente.tipo === 'novo' && janela && janela.fim >= hoje && !proxima ? (
            <BotaoAgendar
              para="/agendar"
              titulo="Escolha o horário da sua gravação"
              texto={`Escolha entre ${fmtData(janela.inicio)} e ${fmtData(janela.fim)}.`}
            />
          ) : janelas.length > 0 ? (
            janelas.map((j) => (
              <BotaoAgendar
                key={j.mes}
                para={`/agendar/${j.mes}`}
                titulo={`Agenda de ${fmtMes(j.mes)} aberta`}
                texto="Escolha uma 1ª e uma 2ª opção de horário."
              />
            ))
          ) : (
            <Vazio
              titulo="A agenda ainda não foi aberta"
              texto="Quando a equipe G7 abrir a agenda do mês, você recebe o link no grupo."
            />
          ))}

        {outras.length > 0 && (
          <section className="space-y-3">
            <h2 className="titulo text-xl font-bold">Outras gravações confirmadas</h2>
            {outras.map((g) => (
              <CartaoGravacao
                key={g.id}
                gravacao={g}
                pedido={pedidos.find((p) => p.gravacao_id === g.id)}
                whatsapp={whatsapp}
                aoPedir={() => setPedindo(g)}
              />
            ))}
          </section>
        )}

        {historico.length > 0 && (
          <section>
            <h2 className="titulo mb-3 text-xl font-bold">Histórico de solicitações</h2>
            <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
              {historico.map((s) => {
                const st = STATUS_SOLICITACAO[s.status];
                return (
                  <li key={s.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-apagado">Enviada em {fmtCriadoEm(s.created_at)}</p>
                      <Selo tipo={st.tipo}>{st.texto}</Selo>
                    </div>
                    <p className="mt-1">
                      1ª: {fmtSlot(s.opcao1_data, s.opcao1_periodo)}
                      <br />
                      2ª: {fmtSlot(s.opcao2_data, s.opcao2_periodo)}
                    </p>
                    {s.status === 'recusada' && s.motivo_recusa && (
                      <p className="mt-2 text-vermelho-tinta">Motivo: {s.motivo_recusa}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <PedidoAlteracaoModal gravacao={pedindo} aoFechar={() => setPedindo(null)} aoEnviar={carregar} />
    </LayoutCliente>
  );
}

function BotaoAgendar({ para, titulo, texto }: { para: string; titulo: string; texto: string }) {
  return (
    <Link
      to={para}
      className="flex items-center justify-between gap-4 rounded-xl bg-azul p-5 text-sobre hover:bg-azul/90"
    >
      <div>
        <p className="titulo text-xl font-bold first-letter:uppercase">{titulo}</p>
        <p className="text-sm text-sobre/75">{texto}</p>
      </div>
      <CalendarPlus className="h-8 w-8 shrink-0" aria-hidden />
    </Link>
  );
}

function CartaoGravacao({
  gravacao,
  destaque,
  pedido,
  whatsapp,
  aoPedir,
}: {
  gravacao: Gravacao;
  destaque?: boolean;
  pedido?: PedidoAlteracao;
  whatsapp: string | null;
  aoPedir: () => void;
}) {
  const podeAlterar = aindaPodeAlterar(gravacao.data, gravacao.periodo);
  return (
    <Cartao className={destaque ? 'border-l-4 border-l-azul p-5' : 'p-5'}>
      {destaque && (
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-azul" aria-hidden />
          <p className="text-sm font-semibold">Próxima gravação confirmada</p>
        </div>
      )}
      <ResumoHorario data={gravacao.data} periodo={gravacao.periodo} tamanho={destaque ? 'g' : 'm'} />
      <div className="mt-4 space-y-3">
        {pedido ? (
          <Aviso
            tipo="info"
            titulo={`Pedido de ${pedido.tipo === 'cancelamento' ? 'cancelamento' : 'remarcação'} em análise`}
          >
            Enviado em {fmtCriadoEm(pedido.created_at)}. A equipe vai responder por aqui.
          </Aviso>
        ) : podeAlterar ? (
          <>
            <AvisoCancelamento data={gravacao.data} periodo={gravacao.periodo} />
            <Botao variante="secundario" onClick={aoPedir}>
              Cancelar ou remarcar
            </Botao>
          </>
        ) : (
          <div className="space-y-3 rounded-lg bg-superficie2 p-4 text-sm">
            <p className="font-semibold">O prazo para cancelar ou remarcar pelo sistema terminou.</p>
            <p className="text-apagado">Para qualquer alteração, fale com a equipe.</p>
            <BotaoWhatsapp numero={whatsapp} />
          </div>
        )}
      </div>
    </Cartao>
  );
}

function PedidoAlteracaoModal({
  gravacao,
  aoFechar,
  aoEnviar,
}: {
  gravacao: Gravacao | null;
  aoFechar: () => void;
  aoEnviar: () => void;
}) {
  const { mostrar } = useToast();
  const [tipo, setTipo] = useState<PedidoAlteracao['tipo']>('remarcacao');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setTipo('remarcacao');
    setMotivo('');
    setErro(null);
  }, [gravacao]);

  if (!gravacao) return null;

  const enviar = async () => {
    setErro(null);
    if (!motivo.trim()) return setErro('Conte o motivo do pedido.');
    setEnviando(true);
    const { error } = await supabase.rpc('pedir_alteracao', {
      p_gravacao_id: gravacao.id,
      p_tipo: tipo,
      p_motivo: motivo,
    });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    mostrar('Pedido enviado para a equipe.');
    aoEnviar();
    aoFechar();
  };

  const opcoes: [PedidoAlteracao['tipo'], string][] = [
    ['remarcacao', 'Remarcar para outro dia'],
    ['cancelamento', 'Cancelar a gravação'],
  ];

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Cancelar ou remarcar"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={enviar} carregando={enviando}>
            Enviar pedido
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm first-letter:uppercase">{fmtSlot(gravacao.data, gravacao.periodo)}</p>
        <AvisoCancelamento data={gravacao.data} periodo={gravacao.periodo} />
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-semibold">O que você precisa?</legend>
          {opcoes.map(([valor, texto]) => (
            <label
              key={valor}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-linha p-3 has-[:checked]:border-azul has-[:checked]:bg-azul-suave/50"
            >
              <input
                type="radio"
                name="tipo"
                value={valor}
                checked={tipo === valor}
                onChange={() => setTipo(valor)}
                className="h-4 w-4 accent-[rgb(var(--azul))]"
              />
              <span className="text-sm font-medium">{texto}</span>
            </label>
          ))}
        </fieldset>
        <Campo
          rotulo="Motivo"
          htmlFor="motivo"
          dica={tipo === 'remarcacao' ? 'Se puder, diga quais dias funcionam melhor para você.' : undefined}
        >
          <AreaTexto id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
