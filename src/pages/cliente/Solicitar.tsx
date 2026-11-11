import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useAuth } from '../../contexts/AuthContext';
import { useApresentacao, useBloqueios, useWhatsappEquipe } from '../../lib/dados';
import { CartaoApresentacao } from '../../components/Apresentacao';
import {
  chaveSlot,
  fimDoMes,
  fmtData,
  fmtMes,
  fmtSlot,
  hojeBR,
  inicioDoMes,
  janelaClienteNovo,
  mesDe,
  motivoSlotFechado,
  diaUtilN,
  primeiroDiaPedido,
  slotJaComecou,
  somarDias,
} from '../../lib/datas';
import { LIMITE_ANEXO, enviarAnexo, removerAnexo, tamanhoLegivel } from '../../lib/anexos';
import type { Janela, OcupacaoSlot, Periodo, Slot } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Cartao, Carregando, useToast } from '../../components/ui';
import { AvisoCancelamento, BotaoWhatsapp } from '../../components/comuns';
import { SeletorSlots, type EstadoSlot } from '../../components/SeletorSlots';
import { LayoutCliente } from './ClienteInicio';

const ETAPAS = ['Horários', 'Observações', 'Revisão'];

type Janelinha = { inicio: string; fim: string };

type Alvo =
  | { erro: 'sem_onboarding' }
  | { erro: 'janela_passou'; janela: Janelinha }
  | { erro: 'mes_fechado'; mes: string | null }
  | { erro: 'mes_passou'; mes: string }
  | { inicio: string; fim: string; janela: Janelinha | null; mes: string | null };

export default function Solicitar() {
  const { cliente } = useAuth();
  const { mes: mesUrl } = useParams();
  const navegar = useNavigate();
  const { mostrar } = useToast();
  const apresentacao = useApresentacao();
  const whatsapp = useWhatsappEquipe();
  const hoje = hojeBR();
  const inicioBloqueios =
    cliente?.data_onboarding && cliente.data_onboarding < hoje ? cliente.data_onboarding : hoje;
  const { mapa, pronto } = useBloqueios(inicioBloqueios, somarDias(hoje, 200));

  const [ocupacao, setOcupacao] = useState<Map<string, OcupacaoSlot>>(new Map());
  const [temPendente, setTemPendente] = useState<boolean | null>(null);
  const [janelas, setJanelas] = useState<Janela[] | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [primeiro, setPrimeiro] = useState<Slot | null>(null);
  const [segundo, setSegundo] = useState<Slot | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!cliente) return;
    const [o, s, j] = await Promise.all([
      supabase.rpc('ocupacao_slots', { p_inicio: hoje, p_fim: somarDias(hoje, 200) }),
      supabase.from('solicitacoes').select('id').eq('cliente_id', cliente.id).eq('status', 'pendente').limit(1),
      supabase.from('janelas').select('*').eq('aberta', true).gte('mes', mesDe(hoje)).order('mes'),
    ]);
    setJanelas((j.data as Janela[]) ?? []);
    const mapaOcupacao = new Map<string, OcupacaoSlot>();
    for (const item of (o.data as OcupacaoSlot[]) ?? []) mapaOcupacao.set(chaveSlot(item.data, item.periodo), item);
    setOcupacao(mapaOcupacao);
    setTemPendente((s.data ?? []).length > 0);
  }, [cliente, hoje]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alvo = useMemo<Alvo | null>(() => {
    if (!cliente || !pronto || !janelas) return null;
    const primeiroDia = primeiroDiaPedido(mapa);
    if (cliente.tipo === 'novo') {
      if (!cliente.data_onboarding) return { erro: 'sem_onboarding' };
      const janela = janelaClienteNovo(cliente.data_onboarding, mapa);
      // Se a janela já passou, não trava: abre os próximos 5 dias úteis.
      const fim = janela.fim < primeiroDia ? diaUtilN(primeiroDia, 4, mapa) : janela.fim;
      const inicio = janela.inicio > primeiroDia ? janela.inicio : primeiroDia;
      return { inicio, fim, janela: { inicio: janela.inicio, fim }, mes: null };
    }
    const mes = mesUrl ?? janelas[0]?.mes;
    if (!mes || !janelas.some((j) => j.mes === mes)) return { erro: 'mes_fechado', mes: mes ?? null };
    const inicio = inicioDoMes(mes) > primeiroDia ? inicioDoMes(mes) : primeiroDia;
    return inicio > fimDoMes(mes)
      ? { erro: 'mes_passou', mes }
      : { inicio, fim: fimDoMes(mes), janela: null, mes };
  }, [cliente, pronto, mapa, hoje, janelas, mesUrl]);

  const estadoSlot = useCallback(
    (data: string, periodo: Periodo): EstadoSlot => {
      const motivo = motivoSlotFechado(data, periodo, mapa);
      if (motivo) return { estado: 'fechado', rotulo: motivo.length > 18 ? 'Indisponível' : motivo };
      if (slotJaComecou(data, periodo)) return { estado: 'fechado', rotulo: 'Encerrado' };
      const o = ocupacao.get(chaveSlot(data, periodo));
      if (!o) return { estado: 'livre' };
      if (o.proprio) return { estado: 'ocupado', rotulo: 'Sua gravação' };
      if (cliente?.tipo === 'novo' && o.tipo_cliente === 'recorrente') return { estado: 'consulta' };
      return { estado: 'ocupado' };
    },
    [mapa, ocupacao, cliente],
  );

  const escolher = (slot: Slot) => {
    const igual = (s: Slot | null) => s && s.data === slot.data && s.periodo === slot.periodo;
    if (igual(primeiro)) {
      setPrimeiro(segundo);
      setSegundo(null);
    } else if (igual(segundo)) setSegundo(null);
    else if (primeiro) setSegundo(slot);
    else setPrimeiro(slot);
  };

  const trocarArquivo = (f: File | null) => {
    setErro(null);
    if (f && f.size > LIMITE_ANEXO) {
      setErro('O arquivo passa de 50 MB. Envie um arquivo menor ou mande pelo grupo.');
      return;
    }
    setArquivo(f);
  };

  const enviar = async () => {
    if (!primeiro || !segundo || !cliente) return;
    setErro(null);
    setEnviando(true);
    let caminho: string | null = null;
    try {
      if (arquivo) caminho = await enviarAnexo(cliente.id, arquivo);
    } catch (e) {
      setEnviando(false);
      setErro(`Não foi possível enviar o arquivo: ${mensagemErro(e)}`);
      return;
    }
    const { error } = await supabase.rpc('criar_solicitacao', {
      p_opcao1_data: primeiro.data,
      p_opcao1_periodo: primeiro.periodo,
      p_opcao2_data: segundo.data,
      p_opcao2_periodo: segundo.periodo,
      p_local_tipo: 'estudio',
      p_endereco: null,
      p_observacoes: observacoes,
      p_anexo_path: caminho,
      p_anexo_nome: arquivo?.name ?? null,
    });
    setEnviando(false);
    if (error) {
      if (caminho) removerAnexo(caminho);
      setErro(mensagemErro(error));
      carregar();
      return;
    }
    mostrar('Solicitação enviada. Acompanhe o status aqui no sistema.');
    navegar('/', { replace: true });
  };

  if (!cliente) return null;
  if (!pronto || temPendente === null || !janelas || !alvo)
    return (
      <LayoutCliente>
        <Carregando />
      </LayoutCliente>
    );

  const voltar = (
    <Link
      to="/"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-apagado hover:text-tinta"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar
    </Link>
  );

  if (temPendente)
    return (
      <LayoutCliente>
        {voltar}
        <Aviso tipo="info" titulo="Você já tem uma solicitação em análise">
          Aguarde a resposta da equipe ou cancele a solicitação atual na tela inicial para enviar outra.
        </Aviso>
      </LayoutCliente>
    );

  if ('erro' in alvo) {
    const textos: Record<Extract<Alvo, { erro: string }>['erro'], { titulo: string; texto: string }> = {
      sem_onboarding: {
        titulo: 'Seu cadastro ainda não está completo',
        texto:
          'A equipe ainda não registrou a data do seu onboarding. Fale com a gente para liberar o agendamento.',
      },
      janela_passou: {
        titulo: 'O prazo para agendar pelo sistema terminou',
        texto: 'Fale com a equipe G7 para encaixarmos sua gravação o quanto antes.',
      },
      mes_fechado: {
        titulo:
          'mes' in alvo && alvo.mes ? `A agenda de ${fmtMes(alvo.mes)} não está aberta` : 'A agenda ainda não foi aberta',
        texto: 'Quando a equipe G7 abrir a agenda do mês, você recebe o link no grupo.',
      },
      mes_passou: {
        titulo: 'Os dias deste mês já passaram',
        texto: 'Aguarde o link da próxima agenda no grupo.',
      },
    };
    const t = textos[alvo.erro];
    return (
      <LayoutCliente>
        {voltar}
        <div className="space-y-4">
          <Aviso tipo="atencao" titulo={t.titulo}>
            {t.texto}
          </Aviso>
          <BotaoWhatsapp numero={whatsapp} />
        </div>
      </LayoutCliente>
    );
  }

  const instrucao = primeiro
    ? segundo
      ? 'Pronto. Toque num horário escolhido para desmarcar.'
      : 'Agora escolha a 2ª opção, caso a primeira não dê certo.'
    : 'Toque no horário da sua 1ª opção.';

  return (
    <LayoutCliente>
      {voltar}
      <h1 className="titulo text-3xl font-bold">Solicitar gravação</h1>
      {alvo.mes && <p className="mt-1 text-apagado first-letter:uppercase">Agenda de {fmtMes(alvo.mes)}</p>}
      {etapa === 0 && apresentacao?.apresentacao_ativa && <CartaoApresentacao dados={apresentacao} className="mt-4" />}

      <ol className="mt-4 flex gap-2" aria-label="Etapas">
        {ETAPAS.map((nome, i) => (
          <li
            key={nome}
            aria-current={etapa === i ? 'step' : undefined}
            className={`flex-1 border-t-[3px] pt-1.5 text-xs font-semibold ${i <= etapa ? 'border-azul text-tinta' : 'border-linha text-apagado'}`}
          >
            {i + 1}. {nome}
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-5">
        {etapa === 0 && (
          <>
            <AvisoCancelamento />
            {alvo.janela && (
              <Aviso tipo="info" titulo={`Sua gravação precisa acontecer até ${fmtData(alvo.janela.fim)}`}>
                Horários marcados como "Sob consulta" podem ser pedidos: nossa equipe verifica se consegue reorganizar
                a agenda para você.
              </Aviso>
            )}
            <p className="font-semibold" aria-live="polite">
              {instrucao}
            </p>
            <SeletorSlots
              inicio={alvo.inicio}
              fim={alvo.fim}
              bloqueios={mapa}
              estadoSlot={estadoSlot}
              marcados={{ primeiro, segundo }}
              aoEscolher={escolher}
            />
            <div
              className="sticky bottom-0 -mx-4 border-t border-linha bg-fundo/95 px-4 py-3 backdrop-blur"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              <Botao tamanho="g" className="w-full" disabled={!primeiro || !segundo} onClick={() => setEtapa(1)}>
                Continuar
              </Botao>
            </div>
          </>
        )}

        {etapa === 1 && (
          <>
            <Campo
              rotulo="Observações (opcional)"
              htmlFor="obs"
              dica="Ex.: quem vai participar, produtos que vão aparecer, cuidados com o local."
            >
              <AreaTexto id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Campo>
            <Campo
              rotulo="Arquivo (opcional)"
              dica="Roteiro, referência, logo ou o que ajudar na gravação. Até 50 MB."
            >
              {arquivo ? (
                <div className="flex items-center gap-3 rounded-lg border border-linha bg-superficie p-3">
                  <Paperclip className="h-4 w-4 shrink-0 text-azul" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{arquivo.name}</p>
                    <p className="numeros text-xs text-apagado">{tamanhoLegivel(arquivo.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => trocarArquivo(null)}
                    className="rounded-md p-1.5 text-apagado hover:bg-superficie2 hover:text-tinta cursor-pointer"
                    aria-label="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-linha bg-superficie p-4 text-sm font-medium text-apagado hover:border-azul hover:text-tinta">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  Anexar arquivo
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => trocarArquivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </Campo>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="g" onClick={() => setEtapa(0)}>
                Voltar
              </Botao>
              <Botao tamanho="g" className="flex-1" onClick={() => setEtapa(2)}>
                Revisar
              </Botao>
            </div>
          </>
        )}

        {etapa === 2 && primeiro && segundo && (
          <>
            <Cartao className="divide-y divide-linha">
              <LinhaResumo rotulo="1ª opção" valor={fmtSlot(primeiro.data, primeiro.periodo)} capitalizar />
              <LinhaResumo rotulo="2ª opção" valor={fmtSlot(segundo.data, segundo.periodo)} capitalizar />
              {observacoes.trim() && <LinhaResumo rotulo="Observações" valor={observacoes} />}
              {arquivo && <LinhaResumo rotulo="Arquivo" valor={arquivo.name} />}
            </Cartao>
            <Aviso tipo="info">
              Sua solicitação ainda não reserva o horário. A equipe vai analisar e confirmar uma das opções. Acompanhe o
              status aqui no sistema.
            </Aviso>
            <AvisoCancelamento />
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="g" onClick={() => setEtapa(1)}>
                Voltar
              </Botao>
              <Botao tamanho="g" className="flex-1" carregando={enviando} onClick={enviar}>
                Enviar solicitação
              </Botao>
            </div>
          </>
        )}
      </div>
    </LayoutCliente>
  );
}

function LinhaResumo({ rotulo, valor, capitalizar }: { rotulo: string; valor: string; capitalizar?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-4 sm:flex-row sm:gap-4">
      <p className="w-28 shrink-0 text-sm font-semibold text-apagado">{rotulo}</p>
      <p className={`text-sm ${capitalizar ? 'first-letter:uppercase' : ''}`}>{valor}</p>
    </div>
  );
}
