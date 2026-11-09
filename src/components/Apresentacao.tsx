import type { Apresentacao } from '../lib/tipos';
import { Cartao } from './ui';

/** Cartão de boas-vindas da videomaker (foto + texto), igual para o cliente e para a prévia do painel. */
export function CartaoApresentacao({ dados, className = '' }: { dados: Apresentacao; className?: string }) {
  const paragrafos = (dados.apresentacao_texto ?? '').split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <Cartao className={`overflow-hidden ${className}`}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        {dados.apresentacao_foto && (
          <img
            src={dados.apresentacao_foto}
            alt={dados.apresentacao_nome ?? 'Videomaker da G7'}
            className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-azul/30 sm:h-28 sm:w-28"
          />
        )}
        <div className="min-w-0">
          {dados.apresentacao_nome && <p className="titulo text-xl font-bold">{dados.apresentacao_nome}</p>}
          {dados.apresentacao_cargo && <p className="text-sm text-apagado">{dados.apresentacao_cargo}</p>}
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
            {paragrafos.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </Cartao>
  );
}
