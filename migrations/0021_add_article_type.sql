ALTER TABLE articles ADD COLUMN article_type TEXT DEFAULT 'blog';
CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(article_type);
