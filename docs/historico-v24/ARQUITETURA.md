# Arquitetura · Life Lately v24 / esquema 12

## Uma fonte de cálculo

core.js não depende de DOM, rede ou armazenamento. A UI consulta o núcleo para prévias e resultados. Os comandos editam uma cópia em commit; LL.validate e LLStore.save precisam terminar antes de substituir o estado visível. Falha de gravação não gera sucesso falso. O módulo de persistência foi preservado byte a byte.

Valores públicos são unidades monetárias; rateio, limites e snapshots usam centavos inteiros. O método dos maiores restos fecha cada lançamento. A soma do dinheiro distribuído não pode ultrapassar o ganho.

Renda = soma de transactions.value. Saldo de cofrinho = contribuições dos ganhos + depósitos + ajustes + transferências recebidas − usos − transferências enviadas. Dinheiro pendente = valor ganho ainda sem snapshot. Transferência não é renda nem gasto. Dívida devida = principal + ajustes − pagamentos.

## Um limite comum

`funding()` expõe saldo, objetivo, uso do ciclo, falta e conclusão. Para alvo único: falta = max(0, alvo − saldo). Para despesa mensal: falta = max(0, alvo − saldo − usos do ciclo). Para dívida: o objetivo vem das dívidas vinculadas em aberto e não de uma cópia independente no cofrinho. Livre não tem teto.

`fundingCapacity()` e `capShares()` são o contrato comum. Cada parcela pretendida fica limitada à capacidade restante; o excedente vai para Livre. Isso vale para automático, manual, aplicar pendências, redistribuir Livre, transferências e aportes externos. Ajustar saldo é conciliação explícita do valor real: pode informar mais que o alvo sem ocultar dinheiro; depois o cofrinho não recebe novos aportes.

No automático, peso = falta / max(1, dias até o prazo); sem data são usados 30 dias só como base de proporção, sem inventar vencimento. Um único rateio é calculado e limitado. O excedente de uma parcela vai diretamente para Livre, não para um segundo rateio oculto entre os outros compromissos.

No manual, percentuais continuam independentes, incluindo os de cofrinhos completos. A soma configurada deve ser 100% para salvar. A prévia mostra o destino efetivo: 80% configurados podem resultar em apenas 20 reais recebidos por um cofrinho quase completo. O DOM dos sliders não é recriado a cada input.

Exemplo com prazos iguais: Aluguel 400 + Luz 30 + Dívida 40; entrada 100 → 85,11 + 6,38 + 8,51. Entrada 500 com saldos zero → 400 + 30 + 40 e 30 em Livre. Objetivos completos já não participam da seleção automática de novos aportes.

## Dinheiro existente e alterações

Mudanças de plano não modificam snapshots antigos. Um aumento de ganho preserva os centavos já destinados e limita apenas o acréscimo, inclusive quando uma dívida já foi quitada. Reduções/exclusões que retirariam dinheiro já usado são recusadas. Saldos antigos acima do alvo não são confiscados na normalização.

`previewFree()` usa o mesmo motor de divisão sobre o saldo existente. `distributeFree()` confirma a assinatura do plano/saldos e cria pares transfer_out/transfer_in com link e operationId. A parte Livre e o que exceder os alvos permanecem na origem. Não são criadas transactions nem novas pendências. Todas as prévias são livres de efeitos colaterais. Uma confirmação obsoleta ou sem valor efetivo é recusada.

`previewPending()` simula as entradas pendentes em sequência; `applyPending()` só processa centavos ainda não distribuídos. Aplicar novamente não duplica nada.

## Dívida e reserva

`debtFunding()` calcula separadamente a pagar, já pago, reservado e falta reservar. A transferência de dinheiro para o cofrinho NÃO registra payment. É uma redução da necessidade de reserva, indicada na interface.

Quando há cofrinho legado compartilhado por várias dívidas, a reserva disponível é repartida por ordem de vencimento/ID; a mesma quantia não é contada inteira em duas dívidas. Não são criados cofrinhos duplicados durante a migração.

`settlementPreview()` informa parcela da reserva e eventual complemento externo; a assinatura inclui saldos, plano e dívida. `settleDebt()` exige pagamento real confirmado na UI e confirmação adicional do complemento se necessário. `payDebt()` gera um pagamento e somente o uso da reserva efetivamente disponível; não deixa o cofrinho negativo. Pagamento parcial continua funcionando e reduz a pagar e a reserva na mesma operação.

Na quitação, `finishDebtPocket()` só conclui o cofrinho se todas as dívidas vinculadas estiverem quitadas. Eventual sobra vai para Livre. O cofrinho é marcado closedForDebt e arquivado; seu percentual migra para Livre, evitando quebrar o total manual. A dívida aparece em Quitadas e mantém o histórico. Repetir Quitei não gera outro pagamento. Cofrinho quitado não pode ser restaurado isoladamente; registrar um novo saldo na dívida reabre o mesmo vínculo.

## Ciclos, migração e desfazer

Categorias mensais possuem cycleSpentBaselineCents. Uso do ciclo = soma dos usos − baseline, nunca menor que zero. Ao renovar uma categoria na virada, a baseline passa à soma atual de usos e seu prazo avança; nenhum centavo é movido. Transferências para outro cofrinho não contam como gasto cumprido. Objetivos únicos continuam dependendo do saldo existente, mesmo depois de terem sido completos.

Normalização de v23 preserva IDs, conta e snapshots. A baseline legada considera usos externos ao mês de vencimento; nenhum novo uso é inventado. Assinaturas de desfazer anteriores recebem a baseline compatível sem tornar válidas assinaturas que já estavam obsoletas. planState inclui os novos metadados de ciclo. Desfazer restaura somente planejamento, nunca transferências ou pagamentos feitos depois.

## Persistência

Conta `lifeLatelyZeroV22Account`; espelho `lifeLatelyZeroV22State`; IndexedDB `life-lately-zero-v22`, store app, chave state. Formato cifrado `life-lately-encrypted-v1`; backups v2 incluem os metadados necessários para reabrir com a senha. Gravações serializadas e controle de revisão recusam sobrescrita por aba antiga.

O app não possui servidor de autenticação, sincronização nem operação bancária. O service worker guarda só arquivos públicos; atualizar cache não apaga os dados financeiros. Uma nova instalação começa com LL.empty(). Somente o reset completo confirmado remove perfil/estado da edição.
