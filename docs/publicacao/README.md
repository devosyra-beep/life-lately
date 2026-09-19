# Publicação — Life Lately para Android e iOS

Este pacote deixou de ser só um site: continua publicável como site estático
(landing em `/`, app em `/app/`) **e** é a base dos dois aplicativos nativos,
a partir do mesmo código-fonte.

## Como o projeto se organiza agora

```
core.js, storage.js, app.js, styles.css   Fonte única — site e apps
app/index.html                            Casca do app (vira a raiz do bundle)
index.html, assets/landing/, sw.js        Só o site; não entram no app nativo
scripts/build-www.mjs                     Monta www/ e gera platform.js
scripts/stamp-version.mjs                 Propaga a versão para Android e iOS
www/                                      Gerado. Não versionar, não editar.
android/, ios/                            Projetos nativos (versionar)
tests/*.test.cjs                          Motor e armazenamento (Node)
tests/*.test.py                           UI (Playwright)
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run build` | Monta `www/` e carimba a versão nos dois projetos nativos |
| `npm test` | Roda todas as suítes Node |
| `npm run serve` | Serve `www/` em `http://localhost:8000` (secure context) |
| `npm run sync` | `build` + `cap sync` — copia o bundle para Android e iOS |
| `npm run android` | `sync` + abre o Android Studio |
| `npm run ios` | `sync` + abre o Xcode (**exige macOS**) |

**Editou `app.js`, `core.js`, `storage.js` ou `styles.css`? Rode `npm run sync`.**
Sem isso, os projetos nativos continuam com o bundle anterior.

## Por que o app funciona sem rede

Criar conta, definir senha, criar cofrinhos, registrar ganhos e distribuir
funcionam **offline desde a primeira abertura**, em ambas as plataformas:

- `capacitor://localhost` (iOS) e `https://localhost` (Android) são *secure
  contexts*, então `crypto.subtle` — base de todo o `storage.js` — funciona sem
  HTTPS de servidor;
- os arquivos vêm do bundle do app, não da rede. O service worker é
  desativado no modo nativo (`platform.js` → `LLPlatform.native`);
- no iOS, `WKAppBoundDomains` + `limitsNavigationsToAppBoundDomains` tornam o
  WebView *app-bound*: o IndexedDB deixa de sofrer a expiração de 7 dias do ITP.

A permissão `INTERNET` permanece no `AndroidManifest.xml`. O app não a usa hoje;
ela fica para um eventual relatório de erros. Removê-la é uma declaração de
privacidade ainda mais forte — decisão a tomar antes do primeiro envio.

> **Antes de qualquer envio, leia as duas cláusulas no topo de
> [mapeamento.md](mapeamento.md):** o `appId` exposto e irreversível, e como
> (não) verificar durabilidade de dados no app nativo.

## Decisões travadas neste bloco

| Item | Valor | Observação |
|---|---|---|
| `appId` | `com.osyra.lifelately` | ⚠️ **INFERIDO, não decidido. Público e irreversível.** Ver Cláusula 1 em [mapeamento.md](mapeamento.md) |
| Orientação | retrato (iPhone e Android) | Espelha `orientation: portrait-primary` do manifesto |
| `allowBackup` | `false` | Ver abaixo |
| `ITSAppUsesNonExemptEncryption` | `false` | WebCrypto padrão é isento; evita o questionário a cada envio |
| `minSdkVersion` | 23 | O limite real é a versão do WebView, checada em tempo de execução |
| Versão | `package.json` | Origem única para web, `versionName` e `MARKETING_VERSION` |

### Sobre `allowBackup="false"`

O Auto Backup do Android enviaria o blob cifrado **e a chave de cadastro** para o
Google Drive da pessoa. O app promete que nada sai do aparelho — manter o backup
automático contradiria a promessa e obrigaria a declarar transferência de dados
no formulário Data Safety. A cópia de segurança do app é o backup cifrado que a
própria pessoa exporta, protegido pela senha dela.

**Consequência a comunicar:** trocar de celular exige exportar e restaurar o
backup manualmente. Hoje isso está quebrado no iOS — ver o bloco 3 no mapeamento.

## Pré-requisitos por plataforma

**Android** (funciona nesta máquina Windows): Android Studio, JDK 17,
Android SDK 35.

**iOS** (exige macOS): Xcode 15+, CocoaPods, conta Apple Developer.
`npx cap add ios` já rodou; o `pod install` foi pulado por não haver CocoaPods
aqui. No Mac, rode `npm run sync` uma vez antes de abrir o Xcode.
