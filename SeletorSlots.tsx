import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LISTA_PERIODOS,
  PERIODOS,
  diasUteisDaSemana,
  ehDiaUtil,
  fmtDiaMes,
  inicioDaSemana,
  nomeDiaCurto,
  nomeFeriado,
  somarDias,
  type MapaBloqueios,
} from '../lib/datas';
import type { Periodo, Slot } from '../lib/tipos';

export type EstadoSlot =
  | { estado: 'livre' }
  | { estado: 'consulta'; rotulo?: string }
  | { estado: 'ocupado'; rotulo?: string }
  | { estado: 'fechado'; rotulo: string };

interface Props {
  inicio: string;
  fim: string;
  bloqueios: MapaBloqueios;
  estadoSlot: (data: string, periodo: Periodo) => EstadoSlot;
  marcados?: { primeiro?: Slot | null; segundo?: Slot | null };
  aoEscolher: (slot: Slot) => void;
}

const igual = (a: Slot | null | undefined, data: string, periodo: Periodo) =>
  !!a && a.data === data && a.periodo === periodo;

export function SeletorSlots({ inicio, fim, bloqueios, estadoSlot, marcados, aoEscolher }: Props) {
  const primeiraSemana = inicioDaSemana(inicio);
  const ultimaSemana = inicioDaSemana(fim);
  const [semana, setSemana] = useState(primeiraSemana);

  useEffect(() => {
    setSemana(primeiraSemana);
  }, [primeiraSemana]);

  const dias = diasUteisDaSemana(semana).filter((d) => d >= inicio && d <= fim);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setSemana(somarDias(semana, -7))}
          disabled={semana <= primeiraSemana}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-linha bg-superficie hover:bg-superficie2 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="numeros text-sm font-semibold">
          Semana de {fmtDiaMes(semana)} a {fmtDiaMes(somarDias(semana, 4))}
        </p>
        <button
          onClick={() => setSemana(somarDias(semana, 7))}
          disabled={semana >= ultimaSemana}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-linha bg-superficie hover:bg-superficie2 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          aria-label="Próxima semana"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {dias.length === 0 && <p className="py-6 text-center text-sm text-apagado">Nenhum dia disponível nesta semana.</p>}

      <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
        {dias.map((dia) => {
          const fechadoDia = !ehDiaUtil(dia, bloqueios);
          return (
            <li key={dia} className="flex items-stretch gap-3 p-3">
              <div className="w-12 shrink-0 pt-1 text-center">
                <p className="text-xs font-semibold capitalize text-apagado">{nomeDiaCurto(dia)}</p>
                <p className="titulo numeros text-xl font-extrabold">{fmtDiaMes(dia)}</p>
              </div>
              {fechadoDia ? (
                <div className="flex flex-1 items-center rounded-lg bg-superficie2 px-3 text-sm text-apagado">
                  {nomeFeriado(dia) ?? bloqueios.diasInteiros.get(dia) ?? 'Sem gravações'}
                </div>
              ) : (
                <div className="grid flex-1 grid-cols-2 gap-2">
                  {LISTA_PERIODOS.map((periodo) => (
                    <TileSlot
                      key={periodo}
                      data={dia}
                      periodo={periodo}
                      info={estadoSlot(dia, periodo)}
                      primeiro={igual(marcados?.primeiro, dia, periodo)}
                      segundo={igual(marcados?.segundo, dia, periodo)}
                      aoEscolher={aoEscolher}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TileSlot({ data, periodo, info, primeiro, segundo, aoEscolher }: {
  data: string;
  periodo: Periodo;
  info: EstadoSlot;
  primeiro: boolean;
  segundo: boolean;
  aoEscolher: (s: Slot) => void;
}) {
  const p = PERIODOS[periodo];
  const clicavel = info.estado === 'livre' || info.estado === 'consulta';

  let estilo = 'border-linha bg-superficie hover:border-azul hover:bg-azul-suave/40';
  let rotulo = 'Livre';
  let corRotulo = 'text-verde-tinta';

  if (info.estado === 'consulta') {
    estilo = 'border-dashed border-ambar bg-superficie hover:bg-ambar-suave/50';
    rotulo = info.rotulo ?? 'Sob consulta';
    corRotulo = 'text-ambar-tinta';
  }
  if (info.estado === 'ocupado' || info.estado === 'fechado') {
    estilo = 'border-transparent bg-superficie2 text-apagado';
    rotulo = info.rotulo ?? 'Ocupado';
    corRotulo = 'text-apagado';
  }
  if (segundo) {
    estilo = 'border-azul bg-azul-suave text-azul-tinta ring-1 ring-azul';
    rotulo = '2ª opção';
    corRotulo = 'text-azul-tinta';
  }
  if (primeiro) {
    estilo = 'border-azul bg-azul text-white';
    rotulo = '1ª opção';
    corRotulo = 'text-white';
  }

  return (
    <button
      type="button"
      disabled={!clicavel && !primeiro && !segundo}
      onClick={() => aoEscolher({ data, periodo })}
      aria-pressed={primeiro || segundo}
      aria-label={`${p.nome}, ${p.horario}, ${rotulo}`}
      className={`flex min-h-[72px] flex-col items-start justify-between rounded-[10px] border-[1.5px] p-2.5 text-left transition-colors cursor-pointer disabled:cursor-not-allowed ${estilo}`}
    >
      <span className="text-sm font-bold">{p.nome}</span>
      <span className={`numeros text-xs ${primeiro ? 'text-white/85' : 'opacity-80'}`}>{p.horario}</span>
      <span className={`mt-1 text-xs font-semibold ${corRotulo}`}>{rotulo}</span>
    </button>
  );
}
