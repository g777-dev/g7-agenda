import { supabase } from './supabase';

// Criação e manutenção de acessos (usuário e senha) pela edge function "gerenciar-acesso".

export interface RespostaAcesso {
  error?: string;
  usuario?: string;
  [campo: string]: unknown;
}

/** Chama a edge function gerenciar-acesso. Devolve { error } com a mensagem do servidor quando falha. */
export async function gerenciarAcesso(corpo: Record<string, unknown>): Promise<RespostaAcesso> {
  const { data, error } = await supabase.functions.invoke('gerenciar-acesso', { body: corpo });
  if (error) {
    const resposta = (error as { context?: { json?: () => Promise<{ error?: string } | null> } }).context;
    if (resposta && typeof resposta.json === 'function') {
      try {
        const json = await resposta.json();
        if (json?.error) return { error: json.error };
      } catch {
        /* resposta sem JSON */
      }
    }
    return { error: 'Não foi possível falar com o servidor. Tente de novo em instantes.' };
  }
  return (data as RespostaAcesso) ?? {};
}

/** Senha padrão de todos os clientes (pode ser trocada em cada cliente pelo botão "Senha" ou "Editar"). */
export const SENHA_PADRAO = 'G7123456';

/** Senha usada ao criar/trocar acesso: sempre a senha padrão da G7. */
export function gerarSenha(): string {
  return SENHA_PADRAO;
}

/** Nome de usuário sem acento, minúsculo, com hífens (máx. 40 caracteres) */
export function normalizarUsuario(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Endereço completo do sistema (ex.: linkDoSistema('/agendar/2026-11')) */
export function linkDoSistema(caminho = ''): string {
  return `${window.location.origin}${caminho}`;
}

/** Copia o texto e avisa; se o navegador não deixar, mostra o texto para copiar à mão */
export async function copiarTexto(texto: string, mostrar: (msg: string) => void, mensagem: string) {
  try {
    await navigator.clipboard.writeText(texto);
    mostrar(mensagem);
  } catch {
    window.prompt('Copie o texto abaixo:', texto);
  }
}
