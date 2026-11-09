import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { SENHA_PADRAO, gerarSenha, gerenciarAcesso, normalizarUsuario } from '../../lib/acesso';
import { enviarFoto } from '../../lib/dados';
import { CartaoApresentacao } from '../../components/Apresentacao';
import { useAuth } from '../../contexts/AuthContext';
import type { Apresentacao, MembroEquipe } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Cartao, Carregando, Entrada, Modal, useToast } from '../../components/ui';

const APRESENTACAO_VAZIA: Apresentacao = {
  apresentacao_ativa: true,
  apresentacao_nome: '',
  apresentacao_cargo: '',
  apresentacao_texto: '',
  apresentacao_foto: '',
};

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
  const [editandoMembro, setEditandoMembro] = useState<MembroEquipe | null>(null);
  const [apres, setApres] = useState<Apresentacao>(APRESENTACAO_VAZIA);
  const [salvandoApres, setSalvandoApres] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const [e, c] = await Promise.all([
      supabase.from('equipe').select('*').order('nome'),
      supabase
        .from('configuracoes')
        .select('whatsapp_equipe, apresentacao_ativa, apresentacao_nome, apresentacao_cargo, apresentacao_texto, apresentacao_foto')
        .eq('id', 1)
        .maybeSingle(),
    ]);
    setEquipe((e.data as MembroEquipe[] | null) ?? []);
    const conf = c.data as ({ whatsapp_equipe: string | null } & Apresentacao) | null;
    setWhats(conf?.whatsapp_equipe ?? '');
    if (conf) {
      setApres({
        apresentacao_ativa: conf.apresentacao_ativa,
        apresentacao_nome: conf.apresentacao_nome ?? '',
        apresentacao_cargo: conf.apresentacao_cargo ?? '',
        apresentacao_texto: conf.apresentacao_texto ?? '',
        apresentacao_foto: conf.apresentacao_foto ?? '',
      });
    }
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
    // upsert: a linha de configurações pode ainda não existir (antes o update não gravava nada)
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ id: 1, whatsapp_equipe: whats.trim() || null }, { onConflict: 'id' });
    setSalvandoWhats(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('WhatsApp de contato salvo.');
  };

  const salvarApresentacao = async () => {
    setSalvandoApres(true);
    const { error } = await supabase.from('configuracoes').upsert(
      {
        id: 1,
        apresentacao_ativa: apres.apresentacao_ativa,
        apresentacao_nome: apres.apresentacao_nome?.trim() || null,
        apresentacao_cargo: apres.apresentacao_cargo?.trim() || null,
        apresentacao_texto: apres.apresentacao_texto?.trim() || null,
        apresentacao_foto: apres.apresentacao_foto?.trim() || null,
      },
      { onConflict: 'id' },
    );
    setSalvandoApres(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Apresentação salva.');
  };

  const trocarFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviandoFoto(true);
    const r = await enviarFoto(arquivo);
    setEnviandoFoto(false);
    if (r.error || !r.url) return mostrar(r.error ?? 'Não foi possível enviar a foto.', 'erro');
    setApres((a) => ({ ...a, apresentacao_foto: r.url ?? '' }));
    mostrar('Foto enviada. Clique em "Salvar apresentação" para confirmar.');
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
              <div className="flex gap-1">
              <Botao variante="fantasma" tamanho="p" icone={<Pencil className="h-4 w-4" />} onClick={() => setEditandoMembro(m)}>
                Editar
              </Botao>
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
              </div>
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
                <Botao variante="secundario" icone={<RefreshCw className="h-4 w-4" />} onClick={() => setSenha(gerarSenha())}>
                  Padrão
                </Botao>
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
              <span className="numeros font-semibold">{criado.senha}</span>.
            </Aviso>
          )}
          <Botao className="mt-4" icone={<UserPlus className="h-4 w-4" />} onClick={criar} carregando={criando}>
            Criar login da equipe
          </Botao>
        </div>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="titulo text-xl font-bold">Apresentação para o cliente</h2>
        <p className="mt-1 text-sm text-apagado">
          Aparece no topo da tela do cliente quando ele entra para agendar. Edite o texto, troque a foto ou desligue.
        </p>
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-linha p-3">
            <input
              type="checkbox"
              checked={apres.apresentacao_ativa}
              onChange={(e) => setApres({ ...apres, apresentacao_ativa: e.target.checked })}
              className="h-4 w-4 accent-[rgb(var(--azul))]"
            />
            <span className="text-sm font-semibold">Mostrar a apresentação para os clientes</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" htmlFor="ap-nome">
              <Entrada
                id="ap-nome"
                value={apres.apresentacao_nome ?? ''}
                onChange={(e) => setApres({ ...apres, apresentacao_nome: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Cargo" htmlFor="ap-cargo">
              <Entrada
                id="ap-cargo"
                value={apres.apresentacao_cargo ?? ''}
                onChange={(e) => setApres({ ...apres, apresentacao_cargo: e.target.value })}
              />
            </Campo>
          </div>
          <Campo rotulo="Texto" htmlFor="ap-texto" dica="Deixe uma linha em branco para separar os parágrafos.">
            <AreaTexto
              id="ap-texto"
              rows={8}
              value={apres.apresentacao_texto ?? ''}
              onChange={(e) => setApres({ ...apres, apresentacao_texto: e.target.value })}
            />
          </Campo>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                trocarFoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Botao
              variante="secundario"
              icone={<ImagePlus className="h-4 w-4" />}
              carregando={enviandoFoto}
              onClick={() => inputFoto.current?.click()}
            >
              Trocar foto
            </Botao>
            {apres.apresentacao_foto && (
              <Botao
                variante="fantasma"
                icone={<Trash2 className="h-4 w-4" />}
                onClick={() => setApres({ ...apres, apresentacao_foto: '' })}
              >
                Tirar foto
              </Botao>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-apagado">Prévia</p>
            <CartaoApresentacao dados={apres} />
          </div>
          <Botao onClick={salvarApresentacao} carregando={salvandoApres}>
            Salvar apresentação
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
      <MembroModal membro={editandoMembro} aoFechar={() => setEditandoMembro(null)} aoSalvar={carregar} />
    </div>
  );
}

/** Editar nome, usuário e senha de alguém da equipe. */
function MembroModal({
  membro,
  aoFechar,
  aoSalvar,
}: {
  membro: MembroEquipe | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { mostrar } = useToast();
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!membro) return;
    setNome(membro.nome);
    setUsuario(membro.usuario ?? '');
    setSenha('');
    setErro(null);
  }, [membro]);

  if (!membro) return null;

  const salvar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro('Preencha o nome.');
    setSalvando(true);
    const r = await gerenciarAcesso({ acao: 'editar_equipe', email: membro.email, nome: nome.trim(), usuario, senha: senha.trim() });
    setSalvando(false);
    if (r.error) return setErro(r.error);
    mostrar('Alterações salvas.');
    aoSalvar();
    aoFechar();
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Editar ${membro.nome}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar alterações
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Nome" htmlFor="mb-nome">
          <Entrada id="mb-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="Usuário" htmlFor="mb-usuario">
          <Entrada
            id="mb-usuario"
            autoCapitalize="none"
            value={usuario}
            onChange={(e) => setUsuario(normalizarUsuario(e.target.value))}
            className="numeros"
          />
        </Campo>
        <Campo rotulo="Nova senha" htmlFor="mb-senha" dica="Deixe vazio para manter a senha atual.">
          <div className="flex gap-2">
            <Entrada
              id="mb-senha"
              value={senha}
              placeholder="Manter a atual"
              onChange={(e) => setSenha(e.target.value)}
              className="numeros"
            />
            <Botao variante="secundario" onClick={() => setSenha(SENHA_PADRAO)}>
              Padrão
            </Botao>
          </div>
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
