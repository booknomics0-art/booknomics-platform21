CREATE TABLE IF NOT EXISTS book_catalog (
  booknomics_no INTEGER PRIMARY KEY,
  summary_language TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  source_gutenberg TEXT,
  source_wikisource TEXT,
  legal_status TEXT,
  production_status TEXT NOT NULL,
  target_summary_words INTEGER NOT NULL,
  batch_no INTEGER,
  selected INTEGER NOT NULL DEFAULT 0,
  linked_book_id TEXT,
  quality_score REAL,
  quality_status TEXT NOT NULL,
  quality_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_sources (
  id TEXT PRIMARY KEY,
  booknomics_no INTEGER NOT NULL,
  source_rank INTEGER NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_role TEXT NOT NULL,
  access_mode TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_book_sources_catalog ON book_sources(booknomics_no, source_rank);

CREATE TABLE IF NOT EXISTS book_research_sources (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_publisher TEXT,
  verification_scope TEXT NOT NULL DEFAULT '[]',
  is_primary INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_sources_book ON book_research_sources(book_id);

CREATE TABLE IF NOT EXISTS book_quality_audits (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  audit_version TEXT NOT NULL,
  metadata_score INTEGER NOT NULL,
  content_depth_score INTEGER NOT NULL,
  reader_experience_score INTEGER NOT NULL,
  aeo_geo_score INTEGER NOT NULL,
  editorial_verification_score INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  index_ready INTEGER NOT NULL DEFAULT 0,
  issues TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  audited_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quality_audits_book ON book_quality_audits(book_id, audited_at);

CREATE TABLE IF NOT EXISTS book_quality_evidence (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  model TEXT NOT NULL,
  evidence_status TEXT NOT NULL,
  source_urls TEXT NOT NULL DEFAULT '[]',
  source_titles TEXT NOT NULL DEFAULT '[]',
  search_queries TEXT NOT NULL DEFAULT '[]',
  quality_gate TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seo_audits (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  url TEXT NOT NULL,
  on_page_score INTEGER,
  off_page_score INTEGER,
  polishing_score INTEGER,
  humanized_score INTEGER,
  seo_readiness_score INTEGER,
  indexed_status TEXT,
  average_position REAL,
  clicks INTEGER,
  impressions INTEGER,
  ctr REAL,
  top_queries TEXT,
  audit_details TEXT,
  recommendations TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  aeo_score INTEGER,
  geo_score INTEGER,
  ai_visibility_score INTEGER,
  aeo_details TEXT NOT NULL DEFAULT '{}',
  geo_details TEXT NOT NULL DEFAULT '{}',
  external_ai_metrics TEXT NOT NULL DEFAULT '{}',
  scoring_version TEXT
);
CREATE INDEX IF NOT EXISTS idx_seo_audits_book ON seo_audits(book_id, updated_at);

CREATE TABLE IF NOT EXISTS seo_indexing_jobs (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  gsc_status TEXT,
  last_checked_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gsc_page_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  url TEXT NOT NULL,
  clicks REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gsc_query_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  url TEXT NOT NULL,
  query TEXT NOT NULL,
  clicks REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  language TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_summary_jobs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  worker_id TEXT,
  locked_at TEXT,
  source_field TEXT,
  source_chars INTEGER,
  script_words INTEGER,
  audio_url TEXT,
  audio_duration_seconds REAL,
  tts_metadata TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_status ON audio_summary_jobs(status, priority, created_at);

CREATE TABLE IF NOT EXISTS backlink_records (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  domain TEXT,
  status TEXT,
  dofollow INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_name TEXT,
  profile_url TEXT,
  connected INTEGER NOT NULL DEFAULT 0,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TEXT,
  scopes TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  platform TEXT NOT NULL,
  post_type TEXT,
  content TEXT,
  media_url TEXT,
  status TEXT NOT NULL,
  scheduled_at TEXT,
  published_at TEXT,
  external_post_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotion_logs (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  book_title TEXT,
  platforms TEXT NOT NULL DEFAULT '[]',
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  http_status INTEGER,
  response TEXT,
  triggered_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_access_logs (
  id TEXT PRIMARY KEY,
  attempted_email TEXT,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  outcome TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
