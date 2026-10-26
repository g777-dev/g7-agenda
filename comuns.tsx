import { AlertTriangle, Building2, MapPin, MessageCircle } from 'lucide-react';
import { PERIODOS, fmtDataHora, fmtData, nomeDia, prazoAlteracao } from '../lib/datas';
import type { LocalTipo, Periodo } from '../lib/tipos';

export function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-tinta" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-ambar" />
      </span>
      <div className="leading-tight">
        <p className="titulo text-lg font-extrabold">G7 Agenda</p>
        {subtitulo && <p className="text-xs text-apagado">{subtitulo}</p>}
      </div>
    </div>
  );
}

export const TEXTO_48H =
  'Cancelamentos e remarcações devem ser solicitados com no mínimo 48 horas de antecedência da data da gravação.';

/** Aviso da política de 48 horas. Com data e período, mostra também o prazo exato. */
export function AvisoCancelamento({ data, periodo }: { data?: string; periodo?: Periodo }) {
  return (
    <div className="flex gap-3 rounded-lg border border-ambar/60 bg-ambar-suave p-3.5 text-sm text-ambar-tinta" role="note">
      <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <div className="space-y-1 leading-relaxed">
        <p className="font-semibold">{TEXTO_48H}</p>
        {data && periodo && (
          <p className="numeros">Cancelamento ou remarcação até {fmtDataHora(prazoAlteracao(data, periodo))}.</p>
        )}
      </div>
    </div>
  );
}

export function BotaoWhatsapp({ numero, texto = 'Falar com a equipe' }: { numero: string | null; texto?: string }) {
  if (!numero) return null;
  return (
    <a
      href={`https://wa.me/${numero}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-verde px-4 text-sm font-semibold text-white hover:bg-verde/90"
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {texto}
    </a>
  );
}

/** Data grande + período, no estilo de folha de gravação */
export function ResumoHorario({ data, periodo, tamanho = 'm' }: { data: string; periodo: Periodo; tamanho?: 'm' | 'g' }) {
  const p = PERIODOS[periodo];
  return (
    <div className="flex items-baseline gap-3">
      <p className={`titulo numeros font-extrabold ${tamanho === 'g' ? 'text-4xl' : 'text-2xl'}`}>{fmtData(data).slice(0, 5)}</p>
      <div className="leading-tight">
        <p className="font-semibold capitalize">{nomeDia(data)}</p>
        <p className="numeros text-sm text-apagado">
          {p.nome}, {p.horario}
        </p>
      </div>
    </div>
  );
}

export function LocalGravacao({ tipo, endereco }: { tipo: LocalTipo; endereco: string | null }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-apagado">
      {tipo === 'estudio' ? (
        <>
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Estúdio da agência
        </>
      ) : (
        <>
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {endereco || 'Endereço do cliente'}
        </>
      )}
    </p>
  );
}
