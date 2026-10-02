revoke all on table public.book_requests from anon;

drop policy if exists "Users view own book requests" on public.book_requests;
create policy "Users view own book requests"
  on public.book_requests for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

drop policy if exists "Users create own book requests" on public.book_requests;
create policy "Users create own book requests"
  on public.book_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Admins update book requests" on public.book_requests;
create policy "Admins update book requests"
  on public.book_requests for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Admins delete book requests" on public.book_requests;
create policy "Admins delete book requests"
  on public.book_requests for delete to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));
