const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260920033705_add_abacatepay_billing.sql');
const checkout=read('supabase/functions/create-abacatepay-checkout/index.ts');
const webhook=read('supabase/functions/abacatepay-webhook/index.ts');
const cloud=read('cloud.js');
let checks=0;const ok=name=>{checks++;console.log('✓',name);};

assert.match(migration,/create table private\.payment_orders/i);
assert.match(migration,/enable row level security/i);
assert.match(migration,/force row level security/i);
assert.match(migration,/payment_orders_deny_clients/i);
assert.match(migration,/pg_advisory_xact_lock/i);
assert.match(migration,/on conflict \(provider, provider_event_id\)/i);
assert.match(migration,/p_paid_amount_cents <> target_order\.amount_cents/i);
assert.match(migration,/life-lately-lifetime/);
ok('Pedidos são privados, serializados por usuário e webhooks são idempotentes');

assert.match(checkout,/PRODUCT_PRICE_CENTS = 2990/);
assert.match(checkout,/methods: \["PIX", "CARD"\]/);
assert.match(checkout,/card: \{ maxInstallments: 1 \}/);
assert.match(checkout,/hostname !== "app\.abacatepay\.com"/);
assert.match(checkout,/ABACATEPAY_API_KEY/);
assert.doesNotMatch(checkout,/abc_(?:dev|live)_[A-Za-z0-9]+/);
ok('Checkout aceita Pix e cartão, fixa preço e valida o destino sem chave embutida');

assert.match(webhook,/x-webhook-signature/i);
assert.match(webhook,/webhookSecret/);
assert.match(webhook,/HMAC/);
assert.match(webhook,/SHA-256/);
assert.match(webhook,/SUPPORTED_EVENTS/);
assert.doesNotMatch(webhook,/service_role\s*[:=]\s*["']/i);
ok('Webhook exige secret, assinatura HMAC e eventos permitidos');

assert.match(cloud,/functions\.invoke\('create-abacatepay-checkout'/);
assert.match(cloud,/from\('entitlements'\)/);
assert.doesNotMatch(cloud,/ABACATEPAY_API_KEY|ABACATEPAY_WEBHOOK_SECRET/);
ok('Cliente público conhece apenas a função e o próprio direito de acesso');

console.log(`\n${checks} verificações de cobrança concluídas.`);
