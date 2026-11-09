// G7 Agenda: deixa o app instalável no celular e mostra as notificações da equipe.
const CACHE = 'g7-agenda-v1';

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) if (nome !== CACHE) await caches.delete(nome);
      await self.clients.claim();
    })(),
  );
});

// Telas: sempre busca a versão mais nova; sem internet, abre a última guardada
self.addEventListener('fetch', (evento) => {
  if (evento.request.mode !== 'navigate') return;
  evento.respondWith(
    (async () => {
      try {
        const resposta = await fetch(evento.request);
        const copia = resposta.clone();
        caches.open(CACHE).then((c) => c.put('/', copia)).catch(() => {});
        return resposta;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })(),
  );
});

self.addEventListener('push', (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { titulo: 'G7 Agenda', texto: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Com o painel aberto na tela, o próprio painel já toca o "plim": a notificação chega sem som
      const painelNaTela = janelas.some((j) => j.visibilityState === 'visible');
      await self.registration.showNotification(aviso.titulo || 'G7 Agenda', {
        body: aviso.texto || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: aviso.tag || undefined,
        renotify: Boolean(aviso.tag),
        silent: painelNaTela,
        vibrate: [120, 80, 120],
        data: { url: aviso.url || '/painel' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || '/painel';
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const j of janelas) {
        if ('focus' in j) {
          await j.focus();
          if ('navigate' in j) {
            try {
              await j.navigate(url);
            } catch {
              /* janela de outra origem: só foca */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
