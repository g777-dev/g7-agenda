import { MessageCircle, TriangleAlert } from 'lucide-react';
import { PERIODOS, fmtData, fmtDataHora, nomeDia, prazoAlteracao } from '../lib/datas';
import type { Periodo } from '../lib/tipos';

/** Hexágono verde-limão com o "G" da G7 */
export function LogoG7({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden>
      <path d="M60 6L102.5 30.5V79.5L60 104L17.5 79.5V30.5L60 6Z" fill="#C8F31D" />
      <path
        d="M73 42C73 42 67.5 36.5 58 36.5C45.5 36.5 38 46 38 58.5C38 71 45.5 80.5 58.5 80.5C70 80.5 75 73 75 64.5V57H56V66H64C64 69.5 61.5 72 57.5 72C50.5 72 47 66 47 58.5C47 51 51 45.5 58 45.5C63 45.5 66 48 66 48L73 42Z"
        fill="#0A0A0A"
      />
      <path d="M70 36.5H84L77 50H70V36.5Z" fill="#0A0A0A" />
    </svg>
  );
}

export function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoG7 />
      <div className="leading-tight">
        <p className="titulo text-base font-bold">
          G7 <span className="font-normal text-apagado">Agenda</span>
        </p>
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
      <TriangleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
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
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-verde px-4 text-sm font-semibold text-[#0A0A0A] hover:bg-verde/90"
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
      <p className={`numeros font-semibold ${tamanho === 'g' ? 'text-4xl' : 'text-2xl'}`}>{fmtData(data).slice(0, 5)}</p>
      <div className="leading-tight">
        <p className="font-semibold capitalize">{nomeDia(data)}</p>
        <p className="numeros text-sm text-apagado">
          {p.nome}, {p.horario}
        </p>
      </div>
    </div>
  );
}
