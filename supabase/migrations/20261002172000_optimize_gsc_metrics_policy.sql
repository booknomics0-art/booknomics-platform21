-- Keep the GSC metrics admin policy efficient by evaluating auth once per statement.
drop policy if exists "Admins can read GSC page metrics" on public.gsc_page_metrics;
create policy "Admins can read GSC page metrics"
on public.gsc_page_metrics
for select
to authenticated
using ((select public.has_role((select auth.uid()), 'admin')));
