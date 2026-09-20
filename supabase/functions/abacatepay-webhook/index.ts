import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const ABACATEPAY_PUBLIC_HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";
const SUPPORTED_EVENTS = new Set([
  "checkout.completed",
  "checkout.refunded",
  "checkout.disputed",
  "checkout.lost",
]);

function envKey(setName: string, legacyName: string): string {
  const raw = Deno.env.get(setName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const candidate = parsed?.default;
      if (typeof candidate === "string") {
        if (candidate.startsWith("sb_")) return candidate;
        const indirect = Deno.env.get(candidate);
        if (indirect) return indirect;
      }
    } catch {
      // Use the legacy compatibility variable below.
    }
  }
  return Deno.env.get(legacyName) ?? "";
}

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % Math.max(a.length, 1)] ?? 0) ^ (b[index % Math.max(b.length, 1)] ?? 0);
  }
  return difference === 0;
}

function base64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const value of new Uint8Array(bytes)) binary += String.fromCharCode(value);
  return btoa(binary);
}

async function validSignature(rawBody: string, received: string): Promise<boolean> {
  if (!received) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ABACATEPAY_PUBLIC_HMAC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return safeEqual(base64(digest), received);
}

function checkoutPayload(eventId: string, eventType: string, apiVersion: number, devMode: boolean, checkout: any) {
  return {
    id: eventId,
    event: eventType,
    apiVersion,
    devMode,
    checkout: {
      id: checkout.id,
      externalId: checkout.externalId,
      amount: checkout.amount,
      paidAmount: checkout.paidAmount,
      status: checkout.status,
      methods: checkout.methods,
      installmentsCount: checkout.installmentsCount,
      receiptUrl: checkout.receiptUrl,
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { error: "method_not_allowed" });

  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET") ?? "";
  const receivedSecret = new URL(req.url).searchParams.get("webhookSecret") ?? "";
  if (!webhookSecret || !safeEqual(webhookSecret, receivedSecret)) {
    return response(401, { error: "invalid_webhook_secret" });
  }

  const rawBody = await req.text();
  if (rawBody.length > 65536) return response(413, { error: "payload_too_large" });
  const signature = req.headers.get("x-webhook-signature") ?? "";
  if (!(await validSignature(rawBody, signature))) {
    return response(401, { error: "invalid_webhook_signature" });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response(400, { error: "invalid_json" });
  }

  const eventId = typeof payload?.id === "string" ? payload.id : "";
  const eventType = typeof payload?.event === "string" ? payload.event : "";
  if (!eventId || payload?.apiVersion !== 2) return response(400, { error: "invalid_event" });
  const mode = Deno.env.get("ABACATEPAY_MODE");
  if (!["sandbox", "production"].includes(mode ?? "")) return response(503, { error: "provider_not_configured" });
  if (typeof payload.devMode !== "boolean" || payload.devMode !== (mode === "sandbox")) return response(400, { error: "environment_mismatch" });
  if (!SUPPORTED_EVENTS.has(eventType)) return response(200, { ok: true, ignored: true });

  const checkout = payload?.data?.checkout;
  if (!checkout || typeof checkout.id !== "string" || typeof checkout.externalId !== "string") {
    return response(400, { error: "invalid_checkout" });
  }
  if (!Number.isInteger(checkout.amount) || (eventType === "checkout.completed" && !Number.isInteger(checkout.paidAmount))) return response(400, { error: "invalid_amount" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secretKey = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) return response(503, { error: "backend_not_configured" });

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const paymentMethod = payload?.data?.payerInformation?.method;
  const sanitized = checkoutPayload(
    eventId,
    eventType,
    payload.apiVersion,
    Boolean(payload.devMode),
    checkout,
  );

  const { data, error } = await admin.rpc("billing_process_payment_event", {
    p_provider_event_id: eventId,
    p_event_type: eventType,
    p_external_id: checkout.externalId,
    p_provider_checkout_id: checkout.id,
    p_checkout_status: String(checkout.status ?? ""),
    p_amount_cents: Number(checkout.amount),
    p_paid_amount_cents: Number(checkout.paidAmount ?? 0),
    p_payment_method: typeof paymentMethod === "string" ? paymentMethod : null,
    p_receipt_url: typeof checkout.receiptUrl === "string" ? checkout.receiptUrl : null,
    p_dev_mode: Boolean(payload.devMode),
    p_payload: sanitized,
  });

  if (error || !data?.processed) return response(500, { error: "processing_failed" });
  return response(200, { ok: true, duplicate: Boolean(data.duplicate) });
});
