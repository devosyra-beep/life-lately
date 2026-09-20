-- Server-only billing state machine. Sandbox never grants production access.
alter table private.payment_orders add column checkout_lease_until timestamptz,
  add column last_checked_at timestamptz;

create table private.refund_requests (
  order_id bigint primary key references private.payment_orders(id),
  status text not null check(status in ('submitting','submitted','manual_review','completed')),
  reason text not null default '' check(length(reason)<=500),
  automatic boolean not null,
  provider_refund_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.refund_requests enable row level security;
alter table private.refund_requests force row level security;
revoke all on private.refund_requests from public,anon,authenticated;
create policy refund_requests_deny_clients on private.refund_requests for all to anon,authenticated using(false) with check(false);
create index refund_requests_review_idx on private.refund_requests(created_at) where status in ('manual_review','submitting');

create or replace function public.billing_prepare_checkout(p_user_id uuid,p_product_code text,p_amount_cents integer,p_currency text,p_dev_mode boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o private.payment_orders%rowtype;
begin
 if p_user_id is null or p_product_code is distinct from 'life-lately-lifetime' or p_amount_cents is distinct from 2990 or p_currency is distinct from 'BRL' or p_dev_mode is null then
  raise exception 'invalid billing product' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into o from private.payment_orders where user_id=p_user_id and product_code=p_product_code and dev_mode=p_dev_mode and status in ('pending','checkout_created') order by id desc limit 1 for update;
 if o.id is null then
  insert into private.payment_orders(user_id,product_code,external_id,amount_cents,currency,dev_mode)
  values(p_user_id,p_product_code,'ll_'||replace(gen_random_uuid()::text,'-',''),p_amount_cents,p_currency,p_dev_mode) returning * into o;
 end if;
 if o.checkout_url is null then
  if o.checkout_lease_until>now() then return jsonb_build_object('id',o.id,'busy',true); end if;
  update private.payment_orders set checkout_lease_until=now()+interval '60 seconds' where id=o.id;
 end if;
 return jsonb_build_object('id',o.id,'externalId',o.external_id,'status',o.status,'checkoutUrl',o.checkout_url,'providerCheckoutId',o.provider_checkout_id,'devMode',o.dev_mode);
end; $$;

create or replace function public.billing_store_checkout(p_order_id bigint,p_provider_checkout_id text,p_checkout_url text,p_provider_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o private.payment_orders%rowtype;
begin
 select * into o from private.payment_orders where id=p_order_id for update;
 if o.id is null or nullif(btrim(p_provider_checkout_id),'') is null or p_checkout_url is null or p_checkout_url !~ '^https://app[.]abacatepay[.]com/' or jsonb_typeof(p_provider_payload) is distinct from 'object'
  or p_provider_payload->>'externalId' is distinct from o.external_id
  or (p_provider_payload->>'amount')::integer is distinct from o.amount_cents
  or (p_provider_payload->>'devMode')::boolean is distinct from o.dev_mode
  or (o.provider_checkout_id is not null and o.provider_checkout_id<>p_provider_checkout_id) then
  raise exception 'invalid checkout response' using errcode='22023';
 end if;
 update private.payment_orders set provider_checkout_id=p_provider_checkout_id,checkout_url=p_checkout_url,
  status=case when status='pending' then 'checkout_created' else status end,
  checkout_lease_until=null,last_error=null,provider_payload=p_provider_payload,updated_at=now() where id=o.id returning * into o;
 return jsonb_build_object('id',o.id,'status',o.status,'checkoutUrl',o.checkout_url);
end; $$;

create or replace function public.billing_process_payment_event(
 p_provider_event_id text,p_event_type text,p_external_id text,p_provider_checkout_id text,p_checkout_status text,
 p_amount_cents integer,p_paid_amount_cents integer,p_payment_method text,p_receipt_url text,p_dev_mode boolean,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o private.payment_orders%rowtype; target_status text; access_status text;
begin
 if nullif(btrim(p_provider_event_id),'') is null or length(p_provider_event_id)>250
  or p_event_type is null or p_event_type not in ('checkout.completed','checkout.refunded','checkout.disputed','checkout.lost')
  or jsonb_typeof(p_payload) is distinct from 'object' or p_dev_mode is null then
  raise exception 'invalid payment event' using errcode='22023';
 end if;
 select * into o from private.payment_orders where external_id=p_external_id for update;
 if o.id is null then return jsonb_build_object('processed',false,'error','order_not_found'); end if;
 -- Serialize different orders for one account before deriving its entitlement.
 perform pg_advisory_xact_lock(hashtextextended(o.user_id::text,1));
 if o.dev_mode is distinct from p_dev_mode or o.amount_cents is distinct from p_amount_cents
  or nullif(p_provider_checkout_id,'') is null
  or (o.provider_checkout_id is not null and o.provider_checkout_id is distinct from p_provider_checkout_id) then
  return jsonb_build_object('processed',false,'error','checkout_mismatch');
 end if;
 if p_event_type='checkout.completed' and (p_checkout_status is distinct from 'PAID' or p_paid_amount_cents is distinct from o.amount_cents) then
  return jsonb_build_object('processed',false,'error','payment_not_complete');
 end if;
 insert into private.payment_events(provider,provider_event_id,event_type,payload,order_id)
 values('abacatepay',p_provider_event_id,p_event_type,p_payload,o.id) on conflict(provider,provider_event_id) do nothing;
 if not found then return jsonb_build_object('processed',true,'duplicate',true); end if;
 target_status:=case p_event_type when 'checkout.completed' then 'paid' when 'checkout.refunded' then 'refunded' when 'checkout.disputed' then 'disputed' else 'lost' end;
 -- Terminal/negative events cannot be undone by a late completed event.
 if (target_status='paid' and o.status in ('refunded','disputed','lost')) or o.status='refunded' then target_status:=o.status; end if;
 update private.payment_orders set status=target_status,provider_checkout_id=coalesce(provider_checkout_id,p_provider_checkout_id),
  payment_method=case when p_payment_method in ('PIX','CARD') then p_payment_method else payment_method end,
  receipt_url=case when p_receipt_url ~ '^https://' then p_receipt_url else receipt_url end,
  paid_at=case when target_status='paid' then coalesce(paid_at,now()) else paid_at end,
  refunded_at=case when target_status='refunded' then coalesce(refunded_at,now()) else refunded_at end,
  provider_payload=p_payload,updated_at=now(),last_error=null where id=o.id;
 if target_status='refunded' then update private.refund_requests set status='completed',updated_at=now() where order_id=o.id; end if;
 if not o.dev_mode then
  access_status:=case when exists(select 1 from private.payment_orders where user_id=o.user_id and product_code=o.product_code and not dev_mode and status='paid') then 'active' else 'canceled' end;
  insert into public.entitlements(user_id,product_code,status,provider) values(o.user_id,o.product_code,access_status,'abacatepay')
  on conflict(user_id,product_code) do update set status=excluded.status,updated_at=now()
  where entitlements.provider='abacatepay'; -- Never revoke founder/manual access.
 end if;
 update private.payment_events set processed_at=now() where provider='abacatepay' and provider_event_id=p_provider_event_id;
 return jsonb_build_object('processed',true,'duplicate',false,'status',target_status);
end; $$;

-- This API accepts only the verified user ID from an Edge Function, not clients.
create function public.billing_customer_portal(p_user_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('founder',exists(select 1 from public.entitlements where user_id=p_user_id and provider='founder' and status='active'),
  'orders',coalesce((select jsonb_agg(row_to_json(t)) from (
   select o.id, o.external_id as reference,o.status,o.amount_cents,o.payment_method,o.paid_at,r.status as refund_status,
    (o.status='paid' and r.order_id is null) as can_request_refund,
    (o.paid_at>=now()-interval '7 days') as automatic_refund
   from private.payment_orders o left join private.refund_requests r on r.order_id=o.id
   where o.user_id=p_user_id and not o.dev_mode order by o.id desc limit 20
  ) t),'[]'::jsonb));
$$;

create function public.billing_claim_reconcile(p_user_id uuid,p_dev_mode boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o private.payment_orders%rowtype;
begin
 select * into o from private.payment_orders where user_id=p_user_id and dev_mode=p_dev_mode
  and status in ('pending','checkout_created') and (last_checked_at is null or last_checked_at<now()-interval '15 seconds')
 order by id desc limit 1 for update skip locked;
 if o.id is null then return null; end if;
 update private.payment_orders set last_checked_at=now() where id=o.id;
 return jsonb_build_object('id',o.id,'externalId',o.external_id,'providerCheckoutId',o.provider_checkout_id,'amount',o.amount_cents,'devMode',o.dev_mode);
end; $$;

create function public.billing_request_refund(p_user_id uuid,p_order_id bigint,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o private.payment_orders%rowtype; r private.refund_requests%rowtype; auto_refund boolean;
begin
 select * into o from private.payment_orders where id=p_order_id and user_id=p_user_id and not dev_mode for update;
 if o.id is null then raise exception 'purchase not found' using errcode='P0002'; end if;
 select * into r from private.refund_requests where order_id=o.id;
 if r.order_id is not null then return jsonb_build_object('status',r.status,'send',false); end if;
 if o.status<>'paid' then raise exception 'purchase not refundable' using errcode='22023'; end if;
 auto_refund:=o.paid_at>=now()-interval '7 days';
 insert into private.refund_requests(order_id,status,reason,automatic) values(o.id,case when auto_refund then 'submitting' else 'manual_review' end,left(coalesce(p_reason,''),500),auto_refund);
 return jsonb_build_object('status',case when auto_refund then 'submitting' else 'manual_review' end,'send',auto_refund,'checkoutId',o.provider_checkout_id);
end; $$;

create function public.billing_record_refund_result(p_order_id bigint,p_refund_id text,p_error text) returns void
language sql security definer set search_path='' as $$
 update private.refund_requests set status=case when nullif(p_refund_id,'') is not null then 'submitted' else 'manual_review' end,
  provider_refund_id=p_refund_id,last_error=left(p_error,300),updated_at=now() where order_id=p_order_id and status='submitting';
$$;

revoke all on function public.billing_customer_portal(uuid),public.billing_claim_reconcile(uuid,boolean),public.billing_request_refund(uuid,bigint,text),public.billing_record_refund_result(bigint,text,text) from public,anon,authenticated;
grant execute on function public.billing_customer_portal(uuid),public.billing_claim_reconcile(uuid,boolean),public.billing_request_refund(uuid,bigint,text),public.billing_record_refund_result(bigint,text,text) to service_role;

-- Owning existing records still permits read/export after a refund. Writes need
-- actual paid or manually granted access; changing client JS cannot bypass this.
alter policy app_states_insert_own on public.app_states with check(
 (select auth.uid())=user_id and exists(select 1 from public.entitlements e where e.user_id=(select auth.uid()) and e.product_code='life-lately-lifetime' and e.status='active'));
alter policy app_states_update_own on public.app_states using(
 (select auth.uid())=user_id and exists(select 1 from public.entitlements e where e.user_id=(select auth.uid()) and e.product_code='life-lately-lifetime' and e.status='active'))
 with check((select auth.uid())=user_id and exists(select 1 from public.entitlements e where e.user_id=(select auth.uid()) and e.product_code='life-lately-lifetime' and e.status='active'));
