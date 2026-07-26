/**
 * admin/settings.js — 后台页面设置
 * 功能：页面标题/副标题/页脚/壁纸配置（日间+夜间）、纯色背景开关、实时预览
 * 依赖：admin/core.js（apiFetch、API_SETTINGS）
 */
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
            // 日间背景图
            var bg = data.bg_image || '';
            document.getElementById('set-bg-image').value = bg;
            updateBgPreview('set-bg-image', 'bg-light-preview');
            // 夜间背景图
            var bgDark = data.bg_image_dark || '';
            document.getElementById('set-bg-image-dark').value = bgDark;
            updateBgPreview('set-bg-image-dark', 'bg-dark-preview');
            // 纯色背景开关
            var solidBg = data.solid_bg === '1' || data.solid_bg === true;
            document.getElementById('set-solid-bg').checked = solidBg;
            updateSolidBgLabel(solidBg);
            updatePreview();
        } catch (e) { /* ignore */ }
    }

    function updatePreview() {
        document.getElementById('preview-title').textContent = document.getElementById('set-title').value || '我的导航主页';
        document.getElementById('preview-subtitle').textContent = document.getElementById('set-subtitle').value || '';
        document.getElementById('preview-footer').textContent = document.getElementById('set-footer').value || '';
    }

    // 处理中文输入法
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

    // 背景图输入框变化时更新预览
    ['set-bg-image', 'set-bg-image-dark'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function() {
            var previewId = id === 'set-bg-image' ? 'bg-light-preview' : 'bg-dark-preview';
            updateBgPreview(id, previewId);
        });
    });

    function updateBgPreview(inputId, previewId) {
        var url = document.getElementById(inputId).value.trim();
        var preview = document.getElementById(previewId);
        if (preview) {
            preview.style.backgroundImage = url ? 'url(' + url + ')' : '';
        }
    }

    // ---- 背景图上传 ----
    async function uploadBgImage(input, inputId, previewId) {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); input.value = ''; return; }
        try {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'image');
            var res = await apiFetch('/api/media', { method: 'POST', body: formData });
            if (res.ok) {
                var result = await res.json();
                document.getElementById(inputId).value = result.url;
                updateBgPreview(inputId, previewId);
            } else {
                var err = await res.json().catch(function() { return {}; });
                alert('上传失败: ' + (err.error || '未知错误'));
            }
        } catch(e) {
            alert('上传失败: ' + e.message);
        }
        input.value = '';
    }

    function clearBgImage(inputId, previewId) {
        document.getElementById(inputId).value = '';
        updateBgPreview(inputId, previewId);
    }

    // ---- 纯色背景开关 ----
    function toggleSolidBg(checked) {
        updateSolidBgLabel(checked);
    }

    function updateSolidBgLabel(checked) {
        var label = document.getElementById('solid-bg-label');
        if (label) {
            label.textContent = checked ? '开启 — 使用纯色背景' : '关闭 — 显示背景图片';
        }
    }

    // ---- 保存设置 ----
    async function saveSettings(e) {
        e.preventDefault();
        try {
            var body = {
                title: document.getElementById('set-title').value.trim(),
                subtitle: document.getElementById('set-subtitle').value.trim(),
                footer: document.getElementById('set-footer').value.trim(),
                bg_image: document.getElementById('set-bg-image').value.trim(),
                bg_image_dark: document.getElementById('set-bg-image-dark').value.trim(),
                solid_bg: document.getElementById('set-solid-bg').checked ? '1' : '0'
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
        } catch(e) { alert('保存失败: 网络错误'); }
    }

    // ---- 暴露到全局 ----
    window.loadSettings = loadSettings;
    window.updatePreview = updatePreview;
    window.uploadBgImage = uploadBgImage;
    window.clearBgImage = clearBgImage;
    window.toggleSolidBg = toggleSolidBg;
    window.saveSettings = saveSettings;
})();
