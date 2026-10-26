import type { Bloqueio, Periodo } from './tipos';

// Datas no formato 'AAAA-MM-DD'. As contas usam UTC para não sofrer com fuso.

export const PERIODOS: Record<Periodo, { nome: string; horario: string; inicio: string }> = {
  manha: { nome: 'Manhã', horario: '09:00–12:00', inicio: '09:00' },
  tarde: { nome: 'Tarde', horario: '14:00–17:30', inicio: '14:00' },
};

export const LISTA_PERIODOS: Periodo[] = ['manha', 'tarde'];

const UM_DIA = 86_400_000;
const FUSO = 'America/Sao_Paulo';

export function paraData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function somarDias(iso: string, n: number): string {
  return paraISO(new Date(paraData(iso).getTime() + n * UM_DIA));
}

export function diaDaSemana(iso: string): number {
  return paraData(iso).getUTCDay();
}

export function hojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ---------- Feriados nacionais ----------

export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return paraISO(new Date(Date.UTC(ano, mes - 1, dia)));
}

const FERIADOS_FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal',
};

export function nomeFeriado(iso: string): string | null {
  const fixo = FERIADOS_FIXOS[iso.slice(5)];
  if (fixo) return fixo;
  const p = pascoa(Number(iso.slice(0, 4)));
  if (iso === somarDias(p, -48) || iso === somarDias(p, -47)) return 'Carnaval';
  if (iso === somarDias(p, -2)) return 'Sexta-feira Santa';
  if (iso === somarDias(p, 60)) return 'Corpus Christi';
  return null;
}

// ---------- Bloqueios e dias úteis ----------

export interface MapaBloqueios {
  diasInteiros: Map<string, string>;
  slots: Map<string, string>;
}

export const chaveSlot = (data: string, periodo: Periodo) => `${data}|${periodo}`;

export function montarBloqueios(lista: Bloqueio[]): MapaBloqueios {
  const diasInteiros = new Map<string, string>();
  const slots = new Map<string, string>();
  for (const b of lista) {
    if (b.periodo) slots.set(chaveSlot(b.data, b.periodo), b.motivo);
    else diasInteiros.set(b.data, b.motivo);
  }
  return { diasInteiros, slots };
}

export const SEM_BLOQUEIOS: MapaBloqueios = { diasInteiros: new Map(), slots: new Map() };

export function ehFimDeSemana(iso: string): boolean {
  const d = diaDaSemana(iso);
  return d === 0 || d === 6;
}

export function ehDiaUtil(iso: string, bl: MapaBloqueios): boolean {
  return !ehFimDeSemana(iso) && !nomeFeriado(iso) && !bl.diasInteiros.has(iso);
}

/** Motivo de um slot não existir na agenda, ou null se ele existe. */
export function motivoSlotFechado(iso: string, periodo: Periodo, bl: MapaBloqueios): string | null {
  if (ehFimDeSemana(iso)) return 'Fim de semana';
  const feriado = nomeFeriado(iso);
  if (feriado) return feriado;
  const dia = bl.diasInteiros.get(iso);
  if (dia) return dia;
  const slot = bl.slots.get(chaveSlot(iso, periodo));
  if (slot) return slot;
  return null;
}

export function slotExiste(iso: string, periodo: Periodo, bl: MapaBloqueios): boolean {
  return motivoSlotFechado(iso, periodo, bl) === null;
}

/** N-ésimo dia útil depois da data base (a data base é o dia 0). */
export function diaUtilN(base: string, n: number, bl: MapaBloqueios): string {
  let d = base;
  let contados = 0;
  let guarda = 0;
  while (contados < n && guarda < 400) {
    d = somarDias(d, 1);
    guarda++;
    if (ehDiaUtil(d, bl)) contados++;
  }
  return d;
}

/** Janela do cliente novo: do 5º ao 7º dia útil depois do onboarding. */
export function janelaClienteNovo(onboarding: string, bl: MapaBloqueios) {
  return { inicio: diaUtilN(onboarding, 5, bl), fim: diaUtilN(onboarding, 7, bl) };
}

/** Quantos dias úteis faltam de hoje (exclusive) até a data (inclusive). */
export function diasUteisAte(fim: string, bl: MapaBloqueios): number {
  let d = hojeBR();
  let contados = 0;
  let guarda = 0;
  while (d < fim && guarda < 400) {
    d = somarDias(d, 1);
    guarda++;
    if (ehDiaUtil(d, bl)) contados++;
  }
  return contados;
}

export function proximoDiaUtil(iso: string, bl: MapaBloqueios): string {
  return diaUtilN(iso, 1, bl);
}

// ---------- Prazo de 48 horas ----------

export function inicioSlot(iso: string, periodo: Periodo): Date {
  // Horário de Brasília (UTC-3, sem horário de verão)
  return new Date(`${iso}T${PERIODOS[periodo].inicio}:00-03:00`);
}

export function prazoAlteracao(iso: string, periodo: Periodo): Date {
  return new Date(inicioSlot(iso, periodo).getTime() - 48 * 3_600_000);
}

export function aindaPodeAlterar(iso: string, periodo: Periodo): boolean {
  return Date.now() <= prazoAlteracao(iso, periodo).getTime();
}

// ---------- Semanas ----------

export function inicioDaSemana(iso: string): string {
  const d = diaDaSemana(iso);
  const recuo = d === 0 ? 6 : d - 1;
  return somarDias(iso, -recuo);
}

export function diasUteisDaSemana(segunda: string): string[] {
  return [0, 1, 2, 3, 4].map((n) => somarDias(segunda, n));
}

// ---------- Formatação ----------

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function fmtData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function fmtDiaMes(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function nomeDia(iso: string): string {
  return DIAS[diaDaSemana(iso)];
}

export function nomeDiaCurto(iso: string): string {
  return DIAS_CURTOS[diaDaSemana(iso)];
}

/** Ex.: "quinta, 29/10/2026, manhã (09:00–12:00)" */
export function fmtSlot(iso: string, periodo: Periodo): string {
  const p = PERIODOS[periodo];
  return `${nomeDia(iso)}, ${fmtData(iso)}, ${p.nome.toLowerCase()} (${p.horario})`;
}

/** Ex.: "27/10 às 14:00" no horário de Brasília */
export function fmtDataHora(data: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(data);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('day')}/${v('month')} às ${v('hour')}:${v('minute')}`;
}

export function fmtCriadoEm(iso: string): string {
  return fmtDataHora(new Date(iso));
}
