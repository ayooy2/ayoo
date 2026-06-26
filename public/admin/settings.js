(function() {
    // ---- 页面设置 ----
    var composing = false;

    async function loadSettings() {
        try {
            var res = await apiFetch(API_SETTINGS);
            var data = await res.json();
            document.getElementById('set-title').value = data.title || '';
            document.getElementById('set-subtitle').value = data.subtitle || '';
            document.getElementById('set-footer').value = data.footer || '';
            var bg = data.bg_image || '';
            document.getElementById('set-bg-image').value = bg;
            // 激活对应壁纸项
            document.querySelectorAll('.wallpaper-item').forEach(function(el) {
                el.classList.toggle('active', el.dataset.bg === bg);
            });
            updatePreview();
        } catch (e) { /* ignore */ }
    }

    function updatePreview() {
        document.getElementById('preview-title').textContent = document.getElementById('set-title').value || '我的导航主页';
        document.getElementById('preview-subtitle').textContent = document.getElementById('set-subtitle').value || '';
        document.getElementById('preview-footer').textContent = document.getElementById('set-footer').value || '';
    }

    // 处理中文输入法：composition 期间不更新，等输入法确认后再刷新
    ['set-title', 'set-subtitle', 'set-footer'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('compositionstart', function() { composing = true; });
        el.addEventListener('compositionend', function() {
            composing = false;
            updatePreview();
        });
        el.addEventListener('input', function() {
            if (!composing) updatePreview();
        });
    });

    function selectWallpaper(el) {
        document.querySelectorAll('.wallpaper-item').forEach(function(item) {
            item.classList.remove('active');
        });
        el.classList.add('active');
        document.getElementById('set-bg-image').value = el.dataset.bg || '';
    }

    async function saveSettings(e) {
        e.preventDefault();
        var bgVal = document.getElementById('set-bg-image').value.trim();
        // 如果有预设选中且自定义为空，用预设值
        if (!bgVal) {
            var active = document.querySelector('.wallpaper-item.active');
            if (active) bgVal = active.dataset.bg || '';
        }
        var body = {
            title: document.getElementById('set-title').value.trim(),
            subtitle: document.getElementById('set-subtitle').value.trim(),
            footer: document.getElementById('set-footer').value.trim(),
            bg_image: bgVal
        };
        var res = await apiFetch(API_SETTINGS, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            var hint = document.getElementById('save-hint');
            hint.classList.add('show');
            setTimeout(function() { hint.classList.remove('show'); }, 2000);
        } else if (res.status === 401) {
            alert('登录已过期'); logout();
        } else {
            alert('保存失败');
        }
    }

    // ---- 暴露到全局 ----
    window.loadSettings = loadSettings;
    window.updatePreview = updatePreview;
    window.selectWallpaper = selectWallpaper;
    window.saveSettings = saveSettings;
})();
