import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { gerarSenha, gerenciarAcesso, normalizarUsuario } from '../../lib/acesso';
import { useAuth } from '../../contexts/AuthContext';
import type { MembroEquipe } from '../../lib/tipos';
import { Aviso, Botao, Campo, Cartao, Carregando, Entrada, useToast } from '../../components/ui';

export default function Configuracoes() {
  const { mostrar } = useToast();
  const { sessao } = useAuth();
  const meuEmail = sessao?.user.email?.toLowerCase();
  const [equipe, setEquipe] = useState<MembroEquipe[] | null>(null);
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState(gerarSenha());
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ nome: string; usuario: string; senha: string } | null>(null);
  const [whats, setWhats] = useState('');
  const [salvandoWhats, setSalvandoWhats] = useState(false);

  const carregar = useCallback(async () => {
    const [e, c] = await Promise.all([
      supabase.from('equipe').select('*').order('nome'),
      supabase.from('configuracoes').select('whatsapp_equipe').eq('id', 1).maybeSingle(),
    ]);
    setEquipe((e.data as MembroEquipe[] | null) ?? []);
    setWhats((c.data as { whatsapp_equipe: string | null } | null)?.whatsapp_equipe ?? '');
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async () => {
    setErro(null);
    if (!nome.trim() || !usuario.trim()) return setErro('Preencha nome e usuário.');
    setCriando(true);
    const r = await gerenciarAcesso({ acao: 'criar_equipe', nome: nome.trim(), usuario, senha });
    setCriando(false);
    if (r.error) return setErro(r.error);
    setCriado({ nome: nome.trim(), usuario, senha });
    setNome('');
    setUsuario('');
    setSenha(gerarSenha());
    carregar();
  };

  const remover = async (m: MembroEquipe) => {
    setRemovendo(m.email);
    const { error } = await supabase.from('equipe').delete().eq('email', m.email);
    setRemovendo(null);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar(`${m.nome} saiu da equipe.`);
    carregar();
  };

  const salvarWhats = async () => {
    setSalvandoWhats(true);
    const { error } = await supabase
      .from('configuracoes')
      .update({ whatsapp_equipe: whats.trim() || null })
      .eq('id', 1);
    setSalvandoWhats(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('WhatsApp de contato salvo.');
  };

  if (!equipe) return <Carregando />;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="titulo text-3xl font-bold">Equipe e ajustes</h1>
        <p className="mt-1 text-apagado">
          Quem está na equipe tem acesso total ao painel: aprova, agenda, remarca e cancela gravações de qualquer cliente.
        </p>
      </div>

      <Cartao className="p-5">
        <h2 className="titulo text-xl font-bold">Equipe</h2>
        <ul className="mt-3 divide-y divide-linha">
          {equipe.map((m) => (
            <li key={m.email} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">
                  {m.nome} {m.email === meuEmail && <span className="text-xs font-normal text-apagado">(você)</span>}
                </p>
                <p className="numeros text-sm text-apagado">{m.usuario}</p>
              </div>
              {equipe.length > 1 && (
                <Botao
                  variante="fantasma"
                  tamanho="p"
                  icone={<Trash2 className="h-4 w-4" />}
                  carregando={removendo === m.email}
                  onClick={() => remover(m)}
                >
                  Remover
                </Botao>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-linha pt-4">
          <h3 className="font-semibold">Adicionar pessoa</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Nome" htmlFor="eq-nome">
              <Entrada
                id="eq-nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setUsuario(normalizarUsuario(e.target.value.split(' ')[0] ?? ''));
                }}
                placeholder="Ex.: Maria Eduarda"
              />
            </Campo>
            <Campo rotulo="Usuário" htmlFor="eq-usuario">
              <Entrada
                id="eq-usuario"
                autoCapitalize="none"
                value={usuario}
                onChange={(e) => setUsuario(normalizarUsuario(e.target.value))}
                className="numeros"
              />
            </Campo>
            <Campo rotulo="Senha" htmlFor="eq-senha">
              <div className="flex gap-2">
                <Entrada id="eq-senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="numeros" />
                <Botao
                  variante="secundario"
                  icone={<RefreshCw className="h-4 w-4" />}
                  onClick={() => setSenha(gerarSenha())}
                  aria-label="Gerar outra senha"
                />
              </div>
            </Campo>
          </div>
          {erro && (
            <Aviso tipo="erro" className="mt-4">
              {erro}
            </Aviso>
          )}
          {criado && (
            <Aviso tipo="sucesso" titulo={`${criado.nome} já pode entrar no painel`} className="mt-4">
              Usuário <span className="numeros font-semibold">{criado.usuario}</span>, senha{' '}
              <span className="numeros font-semibold">{criado.senha}</span>. Anote agora: a senha não fica salva para consulta.
            </Aviso>
          )}
          <Botao className="mt-4" icone={<UserPlus className="h-4 w-4" />} onClick={criar} carregando={criando}>
            Criar login da equipe
          </Botao>
        </div>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="titulo text-xl font-bold">WhatsApp de contato da equipe</h2>
        <p className="mt-1 text-sm text-apagado">
          Aparece no botão "Falar com a equipe" quando o cliente perde o prazo de 48 horas para cancelar ou remarcar.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Campo rotulo="Número com código do país e DDD" htmlFor="whats" dica="Ex.: 55 21 99999-9999">
              <Entrada id="whats" type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} />
            </Campo>
          </div>
          <Botao onClick={salvarWhats} carregando={salvandoWhats} className="sm:mb-[22px]">
            Salvar
          </Botao>
        </div>
      </Cartao>
    </div>
  );
}
