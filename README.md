# Life Lately · versão 25

## Uma entrada para o site, outra para o aplicativo

- `index.html` é a landing page.
- `app/index.html` é a tela de cadastro/login do app existente.
- Todos os botões **Acessar o app** apontam para `app/index.html`.
- No site publicado, `/app/` também abre o aplicativo. `/login` é um alias.
- `core.js`, `storage.js` e `styles.css` do aplicativo são idênticos aos da v24.

A chamada principal agora é **A vida acontece. Seu dinheiro acompanha.**

## Publicar / atualizar no GitHub Pages

Este pacote é estático e pode ser hospedado gratuitamente no GitHub Pages. Use um repositório público, envie **a pasta inteira** e, em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)` como origem. O site publicado fica em `https://<conta>.github.io/<repositório>/`.

Não envie apenas o HTML nem apenas a pasta `app`: a landing, o aplicativo, os assets, os scripts, o manifesto e o `sw.js` precisam permanecer juntos. O arquivo `.nojekyll` evita que o processamento padrão do GitHub Pages esconda arquivos iniciados por sublinhado.

## Publicar / atualizar no Netlify

Faça um backup pelo app antes de atualizar. Extraia este ZIP e envie **a pasta inteira**, que contém este `index.html`, a pasta `app`, a pasta `assets`, os scripts e o `sw.js`, ao deploy manual do mesmo site existente. Não envie apenas o HTML nem apenas a pasta `app`.

O pacote já é estático: não depende de instalar Node, executar npm, compilar React ou manter um servidor de aplicação. Use o mesmo domínio/site para continuar acessando a mesma instalação local.

### Na primeira atualização a partir da v24

A v24 armazenava a página antiga em cache. Se ela ainda aparecer na raiz do site, abra o app antigo, entre em **Configurações → Atualização disponível** e confirme. Outra possibilidade é fechar as abas e a janela do PWA depois de um acesso online e reabrir para permitir a ativação do worker instalado. Não limpe dados do navegador nem apague o acesso.

Não forçamos recarga no meio de uma sessão com edição pendente. O novo worker mantém landing e login separados, inclusive nos fallbacks offline. Navegações desconhecidas não são enviadas indiscriminadamente para o app.

## Dados e acesso

Nada nesta atualização reseta cadastro, senha ou planejamento. Continuam os identificadores:

```
Conta:       lifeLatelyZeroV22Account
Estado:      lifeLatelyZeroV22State
IndexedDB:   life-lately-zero-v22
```

A landing não carrega o motor financeiro nem lê o cadastro. Os valores e o nome na maquete do site são uma **ilustração estática**, não dados cadastrados ou dados reais extraídos do navegador.

A conta continua local, como na v24: no aparelho/navegador em que já existe um cadastro, o app pede aquela senha; em uma instalação sem cadastro, abre o primeiro acesso. A landing não adiciona um servidor de usuários ou sincronização entre aparelhos.

## Imagens e identidade

As três fotografias enviadas estão aplicadas e guardadas em `assets/landing/`: `hero-night.jpg`, `night-table.jpg` e `golden-sea.jpg`. Há versões WebP para diferentes larguras e os JPGs originais como fallback.

A landing preserva a proposta visual do projeto enviado: noite, rosé, ouro, tipografia serifada, seções e créditos. A tipografia Cormorant Garamond/Manrope continua referenciada no Google Fonts, com fontes de sistema caso a conexão falhe. Não há arquivos de fonte dentro do ZIP.

O símbolo do app foi mantido nos ícones de instalação. O favicon original da landing está preservado em `assets/landing/favicon-original.ico`. O link fictício de Instagram, que apontava somente para `#`, não foi publicado como um botão sem destino.

## Arquivos principais

```
index.html                  Landing pronta para publicação
assets/landing/              CSS/JS da landing, fotos e variantes
app/index.html              Tela existente de acesso ao aplicativo
core.js / storage.js        Motor e armazenamento preservados
app.js / styles.css         Interface do aplicativo
manifest.webmanifest        Mesmo PWA, com início em /app/
sw.js                       Cache com páginas distintas
_headers / _redirects       Regras para Netlify
source/landing/             TSX e CSS de referência do projeto enviado
tests/                      Testes e fixtures isolados da produção
docs/                       Integração e relatório desta versão
```

## Validar localmente

Em um ambiente que permita servidor local, execute `python -m http.server 8000` na pasta deste README e abra `http://localhost:8000`. Para testar acesso, criptografia e instalação no navegador, use localhost ou HTTPS, não um visualizador que bloqueie JavaScript/armazenamento.

As regras `_headers` e `_redirects` são específicas da hospedagem Netlify. O servidor Python não as interpreta.

Leia `docs/VALIDACAO-V25.md` para os testes executados e as limitações. Nenhum teste inclui dados de usuário reais ou foi executado no site publicado.


## Correção v27 — migração da raiz
O service worker desta versão assume controle imediatamente para substituir caches de versões anteriores que ainda entregavam o login em `/`. Nenhum IndexedDB/localStorage é apagado. A landing fica em `/` e o app em `/app/`.
