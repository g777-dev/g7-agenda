import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// App instalável (PWA), notificações push e som de aviso da equipe.

/** Chave pública VAPID das notificações push */
export const VAPID_PUBLICA =
  'BEIimSXG08Tvw50pTV8SBXNPI7b-ri60RChm8JIU5Y9roURGBPGNRNP_FzleRLkImUoISzrQdBdcki1ZVHJ8mMs';

// ---------- Instalação do app ----------

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pedidoInstalar: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

/** Chamado uma vez no main.tsx: guarda o convite de instalação e registra o service worker. */
export function iniciarAparelho() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalar = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    pedidoInstalar = null;
    avisar();
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

/** Mesmo que iniciarAparelho (nome usado no mapa de módulos) */
export const iniciarInstalacao = iniciarAparelho;

export const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const ehInstalado = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function useInstalacao() {
  const [, setVersao] = useState(0);
  useEffect(() => {
    const f = () => setVersao((v) => v + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  return {
    instalado: ehInstalado(),
    podeInstalar: !!pedidoInstalar,
    ios: ehIOS(),
    instalar: async () => {
      if (!pedidoInstalar) return false;
      await pedidoInstalar.prompt();
      const { outcome } = await pedidoInstalar.userChoice;
      pedidoInstalar = null;
      avisar();
      return outcome === 'accepted';
    },
  };
}

// ---------- Notificações push ----------

export type EstadoNotificacoes = 'ativo' | 'inativo' | 'bloqueado' | 'instalar_primeiro' | 'indisponivel';

export const pushSuportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Registro do service worker ativo (espera até 5 s ficar pronto) */
export async function registroSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg?.active) return reg;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
}

function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

async function salvarInscricao(inscricao: PushSubscription) {
  const json = inscricao.toJSON();
  const { error } = await supabase.rpc('salvar_inscricao_push', {
    p_endpoint: inscricao.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_aparelho: navigator.userAgent,
  });
  if (error) throw error;
}

export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  if (!pushSuportado()) return ehIOS() && !ehInstalado() ? 'instalar_primeiro' : 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission !== 'granted') return 'inativo';
  const reg = await registroSW();
  if (!reg) return 'indisponivel';
  return (await reg.pushManager.getSubscription()) ? 'ativo' : 'inativo';
}

export async function ativarNotificacoes(): Promise<EstadoNotificacoes> {
  if (!pushSuportado()) return estadoNotificacoes();
  const permissao = await Notification.requestPermission();
  if (permissao === 'denied') return 'bloqueado';
  if (permissao !== 'granted') return 'inativo';
  const reg = await registroSW();
  if (!reg) return 'indisponivel';
  const inscricao =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ParaBytes(VAPID_PUBLICA),
    }));
  await salvarInscricao(inscricao);
  return 'ativo';
}

/** Regrava a inscrição deste aparelho no banco (ao abrir o painel) */
export async function renovarInscricao() {
  if (!pushSuportado() || Notification.permission !== 'granted') return;
  const reg = await registroSW();
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) await salvarInscricao(inscricao).catch(() => {});
}

/** Tira este aparelho da lista de avisos (ao sair) */
export async function removerInscricao() {
  if (!pushSuportado()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) await supabase.rpc('remover_inscricao_push', { p_endpoint: inscricao.endpoint });
}

// ---------- Som de aviso ----------

let audio: AudioContext | null = null;

function contextoAudio(): AudioContext | null {
  const Ctor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

/** Destrava o áudio no primeiro toque (exigência dos navegadores) */
export function prepararSom() {
  try {
    contextoAudio();
  } catch {
    /* sem áudio */
  }
}

/** Dois bipes curtos de aviso */
export function tocarSom() {
  try {
    const ctx = contextoAudio();
    if (!ctx) return;
    const agora = ctx.currentTime;
    const notas: [number, number][] = [
      [1318.5, 0],
      [1760, 0.17],
    ];
    for (const [freq, atraso] of notas) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, agora + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.35, agora + atraso + 0.015);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.7);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(agora + atraso);
      osc.stop(agora + atraso + 0.75);
    }
  } catch {
    /* sem áudio */
  }
}
