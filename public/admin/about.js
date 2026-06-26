(function() {
    // ---- 关于我 ----
    async function loadAbout() {
        try {
            var res = await apiFetch(API_SETTINGS);
            var data = await res.json();
            document.getElementById('about-title').value = data.about_title || '';
            document.getElementById('about-avatar').value = data.about_avatar || '';
            document.getElementById('about-content').value = (data.about_content || '').replace(/\\n/g, '\n');
            updateAboutPreview();
        } catch (e) { /* ignore */ }
    }

    function updateAboutPreview() {
        var content = document.getElementById('about-content').value;
        var preview = document.getElementById('about-preview');
        if (preview) {
            preview.innerHTML = content ? '<p style="color:var(--text-muted);white-space:pre-wrap;">' + content.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>' : '<p style="color:var(--text-muted);">暂无内容</p>';
        }
    }

    async function saveAbout(e) {
        e.preventDefault();
        try {
            var body = {
                about_title: document.getElementById('about-title').value.trim(),
                about_avatar: document.getElementById('about-avatar').value.trim(),
                about_content: document.getElementById('about-content').value
            };
            var res = await apiFetch(API_SETTINGS, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                var hint = document.getElementById('about-save-hint');
                hint.classList.add('show');
                setTimeout(function() { hint.classList.remove('show'); }, 2000);
            } else if (res.status === 401) {
                alert('登录已过期'); logout();
            } else {
                alert('保存失败');
            }
        } catch(e) { alert('保存失败: 网络错误'); }
    }

    // 关于页面内容实时预览
    (function() {
        var aboutEl = document.getElementById('about-content');
        if (aboutEl) {
            aboutEl.addEventListener('input', updateAboutPreview);
        }
    })();

    // ---- 暴露到全局 ----
    window.loadAbout = loadAbout;
    window.updateAboutPreview = updateAboutPreview;
    window.saveAbout = saveAbout;
})();
