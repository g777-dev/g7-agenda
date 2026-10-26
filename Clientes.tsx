import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Pencil, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { fmtData, fmtSlot, hojeBR, janelaClienteNovo, somarDias } from '../../lib/datas';
import type { Cliente, Gravacao, TipoCliente } from '../../lib/tipos';
import { Aviso, Botao, Campo, Cartao, Carregando, Entrada, Modal, Selecao, Selo, Vazio, useToast } from '../../components/ui';

type Filtro = 'ativos' | 'novos' | 'recorrentes' | 'inativos';

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null);
  const [historicoDe, setHistoricoDe] = useState<Cliente | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('clientes').select('*').order('empresa');
    setClientes((data as Cliente[]) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (clientes ?? []).filter((c) => {
      if (filtro === 'ativos' && !c.ativo) return false;
      if (filtro === 'novos' && (!c.ativo || c.tipo !== 'novo')) return false;
      if (filtro === 'recorrentes' && (!c.ativo || c.tipo !== 'recorrente')) return false;
      if (filtro === 'inativos' && c.ativo) return false;
      return !b || `${c.empresa} ${c.nome_contato} ${c.email} ${c.whatsapp ?? ''}`.toLowerCase().includes(b);
    });
  }, [clientes, busca, filtro]);

  if (!clientes) return <Carregando />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo text-3xl font-extrabold">Clientes</h1>
          <p className="mt-1 text-apagado">Cadastre o cliente aqui e ele cria a senha em "Primeiro acesso" com o mesmo e-mail.</p>
        </div>
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>Cadastrar cliente</Botao>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" aria-hidden />
          <Entrada aria-label="Buscar cliente" placeholder="Buscar por empresa, contato, e-mail ou WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Selecao aria-label="Filtrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className="sm:w-48">
          <option value="ativos">Todos os ativos</option>
          <option value="novos">Clientes novos</option>
          <option value="recorrentes">Recorrentes</option>
          <option value="inativos">Desativados</option>
        </Selecao>
      </div>

      <div className="mt-4">
        {lista.length === 0 ? (
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
                  <th className="px-4 py-3 font-semibold">Acesso</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {lista.map((c) => (
                  <tr key={c.id} className={c.ativo ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 font-semibold">{c.empresa}</td>
                    <td className="px-4 py-3">
                      <p>{c.nome_contato}</p>
                      <p className="text-xs text-apagado">{c.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Selo tipo={c.tipo === 'novo' ? 'novo' : 'recorrente'}>{c.tipo === 'novo' ? 'Novo' : 'Recorrente'}</Selo>
                    </td>
                    <td className="numeros px-4 py-3">{c.data_onboarding ? fmtData(c.data_onboarding) : '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {!c.ativo ? <Selo>Desativado</Selo> : c.user_id ? <Selo tipo="sucesso">Ativo</Selo> : <Selo tipo="pendente">Aguardando 1º acesso</Selo>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Botao variante="fantasma" tamanho="p" icone={<History className="h-4 w-4" />} onClick={() => setHistoricoDe(c)}>Histórico</Botao>
                        <Botao variante="fantasma" tamanho="p" icone={<Pencil className="h-4 w-4" />} onClick={() => setEditando(c)}>Editar</Botao>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        )}
      </div>

      <ModalCliente cliente={editando} aoFechar={() => setEditando(null)} aoSalvar={carregar} />
      <ModalHistorico cliente={historicoDe} aoFechar={() => setHistoricoDe(null)} />
    </div>
  );
}

function ModalCliente({ cliente, aoFechar, aoSalvar }: {
  cliente: Cliente | 'novo' | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { mostrar } = useToast();
  const hoje = hojeBR();
  const { mapa } = useBloqueios(somarDias(hoje, -60), somarDias(hoje, 60));
  const [empresa, setEmpresa] = useState('');
  const [contato, setContato] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tipo, setTipo] = useState<TipoCliente>('novo');
  const [onboarding, setOnboarding] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const editando = cliente && cliente !== 'novo' ? cliente : null;

  useEffect(() => {
    if (!cliente) return;
    setErro(null);
    setEmpresa(editando?.empresa ?? '');
    setContato(editando?.nome_contato ?? '');
    setEmail(editando?.email ?? '');
    setWhatsapp(editando?.whatsapp ?? '');
    setTipo(editando?.tipo ?? 'novo');
    setOnboarding(editando?.data_onboarding ?? (cliente === 'novo' ? hoje : ''));
    setAtivo(editando?.ativo ?? true);
  }, [cliente, editando, hoje]);

  if (!cliente) return null;

  const janela = tipo === 'novo' && onboarding ? janelaClienteNovo(onboarding, mapa) : null;

  const salvar = async () => {
    setErro(null);
    if (!empresa.trim() || !contato.trim() || !email.trim()) return setErro('Preencha empresa, contato e e-mail.');
    if (tipo === 'novo' && !onboarding) return setErro('Informe a data do onboarding do cliente novo.');
    const dados = {
      empresa: empresa.trim(),
      nome_contato: contato.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim() || null,
      tipo,
      data_onboarding: onboarding || null,
      ativo,
    };
    setSalvando(true);
    const { error } = editando
      ? await supabase.from('clientes').update(dados).eq('id', editando.id)
      : await supabase.from('clientes').insert(dados);
    setSalvando(false);
    if (error) {
      if (error.message.includes('clientes_email_key')) return setErro('Já existe um cliente com este e-mail.');
      return setErro(mensagemErro(error));
    }
    mostrar(editando ? 'Cliente atualizado.' : 'Cliente cadastrado. Avise que ele já pode criar a senha em "Primeiro acesso".');
    aoSalvar();
    aoFechar();
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={editando ? `Editar ${editando.empresa}` : 'Cadastrar cliente'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={salvar} carregando={salvando}>{editando ? 'Salvar alterações' : 'Cadastrar cliente'}</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Empresa" htmlFor="c-empresa">
          <Entrada id="c-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do contato" htmlFor="c-contato">
            <Entrada id="c-contato" value={contato} onChange={(e) => setContato(e.target.value)} />
          </Campo>
          <Campo rotulo="WhatsApp" htmlFor="c-whats" dica="Com DDD. Ex.: 21 99999-9999">
            <Entrada id="c-whats" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="E-mail" htmlFor="c-email" dica={editando?.user_id ? 'Este cliente já criou a senha. Trocar o e-mail aqui não muda o e-mail de login dele.' : 'O cliente usa este e-mail para criar a senha.'}>
          <Entrada id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
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
        {editando && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-linha p-3">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--azul))]" />
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

const STATUS_GRAVACAO: Record<Gravacao['status'], { texto: string; tipo: 'sucesso' | 'erro' | 'recorrente' }> = {
  confirmada: { texto: 'Confirmada', tipo: 'recorrente' },
  realizada: { texto: 'Realizada', tipo: 'sucesso' },
  cancelada: { texto: 'Cancelada', tipo: 'erro' },
};

function ModalHistorico({ cliente, aoFechar }: { cliente: Cliente | null; aoFechar: () => void }) {
  const [lista, setLista] = useState<Gravacao[] | null>(null);

  useEffect(() => {
    if (!cliente) return;
    setLista(null);
    supabase
      .from('gravacoes')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('data', { ascending: false })
      .then(({ data }) => setLista((data as Gravacao[]) ?? []));
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
                <Selo tipo={STATUS_GRAVACAO[g.status].tipo}>{STATUS_GRAVACAO[g.status].texto}</Selo>
              </div>
              {g.motivo_cancelamento && <p className="mt-1 text-xs text-apagado">Motivo: {g.motivo_cancelamento}</p>}
              {g.ultima_alteracao && <p className="mt-1 text-xs text-apagado">{g.ultima_alteracao}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
