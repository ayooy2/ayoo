(function() {
    // ---- 图片上传 ----
    function uploadMDImage(input) {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('图片不能超过 5MB'); input.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var maxW = 1200, maxH = 800;
                var w = img.width, h = img.height;
                if (w > maxW) { h = h * maxW / w; w = maxW; }
                if (h > maxH) { w = w * maxH / h; h = maxH; }
                canvas.width = Math.round(w); canvas.height = Math.round(h);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                var base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                uploadToServer(file.name, 'image/jpeg', base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        input.value = '';
    }

    async function uploadToServer(filename, mime, data) {
        try {
            var res = await apiFetch('/api/images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filename, mime_type: mime, data: data })
            });
            if (res.ok) {
                var result = await res.json();
                var mdImg = '\n![' + filename + '](' + result.url + ')\n';
                var ta = document.getElementById('article-content-md');
                ta.focus();
                _saveUndoState(ta);
                var pos = ta.selectionStart;
                ta.value = ta.value.substring(0, pos) + mdImg + ta.value.substring(ta.selectionEnd);
                ta.selectionStart = ta.selectionEnd = pos + mdImg.length;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                alert('图片上传失败');
            }
        } catch(e) {
            alert('图片上传失败: ' + e.message);
        }
    }

    // ---- 暴露到全局 ----
    window.uploadMDImage = uploadMDImage;
    window.uploadToServer = uploadToServer;
})();
