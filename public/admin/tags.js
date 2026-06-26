(function() {
    // ---- 标签管理 ----
    var _allTags = [];
    var _tagSelectorOpen = false;

    async function loadTags() {
        try {
            var res = await apiFetch('/api/tags');
            var data = await res.json();
            _allTags = data.tags || [];
            renderTagsTable(_allTags);
        } catch (e) {
            document.getElementById('tags-table-body').innerHTML =
                '<tr><td colspan="4" style="text-align:center;color:var(--color-danger);padding:2rem;">加载失败</td></tr>';
        }
    }

    function renderTagsTable(tags) {
        var tbody = document.getElementById('tags-table-body');
        if (!tags.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-placeholder);padding:2rem;">暂无标签</td></tr>';
            return;
        }
        tbody.innerHTML = tags.map(function(t) {
            var color = t.color || '#6366f1';
            return '<tr>'
                + '<td><span class="tag-color-badge" style="background:' + escapeHtml(color) + '">' + escapeHtml(t.name) + '</span></td>'
                + '<td><code style="font-size:0.82rem;color:var(--color-text-secondary);">' + escapeHtml(t.slug || '') + '</code></td>'
                + '<td><span class="tag-color-dot" style="background:' + escapeHtml(color) + ';cursor:default;"></span> <span style="font-size:0.8rem;color:var(--color-text-muted);">' + escapeHtml(color) + '</span></td>'
                + '<td class="actions">'
                + '<button class="btn btn-secondary btn-sm" onclick="openTagEditor(' + t.id + ')">编辑</button>'
                + '<button class="btn btn-danger btn-sm" onclick="deleteTag(' + t.id + ')">删除</button>'
                + '</td></tr>';
        }).join('');
    }

    function openTagEditor(id) {
        document.getElementById('tag-modal').classList.add('active');
        document.getElementById('tag-form').reset();
        document.getElementById('tag-edit-id').value = '';
        document.getElementById('tag-color').value = '#6366f1';
        document.getElementById('tag-modal-title').textContent = id ? '编辑标签' : '新建标签';
        // 重置颜色选择
        document.querySelectorAll('#tag-color-presets .tag-color-dot').forEach(function(d) {
            d.classList.toggle('active', d.dataset.color === '#6366f1');
        });
        document.getElementById('tag-color-picker').value = '#6366f1';

        if (id) {
            var tag = _allTags.find(function(t) { return t.id === id; });
            if (tag) {
                document.getElementById('tag-edit-id').value = tag.id;
                document.getElementById('tag-name').value = tag.name || '';
                document.getElementById('tag-slug').value = tag.slug || '';
                document.getElementById('tag-color').value = tag.color || '#6366f1';
                document.getElementById('tag-color-picker').value = tag.color || '#6366f1';
                document.querySelectorAll('#tag-color-presets .tag-color-dot').forEach(function(d) {
                    d.classList.toggle('active', d.dataset.color === (tag.color || '#6366f1'));
                });
            }
        }
    }

    function closeTagEditor() {
        document.getElementById('tag-modal').classList.remove('active');
    }

    function selectTagColor(el) {
        var color = el.dataset.color;
        document.getElementById('tag-color').value = color;
        document.getElementById('tag-color-picker').value = color;
        document.querySelectorAll('#tag-color-presets .tag-color-dot').forEach(function(d) {
            d.classList.remove('active');
        });
        el.classList.add('active');
    }

    async function saveTag(e) {
        e.preventDefault();
        var id = document.getElementById('tag-edit-id').value;
        var body = {
            name: document.getElementById('tag-name').value.trim(),
            slug: document.getElementById('tag-slug').value.trim(),
            color: document.getElementById('tag-color').value
        };
        if (!body.name) { alert('请输入标签名'); return; }

        var url = id ? '/api/tags/' + id : '/api/tags';
        var res = await apiFetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) { closeTagEditor(); loadTags(); }
        else if (res.status === 401) { alert('登录已过期'); logout(); }
        else {
            var errData = await res.json().catch(function() { return {}; });
            alert('保存失败: ' + (errData.error || res.status));
        }
    }

    async function deleteTag(id) {
        var tag = _allTags.find(function(t) { return t.id === id; });
        var name = tag ? tag.name : '';
        if (!confirm('确定删除标签"' + name + '"？')) return;
        var res = await apiFetch('/api/tags/' + id, {
            method: 'DELETE',
            headers: {}
        });
        if (res.ok) loadTags();
        else if (res.status === 401) { alert('登录已过期'); logout(); }
        else { alert('删除失败'); }
    }

    // ---- 文章编辑器中的标签选择器 ----
    function toggleTagSelector() {
        _tagSelectorOpen = !_tagSelectorOpen;
        var dropdown = document.getElementById('tag-selector-dropdown');
        if (_tagSelectorOpen) {
            loadTagSelector();
            dropdown.classList.add('open');
        } else {
            dropdown.classList.remove('open');
        }
    }

    function getSelectedArticleTags() {
        var val = document.getElementById('article-tags').value.trim();
        if (!val) return [];
        return val.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    }

    async function loadTagSelector() {
        var dropdown = document.getElementById('tag-selector-dropdown');
        if (!_allTags.length) {
            try {
                var res = await apiFetch('/api/tags');
                var data = await res.json();
                _allTags = data.tags || [];
            } catch (e) {
                dropdown.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.82rem;">加载失败</span>';
                return;
            }
        }
        if (!_allTags.length) {
            dropdown.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.82rem;">暂无标签，请先到标签管理中创建</span>';
            return;
        }
        var selected = getSelectedArticleTags();
        dropdown.innerHTML = _allTags.map(function(t) {
            var isSelected = selected.indexOf(t.name) >= 0;
            var cls = 'tag-selector-item' + (isSelected ? ' selected' : '');
            return '<span class="' + cls + '" style="background:' + escapeHtml(t.color || '#6366f1') + '" onclick="addTagToSelector(\'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')">' + escapeHtml(t.name) + '</span>';
        }).join('');
        updateArticleTagChips();
    }

    function addTagToSelector(name) {
        var input = document.getElementById('article-tags');
        var current = getSelectedArticleTags();
        if (current.indexOf(name) >= 0) return;
        current.push(name);
        input.value = current.join(', ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        loadTagSelector();
    }

    function removeTagChip(name) {
        var input = document.getElementById('article-tags');
        var current = getSelectedArticleTags();
        current = current.filter(function(t) { return t !== name; });
        input.value = current.join(', ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateArticleTagChips();
        if (_tagSelectorOpen) loadTagSelector();
    }

    function updateArticleTagChips() {
        var container = document.getElementById('article-tag-chips');
        var selected = getSelectedArticleTags();
        if (!selected.length) { container.innerHTML = ''; return; }
        var colorMap = {};
        _allTags.forEach(function(t) { colorMap[t.name] = t.color || '#6366f1'; });
        container.innerHTML = selected.map(function(name) {
            var color = colorMap[name] || '#6b7280';
            return '<span class="tag-chip" style="background:' + escapeHtml(color) + '">'
                + escapeHtml(name)
                + '<span class="tag-chip-remove" onclick="removeTagChip(\'' + escapeHtml(name).replace(/'/g, "\\'") + '\')">&times;</span>'
                + '</span>';
        }).join('');
    }

    // ---- 暴露到全局 ----
    window._allTags = _allTags;
    window._tagSelectorOpen = _tagSelectorOpen;
    window.loadTags = loadTags;
    window.renderTagsTable = renderTagsTable;
    window.openTagEditor = openTagEditor;
    window.closeTagEditor = closeTagEditor;
    window.selectTagColor = selectTagColor;
    window.saveTag = saveTag;
    window.deleteTag = deleteTag;
    window.toggleTagSelector = toggleTagSelector;
    window.getSelectedArticleTags = getSelectedArticleTags;
    window.loadTagSelector = loadTagSelector;
    window.addTagToSelector = addTagToSelector;
    window.removeTagChip = removeTagChip;
    window.updateArticleTagChips = updateArticleTagChips;
})();
