ALTER TABLE article_snapshots ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE article_snapshots ADD COLUMN IF NOT EXISTS region TEXT;
