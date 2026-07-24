# Ayoo 数据备份与恢复手册

## 一、D1 数据库表结构

### 1. sites（导航链接）
```sql
CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,          -- 网站标题
  url TEXT NOT NULL,            -- 网站链接
  icon TEXT DEFAULT '',         -- 图标（base64 或 URL）
  description TEXT DEFAULT '',  -- 简介
  sort_order INTEGER DEFAULT 0, -- 排序
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. settings（页面配置键值对）
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,         -- 配置项名称
  value TEXT NOT NULL,          -- 配置值
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- 常用 key：title, subtitle, footer, bg_image, about_title, about_content, about_avatar
```

### 3. articles（博客文章）
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,           -- 文章标题
  slug TEXT NOT NULL UNIQUE,     -- URL slug
  content_md TEXT NOT NULL DEFAULT '',  -- Markdown 内容
  summary TEXT DEFAULT '',       -- 摘要
  cover_image TEXT DEFAULT '',   -- 封面图 URL
  author TEXT DEFAULT 'Admin',   -- 作者
  tags TEXT DEFAULT '',          -- 标签（逗号分隔）
  is_published INTEGER DEFAULT 0, -- 0=草稿, 1=已发布
  scheduled_at DATETIME DEFAULT NULL, -- 定时发布时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. comments（评论）
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,   -- 关联文章 ID
  parent_id INTEGER DEFAULT NULL, -- 父评论 ID（树形回复）
  author_name TEXT NOT NULL DEFAULT '匿名',
  email TEXT DEFAULT '',         -- 邮箱（Gravatar）
  url TEXT DEFAULT '',           -- 个人网站
  content TEXT NOT NULL,         -- 评论内容
  ip TEXT DEFAULT '',            -- IP 地址
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

### 5. likes（点赞）
```sql
CREATE TABLE likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,   -- 关联文章 ID
  fingerprint TEXT NOT NULL,     -- 浏览器指纹（切换点赞）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(article_id, fingerprint),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

### 6. guestbook（留言簿）
```sql
CREATE TABLE guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'anonymous',
  url TEXT DEFAULT '',           -- 个人网站
  message TEXT NOT NULL,         -- 留言内容
  ip TEXT DEFAULT '',            -- IP 地址
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 7. now_items（近况卡片）
```sql
CREATE TABLE now_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT '',  -- 分类
  content TEXT NOT NULL DEFAULT '',   -- 内容
  sort_order INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 8. tags（标签）
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,     -- 标签名
  slug TEXT NOT NULL UNIQUE,     -- URL slug
  color TEXT DEFAULT '',         -- 颜色
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 9. media（媒体文件）
```sql
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  r2_key TEXT NOT NULL DEFAULT '', -- R2 存储 key
  file_size INTEGER DEFAULT 0,
  type TEXT DEFAULT 'image',     -- image/video/audio
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_created ON media(created_at);
```

### 10. rate_limits（频率限制）
```sql
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'login',
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rate_limits_ip_action ON rate_limits(ip, action, attempted_at);
```

## 二、D1 数据库备份

### 导出全部数据
```bash
# 导出为 SQL 文件
npx wrangler d1 execute a-site-db --remote --command ".dump" > backup_$(date +%Y%m%d).sql

# 导出为 JSON（按表）
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM sites" --json > backup_sites.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM articles" --json > backup_articles.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM comments" --json > backup_comments.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM settings" --json > backup_settings.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM guestbook" --json > backup_guestbook.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM tags" --json > backup_tags.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM likes" --json > backup_likes.json
npx wrangler d1 execute a-site-db --remote --command "SELECT * FROM media" --json > backup_media.json
```

### 恢复数据
```bash
# 从 SQL 文件恢复
npx wrangler d1 execute a-site-db --remote --file backup_20260719.sql

# 从 JSON 恢复（需要转换为 INSERT 语句）
# 使用后台管理的"导入"功能更方便
```

### 使用后台管理导出/导入
1. 登录后台 → 点击"📦 导出"按钮
2. 下载 JSON 备份文件
3. 恢复时点击"📥 导入"按钮，选择备份文件

## 三、R2 对象存储备份

### 使用 Wrangler CLI
```bash
# 列出所有文件
npx wrangler r2 object list ayoo --prefix media/

# 下载单个文件
npx wrangler r2 object get ayoo/media/image/1234567890-abcdef.jpg --file ./backup.jpg

# 批量下载（需要 rclone 或自定义脚本）
```

### 使用 rclone（推荐）
```bash
# 安装 rclone
# Windows: winget install rclone
# macOS: brew install rclone

# 配置 Cloudflare R2
rclone config
# 选择 "New remote" → 名称: ayoo-r2
# 选择 "Amazon S3 Compliant" → "Cloudflare R2"
# 输入 Access Key ID 和 Secret Access Key（从 Cloudflare Dashboard 获取）
# Region: auto
# Endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# 备份整个 bucket
rclone sync ayoo-r2:ayoo ./r2_backup/ --progress

# 恢复
rclone sync ./r2_backup/ ayoo-r2:ayoo --progress
```

### 使用 S3 API（兼容 R2）
```bash
# 使用 aws cli
aws configure  # 设置 R2 的 endpoint 和 credentials
aws s3 sync s3://ayoo ./r2_backup/ --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

## 四、代码备份

### Git 仓库
```bash
# 代码已在 GitHub 上，确保定期 push
git push origin main

# 打标签标记重要版本
git tag -a v1.0.0 -m "稳定版本"
git push origin v1.0.0

# 查看所有标签
git tag -l
```

### 部署历史
```bash
# 查看部署历史
npx wrangler pages deployment list

# 回滚到指定部署
npx wrangler pages deployment rollback <deployment-id>
```

## 五、定期备份建议

| 备份项 | 频率 | 方法 |
|--------|------|------|
| D1 数据库 | 每周 | 后台导出 + wrangler |
| R2 存储 | 每月 | rclone sync |
| 代码 | 每次改动 | git push |
| 部署 | 自动 | Cloudflare Pages |

## 六、紧急恢复流程

### 场景 1：误删数据
1. 使用后台"导入"功能恢复最近的 JSON 备份
2. 或使用 `wrangler d1 execute --file` 恢复 SQL

### 场景 2：代码出问题
1. `git log` 查看最近提交
2. `git revert <commit-hash>` 回滚问题提交
3. `npx wrangler pages deploy public` 重新部署

### 场景 3：需要回滚部署
1. `npx wrangler pages deployment list` 查看历史
2. `npx wrangler pages deployment rollback <id>` 回滚

## 七、Cloudflare Dashboard 备份

### 环境变量和 Secrets
- 登录 Cloudflare Dashboard → Pages → 项目 → Settings → Environment variables
- 记录所有环境变量和 Secrets

### R2 访问密钥
- 登录 Cloudflare Dashboard → R2 → Manage R2 API Tokens
- 记录 Access Key ID 和 Secret Access Key

### D1 数据库
- 登录 Cloudflare Dashboard → D1 → a-site-db
- 可以在 Dashboard 中直接导出 SQL
