CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_md TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  author TEXT DEFAULT 'Admin',
  tags TEXT DEFAULT '',
  is_published INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  author_name TEXT NOT NULL DEFAULT '匿名',
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(article_id, fingerprint),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

INSERT OR IGNORE INTO articles (title, slug, content_md, summary, author, tags, is_published) VALUES
('Hello World', 'hello-world',
 '# Hello World\n\n欢迎来到我的博客！\n\n这是一篇示例文章，支持 **Markdown** 语法。\n\n## 代码块\n\n```javascript\nconsole.log("Hello, World!");\n```\n\n```python\nprint("Hello from Python!")\n```\n\n## 表格\n\n| 功能 | 状态 |\n|------|------|\n| Markdown | ✅ |\n| 代码高亮 | ✅ |\n| 评论 | ✅ |\n| 点赞 | ✅ |\n\n## 图片\n\n> 你可以在后台编辑器中上传图片\n\n## 引用\n\n> 这是一段引用文字\n\n---\n\n感谢阅读！',
 '欢迎来到我的博客，这是一篇示例文章。', 'Admin', '博客,示例', 1);
