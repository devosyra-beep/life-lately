# Validação · versão 24

## Executado nesta entrega

**104 testes Node passaram:**

- 14 de regressão financeira.
- 23 de planejamento, reset, virada, mês curto, prazo longo e desfazer.
- 36 de limite dos cofrinhos, manual/automático, Livre, ciclos mensais, quitação e migração de v23. Inclui cenário de 800 aportes/transferências em centavos com conservação do saldo.
- 15 de persistência com WebCrypto real do Node, inclusive restauração da nova quitação/baseline de ciclo/redistribuição Livre.
- 10 de estado inicial, isolamento e exclusão completa.
- 6 de service worker e pacote (cache simulado).

**46 grupos de interface Chromium passaram:** 16 de regressão geral, 5 de primeiro acesso/reset, 14 de planejamento/virada e 11 específicos desta entrega. Exercitados card→modal, arraste por mouse/toque em emulação, prévias, quitação, pagamento parcial, ciclos, redistribuição, moeda, erro de gravação e navegação por teclado. Larguras de 320 a 1440 px foram verificadas sem rolagem horizontal. Capturas mobile de divisão manual, dívida reservada, confirmação de quitação, virada e distribuir Livre foram inspecionadas.

Também foram verificadas a sintaxe dos scripts, existência dos assets de PWA, conteúdo do pacote e correspondência entre código da prévia e da hospedagem.

## Limites

A navegação do Chromium para localhost foi bloqueada por política do ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR`). A política não foi contornada. Os testes de UI usaram os arquivos reais em um documento de teste, com IO em memória, sem rede. A criação, bloqueio/reentrada e as telas foram exercitados, mas isso não é teste ponta a ponta de IndexedDB/WebCrypto no navegador.

A criptografia foi executada separadamente no Node com adaptadores de IndexedDB/localStorage em memória. O service worker foi testado em contexto simulado; não houve instalação real ou recarregamento offline de PWA neste Chromium. Não houve teste em celular físico, auditoria integral de acessibilidade, publicação nem alteração de uma instalação remota.

O módulo storage.js é idêntico ao da v23 e seus identificadores da v22 são preservados. A migração de esquema 11 para 12 foi testada inclusive com desfazer ativo e assinatura obsoleta. Dados de teste vivem exclusivamente nos scripts de teste/contexts temporários e não são inicializados pela entrega.
