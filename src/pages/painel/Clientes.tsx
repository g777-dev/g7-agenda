import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, History, KeyRound, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { fmtData, fmtSlot, hojeBR, janelaClienteNovo, somarDias } from '../../lib/datas';
import { gerarSenha, gerenciarAcesso, linkDoSistema, normalizarUsuario } from '../../lib/acesso';
import type { Cliente, Gravacao, TipoCliente } from '../../lib/tipos';
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  Carregando,
  Entrada,
  Modal,
  Selecao,
  Selo,
  Vazio,
  useToast,
} from '../../components/ui';

type Filtro = 'ativos' | 'novos' | 'recorrentes' | 'inativos';

/** Dados mostrados (uma única vez) depois de criar o login ou trocar a senha. */
interface DadosAcesso {
  empresa: string;
  nome: string;
  usuario: string;
  senha: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null);
  const [historico, setHistorico] = useState<Cliente | null>(null);
  const [senhaDe, setSenhaDe] = useState<Cliente | null>(null);
  const [acesso, setAcesso] = useState<DadosAcesso | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('clientes').select('*').order('empresa');
    setClientes((data as Cliente[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (clientes ?? []).filter((c) => {
      if (filtro === 'ativos' && !c.ativo) return false;
      if (filtro === 'novos' && (!c.ativo || c.tipo !== 'novo')) return false;
      if (filtro === 'recorrentes' && (!c.ativo || c.tipo !== 'recorrente')) return false;
      if (filtro === 'inativos' && c.ativo) return false;
      return !t || `${c.empresa} ${c.nome_contato} ${c.usuario} ${c.whatsapp ?? ''}`.toLowerCase().includes(t);
    });
  }, [clientes, busca, filtro]);

  if (!clientes) return <Carregando />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo text-3xl font-bold">Clientes</h1>
          <p className="mt-1 text-apagado">Aqui a equipe G7 cria o login (usuário e senha) de cada cliente.</p>
        </div>
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>
          Criar login de cliente
        </Botao>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" aria-hidden />
          <Entrada
            aria-label="Buscar cliente"
            placeholder="Buscar por empresa, contato, usuário ou WhatsApp"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Selecao aria-label="Filtrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className="sm:w-48">
          <option value="ativos">Todos os ativos</option>
          <option value="novos">Clientes novos</option>
          <option value="recorrentes">Recorrentes</option>
          <option value="inativos">Desativados</option>
        </Selecao>
      </div>

      <div className="mt-4">
        {visiveis.length === 0 ? (
          <Vazio
            titulo={clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
            texto={clientes.length === 0 ? 'Cadastre o primeiro cliente para ele poder agendar.' : 'Tente outra busca ou filtro.'}
          />
        ) : (
          <Cartao className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-xs text-apagado">
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Contato</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Onboarding</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {visiveis.map((c) => (
                  <tr key={c.id} className={c.ativo ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 font-semibold">{c.empresa}</td>
                    <td className="px-4 py-3">
                      <p>{c.nome_contato}</p>
                      {c.whatsapp && <p className="text-xs text-apagado">{c.whatsapp}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Selo tipo={c.tipo === 'novo' ? 'novo' : 'recorrente'}>{c.tipo === 'novo' ? 'Novo' : 'Recorrente'}</Selo>
                    </td>
                    <td className="numeros px-4 py-3">{c.data_onboarding ? fmtData(c.data_onboarding) : '—'}</td>
                    <td className="px-4 py-3">
                      <p className="numeros text-[13px]">{c.usuario}</p>
                      {!c.ativo && <Selo>Desativado</Selo>}
                      {c.ativo && !c.user_id && <Selo tipo="pendente">Sem login</Selo>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Botao variante="fantasma" tamanho="p" icone={<History className="h-4 w-4" />} onClick={() => setHistorico(c)}>
                          Histórico
                        </Botao>
                        <Botao variante="fantasma" tamanho="p" icone={<KeyRound className="h-4 w-4" />} onClick={() => setSenhaDe(c)}>
                          Senha
                        </Botao>
                        <Botao variante="fantasma" tamanho="p" icone={<Pencil className="h-4 w-4" />} onClick={() => setEditando(c)}>
                          Editar
                        </Botao>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        )}
      </div>

      <ClienteModal cliente={editando} aoFechar={() => setEditando(null)} aoSalvar={carregar} aoCriar={setAcesso} />
      <SenhaModal cliente={senhaDe} aoFechar={() => setSenhaDe(null)} aoTrocar={setAcesso} />
      <AcessoModal dados={acesso} aoFechar={() => setAcesso(null)} />
      <HistoricoModal cliente={historico} aoFechar={() => setHistorico(null)} />
    </div>
  );
}

/** Criar login de cliente (via função gerenciar-acesso) ou editar um cliente existente (update direto). */
function ClienteModal({
  cliente,
  aoFechar,
  aoSalvar,
  aoCriar,
}: {
  cliente: Cliente | 'novo' | null;
  aoFechar: () => void;
  aoSalvar: () => void;
  aoCriar: (d: DadosAcesso) => void;
}) {
  const { mostrar } = useToast();
  const hoje = hojeBR();
  const { mapa } = useBloqueios(somarDias(hoje, -60), somarDias(hoje, 60));
  const [empresa, setEmpresa] = useState('');
  const [contato, setContato] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [usuario, setUsuario] = useState('');
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState<TipoCliente>('novo');
  const [onboarding, setOnboarding] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const existente = cliente && cliente !== 'novo' ? cliente : null;

  useEffect(() => {
    if (!cliente) return;
    setErro(null);
    setEmpresa(existente?.empresa ?? '');
    setContato(existente?.nome_contato ?? '');
    setWhatsapp(existente?.whatsapp ?? '');
    setUsuario(existente?.usuario ?? '');
    setUsuarioEditado(false);
    setSenha(cliente === 'novo' ? gerarSenha() : '');
    setTipo(existente?.tipo ?? 'novo');
    setOnboarding(existente?.data_onboarding ?? (cliente === 'novo' ? hoje : ''));
    setAtivo(existente?.ativo ?? true);
  }, [cliente, existente, hoje]);

  if (!cliente) return null;

  const janela = tipo === 'novo' && onboarding ? janelaClienteNovo(onboarding, mapa) : null;

  // Enquanto o usuário não for editado à mão, ele acompanha o nome da empresa.
  const mudarEmpresa = (v: string) => {
    setEmpresa(v);
    if (!existente && !usuarioEditado) setUsuario(normalizarUsuario(v));
  };

  const salvar = async () => {
    setErro(null);
    if (!empresa.trim() || !contato.trim()) return setErro('Preencha empresa e nome do contato.');
    if (tipo === 'novo' && !onboarding) return setErro('Informe a data do onboarding do cliente novo.');
    setSalvando(true);

    if (!existente) {
      const r = await gerenciarAcesso({
        acao: 'criar_cliente',
        usuario,
        senha,
        empresa: empresa.trim(),
        nome_contato: contato.trim(),
        whatsapp: whatsapp.trim() || null,
        tipo,
        data_onboarding: onboarding || null,
      });
      setSalvando(false);
      if (r.error) return setErro(r.error);
      aoSalvar();
      aoFechar();
      aoCriar({ empresa: empresa.trim(), nome: contato.trim(), usuario: r.usuario ?? usuario, senha });
      return;
    }

    const { error } = await supabase
      .from('clientes')
      .update({
        empresa: empresa.trim(),
        nome_contato: contato.trim(),
        whatsapp: whatsapp.trim() || null,
        tipo,
        data_onboarding: onboarding || null,
        ativo,
      })
      .eq('id', existente.id);
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    mostrar('Cliente atualizado.');
    aoSalvar();
    aoFechar();
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={existente ? `Editar ${existente.empresa}` : 'Criar login de cliente'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            {existente ? 'Salvar alterações' : 'Criar login'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Empresa" htmlFor="c-empresa">
          <Entrada id="c-empresa" value={empresa} onChange={(e) => mudarEmpresa(e.target.value)} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do contato" htmlFor="c-contato">
            <Entrada id="c-contato" value={contato} onChange={(e) => setContato(e.target.value)} />
          </Campo>
          <Campo rotulo="WhatsApp" htmlFor="c-whats" dica="Com DDD. Ex.: 21 99999-9999">
            <Entrada id="c-whats" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </Campo>
        </div>

        {existente ? (
          <div className="rounded-lg bg-superficie2 p-3 text-sm">
            <span className="text-apagado">Usuário de login: </span>
            <span className="numeros font-semibold">{existente.usuario}</span>
            <p className="mt-1 text-xs text-apagado">Para trocar a senha, use o botão "Senha" na lista de clientes.</p>
          </div>
        ) : (
          <div className="grid gap-4 rounded-lg border border-azul/40 bg-azul-suave/30 p-4 sm:grid-cols-2">
            <Campo rotulo="Usuário" htmlFor="c-usuario" dica="Minúsculas, sem espaço e sem acento.">
              <Entrada
                id="c-usuario"
                autoCapitalize="none"
                spellCheck={false}
                value={usuario}
                onChange={(e) => {
                  setUsuarioEditado(true);
                  setUsuario(normalizarUsuario(e.target.value));
                }}
                className="numeros"
              />
            </Campo>
            <Campo rotulo="Senha" htmlFor="c-senha" dica="Pelo menos 6 caracteres.">
              <div className="flex gap-2">
                <Entrada id="c-senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="numeros" />
                <Botao
                  variante="secundario"
                  icone={<RefreshCw className="h-4 w-4" />}
                  onClick={() => setSenha(gerarSenha())}
                  aria-label="Gerar outra senha"
                />
              </div>
            </Campo>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tipo" htmlFor="c-tipo">
            <Selecao id="c-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCliente)}>
              <option value="novo">Novo (acabou de passar pelo onboarding)</option>
              <option value="recorrente">Recorrente</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Data do onboarding" htmlFor="c-onb">
            <Entrada id="c-onb" type="date" value={onboarding} onChange={(e) => setOnboarding(e.target.value)} />
          </Campo>
        </div>

        {janela && (
          <Aviso tipo="info">
            Janela de gravação: de {fmtData(janela.inicio)} a {fmtData(janela.fim)} (5º ao 7º dia útil depois do onboarding).
          </Aviso>
        )}

        {existente && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-linha p-3">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--azul))]"
            />
            <span className="text-sm">
              <span className="font-semibold">Cliente ativo</span>
              <span className="block text-apagado">Desmarque para bloquear o acesso sem apagar o histórico.</span>
            </span>
          </label>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

/** Troca a senha do cliente pela função gerenciar-acesso (acao "redefinir_senha"). */
function SenhaModal({
  cliente,
  aoFechar,
  aoTrocar,
}: {
  cliente: Cliente | null;
  aoFechar: () => void;
  aoTrocar: (d: DadosAcesso) => void;
}) {
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente) return;
    setSenha(gerarSenha());
    setErro(null);
  }, [cliente]);

  if (!cliente) return null;

  const trocar = async () => {
    setErro(null);
    setSalvando(true);
    const r = await gerenciarAcesso({ acao: 'redefinir_senha', usuario: cliente.usuario, senha });
    setSalvando(false);
    if (r.error) return setErro(r.error);
    aoFechar();
    aoTrocar({ empresa: cliente.empresa, nome: cliente.nome_contato, usuario: cliente.usuario ?? '', senha });
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Nova senha para ${cliente.empresa}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={trocar} carregando={salvando}>
            Trocar senha
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-apagado">
          Usuário: <span className="numeros font-semibold text-tinta">{cliente.usuario}</span>. A senha antiga deixa de funcionar na
          hora.
        </p>
        <Campo rotulo="Nova senha" htmlFor="nova-senha" dica="Pelo menos 6 caracteres.">
          <div className="flex gap-2">
            <Entrada id="nova-senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="numeros" />
            <Botao
              variante="secundario"
              icone={<RefreshCw className="h-4 w-4" />}
              onClick={() => setSenha(gerarSenha())}
              aria-label="Gerar outra senha"
            />
          </div>
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

/** Mostra usuário e senha recém-criados com uma mensagem pronta para enviar ao cliente. */
function AcessoModal({ dados, aoFechar }: { dados: DadosAcesso | null; aoFechar: () => void }) {
  const { mostrar } = useToast();
  if (!dados) return null;

  const mensagem = [
    `Olá, ${dados.nome.split(' ')[0]}! Este é o seu acesso à agenda de gravações da G7.`,
    '',
    `Acesse: ${linkDoSistema('/login')}`,
    `Usuário: ${dados.usuario}`,
    `Senha: ${dados.senha}`,
  ].join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      mostrar('Mensagem copiada.');
    } catch {
      window.prompt('Copie o texto abaixo:', mensagem);
    }
  };

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Acesso de ${dados.empresa}`} rodape={<Botao onClick={aoFechar}>Pronto</Botao>}>
      <div className="space-y-4">
        <Aviso tipo="atencao">Anote ou envie a senha agora. Por segurança, ela não fica salva para consulta depois.</Aviso>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-superficie2 p-4">
          <dt className="text-sm text-apagado">Usuário</dt>
          <dd className="numeros font-semibold">{dados.usuario}</dd>
          <dt className="text-sm text-apagado">Senha</dt>
          <dd className="numeros font-semibold text-azul">{dados.senha}</dd>
        </dl>
        <AreaTexto
          readOnly
          rows={6}
          value={mensagem}
          style={{ minHeight: 140 }}
          className="font-mono text-[13px]"
          aria-label="Mensagem com o acesso"
        />
        <Botao icone={<Copy className="h-4 w-4" />} onClick={copiar}>
          Copiar mensagem
        </Botao>
      </div>
    </Modal>
  );
}

const STATUS: Record<Gravacao['status'], { texto: string; tipo: 'recorrente' | 'sucesso' | 'erro' }> = {
  confirmada: { texto: 'Confirmada', tipo: 'recorrente' },
  realizada: { texto: 'Realizada', tipo: 'sucesso' },
  nao_realizada: { texto: 'Não realizada', tipo: 'erro' },
  cancelada: { texto: 'Cancelada', tipo: 'erro' },
};

function HistoricoModal({ cliente, aoFechar }: { cliente: Cliente | null; aoFechar: () => void }) {
  const [lista, setLista] = useState<Gravacao[] | null>(null);

  useEffect(() => {
    if (!cliente) return;
    setLista(null);
    supabase
      .from('gravacoes')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('data', { ascending: false })
      .then(({ data }) => setLista((data as Gravacao[] | null) ?? []));
  }, [cliente]);

  if (!cliente) return null;

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Histórico de ${cliente.empresa}`}>
      {!lista ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-apagado">Nenhuma gravação ainda.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {lista.map((g) => (
            <li key={g.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium first-letter:uppercase">{fmtSlot(g.data, g.periodo)}</p>
                <Selo tipo={STATUS[g.status].tipo}>{STATUS[g.status].texto}</Selo>
              </div>
              {(g.motivo_cancelamento || g.motivo_nao_realizada) && (
                <p className="mt-1 text-xs text-apagado">Motivo: {g.motivo_cancelamento ?? g.motivo_nao_realizada}</p>
              )}
              {g.ultima_alteracao && <p className="mt-1 text-xs text-apagado">{g.ultima_alteracao}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
