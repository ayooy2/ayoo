/**
 * SSR 模板辅助函数
 * 集中管理公共 HTML 结构，统一 CSS 版本、meta 标签等
 */

// CSS 版本号，修改时只需改这一处
export const CSS_VERSION = '6';

/**
 * HTML head 开始
 * @param {string} title - 页面标题
 * @param {string} extra - 额外的 meta/link 标签
 */
export function htmlHead(title, extra = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="/style.css?v=${CSS_VERSION}">
${extra}
</head>`;
}

/**
 * 页面主体开始（navbar + page-wrapper + content）
 * @param {string} navbarHtml - navbar() 返回的 HTML
 * @param {string} mobileMenuHtml - mobileMenu() 返回的 HTML
 * @param {string} headerHtml - 页面顶部内容（page-header 等）
 */
export function pageStart(navbarHtml, mobileMenuHtml, headerHtml = '') {
  return `<body>
${navbarHtml}
${mobileMenuHtml}
<div class="page-wrapper">
${headerHtml}
  <div class="content">`;
}

/**
 * 页面主体结束（content 关闭 + footer + scripts）
 * @param {string} footerText - 页脚文字，默认返回首页链接
 * @param {string} extraScripts - 额外的 script 标签
 * @param {string} cmdOverlayHtml - cmdOverlay() 返回的 HTML
 */
export function pageEnd(footerText = '<a href="/">← 返回首页</a>', extraScripts = '', cmdOverlayHtml = '') {
  return `  </div>
  <footer class="page-footer">
    <span class="footer-text">${footerText}</span>
  </footer>
</div>
<script src="/app.js"></script>
${extraScripts}
${cmdOverlayHtml}
</body>
</html>`;
}

/**
 * 完整的页面响应
 * @param {string} html - 完整 HTML
 * @param {object} opts - 选项（cacheAge 等）
 */
export function htmlResponse(html, opts = {}) {
  const cacheAge = opts.cacheAge || 60;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheAge}, s-maxage=${cacheAge * 60}`,
    }
  });
}

/**
 * 错误响应
 */
export function errorResponse() {
  return new Response('服务器错误，请稍后再试', { status: 500 });
}
