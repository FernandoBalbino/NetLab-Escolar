(function () {
  'use strict';

  function updateConnectionState() {
    document.documentElement.dataset.connection = navigator.onLine ? 'online' : 'offline';
  }

  updateConnectionState();
  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);

  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  window.addEventListener('load', async function () {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      await navigator.serviceWorker.ready;
      document.documentElement.dataset.offlineReady = 'true';
      window.dispatchEvent(new CustomEvent('netlab:offline-ready'));

      registration.addEventListener('updatefound', function () {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            document.documentElement.dataset.updateReady = 'true';
          }
        });
      });
    } catch (error) {
      console.error('Não foi possível preparar o NetLab para uso offline.', error);
    }
  });
})();
