# Planejamento e virada · contrato da versão 24

## Separação central

O dinheiro é derivado de `transactions`, snapshots em centavos e `movements`. Planejamento são instruções para as próximas distribuições. Os comandos `resetPlanning`, `rollMonth` e `undoPlanning` nunca escrevem valores ou snapshots financeiros, não geram pagamentos e não apagam o cadastro. Salvar continua passando por `commit` → `LL.validate` → `LLStore.save`. A UI só assume sucesso depois da gravação.

## Esquema 12

`planning.month` contém o mês em foco. `planning.closures` contém fotografias de fechamentos, `planning.resets` os planos anteriores aos reinícios. `planning.undo` contém a última operação de gerenciamento, os campos de planejamento anteriores e uma assinatura esperada do plano posterior. Todos são parte do estado cifrado e dos backups. Não há chaves de armazenamento novas.

Categorias recebem `planningPaused`, `recurrence` (once/monthly) e `recurrenceDay` (1–31). A migração não infere recorrência por nome, valor ou prazo: categorias existentes começam como únicas. Metas financeiras podem durar décadas e não entram na seleção de despesas mensais.

## Reinício

Nos cofrinhos ativos, limpa `targetAmount`, `targetDate`, recorrência e percentuais. Categorias não livres ficam pausadas; Livre continua estrutural. Zera referências `goals.monthly` e `goals.weekly` e o espelho legado `goals.financial`, impedindo que normalize ressuscite a meta antiga. Retorna ao modo automático não configurado: novas entradas ficam pendentes até haver um plano.

`target()` ignora objetivos pausados, inclusive a sugestão de separação de uma dívida, mas continua informando o saldo real. A dívida original continua em Dívidas com seu valor, prazo e pagamentos. Editar/salvar um plano, retomar a dívida ou definir uma porcentagem manual positiva reativa a participação correspondente. Metas pausadas deixam a lista de objetivos ativos, mas seus cofrinhos e saldos continuam em Organizar.

Categorias arquivadas não são apagadas nem reativadas. O histórico e os snapshots de distribuição passados permanecem intactos.

## Virada

`rolloverPreview()` é pura: calcula `from`, `to`, candidatos e fotografia dos valores. `rollMonth()` exige o mês esperado e confere a assinatura de planejamento capturada ao abrir o modal. Duplicar a confirmação não avança novamente. Um fechamento ativo por mês evita repetição; um fechamento desfeito fica marcado no histórico, permitindo uma nova virada intencional.

Somente categorias comuns, ativas, não pausadas, com valor positivo e data até o período a encerrar são elegíveis para renovação. Não se renova dívida nem meta financeira por inferência. A UI pré-seleciona apenas recorrentes explicitamente marcadas no formulário; itens comuns podem ser selecionados para renovar uma única vez. Itens não selecionados mantêm a data, mesmo vencida.

A virada muda as datas selecionadas, a baseline de uso dos ciclos renovados e `planning.month`. Saldo disponível, total recebido, pagamentos e dinheiro pendente permanecem. A referência de renda mensal não é apagada: apenas o progresso passa a consultar os ganhos datados no novo mês. A semana continua sendo a semana civil atual, identificada como “Esta semana”. O rateio dos próximos ganhos continua usando dias reais até os prazos, não uma data fictícia de recebimento.

O mês em foco não avança sozinho. Quando está atrasado em relação ao calendário, Início oferece revisar a virada. É permitido abrir até o próximo mês civil, com aviso de antecipação. Fechamentos antigos podem ser feitos em sequência; não há salto silencioso de múltiplos períodos.

## Dia 31 e meses curtos

O próximo vencimento é construído a partir do ano/mês de destino e de `min(dia habitual, último dia do mês)`. Não se usa overflow de `Date.setMonth()` sobre o dia 31. A âncora continua 31 após fevereiro, inclusive se só o valor do plano for editado; uma mudança explícita da data estabelece nova âncora.

## Fotografia, correções e moeda

O fechamento guarda receitas, usos dos cofrinhos e pagamentos de dívidas datados naquele mês, além dos saldos disponíveis no instante da confirmação. Valores são inteiros em centavos; o código da moeda no fechamento é preservado para exibir a fotografia corretamente mesmo após uma troca de unidade no app.

“Usado dos cofrinhos” e “Pago em dívidas” não são somados: pagamentos podem estar contidos nos usos. Se uma entrada ou movimento passado mudar, o fechamento não é reescrito. Sua tela compara os totais atuais do mês com a fotografia e avisa sobre lançamentos/correções posteriores. O fechamento não é extrato bancário nem bloqueio contábil de lançamentos.

## Desfazer sem apagar o que aconteceu depois

`planState()` contém somente campos de planejamento. Antes de desfazer, a assinatura atual precisa coincidir com a assinatura esperada. Um novo cofrinho, uma edição de objetivo ou troca de divisão impede restaurar por cima desse trabalho. Ganhos, usos e pagamentos posteriores não são revertidos, mesmo quando desfazer ainda é permitido.

A restauração recupera mês, referências, percentuais, pausas, metas, recorrências e baseline de uso do ciclo. A operação original é marcada como desfeita e outra atividade é adicionada ao histórico. A confirmação revisa o efeito antes da gravação.

## Complementos da v24

A fotografia guarda também freeCents: quanto estava Livre no fechamento, sem tratá-lo como ganho do novo mês. A confirmação de sucesso oferece Distribuir saldo Livre; esta é uma segunda ação, opcional, com prévia e confirmação própria. Virar o mês sozinho não transfere dinheiro.

Um cofrinho mensal já atendido não volta a receber só porque seu saldo foi gasto. Ele volta a precisar guardar quando o ciclo for renovado e o saldo restante não cobrir o novo objetivo. Os não selecionados continuam no ciclo anterior. Metas únicas/dívidas não são renovadas como despesas mensais.

Quitei pode arquivar um cofrinho e modificar a divisão manual, portanto invalida um desfazer de planejamento que sobrescreveria essas mudanças. Simples redistribuição de dinheiro entre cofrinhos não altera a assinatura de planejamento; um desfazer permitido não reverte essa movimentação.
