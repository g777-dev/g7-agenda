import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';

const juntar = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Botão ----------

type VarianteBotao = 'azul' | 'secundario' | 'perigo' | 'fantasma' | 'escuro';

const VARIANTES: Record<VarianteBotao, string> = {
  azul: 'bg-azul text-white hover:bg-azul/90 disabled:bg-azul/50',
  escuro: 'bg-tinta text-superficie hover:bg-tinta/85 disabled:opacity-50',
  secundario:
    'bg-superficie text-tinta border border-linha hover:bg-superficie2 disabled:opacity-50',
  perigo:
    'bg-superficie text-vermelho-tinta border border-vermelho/40 hover:bg-vermelho-suave disabled:opacity-50',
  fantasma: 'text-apagado hover:text-tinta hover:bg-superficie2 disabled:opacity-50',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: 'p' | 'm' | 'g';
  carregando?: boolean;
  icone?: ReactNode;
}

export function Botao({
  variante = 'azul',
  tamanho = 'm',
  carregando,
  icone,
  className,
  children,
  disabled,
  type = 'button',
  ...resto
}: BotaoProps) {
  const tam = { p: 'h-8 px-3 text-sm gap-1.5', m: 'h-10 px-4 text-sm gap-2', g: 'h-12 px-5 text-base gap-2' }[tamanho];
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      className={juntar(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap',
        tam,
        VARIANTES[variante],
        className,
      )}
      {...resto}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
}

// ---------- Campos ----------

export function Campo({ rotulo, dica, erro, children, htmlFor }: {
  rotulo: string;
  dica?: string;
  erro?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {rotulo}
      </label>
      {children}
      {dica && !erro && <p className="text-xs text-apagado">{dica}</p>}
      {erro && <p className="text-xs text-vermelho-tinta">{erro}</p>}
    </div>
  );
}

const BASE_CAMPO =
  'w-full rounded-lg border border-linha bg-superficie px-3 text-[15px] text-tinta placeholder:text-apagado/70 focus:border-azul focus:outline-none focus:ring-2 focus:ring-azul/25';

export function Entrada({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={juntar(BASE_CAMPO, 'h-11', className)} {...p} />;
}

export function AreaTexto({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={juntar(BASE_CAMPO, 'min-h-[88px] py-2.5', className)} {...p} />;
}

export function Selecao({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={juntar(BASE_CAMPO, 'h-11 cursor-pointer', className)} {...p}>
      {children}
    </select>
  );
}

// ---------- Aviso ----------

type TipoAviso = 'atencao' | 'info' | 'erro' | 'sucesso';

const ESTILO_AVISO: Record<TipoAviso, { caixa: string; Icone: typeof Info }> = {
  atencao: { caixa: 'bg-ambar-suave text-ambar-tinta border-ambar/50', Icone: AlertTriangle },
  info: { caixa: 'bg-azul-suave text-azul-tinta border-azul/30', Icone: Info },
  erro: { caixa: 'bg-vermelho-suave text-vermelho-tinta border-vermelho/30', Icone: XCircle },
  sucesso: { caixa: 'bg-verde-suave text-verde-tinta border-verde/30', Icone: CheckCircle2 },
};

export function Aviso({ tipo = 'info', titulo, children, className }: {
  tipo?: TipoAviso;
  titulo?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { caixa, Icone } = ESTILO_AVISO[tipo];
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={juntar('flex gap-3 rounded-lg border p-3.5 text-sm', caixa, className)}>
      <Icone className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <div className="space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

// ---------- Selo ----------

type TipoSelo = 'neutro' | 'novo' | 'recorrente' | 'sucesso' | 'erro' | 'pendente';

const ESTILO_SELO: Record<TipoSelo, string> = {
  neutro: 'bg-superficie2 text-apagado',
  novo: 'bg-ambar-suave text-ambar-tinta',
  recorrente: 'bg-azul-suave text-azul-tinta',
  sucesso: 'bg-verde-suave text-verde-tinta',
  erro: 'bg-vermelho-suave text-vermelho-tinta',
  pendente: 'bg-ambar-suave text-ambar-tinta',
};

export function Selo({ tipo = 'neutro', children }: { tipo?: TipoSelo; children: ReactNode }) {
  return (
    <span className={juntar('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold', ESTILO_SELO[tipo])}>
      {children}
    </span>
  );
}

// ---------- Cartão ----------

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={juntar('rounded-xl border border-linha bg-superficie', className)}>{children}</section>;
}

// ---------- Carregando e vazio ----------

export function Carregando({ texto = 'Carregando' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-apagado" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-linha px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-sm text-sm text-apagado">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

// ---------- Modal ----------

export function Modal({ aberto, aoFechar, titulo, children, rodape, largura = 'md' }: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: 'md' | 'lg' | 'xl';
}) {
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current();
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    const foco = painel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])');
    (foco ?? painel.current)?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;
  const max = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[largura];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-tinta/50" onClick={aoFechar} aria-hidden />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={juntar(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-superficie shadow-2xl sm:rounded-2xl',
          max,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-linha px-5 py-4">
          <h2 className="titulo text-xl font-bold">{titulo}</h2>
          <button
            data-fechar
            onClick={aoFechar}
            className="-mr-1 rounded-md p-1.5 text-apagado hover:bg-superficie2 hover:text-tinta cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-linha px-5 py-3.5">{rodape}</div>}
      </div>
    </div>
  );
}

// ---------- Notificações na tela (toasts) ----------

interface Toast {
  id: number;
  texto: string;
  tipo: 'sucesso' | 'erro';
}

const ToastCtx = createContext<{ mostrar: (texto: string, tipo?: 'sucesso' | 'erro') => void }>({
  mostrar: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);

  const mostrar = useCallback((texto: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), tipo === 'erro' ? 7000 : 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ mostrar }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        aria-live="polite"
      >
        {lista.map((t) => (
          <div
            key={t.id}
            className={juntar(
              'pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
              t.tipo === 'erro' ? 'bg-vermelho text-white' : 'bg-tinta text-superficie',
            )}
          >
            {t.tipo === 'erro' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
