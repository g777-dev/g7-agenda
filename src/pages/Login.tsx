import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import { mensagemErro } from '../lib/erros';
import { Aviso, Botao, Campo, Entrada } from '../components/ui';
import { LogoG7 } from '../components/comuns';
import { BotaoInstalar } from '../components/Aparelho';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const digitado = usuario.trim().toLowerCase();
    // Aceita o usuário (ex.: "padaria-central") ou o e-mail
    let email: string | null = digitado.includes('@') ? digitado : null;
    if (!email) {
      const { data } = await supabase.rpc('email_do_usuario', { p_usuario: digitado });
      email = (data as string | null) ?? null;
    }
    if (!email) {
      setEnviando(false);
      return setErro('Usuário ou senha incorretos.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) setErro(mensagemErro(error));
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-azul/10 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <LogoG7 className="h-12 w-12" />
          <div className="leading-tight">
            <p className="titulo text-lg font-bold">G7 Soluções Digitais</p>
            <p className="text-sm text-apagado">Agenda de gravações</p>
          </div>
        </div>

        {!supabaseConfigurado && (
          <Aviso tipo="erro" titulo="Sistema sem conexão com o banco" className="mb-4">
            Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).
          </Aviso>
        )}

        <form onSubmit={entrar} className="space-y-4">
          <h1 className="titulo text-3xl font-bold">
            Agende sua <span className="text-azul">gravação</span>
          </h1>
          <p className="text-sm text-apagado">Entre com o usuário e a senha que a equipe G7 enviou para você.</p>

          <Campo rotulo="Usuário" htmlFor="usuario">
            <Entrada
              id="usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </Campo>

          <Campo rotulo="Senha" htmlFor="senha">
            <div className="relative">
              <Entrada
                id="senha"
                type={verSenha ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-apagado hover:text-tinta cursor-pointer"
                aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              >
                {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Campo>

          {erro && <Aviso tipo="erro">{erro}</Aviso>}

          <Botao type="submit" tamanho="g" className="w-full" carregando={enviando}>
            Entrar
          </Botao>
          <p className="text-center text-xs text-apagado">Esqueceu a senha? Fale com a equipe G7 no grupo.</p>
        </form>

        <div className="mt-8">
          <BotaoInstalar />
        </div>
      </div>
    </main>
  );
}
