# Ayoo 项目交接文档

## 时间
2026-08-04

## 紧急：部署
**aec97c3 及之后的 commit 尚未部署**，因会话内存不足导致 wrangler 编译 OOM。
请在终端执行：
```bash
cd E:\Ayoo
npx wrangler pages deploy public
```
部署成功后访问返回的 `.ayoow.pages.dev` URL。

可选：执行 D1 迁移（如果还没执行）
```bash
npx wrangler d1 migrations apply a-site-db --remote
```

## 已完成的改动（15个 commit，已 push 到 GitHub）

### 1. 全局配色 → Argon 主题风格
- `--bg-primary: #f4f5f7` (灰底) + `--bg-elevated: #ffffff` (白卡片)
- `--accent: #5e72e4` (蓝紫)
- 阴影增强：`--shadow-lg: 0 15px 35px rgba(50,50,93,0.1)`
- 涉及：`public/style.css`

### 2. 导航栏 hover 下拉菜单
- 鼠标悬停"分类 ▾"→ 下拉显示"📝 笔记"和"💻 Code"
- 纯 CSS 实现（`.dropdown:hover .dropdown-menu`）
- 移动端也包含分类子项
- 涉及：`functions/lib/navbar.js`, `public/style.css`

### 3. 首页布局重设计
- Banner 居中显示站名+副标题（去掉时间/日期 hero）
- 文章列表改为单栏垂直排列
- 文章卡片匹配 ihkk.net 风格：有封面时全宽缩略图+文字叠加+下方摘要
- 涉及：`functions/index.js`, `public/style.css`

### 4. 首页 Profile 左侧悬浮框
- 桌面端 `position:fixed` 在左侧（220px 宽，垂直居中）
- 含头像、站名、简介、统计（文章/标签/阅读/导航）、社交链接
- 移动端变为 in-flow 水平卡片
- 后台可配置 `profile_bio` 和 `profile_links`（JSON 格式）
- margin-left 仅首页生效（`.home-profile ~ .page-wrapper`），不影响其他页面
- 涉及：`functions/index.js`, `public/style.css`, `functions/api/settings.js`, `public/admin.html`/`settings.js`

### 5. Code 文章板块
- 新 `article_type` 列（迁移 `migrations/0021_add_article_type.sql`，已应用到远程 D1）
- `/code` 列表页 + `/code/[slug]` 详情页
- Code 文章：无封面、无评论、代码块 figure.highlight table 布局
- API 支持 `?type=blog/code` 筛选
- 涉及：`functions/code/index.js`, `functions/code/[slug].js`, `public/code.css`, `functions/api/articles.js`, `functions/api/articles/[id].js`

### 6. 编辑器 article_type 支持
- 侧边栏新增"📝 笔记 / 💻 Code"类型切换
- Code 模式下隐藏封面图、定时发布
- URL 参数 `?type=code` 自动切换
- publish.js 发送 `article_type` 字段
- 涉及：`public/editor.js`, `public/editor/state.js`, `public/editor/publish.js`, `public/editor.html`, `public/editor.css`

### 7. 后台管理适配
- 文章列表显示 Code 标签
- "写 Code"按钮跳转 `editor.html?type=code`
- 编辑模态框支持 article_type 隐藏字段
- 涉及：`public/admin.html`, `public/admin/articles.js`

### 8. 文章封面卡片
- 详情页：全宽封面大图
- 列表卡片：ihkk.net post-header-with-thumbnail 风格
- 首页文章卡片：同上
- 涉及：`functions/blog/[slug].js`, `functions/blog/index.js`, `functions/index.js`, `public/style.css`

### 9. Code 与 Blog TOC 侧栏区分
- Code TOC：等宽字体 + 2px 左边框 + 紧凑间距 + hover 高亮
- Blog TOC：sans-serif + 1px subtle 边框
- 涉及：`public/code.css`, `functions/code/[slug].js`

### 10. FAB 工具栏修复
- 滤镜：暖色/冷色 2 种，alpha 0.30-0.35
- 滤镜层 z-index:0（在内容下方）
- 字体：Inter / 宋体 2 种
- 删除语言切换功能
- 所有按钮使用内联 onclick
- 涉及：`public/toolbar.js`, `public/toolbar.css`

### 11. Bug 修复
- `--shadow-card` 被 legacy alias 覆盖导致卡片阴影消失 → 已删除冲突行
- `categories.js` code 文章链接错误指向 /blog/ → 已修复为 /code/
- Profile margin-left 影响所有页面 → 改用 `.home-profile ~ .page-wrapper` 选择器

## 当前待处理

### 已知问题
1. **后台"标签管理"**：一键加密功能增加了但可能未完整测试
2. **Code 文章发布流程**：编辑器支持了 article_type，但需要验证实际创建→列表→详情全链路
3. **分类导航页 `/categories`**：之前有独立页面，改为 dropdown 后该页面可能仍是旧逻辑

### 用户可能继续要求
- 后台标签管理进一步优化（标签筛选含加密文章）
- 各页面细节调整匹配 ihkk.net
- 移动端体验优化

## 关键文件速查

| 文件 | 用途 |
|------|------|
| `public/style.css` | 全局样式（注意 `v=6` 缓存） |
| `public/toolbar.js` | FAB 工具栏（`v=15`） |
| `public/toolbar.css` | FAB 样式 |
| `functions/lib/navbar.js` | 导航栏（含 dropdown） |
| `functions/index.js` | 首页 SSR |
| `functions/blog/[slug].js` | 博客详情 |
| `functions/blog/index.js` | 博客列表 |
| `functions/code/[slug].js` | Code 详情 |
| `functions/code/index.js` | Code 列表 |
| `functions/categories.js` | 分类导航页 |
| `public/code.css` | Code 专属样式 |
| `functions/api/articles.js` | 文章 API |
| `functions/api/articles/[id].js` | 单篇文章 API |
| `public/editor.js` | 编辑器主入口 |
| `public/editor/publish.js` | 发布逻辑 |
| `public/editor/state.js` | 编辑器状态 |
| `public/editor.html` | 编辑器 HTML |
| `public/admin.html` | 后台管理 |
| `public/admin/articles.js` | 后台文章管理 |
| `migrations/0021_add_article_type.sql` | article_type 迁移 |

## 缓存警告
- `toolbar.js` 当前版本号 `v=15`，改 toolbar.js 后需升级版本号（sed 批量替换）
- `style.css` 版本号 `v=6`
- CDN `_headers` 中 toolbar.js s-maxage 已降为 3600（1小时）

## 部署命令
```bash
cd E:\Ayoo
npx wrangler pages deploy public
npx wrangler d1 migrations apply a-site-db --remote  # 如有新迁移
```
