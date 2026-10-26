import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useBloqueios } from '../../lib/dados';
import { PERIODOS, ehFimDeSemana, fmtData, hojeBR, nomeDia, nomeFeriado, somarDias } from '../../lib/datas';
import type { Periodo } from '../../lib/tipos';
import { Aviso, Botao, Campo, Cartao, Carregando, Entrada, Selecao, Vazio, useToast } from '../../components/ui';

export default function Bloqueios() {
  const { mostrar } = useToast();
  const hoje = hojeBR();
  const { lista, pronto, recarregar } = useBloqueios(hoje, somarDias(hoje, 365));
  const [data, setData] = useState('');
  const [periodo, setPeriodo] = useState<'' | Periodo>('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const ordenados = useMemo(() => [...lista].sort((a, b) => (a.data + (a.periodo ?? '')).localeCompare(b.data + (b.periodo ?? ''))), [lista]);

  const feriados = useMemo(() => {
    const r: { data: string; nome: string }[] = [];
    for (let i = 0; i <= 120; i++) {
      const d = somarDias(hoje, i);
      const nome = nomeFeriado(d);
      if (nome && !ehFimDeSemana(d)) r.push({ data: d, nome });
    }
    return r;
  }, [hoje]);

  const criar = async () => {
    setErro(null);
    if (!data) return setErro('Escolha a data.');
    if (data < hoje) return setErro('Escolha uma data a partir de hoje.');
    if (!motivo.trim()) return setErro('Informe o motivo. Ex.: feriado municipal, folga, manutenção do equipamento.');
    setSalvando(true);
    const { error } = await supabase.from('bloqueios').insert({ data, periodo: periodo || null, motivo: motivo.trim() });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    mostrar('Bloqueio criado.');
    setData('');
    setPeriodo('');
    setMotivo('');
    recarregar();
  };

  const remover = async (id: string) => {
    setRemovendo(id);
    const { error } = await supabase.from('bloqueios').delete().eq('id', id);
    setRemovendo(null);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Bloqueio removido.');
    recarregar();
  };

  if (!pronto) return <Carregando />;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="titulo text-3xl font-extrabold">Bloqueios</h1>
      <p className="mt-1 text-apagado">Feche um dia ou um período da agenda. Clientes não conseguem pedir horários bloqueados.</p>

      <Cartao className="mt-6 p-5">
        <h2 className="titulo text-xl font-bold">Novo bloqueio</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Data" htmlFor="b-data">
            <Entrada id="b-data" type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="O que bloquear" htmlFor="b-periodo">
            <Selecao id="b-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as '' | Periodo)}>
              <option value="">Dia inteiro</option>
              <option value="manha">Só a manhã (09:00–12:00)</option>
              <option value="tarde">Só a tarde (14:00–17:30)</option>
            </Selecao>
          </Campo>
        </div>
        <div className="mt-4">
          <Campo rotulo="Motivo" htmlFor="b-motivo">
            <Entrada id="b-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Feriado municipal de Magé" />
          </Campo>
        </div>
        {erro && <Aviso tipo="erro" className="mt-4">{erro}</Aviso>}
        <Aviso tipo="info" className="mt-4">
          Bloquear não cancela gravações que já estão confirmadas nesse horário. Remarque essas pela Agenda.
        </Aviso>
        <div className="mt-4">
          <Botao onClick={criar} carregando={salvando}>Criar bloqueio</Botao>
        </div>
      </Cartao>

      <section className="mt-8">
        <h2 className="titulo mb-3 text-xl font-bold">Próximos bloqueios</h2>
        {ordenados.length === 0 ? (
          <Vazio titulo="Nenhum bloqueio" texto="A agenda está aberta em todos os dias úteis." />
        ) : (
          <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
            {ordenados.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    <span className="numeros">{fmtData(b.data)}</span>, <span>{nomeDia(b.data)}</span>
                  </p>
                  <p className="text-sm text-apagado">
                    {b.periodo ? `${PERIODOS[b.periodo].nome} (${PERIODOS[b.periodo].horario})` : 'Dia inteiro'}: {b.motivo}
                  </p>
                </div>
                <Botao variante="fantasma" tamanho="p" icone={<Trash2 className="h-4 w-4" />} carregando={removendo === b.id} onClick={() => remover(b.id)}>
                  Remover
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="titulo mb-1 text-xl font-bold">Feriados nacionais nos próximos meses</h2>
        <p className="mb-3 text-sm text-apagado">Já ficam fechados automaticamente. Feriados municipais precisam de bloqueio.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {feriados.map((f) => (
            <li key={f.data} className="rounded-lg bg-superficie2 px-3 py-2 text-sm">
              <span className="numeros font-semibold">{fmtData(f.data)}</span> {f.nome}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
