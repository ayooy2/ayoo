-- 将 images 表从 base64 存储迁移到 R2 key 存储
-- data TEXT -> r2_key TEXT，新增 file_size INTEGER
-- 注意：旧图片的 base64 数据不会自动迁移到 R2，需要后续手动处理

CREATE TABLE IF NOT EXISTS images_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT DEFAULT '',
  mime_type TEXT DEFAULT 'image/png',
  r2_key TEXT NOT NULL DEFAULT '',
  file_size INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO images_new (id, filename, mime_type, r2_key, file_size, created_at)
  SELECT id, filename, mime_type, '', 0, created_at FROM images;

DROP TABLE images;
ALTER TABLE images_new RENAME TO images;
