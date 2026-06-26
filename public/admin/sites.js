(function() {
    // ---- 网站管理 ----
    async function loadTable() {
        try {
            var res = await apiFetch(API_BASE);
            var data = await res.json();
            renderTable(data.sites || []);
        } catch (e) {
            document.getElementById('table-body').innerHTML =
                '<tr><td colspan="5" style="text-align:center">加载失败</td></tr>';
        }
    }

    function renderTable(sites) {
        var tbody = document.getElementById('table-body');
        if (!sites.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-placeholder);padding:2rem;">暂无数据</td></tr>';
            return;
        }
        tbody.innerHTML = sites.map(function(site) {
            var iconCell;
            if (site.icon) {
                iconCell = '<img src="' + escapeHtml(site.icon) + '" class="site-icon-preview" onerror="this.style.display=\'none\'; this.parentElement.innerHTML=\'🌐\';">';
            } else {
                iconCell = '<span style="font-size:1.5rem;">🌐</span>';
            }
            return '<tr>'
                + '<td>' + iconCell + '</td>'
                + '<td>' + escapeHtml(site.title) + '</td>'
                + '<td><a href="' + escapeHtml(site.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary);">' + escapeHtml(site.url) + '</a></td>'
                + '<td>' + escapeHtml(site.description || '') + '</td>'
                + '<td class="actions">'
                + '<button class="btn btn-secondary btn-sm" onclick="editSite(' + site.id + ')">编辑</button>'
                + '<button class="btn btn-danger btn-sm" onclick="deleteSite(' + site.id + ')">删除</button>'
                + '</td></tr>';
        }).join('');
    }

    function openModal(id) {
        document.getElementById('modal').classList.add('active');
        document.getElementById('edit-form').reset();
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-icon').value = '';
        document.getElementById('edit-icon-file').value = '';
        document.getElementById('icon-preview').innerHTML = '🌐';
        document.getElementById('modal-title').textContent = id ? '编辑网站' : '添加网站';
        if (id) {
            apiFetch(API_BASE + '/' + id).then(function(r) { return r.json(); }).then(function(site) {
                document.getElementById('edit-id').value = site.id;
                document.getElementById('edit-title').value = site.title;
                document.getElementById('edit-url').value = site.url;
                document.getElementById('edit-icon').value = site.icon || '';
                document.getElementById('edit-desc').value = site.description || '';
                updateIconPreview(site.icon);
            });
        }
    }

    function handleIconFile(input) {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var size = Math.min(img.width, img.height);
                canvas.width = 64; canvas.height = 64;
                var ctx = canvas.getContext('2d');
                var sx = (img.width - size) / 2;
                var sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, 64, 64);
                var base64 = canvas.toDataURL('image/png', 0.7);
                document.getElementById('edit-icon').value = base64;
                updateIconPreview(base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function updateIconPreview(src) {
        var preview = document.getElementById('icon-preview');
        if (src && src.startsWith('data:')) {
            preview.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
        } else if (src && src.startsWith('http')) {
            preview.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.parentElement.innerHTML=\'🌐\';">';
        } else {
            preview.innerHTML = '🌐';
        }
    }

    function closeModal() {
        document.getElementById('modal').classList.remove('active');
    }

    async function saveSite(e) {
        e.preventDefault();
        var id = document.getElementById('edit-id').value;
        var body = {
            title: document.getElementById('edit-title').value.trim(),
            url: document.getElementById('edit-url').value.trim(),
            icon: document.getElementById('edit-icon').value.trim(),
            description: document.getElementById('edit-desc').value.trim()
        };
        var url = id ? API_BASE + '/' + id : API_BASE + '/new';
        var res = await apiFetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) { closeModal(); loadTable(); }
        else if (res.status === 401) { alert('登录已过期'); logout(); }
        else { alert('保存失败'); }
    }

    function editSite(id) { openModal(id); }

    async function deleteSite(id) {
        if (!confirm('确定删除？')) return;
        var res = await apiFetch(API_BASE + '/' + id, {
            method: 'DELETE',
            headers: {}
        });
        if (res.ok) loadTable();
        else if (res.status === 401) { alert('登录已过期'); logout(); }
    }

    // ---- 暴露到全局 ----
    window.loadTable = loadTable;
    window.renderTable = renderTable;
    window.openModal = openModal;
    window.handleIconFile = handleIconFile;
    window.updateIconPreview = updateIconPreview;
    window.closeModal = closeModal;
    window.saveSite = saveSite;
    window.editSite = editSite;
    window.deleteSite = deleteSite;
})();
