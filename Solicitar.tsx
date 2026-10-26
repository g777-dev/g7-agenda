import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useAuth } from '../../contexts/AuthContext';
import { useBloqueios, useWhatsappEquipe } from '../../lib/dados';
import {
  chaveSlot,
  fmtData,
  fmtSlot,
  hojeBR,
  janelaClienteNovo,
  motivoSlotFechado,
  proximoDiaUtil,
  somarDias,
} from '../../lib/datas';
import type { LocalTipo, Periodo, Slot } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Cartao, Carregando, Entrada, useToast } from '../../components/ui';
import { AvisoCancelamento, BotaoWhatsapp } from '../../components/comuns';
import { SeletorSlots, type EstadoSlot } from '../../components/SeletorSlots';
import { LayoutCliente } from './ClienteInicio';

interface Ocupacao {
  data: string;
  periodo: Periodo;
  tipo_cliente: 'novo' | 'recorrente';
  proprio: boolean;
}

const ETAPAS = ['Horários', 'Local', 'Revisão'];

export default function Solicitar() {
  const { cliente } = useAuth();
  const navegar = useNavigate();
  const { mostrar } = useToast();
  const whatsapp = useWhatsappEquipe();
  const hoje = hojeBR();

  const inicioBusca = cliente?.data_onboarding && cliente.data_onboarding < hoje ? cliente.data_onboarding : hoje;
  const { mapa, pronto } = useBloqueios(inicioBusca, somarDias(hoje, 75));

  const [ocupacao, setOcupacao] = useState<Map<string, Ocupacao>>(new Map());
  const [temPendente, setTemPendente] = useState<boolean | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [primeiro, setPrimeiro] = useState<Slot | null>(null);
  const [segundo, setSegundo] = useState<Slot | null>(null);
  const [localTipo, setLocalTipo] = useState<LocalTipo>('estudio');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!cliente) return;
    const [oc, pend] = await Promise.all([
      supabase.rpc('ocupacao_slots', { p_inicio: hoje, p_fim: somarDias(hoje, 75) }),
      supabase.from('solicitacoes').select('id').eq('cliente_id', cliente.id).eq('status', 'pendente').limit(1),
    ]);
    const mapaOc = new Map<string, Ocupacao>();
    for (const o of (oc.data as Ocupacao[]) ?? []) mapaOc.set(chaveSlot(o.data, o.periodo), o);
    setOcupacao(mapaOc);
    setTemPendente((pend.data ?? []).length > 0);
  }, [cliente, hoje]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const intervalo = useMemo(() => {
    if (!cliente || !pronto) return null;
    const amanha = proximoDiaUtil(hoje, mapa);
    if (cliente.tipo === 'novo') {
      if (!cliente.data_onboarding) return { erro: 'sem_onboarding' as const };
      const janela = janelaClienteNovo(cliente.data_onboarding, mapa);
      const inicio = janela.inicio > amanha ? janela.inicio : amanha;
      if (inicio > janela.fim) return { erro: 'janela_passou' as const, janela };
      return { inicio, fim: janela.fim, janela };
    }
    return { inicio: amanha, fim: somarDias(hoje, 60), janela: null };
  }, [cliente, pronto, mapa, hoje]);

  const estadoSlot = useCallback(
    (data: string, periodo: Periodo): EstadoSlot => {
      const fechado = motivoSlotFechado(data, periodo, mapa);
      if (fechado) return { estado: 'fechado', rotulo: fechado.length > 18 ? 'Indisponível' : fechado };
      const oc = ocupacao.get(chaveSlot(data, periodo));
      if (oc) {
        if (oc.proprio) return { estado: 'ocupado', rotulo: 'Sua gravação' };
        if (cliente?.tipo === 'novo' && oc.tipo_cliente === 'recorrente') return { estado: 'consulta' };
        return { estado: 'ocupado' };
      }
      return { estado: 'livre' };
    },
    [mapa, ocupacao, cliente],
  );

  const escolher = (slot: Slot) => {
    const mesmo = (a: Slot | null) => a && a.data === slot.data && a.periodo === slot.periodo;
    if (mesmo(primeiro)) {
      setPrimeiro(segundo);
      setSegundo(null);
    } else if (mesmo(segundo)) {
      setSegundo(null);
    } else if (!primeiro) {
      setPrimeiro(slot);
    } else {
      setSegundo(slot);
    }
  };

  const enviar = async () => {
    if (!primeiro || !segundo) return;
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.rpc('criar_solicitacao', {
      p_opcao1_data: primeiro.data,
      p_opcao1_periodo: primeiro.periodo,
      p_opcao2_data: segundo.data,
      p_opcao2_periodo: segundo.periodo,
      p_local_tipo: localTipo,
      p_endereco: localTipo === 'cliente' ? endereco : null,
      p_observacoes: observacoes,
    });
    setEnviando(false);
    if (error) {
      setErro(mensagemErro(error));
      carregar();
      return;
    }
    mostrar('Solicitação enviada. Acompanhe o status aqui no sistema.');
    navegar('/', { replace: true });
  };

  if (!cliente) return null;
  if (!pronto || temPendente === null || !intervalo) {
    return <LayoutCliente><Carregando /></LayoutCliente>;
  }

  const voltar = (
    <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-apagado hover:text-tinta">
      <ArrowLeft className="h-4 w-4" /> Voltar
    </Link>
  );

  if (temPendente) {
    return (
      <LayoutCliente>
        {voltar}
        <Aviso tipo="info" titulo="Você já tem uma solicitação em análise">
          Aguarde a resposta da equipe ou cancele a solicitação atual na tela inicial para enviar outra.
        </Aviso>
      </LayoutCliente>
    );
  }

  if ('erro' in intervalo) {
    return (
      <LayoutCliente>
        {voltar}
        <div className="space-y-4">
          <Aviso tipo="atencao" titulo={intervalo.erro === 'sem_onboarding' ? 'Seu cadastro ainda não está completo' : 'O prazo para agendar pelo sistema terminou'}>
            {intervalo.erro === 'sem_onboarding'
              ? 'A equipe ainda não registrou a data do seu onboarding. Fale com a gente para liberar o agendamento.'
              : `Sua gravação precisava ser marcada até ${intervalo.janela ? fmtData(intervalo.janela.fim) : 'o 7º dia útil após o onboarding'}. Fale com a equipe para encaixarmos você o quanto antes.`}
          </Aviso>
          <BotaoWhatsapp numero={whatsapp} />
        </div>
      </LayoutCliente>
    );
  }

  const instrucao = !primeiro
    ? 'Toque no horário da sua 1ª opção.'
    : !segundo
      ? 'Agora escolha a 2ª opção, caso a primeira não dê certo.'
      : 'Pronto. Toque num horário escolhido para desmarcar.';

  const enderecoFaltando = localTipo === 'cliente' && !endereco.trim();

  return (
    <LayoutCliente>
      {voltar}
      <h1 className="titulo text-3xl font-extrabold">Solicitar gravação</h1>

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
            {intervalo.janela && (
              <Aviso tipo="info" titulo={`Sua gravação precisa acontecer até ${fmtData(intervalo.janela.fim)}`}>
                Horários marcados como "Sob consulta" podem ser pedidos: nossa equipe verifica se consegue reorganizar a
                agenda para você.
              </Aviso>
            )}
            <p className="font-semibold" aria-live="polite">{instrucao}</p>
            <SeletorSlots
              inicio={intervalo.inicio}
              fim={intervalo.fim}
              bloqueios={mapa}
              estadoSlot={estadoSlot}
              marcados={{ primeiro, segundo }}
              aoEscolher={escolher}
            />
            <div className="sticky bottom-0 -mx-4 border-t border-linha bg-fundo/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
              <Botao tamanho="g" className="w-full" disabled={!primeiro || !segundo} onClick={() => setEtapa(1)}>
                Continuar
              </Botao>
            </div>
          </>
        )}

        {etapa === 1 && (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-semibold">Onde vai ser a gravação?</legend>
              {([
                ['estudio', 'Estúdio da agência', Building2],
                ['cliente', 'No meu endereço', MapPin],
              ] as const).map(([valor, texto, Icone]) => (
                <label
                  key={valor}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-linha bg-superficie p-4 has-[:checked]:border-azul has-[:checked]:bg-azul-suave/50"
                >
                  <input type="radio" name="local" checked={localTipo === valor} onChange={() => setLocalTipo(valor)} className="h-4 w-4 accent-[rgb(var(--azul))]" />
                  <Icone className="h-5 w-5 text-apagado" aria-hidden />
                  <span className="font-medium">{texto}</span>
                </label>
              ))}
            </fieldset>
            {localTipo === 'cliente' && (
              <Campo rotulo="Endereço da gravação" htmlFor="endereco">
                <Entrada id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro e cidade" />
              </Campo>
            )}
            <Campo rotulo="Observações (opcional)" htmlFor="obs" dica="Ex.: quem vai participar, produtos que vão aparecer, cuidados com o local.">
              <AreaTexto id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Campo>
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="g" onClick={() => setEtapa(0)}>Voltar</Botao>
              <Botao tamanho="g" className="flex-1" disabled={enderecoFaltando} onClick={() => setEtapa(2)}>Revisar</Botao>
            </div>
          </>
        )}

        {etapa === 2 && primeiro && segundo && (
          <>
            <Cartao className="divide-y divide-linha">
              <LinhaRevisao rotulo="1ª opção" valor={fmtSlot(primeiro.data, primeiro.periodo)} capitalizar />
              <LinhaRevisao rotulo="2ª opção" valor={fmtSlot(segundo.data, segundo.periodo)} capitalizar />
              <LinhaRevisao rotulo="Local" valor={localTipo === 'estudio' ? 'Estúdio da agência' : endereco} />
              {observacoes.trim() && <LinhaRevisao rotulo="Observações" valor={observacoes} />}
            </Cartao>
            <Aviso tipo="info">
              Sua solicitação ainda não reserva o horário. A equipe vai analisar e confirmar uma das opções. Acompanhe o
              status aqui no sistema.
            </Aviso>
            <AvisoCancelamento />
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="g" onClick={() => setEtapa(1)}>Voltar</Botao>
              <Botao tamanho="g" className="flex-1" carregando={enviando} onClick={enviar}>Enviar solicitação</Botao>
            </div>
          </>
        )}
      </div>
    </LayoutCliente>
  );
}

function LinhaRevisao({ rotulo, valor, capitalizar }: { rotulo: string; valor: string; capitalizar?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-4 sm:flex-row sm:gap-4">
      <p className="w-28 shrink-0 text-sm font-semibold text-apagado">{rotulo}</p>
      <p className={`text-sm ${capitalizar ? 'first-letter:uppercase' : ''}`}>{valor}</p>
    </div>
  );
}
