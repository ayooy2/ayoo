/**
 * HTML 转义
 */
export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * URL 安全检查：阻止 javascript:/data:/vbscript: 协议
 */
export function safeUrl(u) {
  if (!u) return '';
  if (/^javascript:|^data:|^vbscript:/i.test(u)) return '#';
  return u;
}

/**
 * 清理 marked 生成的 HTML 中的危险标签和属性
 * - 移除 script/style/iframe/object/embed/form
 * - 移除所有 on* 事件属性
 * - 移除 javascript:/vbscript: 协议
 * - 阻止危险的 data: URI（text/html, application/javascript 等），允许安全的（image/*）
 * 保留常用 Markdown HTML 标签：h1-h6, p, a, img, ul/ol/li, table/thead/tbody/tr/th/td,
 * blockquote, pre, code, strong, em, del, br, hr, span, div, sup, sub, details, summary
 */
export function sanitizeMD(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>\/]*/gi, '')
    .replace(/\/\s*on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:(?!image\/)/gi, '')
    .replace(/vbscript:/gi, '');
}
