import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const ORIGINS = new Set(["https://devosyra-beep.github.io", "http://127.0.0.1:4173", "http://localhost:4173"]);
function key(name: string, fallback: string): string {
  try { const value = JSON.parse(Deno.env.get(name) ?? "{}").default; if (typeof value === "string" && value.startsWith("sb_")) return value; } catch { /* legacy compatibility */ }
  return Deno.env.get(fallback) ?? "";
}
function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://devosyra-beep.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json", "Cache-Control": "no-store" };
}
async function provider(path: string, apiKey: string, body?: unknown) {
  const response = await fetch(`https://api.abacatepay.com/v2${path}`, {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw Error(`provider_${response.status}`);
  return result.data;
}

Deno.serve(async (req: Request) => {
  const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: headers(req) });
  if (req.method === "OPTIONS") return reply(200, {});
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });
  const origin = req.headers.get("origin");
  if (origin && !ORIGINS.has(origin)) return reply(403, { error: "Origem não autorizada." });
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, { error: "Entre com Google para continuar." });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(url, key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData.user) return reply(401, { error: "Sua sessão expirou. Entre novamente." });
  const userId = userData.user.id;
  const apiKey = Deno.env.get("ABACATEPAY_API_KEY") ?? "";
  const mode = Deno.env.get("ABACATEPAY_MODE");
  let body: any;
  try { const raw = await req.text(); if (raw.length > 2000) return reply(413, { error: "Solicitação muito longa." }); body = JSON.parse(raw); }
  catch { return reply(400, { error: "Solicitação inválida." }); }
  try {
    if (body.action === "refund") {
      if (!Number.isSafeInteger(body.orderId) || body.orderId <= 0 || (body.reason != null && typeof body.reason !== "string")) return reply(400, { error: "Compra inválida." });
      if (mode !== "production" || !apiKey) return reply(503, { error: "O reembolso não está disponível neste ambiente. Tente novamente em breve." });
      const { data: refund, error } = await admin.rpc("billing_request_refund", { p_user_id: userId, p_order_id: body.orderId, p_reason: String(body.reason ?? "").slice(0, 500) });
      if (error) return reply(400, { error: "Não foi possível solicitar reembolso desta compra. Atualize o status." });
      if (refund.send) {
        let refundId: string | null = null, errorCode: string | null = null;
        try {
          const result = await provider("/checkouts/refund", apiKey, { id: refund.checkoutId, reason: "Reembolso solicitado pelo titular no Life Lately (prazo de 7 dias)." });
          if (typeof result?.refundPublicId !== "string") throw Error("invalid_provider_response");
          refundId = result.refundPublicId;
        } catch { errorCode = "provider_confirmation_pending_review"; }
        const { error: recordError } = await admin.rpc("billing_record_refund_result", { p_order_id: body.orderId, p_refund_id: refundId, p_error: errorCode });
        if (recordError) throw Error("refund_result_persistence");
      }
      return reply(200, { ok: true });
    }
    if (body.action !== "status") return reply(400, { error: "Solicitação inválida." });
    // Bounded, customer-triggered reconciliation; no permanent polling jobs.
    if (apiKey && mode === "production") {
      const { data: order, error: claimError } = await admin.rpc("billing_claim_reconcile", { p_user_id: userId, p_dev_mode: false });
      if (claimError) throw Error("reconcile_claim_failed");
      if (order) {
        try {
          const checkout = await provider(`/checkouts/get?externalId=${encodeURIComponent(order.externalId)}`, apiKey);
          if (checkout?.status === "PAID" && checkout.devMode === false && checkout.externalId === order.externalId && checkout.amount === order.amount && checkout.paidAmount === order.amount && (!order.providerCheckoutId || order.providerCheckoutId === checkout.id)) {
            const { error, data } = await admin.rpc("billing_process_payment_event", {
              p_provider_event_id: `reconcile_paid_${checkout.id}`, p_event_type: "checkout.completed", p_external_id: checkout.externalId,
              p_provider_checkout_id: checkout.id, p_checkout_status: checkout.status, p_amount_cents: checkout.amount, p_paid_amount_cents: checkout.paidAmount,
              p_payment_method: null, p_receipt_url: null, p_dev_mode: false,
              p_payload: { source: "provider_reconciliation", checkoutId: checkout.id, amount: checkout.amount, status: checkout.status },
            });
            if (error || !data?.processed) throw Error("reconciliation_failed");
          }
        } catch { /* The portal remains usable while the provider is unavailable; never claim success. */ }
      }
    }
    const { data, error } = await admin.rpc("billing_customer_portal", { p_user_id: userId });
    if (error) throw Error("portal_unavailable");
    return reply(200, data);
  } catch { return reply(503, { error: "Não foi possível concluir agora. Seu pedido não será cobrado novamente; atualize o status em instantes." }); }
});
