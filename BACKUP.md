# Ayoo 数据备份与恢复手册

## 一、D1 数据库备份

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

## 二、R2 对象存储备份

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

## 三、代码备份

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

## 四、定期备份建议

| 备份项 | 频率 | 方法 |
|--------|------|------|
| D1 数据库 | 每周 | 后台导出 + wrangler |
| R2 存储 | 每月 | rclone sync |
| 代码 | 每次改动 | git push |
| 部署 | 自动 | Cloudflare Pages |

## 五、紧急恢复流程

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

## 六、Cloudflare Dashboard 备份

### 环境变量和 Secrets
- 登录 Cloudflare Dashboard → Pages → 项目 → Settings → Environment variables
- 记录所有环境变量和 Secrets

### R2 访问密钥
- 登录 Cloudflare Dashboard → R2 → Manage R2 API Tokens
- 记录 Access Key ID 和 Secret Access Key

### D1 数据库
- 登录 Cloudflare Dashboard → D1 → a-site-db
- 可以在 Dashboard 中直接导出 SQL
