import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Lock, LockOpen, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { fmtData, fmtMes, hojeBR, janelaClienteNovo, mesDe, proximosMeses, somarDias } from '../../lib/datas';
import { SENHA_PADRAO, copiarTexto, gerarSenha, gerenciarAcesso, linkDoSistema } from '../../lib/acesso';
import { useAuth } from '../../contexts/AuthContext';
import type { Cliente, Janela } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Cartao, Carregando, Entrada, Selecao, Selo, useToast } from '../../components/ui';

export default function Janelas() {
  const { mostrar } = useToast();
  const { nomeEquipe } = useAuth();
  const meses = useMemo(() => proximosMeses(6), []);
  const [janelas, setJanelas] = useState<Janela[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [mesLink, setMesLink] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [j, c] = await Promise.all([
      supabase.from('janelas').select('*').gte('mes', mesDe(hojeBR())).order('mes'),
      supabase.from('clientes').select('*').eq('ativo', true).order('empresa'),
    ]);
    const lista = (j.data as Janela[] | null) ?? [];
    setJanelas(lista);
    setClientes((c.data as Cliente[] | null) ?? []);
    setMesLink((atual) => atual ?? lista.find((x) => x.aberta)?.mes ?? null);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = async (mes: string) => {
    setSalvando(mes);
    const { error } = await supabase.from('janelas').upsert({
      mes,
      aberta: true,
      aberta_por: nomeEquipe,
      updated_at: new Date().toISOString(),
    });
    setSalvando(null);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar(`Agenda de ${fmtMes(mes)} aberta. O link já está pronto.`);
    setMesLink(mes);
    carregar();
  };

  const fechar = async (mes: string) => {
    setSalvando(mes);
    const { error } = await supabase
      .from('janelas')
      .update({ aberta: false, updated_at: new Date().toISOString() })
      .eq('mes', mes);
    setSalvando(null);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar(`Agenda de ${fmtMes(mes)} fechada. Os clientes não conseguem mais pedir horário nesse mês.`);
    carregar();
  };

  if (!janelas) return <Carregando />;
  const abertas = janelas.filter((j) => j.aberta);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="titulo text-3xl font-bold">Janelas de gravação</h1>
      <p className="mt-1 text-apagado">
        Abra a agenda do mês para gerar o link. Envie o link no grupo do cliente junto com o usuário e a senha dele.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map((mes) => {
          const j = janelas.find((x) => x.mes === mes);
          const aberta = !!j?.aberta;
          return (
            <Cartao key={mes} className={`p-4 ${aberta ? 'border-azul/60' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold first-letter:uppercase">{fmtMes(mes)}</p>
                {aberta ? <Selo tipo="recorrente">Aberta</Selo> : j ? <Selo>Fechada</Selo> : <Selo>Não aberta</Selo>}
              </div>
              {j?.aberta_por && aberta && <p className="mt-1 text-xs text-apagado">Aberta por {j.aberta_por}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {aberta ? (
                  <>
                    <Botao tamanho="p" icone={<Copy className="h-4 w-4" />} onClick={() => setMesLink(mes)}>
                      Ver link
                    </Botao>
                    <Botao
                      tamanho="p"
                      variante="fantasma"
                      icone={<Lock className="h-4 w-4" />}
                      carregando={salvando === mes}
                      onClick={() => fechar(mes)}
                    >
                      Fechar
                    </Botao>
                  </>
                ) : (
                  <Botao
                    tamanho="p"
                    variante="secundario"
                    icone={<LockOpen className="h-4 w-4" />}
                    carregando={salvando === mes}
                    onClick={() => abrir(mes)}
                  >
                    Abrir janela
                  </Botao>
                )}
              </div>
            </Cartao>
          );
        })}
      </div>

      {abertas.length === 0 ? (
        <Aviso tipo="info" className="mt-6">
          Nenhuma agenda aberta. Clientes novos continuam podendo agendar dentro do prazo deles (5º ao 7º dia útil depois do
          onboarding) mesmo com a agenda fechada.
        </Aviso>
      ) : (
        mesLink &&
        abertas.some((j) => j.mes === mesLink) && (
          <PainelLink mes={mesLink} clientes={clientes} meses={abertas.map((j) => j.mes)} aoTrocarMes={setMesLink} />
        )
      )}
    </div>
  );
}

function PainelLink({
  mes,
  clientes,
  meses,
  aoTrocarMes,
}: {
  mes: string;
  clientes: Cliente[];
  meses: string[];
  aoTrocarMes: (mes: string) => void;
}) {
  const { mostrar } = useToast();
  const hoje = hojeBR();
  const { mapa } = useBloqueios(somarDias(hoje, -60), somarDias(hoje, 60));
  const [clienteId, setClienteId] = useState('');
  const [senha, setSenha] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cliente = clientes.find((c) => c.id === clienteId);
  const ehNovo = cliente?.tipo === 'novo' && !!cliente.data_onboarding;
  const link = linkDoSistema(ehNovo ? '/agendar' : `/agendar/${mes}`);
  const janela = ehNovo && cliente?.data_onboarding ? janelaClienteNovo(cliente.data_onboarding, mapa) : null;

  useEffect(() => {
    setSenha(clienteId ? SENHA_PADRAO : '');
    setErro(null);
  }, [clienteId]);

  const gerar = async () => {
    if (!cliente) return;
    setErro(null);
    setGerando(true);
    const nova = gerarSenha();
    const r = await gerenciarAcesso({ acao: 'redefinir_senha', usuario: cliente.usuario, senha: nova });
    setGerando(false);
    if (r.error) return setErro(r.error);
    setSenha(nova);
    mostrar(`A senha de ${cliente.empresa} agora é ${nova}.`);
  };

  const mensagem = cliente
    ? [
        `Olá, ${cliente.nome_contato.split(' ')[0]}!`,
        '',
        janela
          ? `Sua agenda de gravação com a G7 já está aberta. A gravação precisa acontecer entre ${fmtData(janela.inicio)} e ${fmtData(janela.fim)}.`
          : `A agenda de gravações de ${fmtMes(mes)} da G7 já está aberta.`,
        '',
        `Acesse: ${link}`,
        `Usuário: ${cliente.usuario}`,
        `Senha: ${senha || '(sua senha)'}`,
        '',
        'Escolha uma 1ª e uma 2ª opção de horário. Nossa equipe confirma pelo sistema.',
        'Cancelamentos e remarcações: no mínimo 48 horas antes da gravação.',
      ].join('\n')
    : '';

  return (
    <Cartao className="mt-6 p-5">
      <h2 className="titulo text-xl font-bold">Link para enviar no grupo</h2>
      {meses.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {meses.map((m) => (
            <button
              key={m}
              onClick={() => aoTrocarMes(m)}
              className={`rounded-full px-3 py-1 text-sm font-medium cursor-pointer ${m === mes ? 'bg-azul text-sobre' : 'bg-superficie2 text-apagado hover:text-tinta'}`}
            >
              <span className="first-letter:uppercase">{fmtMes(m)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-azul/40 bg-azul-suave/40 p-3 sm:flex-row sm:items-center">
        <p className="numeros min-w-0 flex-1 break-all text-sm text-azul-tinta">{linkDoSistema(`/agendar/${mes}`)}</p>
        <Botao
          tamanho="p"
          icone={<Copy className="h-4 w-4" />}
          onClick={() => copiarTexto(linkDoSistema(`/agendar/${mes}`), mostrar, 'Link copiado.')}
        >
          Copiar link
        </Botao>
      </div>

      <div className="mt-6 border-t border-linha pt-5">
        <h3 className="font-semibold">Mensagem pronta com login e senha</h3>
        <p className="mt-1 text-sm text-apagado">Escolha o cliente para montar a mensagem com o usuário dele.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Cliente" htmlFor="msg-cliente">
            <Selecao id="msg-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.empresa}
                  {c.tipo === 'novo' ? ' (novo)' : ''}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Senha" htmlFor="msg-senha" dica={`Senha padrão dos clientes: ${SENHA_PADRAO}. "Aplicar" garante que ela vale para este cliente.`}>
            <div className="flex gap-2">
              <Entrada id="msg-senha" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={!cliente} />
              <Botao
                variante="secundario"
                icone={<RefreshCw className="h-4 w-4" />}
                disabled={!cliente}
                carregando={gerando}
                onClick={gerar}
              >
                Aplicar
              </Botao>
            </div>
          </Campo>
        </div>
        {erro && (
          <Aviso tipo="erro" className="mt-4">
            {erro}
          </Aviso>
        )}
        {cliente && (
          <>
            {janela && (
              <Aviso tipo="info" className="mt-4">
                Cliente novo: o link leva direto para a janela dele ({fmtData(janela.inicio)} a {fmtData(janela.fim)}).
              </Aviso>
            )}
            <AreaTexto
              readOnly
              rows={11}
              value={mensagem}
              style={{ minHeight: 240 }}
              className="mt-4 font-mono text-[13px]"
              aria-label="Mensagem para o cliente"
            />
            <Botao
              className="mt-3"
              icone={<Check className="h-4 w-4" />}
              onClick={() => copiarTexto(mensagem, mostrar, 'Mensagem copiada. É só colar no grupo.')}
            >
              Copiar mensagem
            </Botao>
          </>
        )}
      </div>
    </Cartao>
  );
}
