import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, MapPin, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBloqueios, useTempoReal } from '../../lib/dados';
import {
  LISTA_PERIODOS,
  PERIODOS,
  chaveSlot,
  diasUteisDaSemana,
  fmtDiaMes,
  hojeBR,
  inicioDaSemana,
  motivoSlotFechado,
  nomeDiaCurto,
  somarDias,
} from '../../lib/datas';
import type { Gravacao, Periodo, Slot, Solicitacao } from '../../lib/tipos';
import { Botao, Carregando, useToast } from '../../components/ui';
import { GravacaoModal, NovaGravacaoModal } from '../../components/painel/ModaisGravacao';
import { useMover } from '../../components/painel/acoes';

export default function Agenda() {
  const { mostrar } = useToast();
  const hoje = hojeBR();
  const [semana, setSemana] = useState(inicioDaSemana(hoje));
  const dias = diasUteisDaSemana(semana);
  const sexta = dias[4];
  const { mapa, pronto } = useBloqueios(semana, sexta);

  const [gravacoes, setGravacoes] = useState<Gravacao[] | null>(null);
  const [pendentes, setPendentes] = useState<Solicitacao[]>([]);
  const [aberta, setAberta] = useState<Gravacao | null>(null);
  const [nova, setNova] = useState<{ slot: Slot | null } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [g, s] = await Promise.all([
      supabase.from('gravacoes').select('*, clientes(*)').in('status', ['confirmada', 'realizada']).gte('data', semana).lte('data', sexta),
      supabase.from('solicitacoes').select('opcao1_data, opcao1_periodo, opcao2_data, opcao2_periodo').eq('status', 'pendente'),
    ]);
    setGravacoes((g.data as Gravacao[]) ?? []);
    setPendentes((s.data as Solicitacao[]) ?? []);
  }, [semana, sexta]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useTempoReal(['gravacoes', 'solicitacoes'], carregar);

  const { mover, modal: modalTroca } = useMover(carregar);

  const porSlot = useMemo(() => {
    const m = new Map<string, Gravacao>();
    for (const g of gravacoes ?? []) m.set(chaveSlot(g.data, g.periodo), g);
    return m;
  }, [gravacoes]);

  const pedidosPorSlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of pendentes) {
      for (const k of [chaveSlot(s.opcao1_data, s.opcao1_periodo), chaveSlot(s.opcao2_data, s.opcao2_periodo)]) {
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  }, [pendentes]);

  const soltar = async (e: DragEvent, slot: Slot) => {
    e.preventDefault();
    setAlvo(null);
    const id = e.dataTransfer.getData('text/plain');
    setArrastando(null);
    const g = gravacoes?.find((x) => x.id === id);
    if (!g) return;
    if (motivoSlotFechado(slot.data, slot.periodo, mapa)) return mostrar('Esse horário está bloqueado.', 'erro');
    if (slot.data < hoje) return mostrar('Não é possível mover para uma data que já passou.', 'erro');
    await mover(g, slot);
  };

  if (!gravacoes || !pronto) return <Carregando />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo text-3xl font-extrabold">Agenda</h1>
          <p className="mt-1 text-apagado">Arraste uma gravação para outro horário para remarcar. Clique para ver detalhes.</p>
        </div>
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNova({ slot: null })}>
          Nova gravação
        </Botao>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setSemana(somarDias(semana, -7))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-linha bg-superficie hover:bg-superficie2 cursor-pointer" aria-label="Semana anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setSemana(somarDias(semana, 7))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-linha bg-superficie hover:bg-superficie2 cursor-pointer" aria-label="Próxima semana">
          <ChevronRight className="h-5 w-5" />
        </button>
        <p className="titulo numeros px-2 text-xl font-bold">
          {fmtDiaMes(semana)} a {fmtDiaMes(sexta)}
        </p>
        {semana !== inicioDaSemana(hoje) && (
          <Botao variante="fantasma" tamanho="p" onClick={() => setSemana(inicioDaSemana(hoje))}>Esta semana</Botao>
        )}
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-apagado">
          <Legenda cor="bg-ambar" texto="Cliente novo" />
          <Legenda cor="bg-azul" texto="Recorrente" />
          <Legenda cor="bg-verde" texto="Realizada" />
        </div>
      </div>

      {/* Grade: períodos nas linhas, dias nas colunas (no celular, um dia embaixo do outro) */}
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[300px] gap-3 lg:min-w-[900px] lg:grid-cols-[90px_repeat(5,minmax(0,1fr))] lg:gap-2">
          <div className="hidden lg:block" />
          {dias.map((d) => (
            <div key={d} className={`hidden rounded-lg px-2 py-2 text-center lg:block ${d === hoje ? 'bg-tinta text-superficie' : ''}`}>
              <p className="text-xs font-semibold capitalize opacity-75">{nomeDiaCurto(d)}</p>
              <p className="titulo numeros text-2xl font-extrabold">{fmtDiaMes(d)}</p>
            </div>
          ))}

          {/* Desktop */}
          {LISTA_PERIODOS.map((periodo) => (
            <LinhaDesktop
              key={periodo}
              periodo={periodo}
              dias={dias}
              render={(data) => renderCelula({ data, periodo })}
            />
          ))}

          {/* Celular */}
          {dias.map((d) => (
            <div key={`m-${d}`} className="rounded-xl border border-linha bg-superficie p-3 lg:hidden">
              <p className={`titulo mb-2 text-lg font-extrabold capitalize ${d === hoje ? 'text-azul-tinta' : ''}`}>
                {nomeDiaCurto(d)} {fmtDiaMes(d)}
                {d === hoje && <span className="ml-2 text-xs font-semibold">hoje</span>}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {LISTA_PERIODOS.map((periodo) => (
                  <div key={periodo}>
                    <p className="mb-1 text-xs font-semibold text-apagado">
                      {PERIODOS[periodo].nome}, {PERIODOS[periodo].horario}
                    </p>
                    {renderCelula({ data: d, periodo })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <GravacaoModal gravacao={aberta} aoFechar={() => setAberta(null)} aoMudar={carregar} />
      <NovaGravacaoModal aberto={!!nova} slotInicial={nova?.slot} aoFechar={() => setNova(null)} aoSalvar={carregar} />
      {modalTroca}
    </div>
  );

  function renderCelula(slot: Slot) {
    const k = chaveSlot(slot.data, slot.periodo);
    const fechado = motivoSlotFechado(slot.data, slot.periodo, mapa);
    const g = porSlot.get(k);
    const pedidos = pedidosPorSlot.get(k) ?? 0;
    const passado = slot.data < hoje;
    const ehAlvo = alvo === k && arrastando && !fechado && !passado;

    const eventosSoltar = {
      onDragOver: (e: DragEvent) => {
        if (fechado || passado) return;
        e.preventDefault();
        setAlvo(k);
      },
      onDragLeave: () => setAlvo((a) => (a === k ? null : a)),
      onDrop: (e: DragEvent) => soltar(e, slot),
    };

    const base = `min-h-[104px] rounded-xl text-left transition-colors ${ehAlvo ? 'ring-2 ring-azul ring-offset-2 ring-offset-fundo' : ''}`;

    if (fechado) {
      return (
        <div className={`${base} flex items-center justify-center bg-superficie2 p-2.5 text-center text-xs text-apagado [background-image:repeating-linear-gradient(135deg,transparent_0_8px,rgb(var(--linha)/.6)_8px_9px)]`}>
          {fechado}
        </div>
      );
    }

    if (g) {
      const c = g.clientes;
      const cor = g.status === 'realizada' ? 'border-l-verde' : c?.tipo === 'novo' ? 'border-l-ambar' : 'border-l-azul';
      const arrastavel = g.status === 'confirmada' && !passado;
      return (
        <div {...eventosSoltar} className={base}>
          <button
            draggable={arrastavel}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', g.id);
              e.dataTransfer.effectAllowed = 'move';
              setArrastando(g.id);
            }}
            onDragEnd={() => {
              setArrastando(null);
              setAlvo(null);
            }}
            onClick={() => setAberta(g)}
            className={`flex h-full min-h-[104px] w-full flex-col gap-1 rounded-xl border border-linha border-l-4 bg-superficie p-2.5 text-left hover:bg-superficie2 cursor-pointer ${cor} ${arrastando === g.id ? 'opacity-40' : ''} ${arrastavel ? 'active:cursor-grabbing' : ''}`}
          >
            <span className="flex w-full items-start justify-between gap-1">
              <span className="text-sm font-bold leading-tight">{c?.empresa}</span>
              {arrastavel && <GripVertical className="hidden h-4 w-4 shrink-0 text-apagado lg:block" aria-hidden />}
            </span>
            <span className="text-xs text-apagado">{c?.nome_contato}</span>
            {g.local_tipo === 'cliente' && (
              <span className="flex items-center gap-1 text-xs text-apagado">
                <MapPin className="h-3 w-3" aria-hidden /> No cliente
              </span>
            )}
            {g.status === 'realizada' && <span className="text-xs font-semibold text-verde-tinta">Realizada</span>}
            {pedidos > 0 && (
              <span className="mt-auto text-xs font-semibold text-ambar-tinta">
                {pedidos} {pedidos === 1 ? 'pedido' : 'pedidos'} para este horário
              </span>
            )}
          </button>
        </div>
      );
    }

    return (
      <div {...eventosSoltar} className={`${base} flex flex-col border border-dashed border-linha p-1.5`}>
        {passado ? (
          <span className="m-auto text-xs text-apagado">Sem gravação</span>
        ) : (
          <button
            onClick={() => setNova({ slot })}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold text-apagado hover:bg-superficie2 hover:text-tinta cursor-pointer"
            aria-label={`Agendar em ${fmtDiaMes(slot.data)}, ${PERIODOS[slot.periodo].nome}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Livre
            {pedidos > 0 && (
              <span className="text-ambar-tinta">
                {pedidos} {pedidos === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </button>
        )}
      </div>
    );
  }
}

function LinhaDesktop({ periodo, dias, render }: { periodo: Periodo; dias: string[]; render: (data: string) => JSX.Element }) {
  const p = PERIODOS[periodo];
  return (
    <>
      <div className="hidden flex-col justify-center pr-2 lg:flex">
        <p className="titulo text-lg font-bold">{p.nome}</p>
        <p className="numeros text-xs text-apagado">{p.horario}</p>
      </div>
      {dias.map((d) => (
        <div key={d} className="hidden lg:block">
          {render(d)}
        </div>
      ))}
    </>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${cor}`} aria-hidden />
      {texto}
    </span>
  );
}
