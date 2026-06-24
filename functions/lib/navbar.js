// 共享导航栏模块 — 统一所有页面的导航结构
// 用法: import { navbar, mobileMenu, cmdOverlay } from './lib/navbar.js';
// 页面调用 navbar('品牌名') 返回桌面导航 HTML，mobileMenu() 返回移动端菜单 HTML

const ALL_LINKS = [
  { href: '/', label: '首页', icon: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { href: '/blog', label: '笔记', icon: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' },
  { href: '/search', label: '搜索', icon: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' },
  { href: '/archive', label: '归档', icon: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>' },
  { href: '/now', label: 'Now', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
  { href: '/guestbook', label: '留言簿', icon: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' },
  { href: '/about', label: '关于', icon: '' },
  { href: '/features', label: '功能', icon: '' }
];

// brandHref: 品牌链接地址，默认 '/'
// currentPath: 当前页面路径，用于排除桌面端自身链接
export function navbar(brandText, brandHref, currentPath) {
  brandHref = brandHref || '/';
  currentPath = currentPath || '';

  // 桌面端链接：排除当前页面
  var desktopLinks = '';
  for (var i = 0; i < ALL_LINKS.length; i++) {
    var link = ALL_LINKS[i];
    if (link.href === currentPath) continue;
    desktopLinks += '<a href="' + link.href + '" class="nav-link">' + link.icon + link.label + '</a>';
  }

  return '<nav class="navbar"><div class="nav-inner">' +
    '<a href="' + brandHref + '" class="nav-brand">' + escHtml(brandText) + '</a>' +
    '<div class="nav-links">' + desktopLinks + '</div>' +
    '<div class="nav-spacer"></div>' +
    '<span class="nav-clock" id="clock">--:--:--</span>' +
    '<button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button>' +
    '<button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button>' +
    '</div></nav>';
}

// 移动端菜单：始终包含全部链接
export function mobileMenu() {
  var links = '';
  for (var i = 0; i < ALL_LINKS.length; i++) {
    var link = ALL_LINKS[i];
    links += '<a href="' + link.href + '" class="mobile-menu-link">' + link.label + '</a>';
  }
  return '<div class="mobile-menu" id="mobile-menu">' +
    '<button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>' +
    '<div class="mobile-menu-links">' + links + '</div></div>';
}

// 命令面板覆盖层
export function cmdOverlay() {
  return '<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><input class="cmd-input" id="cmd-input" placeholder="搜索页面、文章…" autocomplete="off"><div class="cmd-list" id="cmd-list"></div></div></div>';
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
