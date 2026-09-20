/* Offline support only. The landing never opens the financial database. */
(() => {
  'use strict';
  if (location.protocol === 'file:' || document.querySelector('meta[name="ll-preview"]') || !('serviceWorker' in navigator)) return;
  const root = new URL('./', location.href);
  navigator.serviceWorker.register(new URL('sw.js', root), {
    scope: root.pathname,
    updateViaCache: 'none'
  }).then(registration => registration.update().catch(() => {})).catch(() => {
    /* Navigation and access links remain functional without offline support. */
  });
})();
