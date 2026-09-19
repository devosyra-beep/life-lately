# Integração v25

## Escopo preservado

Esta entrega integra `life-s-luxe-ledger-main.zip` com o aplicativo da versão 24. Nenhuma regra de rateio, teto, Livre, quitação, virada do mês ou reset foi reescrita. O SHA-256 de `core.js`, `storage.js` e `styles.css` é igual ao original.

A landing TSX enviada foi adaptada para HTML/CSS estáticos. O resultado preserva as seções e imagens, mas dispensa React/TanStack/Tailwind em produção. O TSX com a nova frase fica em `source/landing/` como referência; não é um segundo app executável.

## Rotas e índices

`/` e `/index.html` exibem a landing. `app/index.html` contém o HTML que antes estava na raiz, com referências `../` para os recursos originais. O título da página de acesso foi ajustado. O conteúdo de cadastro e login continua sendo renderizado pelo mesmo `app.js`.

Os links usam `./app/index.html` para também resolverem no diretório extraído. `/app/` é a URL curta servida pelo diretório. Não há regra `/* /index.html 200`, que misturaria o aplicativo e a landing. URLs inexistentes recebem a página 404.

No `app.js`, a alteração funcional limita-se ao endereço de registro do worker compartilhado na raiz; a indicação de versão passa a 25. Não foi criado um worker restrito à subpasta `/app/`.

## PWA e atualização

O manifesto permanece no endereço original. A identidade `id: "/"` corresponde ao antigo `start_url` implícito, e o novo `start_url` é `./app/`. Assim o início recomendado para a instalação é o login do app, não a apresentação. Atualização de manifestos e atalhos já instalados varia entre navegadores; uma instalação antiga pode continuar abrindo a raiz até atualizar seu manifesto.

O worker v25 guarda cópias separadas da landing e do app. A landing e seu CSS/JS priorizam rede com fallback em cache. Scripts financeiros usam a versão em cache para evitar mistura de arquivos entre versões. Imagens e ícones locais também estão no precache.

O worker não intercepta POST, URLs externas, arquivos de backup ou dados financeiros. Não acessa IndexedDB nem localStorage. A ativação de uma atualização não é forçada durante uma sessão aberta: o mecanismo da v24 de confirmação da atualização continua funcionando. O aviso de atualização na landing também permite a confirmação.

## Mobile first e acessibilidade

Base de uma coluna para telas estreitas; expansão por `min-width` para tablet/desktop. O cabeçalho mantém acesso ao app em 320 px; botões principais têm área de toque de pelo menos 44 px. Âncoras respeitam o cabeçalho fixo. Há link de pular para o conteúdo, foco visível, textos alternativos, carregamento adiado nas imagens abaixo da dobra e respeito a `prefers-reduced-motion`.

O mockup continua sendo ilustrativo: não abre ou altera o banco. Seu botão “+ Ganhei” leva ao login, assim como todos os CTAs de acesso. O rodapé mantém Marina Costa e developed by Osyra Team, centralizados. Não inventamos endereço de Instagram para substituir o placeholder da fonte.

## Referências técnicas consultadas

- MDN — start_url: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url
- MDN — id: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id
- MDN — Using Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- Netlify — Redirect options: https://docs.netlify.com/manage/routing/redirects/redirect-options/
