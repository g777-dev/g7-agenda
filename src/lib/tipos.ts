export type Periodo = 'manha' | 'tarde';
export type TipoCliente = 'novo' | 'recorrente';
export type LocalTipo = 'estudio' | 'cliente';
export type Papel = 'admin' | 'cliente';

export type StatusGravacao = 'confirmada' | 'realizada' | 'nao_realizada' | 'cancelada';
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'recusada' | 'cancelada';
export type TipoPedido = 'cancelamento' | 'remarcacao';
export type StatusPedido = 'pendente' | 'resolvido';

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
  usuario: string | null;
}

export interface Gravacao {
  id: string;
  cliente_id: string;
  data: string;
  periodo: Periodo;
  local_tipo: LocalTipo;
  endereco: string | null;
  observacoes: string | null;
  status: StatusGravacao;
  motivo_cancelamento: string | null;
  motivo_nao_realizada: string | null;
  ultima_alteracao: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente | null;
}

/** Gravação com só alguns campos do cliente (select "*, clientes(empresa, tipo)") */
export interface GravacaoResumo extends Omit<Gravacao, 'clientes'> {
  clientes?: Pick<Cliente, 'empresa' | 'tipo'> | null;
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
  status: StatusSolicitacao;
  motivo_recusa: string | null;
  gravacao_id: string | null;
  ultima_alteracao: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente | null;
  gravacoes?: Gravacao | null;
}

export interface PedidoAlteracao {
  id: string;
  gravacao_id: string;
  cliente_id: string;
  tipo: TipoPedido;
  motivo: string;
  status: StatusPedido;
  resolvido_por: string | null;
  resolvido_em: string | null;
  created_at: string;
  gravacoes?: Gravacao | null;
  clientes?: Cliente | null;
}

export interface Bloqueio {
  id: string;
  data: string;
  /** null = dia inteiro */
  periodo: Periodo | null;
  motivo: string;
  created_at: string;
}

export interface MembroEquipe {
  email: string;
  nome: string;
  created_at: string;
  usuario: string | null;
}

/** Mês de agenda aberto para clientes recorrentes. `mes` no formato "AAAA-MM". */
export interface Janela {
  mes: string;
  aberta: boolean;
  aberta_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface Configuracao {
  id: number;
  whatsapp_equipe: string | null;
  senha_padrao: string;
  apresentacao_ativa: boolean;
  apresentacao_nome: string | null;
  apresentacao_cargo: string | null;
  apresentacao_texto: string | null;
  apresentacao_foto: string | null;
}

/** Apresentação da videomaker mostrada ao cliente quando ele entra no sistema. */
export type Apresentacao = Pick<
  Configuracao,
  'apresentacao_ativa' | 'apresentacao_nome' | 'apresentacao_cargo' | 'apresentacao_texto' | 'apresentacao_foto'
>;

/** Linha devolvida pela RPC ocupacao_slots */
export interface OcupacaoSlot {
  data: string;
  periodo: Periodo;
  proprio: boolean;
  tipo_cliente: TipoCliente | null;
}

export interface Slot {
  data: string;
  periodo: Periodo;
}
