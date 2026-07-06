# Ayoo 编辑器设计规范

> 基于 WordPress Gutenberg、Ghost Koenig、Notion 三大编辑器的设计模式研究

---

## 一、设计原则

### 1.1 核心理念

| 原则 | 说明 | 参考来源 |
|------|------|----------|
| **沉浸式写作** | 最大化编辑区域，最小化界面干扰 | Notion |
| **卡片化思维** | 每个内容块都是独立可操作的卡片 | Ghost Koenig |
| **渐进式复杂度** | 基础操作简单，高级功能按需展示 | Gutenberg |
| **键盘优先** | 所有操作都可通过键盘完成 | Notion |
| **实时反馈** | 编辑即预览，所见即所得 | Ghost |

### 1.2 设计目标

- 写作流程不被打断
- 视觉层级清晰
- 移动端体验优秀
- 学习成本低

---

## 二、布局结构

### 2.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  顶栏 (固定)                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ← 返回  │  文章标题...  │  草稿已保存  │  发布 ▾       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────┐  ┌────────────────────┐  │
│  │                              │  │  侧边栏 (可折叠)   │  │
│  │       编辑区 (主内容)         │  │                    │  │
│  │                              │  │  • 文章设置        │  │
│  │  ┌────────────────────────┐  │  │  • SEO            │  │
│  │  │ 标题输入框             │  │  │  • 分类标签        │  │
│  │  └────────────────────────┘  │  │  • 特色图片        │  │
│  │                              │  │  • 摘要            │  │
│  │  ┌────────────────────────┐  │  │  • 发布选项        │  │
│  │  │ 正文编辑区             │  │  │                    │  │
│  │  │                        │  │  │                    │  │
│  │  │                        │  │  │                    │  │
│  │  └────────────────────────┘  │  │                    │  │
│  │                              │  │                    │  │
│  └──────────────────────────────┘  └────────────────────┘  │
│                                                              │
│  底部状态栏                                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 字数: 1,234  │  阅读时间: 5分钟  │  最后编辑: 刚刚      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 尺寸规范

| 元素 | 尺寸 | 说明 |
|------|------|------|
| 顶栏高度 | 56px | 固定定位，z-index: 100 |
| 编辑区最大宽度 | 720px | 居中显示，参考 Notion |
| 侧边栏宽度 | 320px | Ghost 标准，可折叠 |
| 底部状态栏 | 36px | 固定定位 |
| 编辑区内边距 | 24px 32px | 上下/左右 |

### 2.3 响应式断点

```css
/* 桌面端 */
@media (min-width: 1024px) {
  .editor-layout {
    grid-template-columns: 1fr 320px;
  }
}

/* 平板端 */
@media (min-width: 768px) and (max-width: 1023px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    right: -320px;
    transition: right 0.3s ease;
  }
  .sidebar.open {
    right: 0;
  }
}

/* 移动端 */
@media (max-width: 767px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    bottom: -100%;
    left: 0;
    right: 0;
    height: 80vh;
    border-radius: 16px 16px 0 0;
    transition: bottom 0.3s ease;
  }
  .sidebar.open {
    bottom: 0;
  }
}
```

---

## 三、顶栏设计

### 3.1 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回   │  文章标题占位符...   │  草稿已保存  │  发布 ▾   │
│  (icon)   │  (居中，可点击编辑)  │  (状态提示)  │  (按钮)   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 发布按钮交互

**参考 Ghost 的发布流程：**

```
点击「发布」→ 按钮变为「确认发布」→ 再次点击完成发布
                    │
                    └─ 可展开下拉菜单：
                       • 立即发布
                       • 保存为草稿
                       • 定时发布
```

**按钮样式：**

```css
.publish-btn {
  /* 初始状态 */
  background: var(--accent);
  color: white;
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}

.publish-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.publish-btn.secondary {
  background: transparent;
  border: 1.5px solid var(--border);
  color: var(--text-secondary);
}

.publish-btn.secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}
```

### 3.3 保存状态指示

```css
.save-status {
  font-size: 13px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.save-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## 四、标题输入框

### 4.1 设计参考

**Notion 风格：**
- 无边框，大字体
- 占位符文字提示
- 自动高度

**Ghost 风格：**
- 独立一行，与正文分离
- 字体明显大于正文

### 4.2 实现方案

```css
.editor-title {
  width: 100%;
  border: none;
  outline: none;
  font-size: 2.5rem;           /* 40px */
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
  background: transparent;
  padding: 2rem 0 0.5rem;
  letter-spacing: -0.02em;
}

.editor-title::placeholder {
  color: var(--text-placeholder);
}

/* 移动端 */
@media (max-width: 767px) {
  .editor-title {
    font-size: 1.75rem;        /* 28px */
    padding: 1.5rem 0 0.5rem;
  }
}
```

### 4.3 交互逻辑

```javascript
// 标题输入框行为
titleInput.addEventListener('input', (e) => {
  // 1. 自动调整高度
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';

  // 2. 自动生成 slug
  if (!slugManuallyEdited) {
    slugInput.value = generateSlug(e.target.value);
  }

  // 3. 更新顶栏标题预览
  headerTitle.textContent = e.target.value || '无标题';

  // 4. 触发自动保存
  debounce(autoSave, 1000)();
});
```

---

## 五、正文编辑区

### 5.1 编辑模式选择

| 模式 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Markdown 原生** | 轻量、快速 | 学习成本高 | ⭐⭐⭐ |
| **所见即所得** | 直观易用 | 实现复杂 | ⭐⭐⭐⭐ |
| **混合模式** | 两全其美 | 状态管理复杂 | ⭐⭐⭐⭐⭐ |

**推荐：混合模式（参考 Ghost Koenig）**

- 输入时显示 Markdown 语法
- 失焦后渲染为富文本
- 支持 Markdown 快捷键

### 5.2 编辑区样式

```css
.editor-content {
  min-height: calc(100vh - 200px);
  padding: 1rem 0 4rem;
  outline: none;
  font-size: 1.0625rem;        /* 17px */
  line-height: 1.8;
  color: var(--text-primary);
}

/* 段落间距 */
.editor-content p {
  margin-bottom: 1em;
}

/* 标题样式 */
.editor-content h1 {
  font-size: 1.875rem;         /* 30px */
  font-weight: 700;
  margin: 2em 0 0.5em;
  line-height: 1.3;
}

.editor-content h2 {
  font-size: 1.5rem;           /* 24px */
  font-weight: 600;
  margin: 1.8em 0 0.5em;
  line-height: 1.35;
}

.editor-content h3 {
  font-size: 1.25rem;          /* 20px */
  font-weight: 600;
  margin: 1.5em 0 0.5em;
  line-height: 1.4;
}

/* 引用块 */
.editor-content blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1rem;
  color: var(--text-secondary);
  font-style: italic;
  margin: 1.5em 0;
}

/* 代码块 */
.editor-content pre {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 1.5em 0;
}

.editor-content code {
  background: var(--bg-secondary);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.editor-content pre code {
  background: none;
  padding: 0;
}

/* 链接 */
.editor-content a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* 图片 */
.editor-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1.5em 0;
}
```

---

## 六、工具栏设计

### 6.1 浮动工具栏（参考 Notion/Ghost）

**触发方式：** 选中文本时出现

**位置：** 选区上方 8px，水平居中

```
┌─────────────────────────────────────────────────────────────┐
│  B  I  S  │  H1 H2 H3  │  " • 1.  │  🔗  📷  </>          │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 工具栏样式

```css
.floating-toolbar {
  position: absolute;
  z-index: 1000;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  display: flex;
  gap: 2px;
  box-shadow: var(--shadow-lg);
  animation: toolbarFadeIn 0.15s ease;
}

@keyframes toolbarFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.1s ease;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn.active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 4px 4px;
}
```

### 6.3 块级工具栏（参考 Notion）

**触发方式：** 鼠标悬停在段落左侧

**图标：** `⋮⋮`（六点拖拽手柄）+ `+`（添加块）

```
  ⋮⋮  +  │ 这是一段文字内容...
```

```css
.block-handle {
  position: absolute;
  left: -48px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.editor-content > *:hover .block-handle {
  opacity: 1;
}

.block-handle-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: 18px;
}

.block-handle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

---

## 七、斜杠命令（/）

### 7.1 触发方式

- 输入 `/` 触发
- 输入 `/` 后继续输入进行过滤

### 7.2 命令列表

| 命令 | 图标 | 说明 | 快捷键 |
|------|------|------|--------|
| `/h1` | H₁ | 一级标题 | - |
| `/h2` | H₂ | 二级标题 | - |
| `/h3` | H₃ | 三级标题 | - |
| `/text` | ¶ | 普通文本 | - |
| `/quote` | " | 引用块 | - |
| `/ul` | • | 无序列表 | - |
| `/ol` | 1. | 有序列表 | - |
| `/code` | </> | 代码块 | - |
| `/image` | 🖼 | 插入图片 | - |
| `/link` | 🔗 | 插入链接 | - |
| `/table` | ⊞ | 插入表格 | - |
| `/hr` | — | 分割线 | - |
| `/callout` | 💡 | 提示框 | - |

### 7.3 弹出菜单样式

```css
.slash-menu {
  position: absolute;
  z-index: 1000;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  width: 280px;
  max-height: 320px;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  animation: menuSlideUp 0.15s ease;
}

@keyframes menuSlideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slash-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.slash-menu-item:hover,
.slash-menu-item.selected {
  background: var(--bg-hover);
}

.slash-menu-item .icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 18px;
}

.slash-menu-item .info {
  flex: 1;
}

.slash-menu-item .name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.slash-menu-item .desc {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

### 7.4 实现逻辑

```javascript
// 斜杠命令处理
editor.addEventListener('input', (e) => {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const text = range.startContainer.textContent;
  const cursorPos = range.startOffset;

  // 检测斜杠命令
  const slashIndex = text.lastIndexOf('/', cursorPos);
  if (slashIndex !== -1) {
    const query = text.slice(slashIndex + 1, cursorPos);

    // 显示菜单
    showSlashMenu(query, getCaretCoordinates());

    // 过滤命令
    filterCommands(query);
  } else {
    hideSlashMenu();
  }
});

// 键盘导航
editor.addEventListener('keydown', (e) => {
  if (isSlashMenuVisible) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectNextItem();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectPrevItem();
        break;
      case 'Enter':
        e.preventDefault();
        executeSelectedCommand();
        break;
      case 'Escape':
        hideSlashMenu();
        break;
    }
  }
});
```

---

## 八、快捷键支持

### 8.1 文本格式化

| 快捷键 | 功能 | 参考来源 |
|--------|------|----------|
| `Ctrl+B` | 加粗 | 通用 |
| `Ctrl+I` | 斜体 | 通用 |
| `Ctrl+U` | 下划线 | 通用 |
| `Ctrl+Shift+S` | 删除线 | Notion |
| `Ctrl+E` | 行内代码 | Notion |
| `Ctrl+Shift+H` | 高亮 | Notion |

### 8.2 块级操作

| 快捷键 | 功能 | 参考来源 |
|--------|------|----------|
| `Ctrl+Shift+1` | H1 | Notion |
| `Ctrl+Shift+2` | H2 | Notion |
| `Ctrl+Shift+3` | H3 | Notion |
| `Ctrl+Shift+7` | 有序列表 | Notion |
| `Ctrl+Shift+8` | 无序列表 | Notion |
| `Ctrl+Shift+9` | 引用块 | Notion |
| `Ctrl+Alt+C` | 代码块 | Notion |

### 8.3 编辑操作

| 快捷键 | 功能 | 参考来源 |
|--------|------|----------|
| `Ctrl+S` | 保存 | 通用 |
| `Ctrl+Z` | 撤销 | 通用 |
| `Ctrl+Shift+Z` | 重做 | 通用 |
| `Ctrl+Enter` | 插入分割线 | Ghost |
| `Tab` | 增加缩进 | 通用 |
| `Shift+Tab` | 减少缩进 | 通用 |

### 8.4 Markdown 快捷语法

| 输入 | 转换结果 | 参考来源 |
|------|----------|----------|
| `# ` | H1 | Markdown |
| `## ` | H2 | Markdown |
| `### ` | H3 | Markdown |
| `> ` | 引用块 | Markdown |
| `- ` 或 `* ` | 无序列表 | Markdown |
| `1. ` | 有序列表 | Markdown |
| `` ``` `` | 代码块 | Markdown |
| `---` | 分割线 | Markdown |
| `**text**` | 加粗 | Markdown |
| `*text*` | 斜体 | Markdown |
| `` `text` `` | 行内代码 | Markdown |
| `[text](url)` | 链接 | Markdown |

---

## 九、侧边栏设计

### 9.1 内容结构

```
┌────────────────────────┐
│  文章设置              │
│  ───────────────────── │
│                        │
│  状态: 草稿            │
│  ───────────────────── │
│                        │
│  SEO 设置              │
│  ┌──────────────────┐  │
│  │ URL Slug         │  │
│  │ my-article-slug  │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ 摘要             │  │
│  │                  │  │
│  └──────────────────┘  │
│  ───────────────────── │
│                        │
│  分类 & 标签           │
│  ┌──────────────────┐  │
│  │ + 添加标签       │  │
│  └──────────────────┘  │
│  ───────────────────── │
│                        │
│  特色图片              │
│  ┌──────────────────┐  │
│  │  点击上传图片    │  │
│  └──────────────────┘  │
│  ───────────────────── │
│                        │
│  发布选项              │
│  ┌──────────────────┐  │
│  │ 定时发布         │  │
│  │ 2024-01-01 12:00 │  │
│  └──────────────────┘  │
│                        │
└────────────────────────┘
```

### 9.2 侧边栏样式

```css
.sidebar {
  background: var(--bg-elevated);
  border-left: 1px solid var(--border);
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 56px);
  position: sticky;
  top: 56px;
}

.sidebar-section {
  margin-bottom: 24px;
}

.sidebar-section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.sidebar-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  transition: border-color 0.15s ease;
}

.sidebar-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.sidebar-textarea {
  min-height: 80px;
  resize: vertical;
}
```

---

## 十、视觉设计

### 10.1 字体系统

```css
:root {
  /* 字体族 */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace;

  /* 字号 */
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.8125rem;  /* 13px */
  --text-base: 0.9375rem;  /* 15px */
  --text-lg:   1.0625rem;  /* 17px - 正文 */
  --text-xl:   1.25rem;    /* 20px */
  --text-2xl:  1.5rem;     /* 24px - H3 */
  --text-3xl:  1.875rem;   /* 30px - H2 */
  --text-4xl:  2.5rem;     /* 40px - H1/标题 */

  /* 行高 */
  --leading-tight:  1.25;
  --leading-snug:   1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;  /* 正文 */
  --leading-loose:  2;

  /* 字重 */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;
}
```

### 10.2 间距系统

```css
:root {
  /* 基础间距 */
  --space-1:  0.25rem;   /* 4px */
  --space-2:  0.5rem;    /* 8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */

  /* 内容间距 */
  --content-gap:    1.5rem;   /* 内容块之间 */
  --section-gap:    3rem;     /* 段落之间 */
  --component-gap:  1rem;     /* 组件内部 */
}
```

### 10.3 颜色方案

```css
:root {
  /* 亮色主题 */
  --bg-primary:      #fafafa;
  --bg-secondary:    #f5f5f5;
  --bg-elevated:     #ffffff;
  --bg-hover:        #f5f5f5;
  --border:          #e5e5e5;
  --border-subtle:   #f0f0f0;
  --text-primary:    #171717;
  --text-secondary:  #525252;
  --text-tertiary:   #a3a3a3;
  --text-placeholder:#d4d4d4;
  --accent:          #2563eb;
  --accent-hover:    #1d4ed8;
  --accent-subtle:   #eff6ff;
  --danger:          #dc2626;
  --success:         #16a34a;
  --warning:         #f59e0b;
}

/* 暗色主题 */
[data-theme="dark"] {
  --bg-primary:      #0a0a0a;
  --bg-secondary:    #171717;
  --bg-elevated:     #1a1a1a;
  --bg-hover:        #262626;
  --border:          #2e2e2e;
  --border-subtle:   #1f1f1f;
  --text-primary:    #fafafa;
  --text-secondary:  #a3a3a3;
  --text-tertiary:   #525252;
  --text-placeholder:#404040;
  --accent:          #3b82f6;
  --accent-hover:    #60a5fa;
  --accent-subtle:   rgba(59, 130, 246, 0.1);
  --danger:          #ef4444;
  --success:         #22c55e;
  --warning:         #fbbf24;
}
```

### 10.4 动画和过渡

```css
/* 基础过渡 */
:root {
  --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-in:      cubic-bezier(0.4, 0, 1, 1);
  --ease-out:     cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);

  --duration-fast:   100ms;
  --duration-normal: 200ms;
  --duration-slow:   300ms;
}

/* 常用动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideDown {
  from { transform: translateY(-8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 工具提示 */
.tooltip {
  animation: fadeIn var(--duration-fast) var(--ease-out);
}

/* 菜单 */
.menu {
  animation: slideUp var(--duration-normal) var(--ease-out);
}

/* 模态框 */
.modal-overlay {
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

.modal {
  animation: scaleIn var(--duration-normal) var(--ease-out);
}
```

---

## 十一、移动端适配

### 11.1 布局变化

```
移动端布局：

┌─────────────────────┐
│  ← 返回    发布     │  顶栏 (48px)
├─────────────────────┤
│                     │
│  文章标题...        │  标题 (28px)
│                     │
├─────────────────────┤
│                     │
│  正文编辑区         │  编辑区
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│  B I S  H1 H2  🔗  │  底部工具栏 (48px)
└─────────────────────┘
```

### 11.2 移动端尺寸调整

```css
/* 移动端样式 */
@media (max-width: 767px) {
  /* 顶栏 */
  .editor-header {
    height: 48px;
    padding: 0 12px;
  }

  .editor-header .title {
    font-size: 15px;
  }

  /* 标题 */
  .editor-title {
    font-size: 1.75rem;        /* 28px */
    padding: 1.25rem 16px 0.5rem;
  }

  /* 内容区 */
  .editor-content {
    padding: 0 16px 120px;     /* 底部留空给工具栏 */
    font-size: 16px;           /* 防止 iOS 缩放 */
    line-height: 1.75;
  }

  /* 侧边栏 */
  .sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80vh;
    border-radius: 16px 16px 0 0;
    border-left: none;
    border-top: 1px solid var(--border);
    transform: translateY(100%);
    transition: transform 0.3s var(--ease-out);
    z-index: 100;
  }

  .sidebar.open {
    transform: translateY(0);
  }

  /* 底部工具栏 */
  .mobile-toolbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 48px;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 8px;
    z-index: 50;
  }

  .mobile-toolbar-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 20px;
  }

  .mobile-toolbar-btn:active {
    background: var(--bg-hover);
  }
}
```

### 11.3 触摸友好设计

```css
/* 触摸目标最小尺寸 */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* 长按菜单 */
.long-press-menu {
  position: fixed;
  background: var(--bg-elevated);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  padding: 8px;
  z-index: 1000;
}

.long-press-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 16px;
  color: var(--text-primary);
}

.long-press-menu-item:active {
  background: var(--bg-hover);
}

/* 滑动手势 */
.swipe-action {
  transition: transform 0.2s var(--ease-out);
}

.swipe-action.swiped {
  transform: translateX(-80px);
}
```

### 11.4 键盘弹出处理

```javascript
// 移动端键盘弹出时调整布局
if ('visualViewport' in window) {
  window.visualViewport.addEventListener('resize', () => {
    const height = window.visualViewport.height;
    document.documentElement.style.setProperty(
      '--viewport-height',
      `${height}px`
    );
  });
}

// 确保输入框不被键盘遮挡
function scrollToInput(input) {
  setTimeout(() => {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}
```

---

## 十二、高级功能

### 12.1 实时预览

**双栏预览（桌面端）：**

```css
.preview-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border);
  height: calc(100vh - 56px);
}

.preview-split .editor-pane {
  background: var(--bg-primary);
  overflow-y: auto;
}

.preview-split .preview-pane {
  background: var(--bg-elevated);
  overflow-y: auto;
  padding: 2rem;
}
```

**预览同步滚动：**

```javascript
function syncScroll(source, target) {
  const sourceScrollPercent = source.scrollTop / (source.scrollHeight - source.clientHeight);
  target.scrollTop = sourceScrollPercent * (target.scrollHeight - target.clientHeight);
}

editorPane.addEventListener('scroll', () => {
  syncScroll(editorPane, previewPane);
});
```

### 12.2 自动保存

```javascript
class AutoSave {
  constructor(options = {}) {
    this.delay = options.delay || 3000;        // 3秒延迟
    this.storageKey = options.storageKey || 'editor-draft';
    this.timer = null;
    this.lastSaved = null;
  }

  // 触发自动保存
  trigger(content) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.save(content);
    }, this.delay);
  }

  // 保存到 localStorage
  save(content) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        content,
        timestamp: Date.now(),
        version: this.getVersion()
      }));
      this.lastSaved = new Date();
      this.showSavedIndicator();
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }

  // 加载草稿
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // 显示保存状态
  showSavedIndicator() {
    const indicator = document.getElementById('save-status');
    indicator.textContent = '已自动保存';
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
  }

  // 版本号管理
  getVersion() {
    return parseInt(localStorage.getItem('editor-version') || '0') + 1;
  }
}

// 使用
const autoSave = new AutoSave({ delay: 3000 });
editor.addEventListener('input', () => {
  autoSave.trigger(editor.innerHTML);
});
```

### 12.3 版本历史

```javascript
class VersionHistory {
  constructor(maxVersions = 50) {
    this.maxVersions = maxVersions;
    this.versions = [];
  }

  // 保存版本
  save(content, description = '') {
    this.versions.push({
      id: Date.now(),
      content,
      description,
      timestamp: new Date()
    });

    // 限制版本数量
    if (this.versions.length > this.maxVersions) {
      this.versions.shift();
    }
  }

  // 获取版本列表
  getVersions() {
    return this.versions.map(v => ({
      id: v.id,
      description: v.description,
      timestamp: v.timestamp
    }));
  }

  // 恢复版本
  restore(versionId) {
    const version = this.versions.find(v => v.id === versionId);
    if (version) {
      return version.content;
    }
    return null;
  }
}

// 版本历史 UI
function renderVersionHistory(versions) {
  return versions.map(v => `
    <div class="version-item" data-id="${v.id}">
      <div class="version-time">
        ${formatTime(v.timestamp)}
      </div>
      <div class="version-desc">
        ${v.description || '自动保存'}
      </div>
      <button class="version-restore" onclick="restoreVersion(${v.id})">
        恢复
      </button>
    </div>
  `).join('');
}
```

### 12.4 草稿管理

```javascript
class DraftManager {
  constructor() {
    this.drafts = this.loadDrafts();
  }

  // 加载所有草稿
  loadDrafts() {
    try {
      return JSON.parse(localStorage.getItem('drafts') || '[]');
    } catch {
      return [];
    }
  }

  // 保存草稿
  save(draft) {
    const index = this.drafts.findIndex(d => d.id === draft.id);
    if (index !== -1) {
      this.drafts[index] = { ...this.drafts[index], ...draft, updatedAt: Date.now() };
    } else {
      this.drafts.push({
        id: Date.now(),
        ...draft,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    this.persist();
  }

  // 删除草稿
  delete(id) {
    this.drafts = this.drafts.filter(d => d.id !== id);
    this.persist();
  }

  // 持久化
  persist() {
    localStorage.setItem('drafts', JSON.stringify(this.drafts));
  }

  // 获取草稿列表
  getList() {
    return this.drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
```

---

## 十三、组件结构

### 13.1 编辑器组件树

```
Editor
├── EditorHeader (顶栏)
│   ├── BackButton
│   ├── TitlePreview
│   ├── SaveStatus
│   └── PublishButton
│
├── EditorBody (主体)
│   ├── EditorContent (编辑区)
│   │   ├── TitleInput
│   │   └── ContentArea
│   │       ├── Block
│   │       ├── Block
│   │       └── ...
│   │
│   └── Sidebar (侧边栏)
│       ├── StatusSection
│       ├── SEOSection
│       ├── TagsSection
│       ├── ImageSection
│       └── PublishSection
│
├── FloatingToolbar (浮动工具栏)
│   ├── FormatButtons
│   └── InsertButtons
│
├── SlashMenu (斜杠菜单)
│   └── MenuItem[]
│
├── MobileToolbar (移动端工具栏)
│   └── ToolbarButton[]
│
└── StatusBar (状态栏)
    ├── WordCount
    ├── ReadTime
    └── LastEdit
```

### 13.2 状态管理

```javascript
// 编辑器状态
const editorState = {
  // 内容
  title: '',
  content: '',
  slug: '',
  excerpt: '',
  coverImage: '',

  // 元数据
  tags: [],
  status: 'draft',       // draft | published | scheduled
  scheduledAt: null,

  // UI 状态
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  sidebarOpen: false,
  slashMenuOpen: false,
  selectedBlock: null,

  // 历史
  versions: [],
  currentVersion: 0
};

// 状态更新
function updateEditorState(updates) {
  Object.assign(editorState, updates);
  renderEditor(editorState);
}
```

---

## 十四、实现优先级

### Phase 1: 核心编辑体验 (1-2 周)

- [ ] 标题输入框
- [ ] Markdown 编辑器基础
- [ ] 浮动工具栏
- [ ] 快捷键支持
- [ ] 自动保存

### Phase 2: 增强功能 (2-3 周)

- [ ] 斜杠命令
- [ ] 实时预览
- [ ] 侧边栏
- [ ] 移动端适配

### Phase 3: 高级功能 (3-4 周)

- [ ] 版本历史
- [ ] 草稿管理
- [ ] 协作编辑（可选）
- [ ] 性能优化

---

## 十五、参考资源

### 设计参考

- **Notion**: https://www.notion.so
- **Ghost**: https://ghost.org
- **WordPress Gutenberg**: https://wordpress.org/gutenberg/

### 技术参考

- **Lexical**: https://lexical.dev/ (Meta 的文本编辑器框架)
- **Tiptap**: https://tiptap.dev/ (Headless 编辑器框架)
- **ProseMirror**: https://prosemirror.net/ (底层编辑器工具包)
- **Editor.js**: https://editorjs.io/ (块级编辑器)

### 设计系统

- **Radix UI**: https://www.radix-ui.com/
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/

---

*最后更新: 2026-07-06*
