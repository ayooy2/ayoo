-- 创建页面设置表（key-value 模式）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 写入默认配置
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('title', '一切从这里开始！'),
  ('subtitle', '双击卡片即可跳转'),
  ('footer', '© 2026');
