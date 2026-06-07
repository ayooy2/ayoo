// 首页 Edge SSR —— 极简留白风
export async function onRequestGet(context) {
  const { env } = context;
  const [sRes, siteRes] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM settings').all(),
    env.DB.prepare('SELECT id, title, url, icon, description FROM sites ORDER BY sort_order ASC, id ASC LIMIT 200').all()
  ]);
  var settings = {};
  for (var i = 0; i < (sRes.results || []).length; i++) {
    settings[sRes.results[i].key] = sRes.results[i].value;
  }
  var html = render(settings, siteRes.results || []);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=86400' }
  });
}

function render(s, sites) {
  var t = esc(s.title || '我的自留地');
  var sub = esc(s.subtitle || '');
  var foot = esc(s.footer || '');
  var bg = esc(s.bg_image || '');

  var bgStyle = bg ? ' style="background-image:url(\'' + bg + '\');background-size:cover;background-position:center;background-attachment:fixed;"' : '';

  var cards = '';
  for (var i = 0; i < sites.length; i++) {
    cards += card(sites[i]);
  }
  if (!cards) cards = '<p class="empty">暂无链接</p>';

  var desc = esc(s.subtitle || '个人导航与笔记');
  var seo = '\n<meta name="description" content="' + desc + '">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="' + t + '">'
    + '\n<meta property="og:description" content="' + desc + '">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev">';

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>' + t + '</title>' + seo + '\n<link rel="stylesheet" href="/style.css">\n</head>\n<body' + bgStyle + '>\n<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">' + t + '</a><a href="/blog" class="nav-link"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></a><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button></div></nav>\n<div class="page-wrapper"><div class="page-header"><h1 class="page-title">' + t + '</h1><p class="subtitle">' + sub + '</p></div>\n<main class="content"><div id="sites-grid" class="sites-grid">' + cards + '</div></main>\n<footer class="page-footer"><span class="footer-text">' + foot + '</span></footer></div>\n<script>(function(){function c(){var n=new Date();document.getElementById("clock").textContent=String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0")+":"+String(n.getSeconds()).padStart(2,"0")}c();setInterval(c,1e3);var b=document.getElementById("theme-toggle"),st=localStorage.getItem("theme")||"light";if(st==="dark")document.documentElement.setAttribute("data-theme","dark");b.textContent=st==="dark"?"☀":"☽";b.addEventListener("click",function(){var d=document.documentElement.getAttribute("data-theme")==="dark";if(d){document.documentElement.removeAttribute("data-theme");localStorage.setItem("theme","light");b.textContent="☽"}else{document.documentElement.setAttribute("data-theme","dark");localStorage.setItem("theme","dark");b.textContent="☀"}});document.querySelectorAll(".site-card").forEach(function(x){x.addEventListener("dblclick",function(){var u=x.dataset.url;if(u)window.open(u,"_blank","noopener,noreferrer")})});document.querySelectorAll(".site-card").forEach(function(x){loadIcon(x)});function loadIcon(x){var ic=x.querySelector(".card-icon"),ci=x.dataset.icon,url=x.dataset.url,iu=null;if(ci)iu=ci;else if(url)try{iu="https://"+new URL(url).hostname+"/favicon.ico"}catch(e){}if(!iu)return;var img=new Image(),done=false,timer=setTimeout(function(){if(!done){done=true;img.src=""}},2e3);img.onload=function(){if(done)return;done=true;clearTimeout(timer);ic.innerHTML="";var el=document.createElement("img");el.src=iu;el.alt="";ic.appendChild(el)};img.onerror=function(){if(done)return;done=true;clearTimeout(timer)};img.src=iu}})()</script>\n</body>\n</html>';
}

function card(site) {
  return '<div class="site-card" data-url="' + esc(site.url) + '" data-icon="' + esc(site.icon || '') + '" title="' + esc(site.title) + '"><div class="card-icon"><span class="card-emoji"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></span></div><div class="card-text"><h3 class="card-title">' + esc(site.title) + '</h3><p class="card-desc">' + esc(site.description || '') + '</p></div></div>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
