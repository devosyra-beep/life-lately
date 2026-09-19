# Mapeamento — o que falta até as lojas

Estado em 19/09/2026. Blocos 1 e 2 concluídos; o resto está detalhado abaixo
na ordem em que convém atacar.

---

# ⚠️ DUAS CLÁUSULAS QUE EXIGEM DECISÃO ANTES DO PRIMEIRO ENVIO

## Cláusula 1 — O `appId` é público, permanente e hoje está INFERIDO

**Valor atual: `com.osyra.lifelately`. Ninguém decidiu esse valor.**
Ele foi deduzido de uma única fonte: o crédito de rodapé “Osyra Team” em
`index.html:78`. O pacote original **não continha** appId, package name,
bundle ID nem domínio — verificado por busca em todo o projeto.

### Onde ele fica exposto

| Plataforma | Exposição |
|---|---|
| Android | Vira o *package name*. Aparece na **URL pública da Play Store** (`play.google.com/store/apps/details?id=com.osyra.lifelately`) e em Ajustes → Apps no aparelho |
| Android | Também virou o `custom_url_scheme` em `res/values/strings.xml` |
| iOS | Vira o *Bundle ID*. Não aparece na URL pública da App Store (que usa ID numérico), mas fica visível no App Store Connect, no portal de desenvolvedor, nos provisioning profiles e para quem inspecionar o IPA |

### Por que decidir agora

- **É irreversível.** Mudar depois de publicar significa uma **listagem nova** na
  Play Store: instalações, avaliações e notas voltam a zero.
- A convenção *reverse-DNS* pressupõe controle do domínio (`osyra.algo`). Nem
  Google nem Apple verificam isso — funciona tecnicamente, mas o identificador
  é uma **declaração de quem é dono do app**.
- Se “Osyra Team” é o estúdio que desenvolveu e o dono do produto é outro, o
  appId atribui o app ao estúdio.

**Trocar agora custa um comando** (9 ocorrências: `capacitor.config.json`,
`android/app/build.gradle`, `strings.xml`, os dois `capacitor.config.json`
copiados e o `project.pbxproj`). Depois do primeiro envio, não tem volta.

## Cláusula 2 — No app nativo, durabilidade NÃO se mede por `navigator.storage.persist()`

**Correção de uma afirmação anterior.** Foi dito que em Capacitor a persistência
“é concedida de imediato”. Isso está errado e, pior, aponta para a verificação
errada.

Nos apps nativos a durabilidade vem do **contêiner do próprio app**, não da API:
no Android, o diretório de dados do app; no iOS, o contêiner do app com WebView
*app-bound*. A regra de 7 dias do ITP vale para contexto de navegação, não para
isso.

> **Consequência prática:** `navigator.storage.persisted()` pode retornar `false`
> no app nativo **com os dados perfeitamente duráveis**. Verificar essa API ali
> mede a coisa errada e gera alarme falso.

Onde o `persist()` realmente importa é no **PWA/web em `/app/`** — o que já está
no ar hoje.

### A) Verificação no PWA/web — aí sim, pela API

DevTools → Application → Storage, ou no console:
`await navigator.storage.persisted()`. O Chrome concede automaticamente se o site
estiver instalado como PWA ou tiver engajamento alto; caso contrário nega em
silêncio.

### B) Verificação no nativo — comportamental, não de API

1. Instalar no aparelho, criar conta e alguns dados.
2. Forçar o fechamento, **reiniciar o celular**, reabrir → dados presentes.
3. Android: Ajustes → Apps → Armazenamento → **“Limpar cache”** (não “Limpar
   dados”) → dados devem sobreviver. É o caso que usuário real encontra.
4. iOS: deixar **8+ dias** sem abrir → dados presentes. É o teste do ITP.
5. E o inverso: “Limpar dados” / desinstalar **deve** apagar — e o app precisa
   então mostrar a **tela de recuperação**, nunca um app vazio. Esse é o
   comportamento entregue no Bloco 1.

Para inspecionar o console dentro do app: Android via `chrome://inspect/#devices`
com depuração USB; iOS via Safari → Desenvolvedor → [aparelho], com o Web
Inspector ativado em Ajustes → Safari → Avançado.

> Pendente (oferecido, não feito): linha de diagnóstico em Configurações com
> estado de persistência e espaço usado, via `LLStore.estimate()`, que já está
> exposto. Tornaria o passo B verificável sem máquina de desenvolvimento.

---

## ✅ Bloco 1 — Integridade dos dados (feito)

- `unlock()` recusa abrir espaço vazio quando o cadastro existe mas a carga
  salva sumiu (`storage.js`), com erro `code:'no-data'`.
- Tela de recuperação no app, com restaurar backup ou recomeçar do zero.
- `discardOrphanAccount()` — saída autenticada, recusada se houver dados.
- `navigator.storage.persist()` passa a ser solicitado a cada abertura.
- Login comum deixou de regravar o banco (`wasMigrated()`).
- 9 testes de regressão em `tests/eviction.test.cjs`.

## ✅ Bloco 2 — Estrutura Capacitor (feito)

- `android/` e `ios/` criados; `www/` montado a partir da fonte única.
- WebView *app-bound* no iOS; backup na nuvem desligado no Android.
- Retrato nas duas plataformas; versão carimbada a partir do `package.json`.
- Checagem de capacidades em tempo de execução, em vez de tela branca.
- Smoke test de ponta a ponta do bundle (Playwright).

## 🔴 Bloco 3 — Backup nativo e biometria (obrigatório)

O item de maior risco. Hoje `exportBackup()` usa `<a download>` + blob URL,
que **não faz nada** no WKWebView. O backup é a única rede de proteção do app.

- `@capacitor/filesystem` + `@capacitor/share` para exportar;
  `@capacitor/file-picker` (ou o input atual, validado) para importar.
- Biometria via `capacitor-native-biometric`: a chave derivada não pode ser
  guardada em claro — o padrão é guardar a senha no Keychain/Keystore,
  liberada por Face ID/Touch ID/digital, e seguir derivando com PBKDF2.
- Lembrete de backup: sem exportar há N dias, avisar na tela inicial.
- Isto também é o que sustenta a defesa contra a **Guideline 4.2** da Apple.

## 🔴 Bloco 4 — Ícones e telas de abertura (obrigatório)

- Maskable dedicado: fundo sangrado, símbolo dentro de 80% da área segura.
  O arquivo atual tem moldura creme e é declarado `any maskable` — erra nos dois.
- 1024×1024 sem transparência e sem cantos arredondados (App Store).
- Adaptive icon do Android (foreground + background separados).
- Splash screens; `@capacitor/splash-screen` já está instalado com
  `launchAutoHide:false`, aguardando o app chamar `hide()` após o primeiro render.
- `@capacitor/assets` gera o conjunto todo a partir de dois arquivos-mestre.

## 🟡 Bloco 5 — Notificações de progresso (o que você pediu)

Todas **locais**, agendadas no aparelho por `@capacitor/local-notifications`.
Sem servidor, sem push, sem conta — coerente com a promessa do app.

Gatilhos que o motor já sabe calcular hoje, sem lógica nova:

| Gatilho | Origem no código |
|---|---|
| Meta atingida | `LL.target(s,c).done` vira `true` |
| Meta em X% | `covered/amount` em `LL.funding()` |
| Prazo chegando ou vencido | `LL.target(s,c).days` |
| Dinheiro sem destino | `LL.pendingCents(s) > 0` |
| Mês virou | `LL.planningMonth(s) < hoje` |

Duas restrições de projeto a respeitar:

1. **O app fica bloqueado.** O agendamento só pode ser calculado enquanto a
   sessão está aberta; reagende ao bloquear, a partir do estado já decifrado.
2. **O texto da notificação sai do aparelho para a tela de bloqueio.** Não
   colocar valores no corpo — "Sua meta Viagem chegou ao fim do prazo", nunca
   "Faltam R$ 320,00". Tornar isso uma opção explícita em Configurações.

Permissão de notificação: pedir **depois** do primeiro cofrinho criado, com
contexto, nunca na abertura.

## 🟡 Bloco 6 — Interface (o "intuitivo" do pedido)

- Modo escuro: `styles.css` não tem um `prefers-color-scheme` sequer.
- Configurações na navegação inferior — hoje só no avatar do topo, e é onde
  mora o backup.
- Onboarding no primeiro acesso: nome → senha → primeiro cofrinho → primeiro
  ganho. O conteúdo já existe em `openHelp()`, só está enterrado.
- Auto-bloqueio de 5 min configurável e sem descartar formulário aberto
  (`app.js`, `visibilitychange`).
- Tipografia: base 15px e `fine` 12px são pequenas para celular.
- Acessibilidade: 22 `aria-label` em ~96KB de UI; heatmap com ~31 alvos
  minúsculos; barras de progresso sem `role="progressbar"`.
- Vocabulário no feminino ("Como quer ser chamad**a**?") — decisão de produto,
  precisa ser deliberada e refletida na ficha da loja.
- Locale da moeda fixo em `pt-BR` (`core.js`): USD mostra `US$ 1.234,56`.

## 🟡 Bloco 7 — Operação e conformidade

- `tests/sw.test.cjs` falha desde a v27: o `skipWaiting()` no `install`
  contradiz o fluxo "Atualização disponível" e faz o SW novo servir assets
  novos a uma página com JS antigo. **Só afeta o site**, não o app nativo.
- Suítes Playwright (`tests/*.py`) no CI — o Playwright agora está instalado.
- Política de privacidade publicada (exigida pelas duas lojas).
- Data Safety (Google) e Nutrition Label (Apple): "nenhum dado coletado".
- Exclusão de conta já existe (`erase()`) — atende à 5.1.1(v) da Apple.
- Decidir sobre a permissão `INTERNET` no Android e sobre relatório de erros:
  as duas coisas se contradizem, escolher uma.
- Conta Apple Developer (US$ 99/ano) e Google Play (US$ 25 única vez).
- App financeiro recebe escrutínio extra: deixar explícito na ficha que o app
  **não** se conecta a bancos e **não** movimenta dinheiro de verdade.
