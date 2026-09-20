import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const PRODUCT_CODE = "life-lately-lifetime";
const PRODUCT_PRICE_CENTS = 2990;
const APP_URL = "https://devosyra-beep.github.io/life-lately/app/";
const PROVIDER_BASE_URL = "https://api.abacatepay.com/v2";
const ALLOWED_ORIGINS = new Set([
  "https://devosyra-beep.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
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
      // The legacy variable below remains the safe compatibility fallback.
    }
  }
  return Deno.env.get(legacyName) ?? "";
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://devosyra-beep.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function cleanCheckout(checkout: Record<string, unknown>): Record<string, unknown> {
  return {
    id: checkout.id,
    externalId: checkout.externalId,
    amount: checkout.amount,
    paidAmount: checkout.paidAmount,
    status: checkout.status,
    devMode: checkout.devMode,
    methods: checkout.methods,
    items: checkout.items,
    createdAt: checkout.createdAt,
    updatedAt: checkout.updatedAt,
  };
}

async function providerRequest(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; ok: boolean; body: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${PROVIDER_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido." });

  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(req, 403, { error: "Origem não autorizada." });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return json(req, 401, { error: "Entre com Google para continuar." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const providerApiKey = Deno.env.get("ABACATEPAY_API_KEY") ?? "";
  const providerProductId = Deno.env.get("ABACATEPAY_PRODUCT_ID") ?? "";
  const providerMode = Deno.env.get("ABACATEPAY_MODE") ?? "";
  const devMode = providerMode === "sandbox";

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json(req, 503, { error: "O backend do Life Lately ainda não está disponível." });
  }
  if (!providerApiKey || !providerProductId || !["sandbox", "production"].includes(providerMode)) {
    return json(req, 503, { error: "Os pagamentos estão em configuração final. Tente novamente em breve." });
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json(req, 401, { error: "Sua sessão expirou. Entre novamente." });
  // Sandbox is reserved for explicitly named test accounts; never send customers
  // to a simulation that looks like a real purchase.
  if (devMode && !(Deno.env.get("ABACATEPAY_TEST_USER_IDS") ?? "").split(",").includes(user.id)) {
    return json(req, 503, { error: "Os pagamentos estão em validação final. Nenhuma cobrança foi criada. Você pode usar Apenas conhecer." });
  }

  let requested: any = {};
  try {
    requested = await req.json();
  } catch {
    requested = {};
  }
  if (requested.productCode && requested.productCode !== PRODUCT_CODE) {
    return json(req, 400, { error: "Produto inválido." });
  }

  const { data: currentAccess, error: accessError } = await admin
    .from("entitlements")
    .select("status")
    .eq("user_id", user.id)
    .eq("product_code", PRODUCT_CODE)
    .maybeSingle();
  if (accessError) return json(req, 500, { error: "Não foi possível verificar seu acesso." });
  if (currentAccess?.status === "active") return json(req, 200, { status: "already_active" });

  const { data: prepared, error: prepareError } = await admin.rpc("billing_prepare_checkout", {
    p_user_id: user.id,
    p_product_code: PRODUCT_CODE,
    p_amount_cents: PRODUCT_PRICE_CENTS,
    p_currency: "BRL",
    p_dev_mode: devMode,
  });
  if (prepareError || !prepared?.id) return json(req, 500, { error: "Não foi possível preparar o pagamento." });
  if (prepared.busy) return json(req, 409, { error: "Seu pagamento já está sendo preparado. Aguarde alguns instantes antes de tentar novamente." });
  if (prepared.checkoutUrl) {
    return json(req, 200, { status: prepared.status, checkoutUrl: prepared.checkoutUrl });
  }

  try {
    let providerCheckout: any = null;
    const existing = await providerRequest(
      providerApiKey,
      `/checkouts/get?externalId=${encodeURIComponent(prepared.externalId)}`,
      { method: "GET" },
    );
    if (existing.ok && existing.body?.success && existing.body?.data) {
      providerCheckout = existing.body.data;
    } else if (existing.status !== 404) {
      throw new Error(`provider lookup failed (${existing.status})`);
    }

    if (!providerCheckout) {
      const created = await providerRequest(providerApiKey, "/checkouts/create", {
        method: "POST",
        body: JSON.stringify({
          items: [{ id: providerProductId, quantity: 1 }],
          methods: ["PIX", "CARD"],
          card: { maxInstallments: 1 },
          externalId: prepared.externalId,
          returnUrl: `${APP_URL}?payment=returned`,
          completionUrl: `${APP_URL}?payment=complete`,
          metadata: { productCode: PRODUCT_CODE, application: "life-lately" },
        }),
      });
      if (!created.ok || !created.body?.success || !created.body?.data) {
        throw new Error(`provider create failed (${created.status})`);
      }
      providerCheckout = created.body.data;
    }

    const checkoutUrl = new URL(String(providerCheckout.url ?? ""));
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "app.abacatepay.com") {
      throw new Error("provider returned an invalid checkout URL");
    }
    if (providerCheckout.devMode !== devMode || providerCheckout.amount !== PRODUCT_PRICE_CENTS || providerCheckout.externalId !== prepared.externalId) {
      throw new Error("provider environment mismatch");
    }

    const { data: saved, error: saveError } = await admin.rpc("billing_store_checkout", {
      p_order_id: prepared.id,
      p_provider_checkout_id: String(providerCheckout.id ?? ""),
      p_checkout_url: checkoutUrl.href,
      p_provider_payload: cleanCheckout(providerCheckout),
    });
    if (saveError || !saved?.checkoutUrl) throw new Error("checkout persistence failed");

    return json(req, 200, { status: saved.status, checkoutUrl: saved.checkoutUrl });
  } catch (error) {
    await admin.rpc("billing_record_checkout_error", {
      p_order_id: prepared.id,
      p_error: error instanceof Error ? error.message : "provider error",
    });
    return json(req, 502, { error: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." });
  }
});
