# Life Lately · versão 37

## Uma entrada para o site, outra para o aplicativo

- `index.html` é a landing page.
- `app/index.html` é a tela de acesso do aplicativo.
- Todos os botões **Acessar o app** apontam para `app/index.html`.
- No site publicado, `/app/` também abre o aplicativo. `/login` é um alias.
- `core.js` mantém o motor financeiro; `storage.js` preserva o modo local e `cloud.js` integra o backend dedicado do Life Lately.

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

A tela de acesso apresenta somente três opções: Google, Apple (em breve) e **Apenas conhecer**. O Google usa um projeto Supabase exclusivo do Life Lately e sincroniza o estado do usuário entre aparelhos; o modo **Apenas conhecer** é temporário e não grava dados. Cadastros locais antigos não são apagados por esta atualização, mas o formulário local deixou de ser oferecido na tela de entrada.

O backend fica em `supabase/`: as migrations criam perfis, estados sincronizados e a base de autorização para futuros pagamentos. Todas as tabelas públicas usam RLS por proprietário e as tabelas privadas de cobrança não aceitam acesso direto do navegador. Nenhuma chave administrativa é incluída no frontend.

## Imagens e identidade

As três fotografias enviadas estão aplicadas e guardadas em `assets/landing/`: `hero-night.jpg`, `night-table.jpg` e `golden-sea.jpg`. Há versões WebP para diferentes larguras e os JPGs originais como fallback.

A landing preserva a proposta visual do projeto enviado: noite, rosé, ouro, tipografia serifada, seções e créditos. A tipografia Cormorant Garamond/Manrope continua referenciada no Google Fonts, com fontes de sistema caso a conexão falhe. Não há arquivos de fonte dentro do ZIP.

O símbolo do app foi mantido nos ícones de instalação. O favicon original da landing está preservado em `assets/landing/favicon-original.ico`. O link fictício de Instagram, que apontava somente para `#`, não foi publicado como um botão sem destino.

## Arquivos principais

```
index.html                  Landing pronta para publicação
assets/landing/              CSS/JS da landing, fotos e variantes
app/index.html              Tela existente de acesso ao aplicativo
core.js / storage.js        Motor e armazenamento local preservados
cloud.js / vendor/          Autenticação e sincronização Supabase
app.js / styles.css         Interface do aplicativo
manifest.webmanifest        Mesmo PWA, com início em /app/
sw.js                       Cache com páginas distintas
_headers / _redirects       Regras para Netlify
source/landing/             TSX e CSS de referência do projeto enviado
tests/                      Testes e fixtures isolados da produção
supabase/                   Configuração e migrations do backend dedicado
docs/                       Integração e relatório desta versão
```

## Validar localmente

Em um ambiente que permita servidor local, execute `python -m http.server 8000` na pasta deste README e abra `http://localhost:8000`. Para testar acesso, criptografia e instalação no navegador, use localhost ou HTTPS, não um visualizador que bloqueie JavaScript/armazenamento.

As regras `_headers` e `_redirects` são específicas da hospedagem Netlify. O servidor Python não as interpreta.

Leia `docs/VALIDACAO-V25.md` para os testes executados e as limitações. Nenhum teste inclui dados de usuário reais ou foi executado no site publicado.


## Correção v27 — migração da raiz
O service worker desta versão assume controle imediatamente para substituir caches de versões anteriores que ainda entregavam o login em `/`. Nenhum IndexedDB/localStorage é apagado. A landing fica em `/` e o app em `/app/`.
