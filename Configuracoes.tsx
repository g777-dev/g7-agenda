import { useCallback, useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro } from '../../lib/erros';
import { useAuth } from '../../contexts/AuthContext';
import type { MembroEquipe } from '../../lib/tipos';
import { Aviso, Botao, Campo, Cartao, Carregando, Entrada, useToast } from '../../components/ui';

export default function Configuracoes() {
  const { mostrar } = useToast();
  const { sessao } = useAuth();
  const meuEmail = sessao?.user.email?.toLowerCase();

  const [equipe, setEquipe] = useState<MembroEquipe[] | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [erroEquipe, setErroEquipe] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const [whatsapp, setWhatsapp] = useState('');
  const [salvandoWhats, setSalvandoWhats] = useState(false);

  const carregar = useCallback(async () => {
    const [e, c] = await Promise.all([
      supabase.from('equipe').select('*').order('nome'),
      supabase.from('configuracoes').select('whatsapp_equipe').eq('id', 1).maybeSingle(),
    ]);
    setEquipe((e.data as MembroEquipe[]) ?? []);
    setWhatsapp(c.data?.whatsapp_equipe ?? '');
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = async () => {
    setErroEquipe(null);
    if (!nome.trim() || !email.trim()) return setErroEquipe('Preencha nome e e-mail.');
    setAdicionando(true);
    const { error } = await supabase.from('equipe').insert({ nome: nome.trim(), email: email.trim().toLowerCase() });
    setAdicionando(false);
    if (error) {
      if (error.message.includes('equipe_pkey')) return setErroEquipe('Este e-mail já está na equipe.');
      return setErroEquipe(mensagemErro(error));
    }
    mostrar(`${nome.trim()} foi adicionada à equipe.`);
    setNome('');
    setEmail('');
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

  const salvarWhatsapp = async () => {
    setSalvandoWhats(true);
    const { error } = await supabase.from('configuracoes').update({ whatsapp_equipe: whatsapp.trim() || null }).eq('id', 1);
    setSalvandoWhats(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('WhatsApp de contato salvo.');
  };

  if (!equipe) return <Carregando />;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="titulo text-3xl font-extrabold">Equipe e ajustes</h1>
        <p className="mt-1 text-apagado">Quem está na equipe tem acesso total ao painel: aprova, agenda, remarca e cancela gravações de qualquer cliente.</p>
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
                <p className="text-sm text-apagado">{m.email}</p>
              </div>
              {equipe.length > 1 && (
                <Botao variante="fantasma" tamanho="p" icone={<Trash2 className="h-4 w-4" />} carregando={removendo === m.email} onClick={() => remover(m)}>
                  Remover
                </Botao>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-linha pt-4">
          <h3 className="font-semibold">Adicionar pessoa</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" htmlFor="eq-nome">
              <Entrada id="eq-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Eduarda" />
            </Campo>
            <Campo rotulo="E-mail" htmlFor="eq-email">
              <Entrada id="eq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
          </div>
          {erroEquipe && <Aviso tipo="erro" className="mt-4">{erroEquipe}</Aviso>}
          <Aviso tipo="info" className="mt-4">
            Depois de adicionar, a pessoa abre o sistema, vai em "Primeiro acesso" e cria a senha com este e-mail. Se ela já tiver
            uma conta, o acesso ao painel é liberado na hora.
          </Aviso>
          <Botao className="mt-4" icone={<UserPlus className="h-4 w-4" />} onClick={adicionar} carregando={adicionando}>
            Adicionar à equipe
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
              <Entrada id="whats" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </Campo>
          </div>
          <Botao onClick={salvarWhatsapp} carregando={salvandoWhats} className="sm:mb-[22px]">Salvar</Botao>
        </div>
      </Cartao>
    </div>
  );
}
