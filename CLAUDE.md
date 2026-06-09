# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指引。

## 项目简介

Ayoo — 基于 Cloudflare Pages + Pages Functions (Workers) + D1 的个人导航/书签 + 博客网站。
纯原生 JS，无框架，无打包工具。线上地址：https://ayoow.pages.dev

## 常用命令

```bash
npx wrangler pages dev public --compatibility-date=2026-05-10   # 本地开发（D1 本地模拟）
npx wrangler pages deploy public                                 # 部署到线上（不要加 --branch main，会报 8000000 错误）
npx wrangler d1 migrations apply a-site-db --remote              # 对线上 D1 执行迁移
npx wrangler d1 execute a-site-db --remote --command "SQL"       # 对线上 D1 执行任意 SQL
npx wrangler d1 migrations apply a-site-db                       # 对本地 D1 执行迁移
```

## 目录结构

- `public/` — 静态文件，直接对外服务（admin.html 后台 SPA、style.css 全局样式）
- `functions/` — Cloudflare Pages Functions，按文件路径自动路由
  - `index.js` — 首页 SSR 渲染
  - `blog/index.js`、`blog/[slug].js` — 博客列表和详情页 SSR，包含 Markdown 渲染
  - `api/*.js` — REST 接口
  - `lib/response.js` — 公共 `json()` 和 `error()` 工具函数
- `migrations/` — D1 SQL 迁移文件（按 0001、0002… 编号）
- D1 绑定名：`DB`，数据库名：`a-site-db`

## 核心模式

**SSR 用字符串拼接。** 所有服务端渲染页面在 `render()` 函数中通过字符串拼接生成 HTML，不用模板引擎。用户内容用 `esc()` 做 HTML 转义。

**认证机制：** 管理员密码存为 Cloudflare Secret（`env.ADMIN_PASSWORD`）。后台管理页面在写操作请求头中携带 `Authorization: Bearer <token>`。读取接口公开，无需认证。

**CDN 缓存策略：** SSR 页面通过 `Cache-Control` 的 `s-maxage` 设置 Cloudflare CDN 缓存。修改设置时通过 Cloudflare API 触发缓存清除。

**博客代码块处理：** `blog/[slug].js` 中的 `simpleMD()` 先把围栏代码块提取为占位符（`__CB0__`），经过 HTML 转义后再还原为完整代码块 HTML。客户端通过 CDN 加载 `marked.min.js` 增强 Markdown 渲染，再调用 `wrapCB()` 为代码块添加折叠/复制/全屏功能。

## 踩坑记录（必读）

1. **D1 存储换行为字面量 `\n`（两个字符），不是真正的换行符。** 在做正则或 indexOf 等需要真实换行的操作前，必须先 `str.replace(/\\n/g, '\n')`。这是本项目 bug 的头号来源。

2. **部署时不要加 `--branch main`**，会导致 Cloudflare API 返回 8000000 错误。

3. **SSR HTML 中用内联 `onclick` 处理事件**，不要用 `addEventListener` 事件委托。事件委托在动态插入的 SSR 内容上不可靠。在 onclick 中用 `this.nextElementSibling` / `this.parentElement` 做 DOM 遍历。

4. **代码块占位符用 `__CBn__` 格式**（字母数字加下划线），能安全通过 `esc()` HTML 转义。HTML 注释占位符（`<!-- -->`）会被转义破坏。

5. **SSR 模板字符串中嵌入 HTML 片段时用 `JSON.stringify()`**，可以正确处理引号和特殊字符。

6. **有 `transform`/`filter`/`perspective` 的祖先元素会破坏 `position: fixed` 定位。** CSS 规范中，这些属性会创建新的包含块，使 `position: fixed` 子元素相对于该祖先而非视口定位。`animate-in` 动画使用了 `transform`，必须在 `animationend` 后移除该类，否则全屏代码块等 `position: fixed` 功能会失效。

## D1 数据库表（共 6 张）

`sites`（导航链接）、`settings`（页面配置键值对）、`articles`（博客文章，Markdown 格式）、`comments`（评论，通过 parent_id 实现树形回复）、`likes`（点赞，基于 fingerprint 切换）、`images`（图片，base64 存储在 D1 中）。
