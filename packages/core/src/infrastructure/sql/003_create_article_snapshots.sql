CREATE TABLE IF NOT EXISTS article_snapshots (
  source_url TEXT PRIMARY KEY,
  final_url TEXT NOT NULL,
  html TEXT NOT NULL,
  content_type TEXT,
  fetched_at TIMESTAMPTZ NOT NULL,
  scraper_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_snapshots_fetched_at
  ON article_snapshots (fetched_at DESC);
