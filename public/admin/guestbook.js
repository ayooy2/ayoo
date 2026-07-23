/**
 * admin/guestbook.js — 后台留言管理
 * 功能：加载留言列表、删除留言、清空留言
 * 依赖：admin/core.js（apiFetch）
 */
(function() {
    // ---- 留言管理 ----
    async function loadGuestbook() {
        try {
            var res = await apiFetch('/api/guestbook');
            if (!res.ok) return;
            var data = await res.json();
            var tbody = document.getElementById('guestbook-table-body');
            var countEl = document.getElementById('guestbook-count');
            if (!tbody) return;

            var items = data.items || (Array.isArray(data) ? data : []);
            if (countEl) countEl.textContent = items.length;

            if (!items.length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-placeholder);padding:2rem;">暂无留言</td></tr>';
                return;
            }

            tbody.innerHTML = items.map(function(item) {
                var time = (item.created_at || '').slice(0, 16).replace('T', ' ');
                var name = escapeHtml(item.name || '');
                var url = item.url ? escapeHtml(item.url) : '';
                var message = escapeHtml(item.message || '');
                var nameHtml = url ? '<a href="' + url + '" target="_blank" rel="noopener">' + name + '</a>' : name;
                return '<tr>'
                    + '<td>' + nameHtml + '</td>'
                    + '<td class="message-cell">' + message + '</td>'
                    + '<td>' + time + '</td>'
                    + '<td><button class="btn btn-danger btn-sm" onclick="deleteGuestbook(' + item.id + ')">删除</button></td>'
                    + '</tr>';
            }).join('');
        } catch(e) {
            console.error('Load guestbook error:', e);
        }
    }

    async function deleteGuestbook(id) {
        if (!confirm('确定删除这条留言？')) return;
        try {
            var res = await apiFetch('/api/guestbook/' + id, { method: 'DELETE' });
            if (res.ok) {
                loadGuestbook();
            } else {
                alert('删除失败');
            }
        } catch(e) {
            alert('删除失败: 网络错误');
        }
    }

    async function clearGuestbook() {
        if (!confirm('确定清空所有留言？此操作不可恢复！')) return;
        try {
            var totalDeleted = 0;
            var hasMore = true;
            while (hasMore) {
                var res = await apiFetch('/api/guestbook');
                if (!res.ok) { alert('获取留言列表失败'); return; }
                var data = await res.json();
                var items = data.items || (Array.isArray(data) ? data : []);
                if (items.length === 0) { hasMore = false; break; }
                for (var i = 0; i < items.length; i++) {
                    var delRes = await apiFetch('/api/guestbook/' + items[i].id, { method: 'DELETE' });
                    if (!delRes.ok) { alert('删除留言 #' + items[i].id + ' 失败'); return; }
                    totalDeleted++;
                }
            }
            alert('已清空 ' + totalDeleted + ' 条留言');
            loadGuestbook();
        } catch(e) {
            alert('清空失败: 网络错误');
        }
    }

    // ---- 暴露到全局 ----
    window.loadGuestbook = loadGuestbook;
    window.deleteGuestbook = deleteGuestbook;
    window.clearGuestbook = clearGuestbook;
})();
