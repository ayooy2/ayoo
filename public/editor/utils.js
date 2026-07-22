/**
 * editor/utils.js — 工具函数
 * DOM 查询、HTML 转义、防抖、时间格式化、字数统计、Slug 生成、API 请求
 */

// DOM 查询快捷方式
export function $(sel) { return document.querySelector(sel); }
export function $$(sel) { return document.querySelectorAll(sel); }

// HTML 转义
export function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
}

// 防抖
export function debounce(fn, delay) {
    var timer;
    return function() {
        var ctx = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
}

// 补零
export function pad2(n) { return n < 10 ? '0' + n : '' + n; }

// 格式化时间
export function formatTime(date) {
    if (!date) return '';
    var d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '/' + pad2(d.getMonth()+1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// 相对时间
export function relativeTime(date) {
    if (!date) return '';
    var d = date instanceof Date ? date : new Date(date);
    var diff = Date.now() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return formatTime(d);
}

// 字数统计（中文 + 英文单词）
export function countWords(text) {
    if (!text) return 0;
    var chinese = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    var english = text.replace(/[一-鿿㐀-䶿]/g, ' ').trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    return chinese + english;
}

// 阅读时间估算
export function calcReadTime(text) {
    var words = countWords(text);
    var minutes = Math.max(1, Math.ceil(words / 300));
    return '约 ' + minutes + ' 分钟';
}

// 生成 URL slug
export function generateSlug(title) {
    if (!title) return '';
    var slug = title
        .toLowerCase()
        .replace(/[一-鿿㐀-䶿]+/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    if (!slug) slug = 'post-' + Date.now().toString(36);
    return slug.slice(0, 80);
}

// API 请求（自动携带 cookie）
export async function apiFetch(url, opts) {
    opts = opts || {};
    if (!opts.credentials) opts.credentials = 'same-origin';
    return fetch(url, opts);
}

/**
 * 估算 textarea 中光标的像素位置
 * 创建一个镜像 div 来测量文本布局
 * @param {HTMLTextAreaElement} ta - textarea 元素
 * @param {number} pos - 光标在文本中的字符位置
 * @returns {{top: number, left: number}} 相对于视口的像素坐标
 */
export function getCursorPixelPos(ta, pos) {
    var mirror = document.createElement('div');
    var cs = getComputedStyle(ta);
    mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;'
        + 'font:' + cs.font
        + ';padding:' + cs.padding
        + ';width:' + ta.clientWidth + 'px'
        + ';line-height:' + cs.lineHeight;
    document.body.appendChild(mirror);

    var textBefore = ta.value.substring(0, pos);
    mirror.textContent = textBefore;

    var span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);

    var taRect = ta.getBoundingClientRect();
    var spanRect = span.getBoundingClientRect();
    var mirrorRect = mirror.getBoundingClientRect();

    var top = taRect.top + (spanRect.top - mirrorRect.top) - ta.scrollTop;
    var left = taRect.left + (spanRect.left - mirrorRect.left);

    document.body.removeChild(mirror);
    return { top: top, left: left };
}
