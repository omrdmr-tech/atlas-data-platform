CREATE TABLE IF NOT EXISTS article_sources (
  source_url TEXT PRIMARY KEY,
  language TEXT,
  region TEXT,
  last_status TEXT NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_capture_logs (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  source_url TEXT NOT NULL REFERENCES article_sources(source_url),
  status TEXT NOT NULL,
  details TEXT,
  language TEXT,
  region TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_capture_logs_batch
  ON article_capture_logs (batch_id, captured_at);
