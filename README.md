# 个人导航网站

基于 Cloudflare Pages + Workers + D1 的导航网站，前后端分离，支持后台管理。

## 项目结构

```
├── public/              # 前端静态文件
│   ├── index.html       # 主页（展示）
│   ├── admin.html       # 后台管理（需密码）
│   └── style.css        # 样式
├── functions/           # Cloudflare Workers 后端 API
│   └── api/
│       ├── sites.js         # GET /api/sites - 获取列表
│       └── sites/[[id]].js  # POST/PUT/DELETE - 增删改（需认证）
├── migrations/          # D1 数据库迁移文件
│   └── 0001_init.sql
├── wrangler.toml        # Cloudflare 配置
└── package.json
```

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create a-site-db
```

把返回的 `database_id` 填入 `wrangler.toml`。

### 3. 执行数据库迁移

```bash
npx wrangler d1 migrations apply a-site-db
```

### 4. 设置管理员密码（可选但强烈建议）

```bash
npx wrangler secret put ADMIN_PASSWORD
```

输入你的管理密码。然后在 `functions/api/sites/[[id]].js` 中把 `ADMIN_PASSWORD` 改为读取环境变量：

```js
const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
```

### 5. 部署

```bash
npx wrangler pages deploy public
```

## 访问地址

- 主页：`https://你的项目名.pages.dev`
- 后台：`https://你的项目名.pages.dev/admin.html`

## 后续迁移到自有服务器

1. 导出 D1 数据库为 SQLite 文件
2. 把 `functions/` 里的代码搬到 Node.js + Express
3. 前端 `public/` 文件放到 Nginx 静态托管
4. 数据库连接改为本地 SQLite 或 MySQL

代码中未使用 Cloudflare 专属 API，迁移成本低。
