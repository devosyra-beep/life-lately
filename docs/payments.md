# Life Lately: pagamentos e reembolsos

## Escopo

- GitHub Pages: `devosyra-beep/life-lately`, app em `/life-lately/app/`.
- Supabase exclusivo: `kgyztrybhrmsxzwpjntq`, organização LIFE LATELY.
- Loja AbacatePay: **Life Lately**. Nunca usar chaves, produtos ou webhooks da loja Osyra.
- Produto: `life-lately-lifetime`, R$ 29,90 (2990 centavos), pagamento único em Pix ou cartão à vista.
- Usuários preexistentes com acesso `founder` mantêm cortesia; isso não representa compra paga.

## Fluxo

Google autentica, mas não inicia cobrança. Sem acesso ativo, o app apresenta preço e condições. Somente o botão de pagar solicita um checkout ao servidor. Retornar por URL não prova pagamento, nem cancela pagamento já confirmado. O botão de verificar consulta o backend sem criar outra cobrança. A área Minha compra também fica disponível fora do acesso pago, para acompanhar reembolso.

O servidor fixa preço/produto e valida identidade, valor e ambiente da resposta. O banco mantém um pedido aberto por conta e reutiliza o checkout, com uma janela de exclusão para criação simultânea. Os eventos são idempotentes e pagamentos tardios não reativam pedidos já reembolsados. Reembolso de um pedido antigo não revoga outra compra válida nem a cortesia.

Pedidos/eventos/reembolsos ficam no schema privado, sem acesso de clientes. As RPCs de cobrança são executáveis apenas por service_role. As funções públicas validam a sessão com auth.getUser; o webhook valida segredo e assinatura HMAC. Escritas financeiras em nuvem requerem acesso ativo por RLS; dados existentes continuam legíveis pelo titular, sem apagamento após reembolso.

## Segredos (somente no projeto Life Lately)

- `ABACATEPAY_API_KEY`: chave API v2 da loja Life Lately, nunca no GitHub ou frontend.
- `ABACATEPAY_PRODUCT_ID`: produto de pagamento único dessa mesma loja e ambiente.
- `ABACATEPAY_MODE`: `sandbox` ou `production`.
- `ABACATEPAY_WEBHOOK_SECRET`: valor aleatório exclusivo, forte.
- `ABACATEPAY_TEST_USER_IDS`: UUIDs separados por vírgula, somente para testar checkout em sandbox. Usuários comuns são recusados nesse modo. Sandbox nunca concede acesso pago em produção.

Webhook: `https://kgyztrybhrmsxzwpjntq.supabase.co/functions/v1/abacatepay-webhook?webhookSecret=<segredo>`.
Eventos API v2: checkout.completed, checkout.refunded, checkout.disputed, checkout.lost.

Permissões de runtime necessárias: CHECKOUT:CREATE, CHECKOUT:READ e REFUND:CREATE. PRODUCT:CREATE/READ e WEBHOOK:CREATE/READ servem à configuração; STORE:READ permite conferir a loja. Não conceder WITHDRAW, BANK_STATEMENT ou STORE:UPDATE/DELETE. Remover permissões de configuração após a validação, se o painel permitir.

## Reembolso e operação

Regra autorizada pelo responsável: pedido nos primeiros 7 dias após confirmação tem envio automático; depois disso, análise manual. A interface pede confirmação explícita do comprador. O endpoint determina o titular pela sessão, nunca pelo corpo da requisição. A API retorna protocolo de envio; a devolução só é mostrada como concluída após evento confirmado.

Falhas/resultado incerto do provedor seguem para análise manual, sem repetição cega. Solicitações interrompidas em `submitting` também precisam de revisão. Consultar a fila no SQL Editor **do Life Lately**:

```sql
select r.order_id, o.external_id, o.provider_checkout_id, o.user_id,
       r.status, r.automatic, r.reason, r.created_at, r.last_error
from private.refund_requests r
join private.payment_orders o on o.id = r.order_id
where not o.dev_mode and r.status in ('manual_review', 'submitting')
order by r.created_at;
```

O painel AbacatePay é a referência para a operação financeira manual. Confirme loja, checkout e valor antes de aprovar. O endpoint oficial de refund é idempotente por checkout. Não marque devolução concluída apenas porque uma solicitação foi enviada. Não há agendamento de verificação nem notificações automáticas para essa fila nesta versão: o responsável precisa acompanhá-la.

## Verificação desta entrega

- Suítes Node do app: `node scripts/run-tests.mjs`.
- Banco isolado PGlite: `node tests/billing-database.mjs` (12 cenários HARNESS).
- Handlers HTTP com provedor simulado: `node tests/billing-edge.mjs` (15 cenários HARNESS).
- Para as duas últimas, dependências de QA são externas ao app: PGlite 0.3.14 e TypeScript 5.9.3. Defina `LL_QA_PACKAGE` com o caminho absoluto do package.json do runtime de QA.
- Prévia mobile 390 × 844: resumo, Minha compra e confirmação de reembolso; sem overflow horizontal.
- LIVE: funções implantadas no projeto correto; chamadas sem sessão/segredo retornam 401; tabelas privadas/RPCs não acessíveis ao cliente.
- LIVE (2026-09-20): 2FA concluído; chave API v2 exclusiva guardada em Edge Function Secrets do Life Lately, junto do modo sandbox, produto e segredo do webhook. Nenhuma credencial foi gravada no repositório. A lista de usuários de teste permanece vazia: clientes comuns não entram no sandbox.
- LIVE: API confirmou loja `store_SpAs10LyM56HtJkGzU5DH02T` / Life Lately; produto `prod_dBsfUs1Ps1U40tDjkMr1kyJ3` (2990 centavos BRL, sem recorrência, devMode=true) e webhook `webh_dev_6m5DWgMQpUwXue1whJwbFMra` (v2, quatro eventos, devMode=true) criados. O endpoint implantado rejeitou chamada com segredo correto, mas sem assinatura, com HTTP 401.
- LIVE: checkout Pix sandbox `bill_1pwNnpCY5mJeP1zchMyYmcgt` criado e consultado, vinculado ao pedido privado 1, externalId `ll_fbdd9853ab4c45d5980ae84ee6f29cf8`. Estado `checkout_created` / PENDING. É uma fixture de integração associada à conta de cortesia preexistente, sem modificar seu acesso. A preparação foi feita pela RPC no SQL Editor, não pelo login/endpoint de compra (que corretamente impede cobrança de quem já tem acesso).
- LIVE: a consulta de checkout inexistente retornou HTTP 400 com `success:false,error:"Billing not found"`, apesar do 404 documentado. Tratamento estrito dessa resposta corrigido e implantado; outros erros continuam bloqueando a criação. Regressão cobre 400/404 e falhas 400/401/403/429/500.
- BLOCKED: a API recusou PIX+CARD com `CARD is not available for this store`. Um checkout somente Pix foi criado exclusivamente para QA; o contrato do app continua Pix+cartão e não foi reduzido silenciosamente.
- BLOCKED: o checkout hospedado do Pix mostrou erro genérico ao avançar com dados sintéticos no sandbox; ainda não houve pagamento simulado confirmado nem entrega de evento pelo provedor.
- NOT_EXECUTED: pagamento/reembolso completo no sandbox, compra ponta a ponta por nova conta Google e cobrança real. Não anunciar pagamento operacional até validação completa.

## Antes de habilitar produção

1. Proprietário: concluir aceite dos termos e documentos da loja Life Lately em “Ir para produção”. O painel informou análise de até 7 dias úteis. Não reutilizar o cadastro/loja Osyra como atalho.
2. Resolver com a AbacatePay a habilitação de cartão e o erro do checkout Pix sandbox; depois testar Pix/cartão, retorno, evento repetido, confirmação atrasada e refund no sandbox real. Nunca simular pagamento alterando manualmente entitlement de produção.
3. Conferir aprovação cadastral e habilitação dos dois meios na loja Life Lately.
4. Criar e guardar chave/produto/webhook de produção exclusivos; trocar modo somente após validação.
5. Validar um pagamento real com autorização específica do titular do meio de pagamento. Não cobrar o usuário automaticamente para testar.

Referências: https://docs.abacatepay.com/pages/payment/create e https://docs.abacatepay.com/pages/payment/refund.
