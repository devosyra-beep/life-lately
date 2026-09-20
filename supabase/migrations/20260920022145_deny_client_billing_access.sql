-- Explicit deny policies document that payment internals are server-only.
-- The schema and table grants are also revoked in the foundation migration.
create policy "billing_customers_deny_clients"
on private.billing_customers
for all
to anon, authenticated
using (false)
with check (false);

create policy "payment_events_deny_clients"
on private.payment_events
for all
to anon, authenticated
using (false)
with check (false);
