export type Periodo = 'manha' | 'tarde';
export type TipoCliente = 'novo' | 'recorrente';
export type LocalTipo = 'estudio' | 'cliente';

export interface Cliente {
  id: string;
  user_id: string | null;
  nome_contato: string;
  empresa: string;
  email: string;
  whatsapp: string | null;
  tipo: TipoCliente;
  data_onboarding: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Gravacao {
  id: string;
  cliente_id: string;
  data: string;
  periodo: Periodo;
  local_tipo: LocalTipo;
  endereco: string | null;
  observacoes: string | null;
  status: 'confirmada' | 'realizada' | 'cancelada';
  motivo_cancelamento: string | null;
  ultima_alteracao: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
}

export interface Solicitacao {
  id: string;
  cliente_id: string;
  opcao1_data: string;
  opcao1_periodo: Periodo;
  opcao2_data: string;
  opcao2_periodo: Periodo;
  local_tipo: LocalTipo;
  endereco: string | null;
  observacoes: string | null;
  status: 'pendente' | 'aprovada' | 'recusada' | 'cancelada';
  motivo_recusa: string | null;
  gravacao_id: string | null;
  ultima_alteracao: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  gravacoes?: Gravacao | null;
}

export interface PedidoAlteracao {
  id: string;
  gravacao_id: string;
  cliente_id: string;
  tipo: 'cancelamento' | 'remarcacao';
  motivo: string;
  status: 'pendente' | 'resolvido';
  resolvido_por: string | null;
  resolvido_em: string | null;
  created_at: string;
  gravacoes?: Gravacao;
  clientes?: Cliente;
}

export interface Bloqueio {
  id: string;
  data: string;
  periodo: Periodo | null;
  motivo: string;
  created_at: string;
}

export interface MembroEquipe {
  email: string;
  nome: string;
  created_at: string;
}

export interface Slot {
  data: string;
  periodo: Periodo;
}
