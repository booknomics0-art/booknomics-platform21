
-- Helper: admin email check via JWT (no recursion, no user_roles dependency)
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'amansrivast2104@gmail.com'
$$;

-- updated_at trigger fn (reuse if exists)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================================================
-- seo_audits
-- =========================================================
CREATE TABLE public.seo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  url text NOT NULL,
  on_page_score int,
  off_page_score int,
  polishing_score int,
  humanized_score int,
  seo_readiness_score int,
  indexed_status text,
  average_position numeric,
  clicks int DEFAULT 0,
  impressions int DEFAULT 0,
  ctr numeric,
  top_queries jsonb DEFAULT '[]'::jsonb,
  audit_details jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_audits_book_id_idx ON public.seo_audits(book_id);
CREATE INDEX seo_audits_url_idx ON public.seo_audits(url);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_audits TO authenticated;
GRANT ALL ON public.seo_audits TO service_role;
ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages seo_audits" ON public.seo_audits FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER seo_audits_touch BEFORE UPDATE ON public.seo_audits
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- seo_indexing_jobs
-- =========================================================
CREATE TABLE public.seo_indexing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  gsc_status text,
  last_checked_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_indexing_jobs_status_idx ON public.seo_indexing_jobs(status);
CREATE INDEX seo_indexing_jobs_book_id_idx ON public.seo_indexing_jobs(book_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_indexing_jobs TO authenticated;
GRANT ALL ON public.seo_indexing_jobs TO service_role;
ALTER TABLE public.seo_indexing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages seo_indexing_jobs" ON public.seo_indexing_jobs FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER seo_indexing_jobs_touch BEFORE UPDATE ON public.seo_indexing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- social_accounts
-- =========================================================
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_name text,
  profile_url text,
  connected boolean NOT NULL DEFAULT false,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX social_accounts_platform_idx ON public.social_accounts(platform);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages social_accounts" ON public.social_accounts FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER social_accounts_touch BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- social_posts
-- =========================================================
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  platform text NOT NULL,
  post_type text,
  content text,
  media_url text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_posts_book_idx ON public.social_posts(book_id);
CREATE INDEX social_posts_platform_status_idx ON public.social_posts(platform, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages social_posts" ON public.social_posts FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER social_posts_touch BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- backlink_records
-- =========================================================
CREATE TABLE public.backlink_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  target_url text NOT NULL,
  anchor_text text,
  domain text,
  status text DEFAULT 'planned',
  dofollow boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX backlink_records_book_idx ON public.backlink_records(book_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backlink_records TO authenticated;
GRANT ALL ON public.backlink_records TO service_role;
ALTER TABLE public.backlink_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages backlink_records" ON public.backlink_records FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER backlink_records_touch BEFORE UPDATE ON public.backlink_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- url_redirects
-- =========================================================
CREATE TABLE public.url_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_path text NOT NULL UNIQUE,
  new_path text NOT NULL,
  status_code int NOT NULL DEFAULT 301,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.url_redirects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.url_redirects TO authenticated;
GRANT ALL ON public.url_redirects TO service_role;
ALTER TABLE public.url_redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read redirects" ON public.url_redirects FOR SELECT USING (true);
CREATE POLICY "Admin writes redirects" ON public.url_redirects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_email());
CREATE POLICY "Admin updates redirects" ON public.url_redirects FOR UPDATE TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE POLICY "Admin deletes redirects" ON public.url_redirects FOR DELETE TO authenticated
  USING (public.is_admin_email());
CREATE TRIGGER url_redirects_touch BEFORE UPDATE ON public.url_redirects
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
