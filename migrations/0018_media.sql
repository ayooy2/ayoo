CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  r2_key TEXT NOT NULL DEFAULT '',
  file_size INTEGER DEFAULT 0,
  type TEXT DEFAULT 'image',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at);
