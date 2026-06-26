-- 恢复 images 表为 base64 存储（暂不使用 R2）

CREATE TABLE IF NOT EXISTS images_old (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  mime_type TEXT DEFAULT 'image/png',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO images_old (id, filename, mime_type, created_at)
  SELECT id, filename, mime_type, created_at FROM images;

DROP TABLE images;
ALTER TABLE images_old RENAME TO images;
