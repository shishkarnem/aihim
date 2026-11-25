/* Service Worker extension for AIhim Web Push notifications */
self.addEventListener('push', function (event) {
  let data = {
    title: 'AIhim — Лаборатория алхимии',
    body: 'Новое событие в вашей алхимической лаборатории.',
    url: '/',
    icon: '/file/41/pwa_icon_192x192.png',
    badge: '/file/40/pwa_icon_96x96.png',
    tag: 'aihim-push'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign({}, data, parsed);
    } catch (e) {
      const txt = event.data.text();
      if (txt) data.body = txt;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/file/41/pwa_icon_192x192.png',
    badge: data.badge || '/file/40/pwa_icon_96x96.png',
    image: data.image || undefined,
    tag: data.tag || 'aihim-push',
    renotify: true,
    vibrate: [120, 60, 120],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
