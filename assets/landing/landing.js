/* Only navigation / offline support. This page never opens the financial database. */
(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  let navTick = 0;
  function paintNavigation() {
    navTick = 0;
    if (!header) return;
    const progress = Math.max(0, Math.min(1, window.scrollY / 180));
    header.style.setProperty('--nav-bg-alpha', (0.03 + progress * 0.89).toFixed(3));
    header.style.setProperty('--nav-border-alpha', (0.07 + progress * 0.11).toFixed(3));
    header.style.setProperty('--nav-shadow-alpha', (0.01 + progress * 0.17).toFixed(3));
    header.style.setProperty('--nav-blur', `${Math.round(progress * 20)}px`);
  }
  function scheduleNavigationPaint() {
    if (navTick) return;
    navTick = requestAnimationFrame(paintNavigation);
  }
  paintNavigation();
  addEventListener('scroll', scheduleNavigationPaint, { passive: true });

  if (location.protocol === 'file:' || document.querySelector('meta[name="ll-preview"]') || !('serviceWorker' in navigator)) return;
  let waiting = null;
  let accepted = false;
  const root = new URL('./', location.href);
  const notice = document.getElementById('site-update');
  const update = document.getElementById('site-update-button');
  function offer(worker) { waiting = worker; if (notice) notice.hidden = false; }
  update?.addEventListener('click', () => {
    if (!waiting) return;
    accepted = true;
    update.disabled = true;
    update.textContent = 'Atualizando…';
    waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (accepted) location.reload();
  });
  navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname, updateViaCache: 'none' }).then(registration => {
    if (registration.waiting) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(registration.waiting || worker);
      });
    });
    registration.update().catch(() => {});
  }).catch(() => { /* The landing and its links work without offline support. */ });
})();
