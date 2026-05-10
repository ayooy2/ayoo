-- D1 数据库初始化：创建 sites 表
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '',
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入示例数据
INSERT INTO sites (title, url, icon, description, sort_order) VALUES
('GitHub', 'https://github.com', '', '代码托管与协作平台', 1),
('V2EX', 'https://v2ex.com', '', '创意工作者社区', 2);
