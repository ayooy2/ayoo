/**
 * 共享工具函数
 * comments.js 和 guestbook.js 共用的内容过滤逻辑
 */

// 移除 HTML 标签
export function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '');
}

// 垃圾内容检测
export function hasSpam(s) {
  const lower = String(s || '').toLowerCase();
  const words = ['buy now', 'click here', 'free money', 'casino', 'viagra', '彩票', '赌博', '代开发票'];
  return words.some(w => lower.indexOf(w) >= 0);
}
