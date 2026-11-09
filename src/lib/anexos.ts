import { supabase } from './supabase';

export const LIMITE_ANEXO = 50 * 1024 * 1024; // 50 MB

/** Envia o arquivo para a pasta do cliente e devolve o caminho salvo */
export async function enviarAnexo(clienteId: string, arquivo: File): Promise<string> {
  const nomeSeguro = arquivo.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-80);
  const caminho = `${clienteId}/${Date.now()}-${nomeSeguro}`;
  const { error } = await supabase.storage.from('anexos').upload(caminho, arquivo, { upsert: false });
  if (error) throw error;
  return caminho;
}

export async function removerAnexo(caminho: string) {
  await supabase.storage.from('anexos').remove([caminho]);
}

/** Abre o arquivo numa nova aba com um link temporário */
export async function abrirAnexo(caminho: string) {
  const aba = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('anexos').createSignedUrl(caminho, 600);
  if (error || !data) {
    aba?.close();
    alert('Não foi possível abrir o arquivo.');
    return;
  }
  if (aba) aba.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
