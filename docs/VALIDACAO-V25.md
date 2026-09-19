# Validação v25 · 19/09/2026

## Executado

- **112 verificações Node**: 14 de core, 23 de planejamento/virada, 36 de limites/Livre/quitação, 15 de armazenamento, 10 de primeiro acesso/reset, 14 de service worker/pacote.
- **10 verificações estáticas Python**: chamada principal, os cinco CTAs, caminhos de recursos, âncoras, semântica, imagens, separação do banco, namespace e cabeçalhos.
- **51 grupos de verificações de UI em Chromium**: 16 do app, 14 de planejamento, 11 de limites/quitação e 10 da landing/acesso.
- Inspeção visual de landing em 390 e 1440 px, além de verificação de overflow em 320, 360, 390, 430, 768, 1024 e 1440 px. As três imagens foram renderizadas e a aparência do login original foi inspecionada.
- Comparação byte a byte do motor, armazenamento e CSS do aplicativo com a versão 24.

## Limitações reais

A navegação do Chromium para o servidor localhost neste ambiente foi recusada por `ERR_BLOCKED_BY_ADMINISTRATOR`. Não foi contornada. As verificações visuais usaram HTML/CSS/imagens inline em memória e adaptadores explícitos de armazenamento de teste; nenhum dado foi gravado na conta real da usuária. Os testes de links verificam os destinos e os cliques, não navegação HTTPS em produção.

As funções WebCrypto foram verificadas com o WebCrypto real do Node; o IndexedDB/localStorage desses testes é um adaptador em memória. O service worker foi executado em uma simulação de Cache/Eventos; sua instalação, atualização e funcionamento offline não foram confirmados em um navegador físico. Os relatórios não devem ser lidos como evidência de deploy realizado ou de migração testada na instalação pessoal da usuária.

O carregamento remoto de Google Fonts não pôde ser confirmado neste ambiente. As imagens/estilos locais foram renderizados, e as capturas usaram as fontes de fallback. Os URLs e a permissão CSP das fontes originais estão no pacote.

Nenhuma instalação em celular físico nem publicação no Netlify foi feita.

## Reproduzir testes

Sem dependências adicionais para Node:

```sh
node tests/core.test.cjs
node tests/planning.test.cjs
node tests/completion.test.cjs
node tests/storage.test.cjs
node tests/zero-storage.test.cjs
node tests/sw.test.cjs
python tests/landing-package.test.py
```

Para UI, instale Playwright e um navegador Chromium no seu próprio ambiente. Os scripts de UI aceitam `LL_BROWSER_PATH` para localizar o binário. `LL_QA_OFFLINE=1` usa apenas fixtures em memória nos testes de planejamento e quitação (não é um teste de PWA offline real).

```sh
python tests/ui.test.py
python tests/landing-ui.test.py
LL_QA_OFFLINE=1 python tests/planning-ui.test.py
LL_QA_OFFLINE=1 python tests/completion-ui.test.py
```

Todos os dados fictícios ficam dentro de `tests/`. Nenhuma fixture é carregada pela landing ou por `app/index.html`.
