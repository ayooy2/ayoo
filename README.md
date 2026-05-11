# Ayoo 个人导航网站

基于 Cloudflare Pages + Edge SSR + D1 的个人导航网站，实时时钟、智能图标加载、可视化后台管理。

## 项目结构

```
├── public/                 # 静态资源
│   ├── admin.html          # 后台管理（密码登录）
│   └── style.css           # CSS 设计变量
├── functions/              # Cloudflare Pages Functions
│   ├── index.js            # 首页 Edge SSR（渲染 + CDN 缓存）
│   └── api/
│       ├── sites.js        # GET /api/sites（公开）
│       ├── sites/[id].js   # POST/PUT/DELETE /api/sites/:id（需认证）
│       └── settings.js     # GET/PUT /api/settings（修改需认证）
├── migrations/             # D1 数据库迁移
│   ├── 0001_init.sql       # sites 表
│   └── 0002_settings.sql   # settings 表
├── wrangler.toml           # Cloudflare 配置
└── package.json
```

## 部署

```bash
npm install
npx wrangler d1 create a-site-db
npx wrangler d1 migrations apply a-site-db --remote
echo "your-password" | npx wrangler pages secret put ADMIN_PASSWORD --project-name <project>
npx wrangler pages deploy public --project-name <project> --branch main
```

## 访问

- 主页：https://ayoow.pages.dev
- 后台：https://ayoow.pages.dev/admin.html
