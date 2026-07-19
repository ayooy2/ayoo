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
  var trimmed = u.replace(/^[\s\x00]+/, '');
  if (/^javascript:|^data:|^vbscript:/i.test(trimmed)) return '#';
  return u;
}

/**
 * 清理 marked 生成的 HTML 中的危险标签和属性
 * - 移除 script/style/object/embed/form
 * - iframe: 只允许 google.com/maps，重建安全版本（仅保留 src/width/height 等安全属性）
 * - 移除所有 on* 事件属性
 * - 移除 javascript:/vbscript: 协议
 * - 阻止危险的 data: URI（text/html, application/javascript 等），允许安全的（image/*）
 */
export function sanitizeMD(html) {
  // 先提取 Google Maps iframe 并重建安全版本
  var iframes = [];
  html = html.replace(/<iframe([^>]*)>([\s\S]*?<\/iframe>|\/?>)/gi, function(match, attrs) {
    var srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      var src = srcMatch[1];
      // 严格校验域名：只允许 google.com 及其子域名
      var isGoogleMaps = false;
      try {
        var u = new URL(src);
        var h = u.hostname;
        isGoogleMaps = (h === 'google.com' || h === 'www.google.com' || h.endsWith('.google.com') || h === 'maps.app.goo.gl');
      } catch(e) {}
      if (!isGoogleMaps) return '';
      // 转义 src 中的引号
      var safeSrc = src.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      var safeAttrs = 'src="' + safeSrc + '"';
      var width = attrs.match(/\bwidth=["'](\d+)["']/i);
      var height = attrs.match(/\bheight=["'](\d+)["']/i);
      if (width) safeAttrs += ' width="' + width[1] + '"';
      if (height) safeAttrs += ' height="' + height[1] + '"';
      safeAttrs += ' style="border:0" allowfullscreen loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer"';
      var idx = iframes.length;
      iframes.push('<iframe ' + safeAttrs + '></iframe>');
      return '__IFRAME_' + idx + '__';
    }
    return '';
  });
  var result = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>\/]*/gi, '')
    .replace(/\/\s*on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/\son\w+(?=[\s>\/]|$)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:(?!image\/(?!svg\+xml))/gi, '')
    .replace(/vbscript:/gi, '');
  // 还原 Google Maps iframe（用 substring 避免 $ 模式问题）
  for (var i = 0; i < iframes.length; i++) {
    var placeholder = '__IFRAME_' + i + '__';
    var idx = result.indexOf(placeholder);
    if (idx !== -1) {
      result = result.substring(0, idx) + iframes[i] + result.substring(idx + placeholder.length);
    }
  }
  return result;
}
