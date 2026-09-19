# Migração v27

Problema corrigido: service workers das versões anteriores armazenavam o app/login em `/` e podiam continuar servindo esse HTML mesmo depois da landing ser publicada.

A v27 usa um novo cache e `skipWaiting()` na instalação para assumir controle imediatamente. Na ativação, remove somente caches `life-lately-*` antigos. IndexedDB e localStorage não são limpos.

Rotas:
- `/` → landing
- `/app/` → login/aplicativo
