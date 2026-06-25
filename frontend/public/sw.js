/* Service worker for PWA and Web Push. Serves from public/ so path is /sw.js */

self.addEventListener('push', function (event) {
  if (!event.data) return;
  let payload = { title: 'MyHainan', body: '' };
  try {
    payload = event.data.json();
  } catch (_) {
    payload.body = event.data.text();
  }
  const title = payload.title || 'MyHainan';
  const options = {
    body: payload.body || payload.message || 'New notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: payload.tag || 'myhainan-notification',
    data: payload.data || {},
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
