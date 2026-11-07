// Firebase Cloud Messaging Service Worker for Haiku Messenger
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBkXKSIaIF-5zVBBLMBQYJhq_6dZeq5_gU",
  authDomain: "haiku-f758f.firebaseapp.com",
  projectId: "haiku-f758f",
  storageBucket: "haiku-f758f.firebasestorage.app",
  messagingSenderId: "279052480304",
  appId: "1:279052480304:web:0087ad4e0e3aefffaae2f5"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Haiku Messenger';
  const body = payload.notification?.body || payload.data?.body || 'New message received.';
  const notificationOptions = {
    body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: payload.data?.notificationId || 'haiku-msg',
    data: payload.data || {},
    vibrate: [100, 50, 100],
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
