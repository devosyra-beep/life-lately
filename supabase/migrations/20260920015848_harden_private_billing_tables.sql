-- Defense in depth: these tables are outside the Data API and have no client
-- grants, but RLS also keeps them closed if schema exposure changes later.
alter table private.billing_customers enable row level security;
alter table private.payment_events enable row level security;
alter table private.billing_customers force row level security;
alter table private.payment_events force row level security;
