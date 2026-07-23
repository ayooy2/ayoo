/**
 * admin/app.js — 后台管理主入口
 * 功能：Tab 切换、认证检查、ESC 关闭模态框、URL hash 自动切换
 * 依赖：admin/core.js（apiFetch）
 */
(function() {
    // ---- Tab 切换 ----
    function switchTab(name) {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === name); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.toggle('hidden', c.id !== 'tab-' + name); });
        if (name === 'settings') loadSettings();
        if (name === 'about') loadAbout();
        if (name === 'sites') loadTable();
        if (name === 'articles') loadArticles();
        if (name === 'tags') loadTags();
        if (name === 'logs') loadLogs();
    }

    // ---- 会话检查（认证通过后才显示 UI）----
    (function() {
        apiFetch(API_AUTH, { credentials: 'same-origin' }).then(function(r) {
            if (!r.ok) { window.location.href = '/login.html'; return; }
            document.getElementById('admin-section').style.display = '';
            // 支持 URL hash 自动切换 tab（如 /admin.html#articles）
            var hash = location.hash.replace('#', '');
            if (hash && document.getElementById('tab-' + hash)) {
                switchTab(hash);
            } else {
                loadTable();
            }
        }).catch(function() {
            window.location.href = '/login.html';
        });
    })();

    // ---- 模态框点击外部关闭 + ESC 键关闭 ----
    document.getElementById('article-modal').addEventListener('click', function(e) {
        if (e.target.id === 'article-modal') closeArticleEditor();
    });
    document.getElementById('modal').addEventListener('click', function(e) {
        if (e.target.id === 'modal') closeModal();
    });
    document.getElementById('tag-modal').addEventListener('click', function(e) {
        if (e.target.id === 'tag-modal') closeTagEditor();
    });
    document.getElementById('pw-modal').addEventListener('click', function(e) {
        if (e.target.id === 'pw-modal') closePwModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('pw-modal').classList.contains('active')) { closePwModal(); return; }
        if (document.getElementById('tag-modal').classList.contains('active')) { closeTagEditor(); return; }
        if (document.getElementById('modal').classList.contains('active')) { closeModal(); return; }
        if (document.getElementById('article-modal').classList.contains('active')) { closeArticleEditor(); return; }
    });

    // ---- 键盘快捷键（只在编辑器打开时生效）----
    document.addEventListener('keydown', function(e) {
        if (!document.getElementById('article-modal').classList.contains('active')) return;
        var mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        var k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
            e.preventDefault();
            var ta = document.getElementById('article-content-md');
            if (ta && document.activeElement === ta) _undo(ta);
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
            e.preventDefault();
            var ta = document.getElementById('article-content-md');
            if (ta && document.activeElement === ta) _redo(ta);
        } else if (k === 'b') { e.preventDefault(); insertMD('bold'); }
        else if (k === 'i') { e.preventDefault(); insertMD('italic'); }
        else if (k === 'd') { e.preventDefault(); insertMD('code'); }
        else if (k === 'k') { e.preventDefault(); insertMD('link'); }
        else if (k === 's') { e.preventDefault(); doPublish('draft'); }
    });

    // ---- 自动保存监听 ----
    bindAutoSaveListeners();

    // ---- 暴露到全局 ----
    window.switchTab = switchTab;
})();
