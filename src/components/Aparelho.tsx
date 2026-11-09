import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Download, Share, Smartphone, SquarePlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mensagemErro } from '../lib/erros';
import {
  ativarNotificacoes,
  estadoNotificacoes,
  prepararSom,
  tocarSom,
  useInstalacao,
  type EstadoNotificacoes,
} from '../lib/aparelho';
import { Aviso, Botao, Modal, useToast } from './ui';

/** Passo a passo para instalar no iPhone/iPad (Safari) */
export function PassosIOS() {
  const numero =
    'numeros flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-azul text-xs font-bold text-sobre';
  return (
    <ol className="space-y-2.5 text-sm">
      <li className="flex items-start gap-2.5">
        <span className={numero}>1</span>
        <span>
          No Safari, toque em <Share className="inline h-4 w-4 align-[-3px]" aria-label="Compartilhar" />{' '}
          <strong>Compartilhar</strong>.
        </span>
      </li>
      <li className="flex items-start gap-2.5">
        <span className={numero}>2</span>
        <span>
          Escolha <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden />{' '}
          <strong>Adicionar à Tela de Início</strong>.
        </span>
      </li>
      <li className="flex items-start gap-2.5">
        <span className={numero}>3</span>
        <span>
          Abra o <strong>G7 Agenda</strong> pelo ícone novo.
        </span>
      </li>
    </ol>
  );
}

/** Botão "Instalar o app no celular" (some quando já está instalado ou não dá para instalar) */
export function BotaoInstalar() {
  const { instalado, podeInstalar, ios, instalar } = useInstalacao();
  const [passos, setPassos] = useState(false);
  if (instalado || (!podeInstalar && !ios)) return null;
  return (
    <>
      <Botao
        variante="secundario"
        className="w-full"
        icone={<Smartphone className="h-4 w-4" />}
        onClick={() => (podeInstalar ? instalar() : setPassos(true))}
      >
        Instalar o app no celular
      </Botao>
      <Modal aberto={passos} aoFechar={() => setPassos(false)} titulo="Instalar no iPhone ou iPad">
        <PassosIOS />
      </Modal>
    </>
  );
}

/** Estado das notificações deste aparelho */
export function useNotificacoes() {
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const atualizar = useCallback(() => {
    estadoNotificacoes()
      .then(setEstado)
      .catch(() => setEstado('indisponivel'));
  }, []);
  useEffect(() => {
    atualizar();
  }, [atualizar]);
  return { estado, setEstado, atualizar };
}

/** Janela "Notificações e app" do painel da equipe */
export function ModalAparelho({ aberto, aoFechar, estado, aoMudarEstado }: {
  aberto: boolean;
  aoFechar: () => void;
  estado: EstadoNotificacoes | null;
  aoMudarEstado: (estado: EstadoNotificacoes) => void;
}) {
  const { mostrar } = useToast();
  const { instalado, podeInstalar, ios, instalar } = useInstalacao();
  const [ligando, setLigando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ligar = async () => {
    setErro(null);
    setLigando(true);
    prepararSom();
    try {
      const novo = await ativarNotificacoes();
      aoMudarEstado(novo);
      if (novo === 'ativo') {
        tocarSom();
        mostrar('Notificações ligadas neste aparelho.');
      }
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setLigando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    const { error } = await supabase.rpc('testar_aviso_equipe');
    setTestando(false);
    if (error) return mostrar(mensagemErro(error), 'erro');
    mostrar('Teste enviado. Bloqueie a tela: a notificação chega em uns 10 segundos.');
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Notificações e app">
      <div className="space-y-6">
        <section>
          <h3 className="flex items-center gap-2 font-semibold">
            <BellRing className="h-4 w-4 text-azul" aria-hidden /> Aviso de novo pedido
          </h3>
          <p className="mt-1 text-sm text-apagado">
            Quando um cliente pedir horário ou pedir para cancelar ou remarcar, este aparelho toca e mostra quem foi.
          </p>
          <div className="mt-3 space-y-3">
            {estado === 'ativo' && (
              <>
                <Aviso tipo="sucesso" titulo="Notificações ligadas neste aparelho" />
                <Botao variante="secundario" icone={<Bell className="h-4 w-4" />} carregando={testando} onClick={testar}>
                  Enviar aviso de teste
                </Botao>
              </>
            )}
            {estado === 'inativo' && (
              <Botao icone={<Bell className="h-4 w-4" />} carregando={ligando} onClick={ligar}>
                Ligar notificações
              </Botao>
            )}
            {estado === 'bloqueado' && (
              <Aviso tipo="atencao" titulo="As notificações estão bloqueadas">
                Libere nas configurações do navegador ou do celular, em Notificações do site g7-agenda.vercel.app, e abra
                esta janela de novo.
              </Aviso>
            )}
            {estado === 'instalar_primeiro' && (
              <Aviso tipo="info" titulo="No iPhone e no iPad, instale o app primeiro">
                A Apple só libera notificações para o app instalado na tela de início. Siga os passos abaixo e ligue as
                notificações por dentro do app.
              </Aviso>
            )}
            {estado === 'indisponivel' && (
              <Aviso tipo="atencao" titulo="Este navegador não recebe notificações">
                Use o Chrome no Android ou no computador, ou o app instalado no iPhone.
              </Aviso>
            )}
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
          </div>
        </section>

        <section className="border-t border-linha pt-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Smartphone className="h-4 w-4 text-azul" aria-hidden /> App no celular ou tablet
          </h3>
          {instalado ? (
            <p className="mt-1 text-sm text-apagado">Você já está usando o app instalado.</p>
          ) : podeInstalar ? (
            <>
              <p className="mt-1 text-sm text-apagado">Abre direto pelo ícone, em tela cheia, como um aplicativo.</p>
              <Botao className="mt-3" icone={<Download className="h-4 w-4" />} onClick={() => instalar()}>
                Instalar o app
              </Botao>
            </>
          ) : ios ? (
            <div className="mt-3">
              <PassosIOS />
            </div>
          ) : (
            <p className="mt-1 text-sm text-apagado">
              No Android, abra este endereço no Chrome, toque no menu de três pontos e escolha{' '}
              <strong>Instalar app</strong>. No computador, use o ícone de instalar na barra de endereço do Chrome.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** Sino ligado/desligado conforme o estado das notificações */
export function IconeNotificacoes({ estado }: { estado: EstadoNotificacoes | null }) {
  return estado === 'ativo' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />;
}
