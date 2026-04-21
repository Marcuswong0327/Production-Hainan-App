/* Firebase Cloud Messaging – background message handler.
 * Must live at /firebase-messaging-sw.js. Replace firebaseConfig below with your
 * project config from Firebase Console (same values as VITE_FIREBASE_* in .env).
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyATiXRGCpYM9MrejzdTafbHRCzipfqG488",
  authDomain: "loan-notification-hainan.firebaseapp.com",
  projectId: "loan-notification-hainan",
  storageBucket: "loan-notification-hainan.firebasestorage.app",
  messagingSenderId: "271254395533",
  appId: "1:271254395533:web:a5671585246f49d9b8a0c4",
  measurementId: "G-F6H3N7J9WB"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title || payload.data?.title || '海南会馆';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || payload.data?.icon || '/vite.svg',
    badge: '/vite.svg',
    tag: payload.data?.tag || 'fcm-notification',
    data: payload.data || {},
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || event.notification.data?.link || '/';
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
