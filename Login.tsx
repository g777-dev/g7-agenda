import { useState, type FormEvent } from 'react';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import { mensagemErro } from '../lib/erros';
import { Aviso, Botao, Campo, Entrada } from '../components/ui';
import { Marca } from '../components/comuns';

type Aba = 'entrar' | 'primeiro' | 'esqueci';

export default function Login() {
  const [aba, setAba] = useState<Aba>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    setErro(null);
    setSucesso(null);
    setSenha('');
    setConfirmar('');
  };

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    setEnviando(false);
    if (error) setErro(mensagemErro(error));
  };

  const criarAcesso = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não são iguais.');

    setEnviando(true);
    const emailLimpo = email.trim().toLowerCase();
    const { data: situacao, error: erroCheck } = await supabase.rpc('email_pode_cadastrar', { p_email: emailLimpo });
    if (erroCheck) {
      setEnviando(false);
      return setErro(mensagemErro(erroCheck));
    }
    if (situacao === 'ja_cadastrado') {
      setEnviando(false);
      return setErro('Este e-mail já tem acesso. Use a aba Entrar ou "Esqueci minha senha".');
    }
    if (situacao === 'nao_encontrado') {
      setEnviando(false);
      return setErro('Este e-mail não está cadastrado. Confirme com a equipe da G7 qual e-mail foi usado no seu cadastro.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailLimpo,
      password: senha,
      options: { emailRedirectTo: window.location.origin },
    });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    if (!data.session) {
      setSucesso('Acesso criado. Enviamos um link de confirmação para o seu e-mail. Clique nele e depois entre com sua senha.');
    }
  };

  const recuperar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    setSucesso('Se este e-mail tiver acesso, você vai receber um link para criar uma nova senha.');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Marca subtitulo="Agenda de gravações" />
        </div>

        {!supabaseConfigurado && (
          <Aviso tipo="erro" titulo="Sistema sem conexão com o banco" className="mb-4">
            Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja o README).
          </Aviso>
        )}

        {aba !== 'esqueci' && (
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-superficie2 p-1" role="tablist">
            {(['entrar', 'primeiro'] as const).map((a) => (
              <button
                key={a}
                role="tab"
                aria-selected={aba === a}
                onClick={() => trocarAba(a)}
                className={`h-9 rounded-md text-sm font-semibold cursor-pointer ${aba === a ? 'bg-superficie shadow-sm' : 'text-apagado hover:text-tinta'}`}
              >
                {a === 'entrar' ? 'Entrar' : 'Primeiro acesso'}
              </button>
            ))}
          </div>
        )}

        {aba === 'entrar' && (
          <form onSubmit={entrar} className="space-y-4">
            <h1 className="titulo text-3xl font-extrabold">Entre para agendar sua gravação</h1>
            <Campo rotulo="E-mail" htmlFor="email">
              <Entrada id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
            <Campo rotulo="Senha" htmlFor="senha">
              <Entrada id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <Botao type="submit" tamanho="g" className="w-full" carregando={enviando}>
              Entrar
            </Botao>
            <button type="button" onClick={() => trocarAba('esqueci')} className="w-full text-center text-sm font-medium text-azul-tinta hover:underline cursor-pointer">
              Esqueci minha senha
            </button>
          </form>
        )}

        {aba === 'primeiro' && (
          <form onSubmit={criarAcesso} className="space-y-4">
            <h1 className="titulo text-3xl font-extrabold">Crie sua senha</h1>
            <p className="text-sm text-apagado">Use o mesmo e-mail que você passou para a equipe da G7 no onboarding.</p>
            <Campo rotulo="E-mail" htmlFor="email-novo">
              <Entrada id="email-novo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
            <Campo rotulo="Senha" dica="Pelo menos 6 caracteres." htmlFor="senha-nova">
              <Entrada id="senha-nova" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
            <Campo rotulo="Confirme a senha" htmlFor="senha-confirmar">
              <Entrada id="senha-confirmar" type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </Campo>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
            <Botao type="submit" tamanho="g" className="w-full" carregando={enviando}>
              Criar acesso
            </Botao>
          </form>
        )}

        {aba === 'esqueci' && (
          <form onSubmit={recuperar} className="space-y-4">
            <h1 className="titulo text-3xl font-extrabold">Recuperar senha</h1>
            <p className="text-sm text-apagado">Enviaremos um link para você criar uma nova senha.</p>
            <Campo rotulo="E-mail" htmlFor="email-rec">
              <Entrada id="email-rec" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
            <Botao type="submit" tamanho="g" className="w-full" carregando={enviando}>
              Enviar link
            </Botao>
            <button type="button" onClick={() => trocarAba('entrar')} className="w-full text-center text-sm font-medium text-azul-tinta hover:underline cursor-pointer">
              Voltar para o login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
