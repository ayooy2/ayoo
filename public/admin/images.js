(function() {
    // ---- 图片上传（R2 media） ----
    function uploadMDImage(input) {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); input.value = ''; return; }
        uploadToServer(file);
        input.value = '';
    }

    async function uploadToServer(file) {
        try {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'image');
            var res = await apiFetch('/api/media', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                var result = await res.json();
                var mdImg = '\n![' + (file.name || 'image') + '](' + result.url + ')\n';
                var ta = document.getElementById('article-content-md');
                ta.focus();
                if (window._saveUndoState) window._saveUndoState(ta);
                var pos = ta.selectionStart;
                ta.value = ta.value.substring(0, pos) + mdImg + ta.value.substring(ta.selectionEnd);
                ta.selectionStart = ta.selectionEnd = pos + mdImg.length;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                var err = await res.json().catch(function() { return {}; });
                alert('图片上传失败: ' + (err.error || '未知错误'));
            }
        } catch(e) {
            alert('图片上传失败: ' + e.message);
        }
    }

    // ---- 图片管理（R2 media） ----
    async function loadImages() {
        try {
            var res = await apiFetch('/api/media?list=1');
            if (!res.ok) {
                // 回退到旧 API
                res = await apiFetch('/api/images?list=1');
            }
            if (!res.ok) return;
            var data = await res.json();
            var container = document.getElementById('images-grid');
            var countEl = document.getElementById('images-count');
            if (!container) return;
            var images = data.media || data.images || [];
            if (countEl) countEl.textContent = images.length;
            if (!images.length) {
                container.innerHTML = '<div class="empty-state"><p>暂无图片</p></div>';
                return;
            }
            var html = '';
            for (var i = 0; i < images.length; i++) {
                var img = images[i];
                var date = (img.created_at || '').slice(0, 16).replace('T', ' ');
                var imgUrl = img.r2_key ? '/api/media?id=' + img.id : '/api/images?id=' + img.id';
                var size = img.file_size ? (img.file_size / 1024).toFixed(1) + 'KB' : '';
                var type = img.type || 'image';
                var typeIcon = type === 'video' ? '🎬' : type === 'audio' ? '🎵' : '🖼️';
                html += '<div class="image-card" data-id="' + img.id + '" data-type="' + type + '">'
                    + '<img src="' + imgUrl + '" alt="' + escapeHtml(img.filename) + '" loading="lazy">'
                    + '<div class="image-info">'
                    + '<span class="image-name">' + typeIcon + ' ' + escapeHtml(img.filename) + '</span>'
                    + '<span class="image-date">' + date + (size ? ' · ' + size : '') + '</span>'
                    + '</div>'
                    + '<button class="image-delete-btn" onclick="deleteImage(' + img.id + ')" title="删除">🗑️</button>'
                    + '</div>';
            }
            container.innerHTML = html;
        } catch(e) { console.error('Load images error:', e); }
    }

    async function deleteImage(id) {
        if (!confirm('确定删除这个文件？')) return;
        try {
            var res = await apiFetch('/api/media?id=' + id, { method: 'DELETE' });
            if (!res.ok) {
                res = await apiFetch('/api/images?id=' + id, { method: 'DELETE' });
            }
            if (res.ok) {
                var card = document.querySelector('.image-card[data-id="' + id + '"]');
                if (card) card.remove();
            } else {
                alert('删除失败');
            }
        } catch(e) { alert('删除失败'); }
    }

    // ---- 暴露到全局 ----
    window.uploadMDImage = uploadMDImage;
    window.uploadToServer = uploadToServer;
    window.loadImages = loadImages;
    window.deleteImage = deleteImage;
})();
