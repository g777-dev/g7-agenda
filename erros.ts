// Traduz erros do Supabase para mensagens claras em português
export function mensagemErro(erro: unknown): string {
  const msg =
    typeof erro === 'object' && erro !== null && 'message' in erro
      ? String((erro as { message: unknown }).message)
      : String(erro ?? '');

  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (msg.includes('User already registered')) return 'Este e-mail já tem acesso. Use a aba Entrar.';
  if (msg.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (msg.includes('rate limit')) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (msg.includes('gravacoes_um_por_slot')) return 'Esse horário acabou de ser ocupado. Escolha outro.';
  if (msg.includes('solicitacoes_uma_pendente')) return 'Já existe uma solicitação em análise.';
  if (msg.includes('Failed to fetch')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return msg || 'Algo deu errado. Tente de novo.';
}
