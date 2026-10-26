-- Apply ONLY to the NEW Supabase project after 001_personal_data.sql.
-- Atomic, replay-safe bookkeeping for a previously VERIFIED Razorpay event.
-- Only a trusted server using service_role can call this RPC.

create or replace function public.booknomics_apply_razorpay_event(
  p_event_id text,
  p_event_name text,
  p_subscription_id text,
  p_payment_id text,
  p_amount integer,
  p_currency text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_happened_at timestamptz,
  p_provider_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed text;
  v_sub public.subscriptions%rowtype;
  v_valid_charge boolean;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_event_id !~ '^[A-Za-z0-9_-]{6,120}$'
     or p_subscription_id !~ '^sub_[A-Za-z0-9]+$' then
    raise exception 'Invalid Razorpay identifiers';
  end if;

  -- INSERT and UPDATE below form a *single* Postgres transaction.
  -- On errors the claim rolls back and Razorpay can retry safely.
  insert into booknomics_private.razorpay_webhook_events (event_id, event_name)
  values (p_event_id, p_event_name)
  on conflict (event_id) do nothing
  returning event_id into v_claimed;

  if v_claimed is null then
    -- Already claimed/processed by another request. Do not apply twice.
    return true;
  end if;

  select * into v_sub from public.subscriptions
  where razorpay_subscription_id = p_subscription_id
  for update;
  if not found then
    raise exception 'Subscription has not yet been registered';
  end if;

  v_valid_charge := p_event_name = 'subscription.charged'
    and p_payment_id ~ '^pay_[A-Za-z0-9]+$'
    and p_currency = 'INR'
    and p_amount = v_sub.amount
    and p_expires_at > now()
    and (v_sub.expires_at is null or p_expires_at >= v_sub.expires_at);

  if v_valid_charge then
    update public.subscriptions set
      status = 'active',
      starts_at = coalesce(p_starts_at, now()),
      expires_at = p_expires_at,
      razorpay_payment_id = p_payment_id,
      provider_status = left(coalesce(p_provider_status, 'active'), 64),
      last_provider_event_at = greatest(coalesce(last_provider_event_at, p_happened_at), p_happened_at),
      updated_at = now()
    where id = v_sub.id;
  elsif p_happened_at is not null
    and (v_sub.last_provider_event_at is null or p_happened_at >= v_sub.last_provider_event_at) then
    update public.subscriptions set
      provider_status = left(coalesce(p_provider_status, p_event_name), 64),
      last_provider_event_at = p_happened_at,
      cancel_at_cycle_end = case
        when p_event_name in ('subscription.cancelled', 'subscription.completed') then true
        when p_event_name = 'subscription.resumed' then false
        else cancel_at_cycle_end
      end,
      status = case
        when p_event_name in ('subscription.cancelled', 'subscription.completed')
          then case when expires_at > now() then 'active' else 'expired' end
        else status
      end,
      updated_at = now()
    where id = v_sub.id;
  end if;

  update booknomics_private.razorpay_webhook_events
    set processed_at = now() where event_id = p_event_id;
  return true;
end;
$$;

revoke all on function public.booknomics_apply_razorpay_event(
  text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,text
) from public, anon, authenticated;
grant execute on function public.booknomics_apply_razorpay_event(
  text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,text
) to service_role;
