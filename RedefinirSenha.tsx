import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mensagemErro } from '../lib/erros';
import { useAuth } from '../contexts/AuthContext';
import { Aviso, Botao, Campo, Carregando, Entrada, useToast } from '../components/ui';
import { Marca } from '../components/comuns';

export default function RedefinirSenha() {
  const { sessao, carregando } = useAuth();
  const navegar = useNavigate();
  const { mostrar } = useToast();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não são iguais.');
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    mostrar('Senha alterada.');
    navegar('/', { replace: true });
  };

  if (carregando) return <Carregando />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <Marca subtitulo="Agenda de gravações" />
        <h1 className="titulo pt-4 text-3xl font-extrabold">Crie uma nova senha</h1>
        {!sessao ? (
          <Aviso tipo="erro">
            Este link expirou ou já foi usado. Volte para o login e peça um novo em "Esqueci minha senha".
          </Aviso>
        ) : (
          <form onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Nova senha" dica="Pelo menos 6 caracteres." htmlFor="nova">
              <Entrada id="nova" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
            <Campo rotulo="Confirme a nova senha" htmlFor="conf">
              <Entrada id="conf" type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </Campo>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <Botao type="submit" tamanho="g" className="w-full" carregando={enviando}>
              Salvar nova senha
            </Botao>
          </form>
        )}
      </div>
    </main>
  );
}
