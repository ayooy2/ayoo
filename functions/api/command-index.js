// Command Palette index — returns sites + articles + static pages for quick navigation
import { json, error } from '../lib/response.js';

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const sites = await env.DB.prepare(
      'SELECT id, title, url, icon, description FROM sites ORDER BY sort_order'
    ).all();
    const articles = await env.DB.prepare(
      'SELECT id, title, slug, tags FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime(\'now\')) ORDER BY created_at DESC LIMIT 100'
    ).all();

    var items = [];
    // Static pages
    items.push({ type: 'page', title: '首页', url: '/', icon: '🏠' });
    items.push({ type: 'page', title: '笔记', url: '/blog', icon: '📝' });
    items.push({ type: 'page', title: '搜索', url: '/search', icon: '🔍' });
    items.push({ type: 'page', title: '归档', url: '/archive', icon: '📦' });

    // Sites
    for (var i = 0; i < (sites.results || []).length; i++) {
      var s = sites.results[i];
      items.push({ type: 'link', title: s.title, url: s.url, icon: s.icon || '🔗', desc: s.description || '' });
    }
    // Articles
    for (var j = 0; j < (articles.results || []).length; j++) {
      var a = articles.results[j];
      items.push({ type: 'article', title: a.title, url: '/blog/' + a.slug, icon: '📄', tags: a.tags || '' });
    }

    return json({ items: items });
  } catch (e) {
    return error(e.message);
  }
}
