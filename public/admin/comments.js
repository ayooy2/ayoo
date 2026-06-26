(function() {
    // ---- 评论管理面板 ----
    var _allComments = [];
    var _cpFilter = { article: '', name: '', content: '' };
    var _cpSort = { key: 'created_at', dir: 'desc' };

    function showCommentPanel() {
        var area = document.getElementById('article-list-area');
        try {
            area.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--color-text-muted);">加载评论...</div>';
            apiFetch('/api/comments?all=1', { headers: {} })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    _allComments = d.comments || [];
                    _cpFilter = { article: '', name: '', content: '' };
                    _cpSort = { key: 'created_at', dir: 'desc' };
                    renderCommentPanel();
                })
                .catch(function() {
                    area.innerHTML = '<p style="text-align:center;color:var(--color-danger);padding:2rem;">加载失败</p>';
                });
        } catch(e) {
            area.innerHTML = '<p style="text-align:center;color:var(--color-danger);padding:2rem;">加载失败</p>';
        }
    }

    function renderCommentPanel() {
        var area = document.getElementById('article-list-area');
        // 收集文章列表用于筛选下拉
        var articles = {};
        _allComments.forEach(function(c) {
            if (c.article_id && !articles[c.article_id]) articles[c.article_id] = c.article_title || ('文章#' + c.article_id);
        });
        var articleOpts = '<option value="">全部文章</option>';
        Object.keys(articles).forEach(function(id) {
            var sel = _cpFilter.article === id ? ' selected' : '';
            articleOpts += '<option value="' + id + '"' + sel + '>' + escapeHtml(articles[id]) + '</option>';
        });

        var html = '<div class="cp-toolbar">'
            + '<button class="btn btn-secondary btn-sm" onclick="loadArticles()">← 返回文章列表</button>'
            + '<div class="cp-sep"></div>'
            + '<label>文章</label><select id="cp-filter-article" onchange="cpFilterChange()">' + articleOpts + '</select>'
            + '<label>昵称</label><input type="text" id="cp-filter-name" placeholder="搜索昵称" value="' + escapeHtml(_cpFilter.name) + '" oninput="cpFilterChange()">'
            + '<label>内容</label><input type="text" id="cp-filter-content" placeholder="搜索内容" value="' + escapeHtml(_cpFilter.content) + '" oninput="cpFilterChange()">'
            + '</div>'
            + '<div class="batch-bar" id="cp-batch-bar">'
            + '<span>已选 <span class="count" id="cp-selected-count">0</span> 条</span>'
            + '<button class="btn btn-danger btn-sm" onclick="batchDeleteComments()">批量删除</button>'
            + '</div>'
            + '<div id="cp-table-area"></div>';
        area.innerHTML = html;
        renderCommentTable();
    }

    function cpFilterChange() {
        _cpFilter.article = document.getElementById('cp-filter-article').value;
        _cpFilter.name = (document.getElementById('cp-filter-name').value || '').trim().toLowerCase();
        _cpFilter.content = (document.getElementById('cp-filter-content').value || '').trim().toLowerCase();
        renderCommentTable();
    }

    function getFilteredComments() {
        return _allComments.filter(function(c) {
            if (_cpFilter.article && String(c.article_id) !== _cpFilter.article) return false;
            if (_cpFilter.name && (c.author_name || '').toLowerCase().indexOf(_cpFilter.name) < 0) return false;
            if (_cpFilter.content && (c.content || '').toLowerCase().indexOf(_cpFilter.content) < 0) return false;
            return true;
        });
    }

    function cpSort(key) {
        if (_cpSort.key === key) {
            _cpSort.dir = _cpSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _cpSort.key = key;
            _cpSort.dir = key === 'created_at' ? 'desc' : 'asc';
        }
        renderCommentTable();
    }

    function renderCommentTable() {
        var filtered = getFilteredComments();
        // 排序
        filtered.sort(function(a, b) {
            var va = '', vb = '';
            if (_cpSort.key === 'created_at') { va = a.created_at || ''; vb = b.created_at || ''; }
            else if (_cpSort.key === 'author_name') { va = (a.author_name || '').toLowerCase(); vb = (b.author_name || '').toLowerCase(); }
            else if (_cpSort.key === 'article') { va = (a.article_title || '').toLowerCase(); vb = (b.article_title || '').toLowerCase(); }
            if (va < vb) return _cpSort.dir === 'asc' ? -1 : 1;
            if (va > vb) return _cpSort.dir === 'asc' ? 1 : -1;
            return 0;
        });

        var sortClass = function(key) {
            if (_cpSort.key !== key) return 'sortable';
            return 'sortable sort-' + _cpSort.dir;
        };

        var html = '<table class="data-table comment-table"><thead><tr>'
            + '<th class="cb-cell"><input type="checkbox" id="cp-select-all" onchange="cpToggleAll(this)"></th>'
            + '<th class="' + sortClass('author_name') + '" onclick="cpSort(\'author_name\')">昵称</th>'
            + '<th>内容</th>'
            + '<th class="' + sortClass('article') + '" onclick="cpSort(\'article\')">文章</th>'
            + '<th class="' + sortClass('created_at') + '" onclick="cpSort(\'created_at\')">时间</th>'
            + '<th>操作</th>'
            + '</tr></thead><tbody>';

        if (!filtered.length) {
            html += '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:2rem;">暂无匹配评论</td></tr>';
        } else {
            for (var i = 0; i < filtered.length; i++) {
                var c = filtered[i];
                var time = (c.created_at || '').slice(0, 16).replace('T', ' ');
                var content = (c.content || '').length > 80 ? c.content.slice(0, 80) + '...' : (c.content || '');
                var prefix = c.parent_id ? '<span class="comment-reply-tag">回复</span> ' : '';
                html += '<tr>'
                    + '<td class="cb-cell"><input type="checkbox" class="cp-cb" data-id="' + c.id + '" onchange="cpUpdateSelected()"></td>'
                    + '<td style="white-space:nowrap;">' + prefix + escapeHtml(c.author_name || '') + '</td>'
                    + '<td>' + escapeHtml(content) + '</td>'
                    + '<td><a href="/blog/' + (c.article_slug || '') + '" target="_blank" style="color:var(--color-primary);text-decoration:none;font-size:0.82rem;">' + escapeHtml(c.article_title || '') + '</a></td>'
                    + '<td style="white-space:nowrap;font-size:0.8rem;">' + time + '</td>'
                    + '<td><button class="btn btn-sm btn-danger" onclick="deleteSingleComment(' + c.id + ')">删除</button></td>'
                    + '</tr>';
            }
        }
        html += '</tbody></table>';
        document.getElementById('cp-table-area').innerHTML = html;
        cpUpdateSelected();
    }

    function cpToggleAll(el) {
        var cbs = document.querySelectorAll('.cp-cb');
        for (var i = 0; i < cbs.length; i++) cbs[i].checked = el.checked;
        cpUpdateSelected();
    }

    function cpUpdateSelected() {
        var cbs = document.querySelectorAll('.cp-cb:checked');
        var count = cbs.length;
        document.getElementById('cp-selected-count').textContent = count;
        var bar = document.getElementById('cp-batch-bar');
        if (count > 0) bar.classList.add('active'); else bar.classList.remove('active');
        // 更新全选 checkbox 状态
        var all = document.querySelectorAll('.cp-cb');
        var sa = document.getElementById('cp-select-all');
        if (all.length === 0) { sa.checked = false; sa.indeterminate = false; }
        else if (count === all.length) { sa.checked = true; sa.indeterminate = false; }
        else { sa.checked = false; sa.indeterminate = true; }
    }

    function deleteSingleComment(id) {
        if (!confirm('确定删除这条评论及其所有回复？')) return;
        try {
            apiFetch('/api/comments/' + id, {
                method: 'DELETE',
                headers: {}
            }).then(function(r) { if (!r.ok) throw new Error(); })
            .then(function() {
                // 递归收集所有后代 id
                var toRemove = [id];
                var changed = true;
                while (changed) {
                    changed = false;
                    for (var i = 0; i < _allComments.length; i++) {
                        if (toRemove.indexOf(_allComments[i].parent_id) >= 0 && toRemove.indexOf(_allComments[i].id) < 0) {
                            toRemove.push(_allComments[i].id);
                            changed = true;
                        }
                    }
                }
                _allComments = _allComments.filter(function(c) { return toRemove.indexOf(c.id) < 0; });
                renderCommentPanel();
            })
            .catch(function() { alert('删除失败'); });
        } catch(e) { alert('删除失败'); }
    }

    function batchDeleteComments() {
        try {
            var cbs = document.querySelectorAll('.cp-cb:checked');
            var ids = [];
            for (var i = 0; i < cbs.length; i++) ids.push(parseInt(cbs[i].dataset.id));
            if (!ids.length) return;
            if (!confirm('确定删除选中的 ' + ids.length + ' 条评论及其回复？')) return;
            var btn = document.querySelector('#cp-batch-bar .btn-danger');
            if (btn) { btn.disabled = true; btn.textContent = '删除中...'; }
            Promise.all(ids.map(function(id) {
                return apiFetch('/api/comments/' + id, {
                    method: 'DELETE',
                    headers: {}
                }).then(function(r) { return r.ok ? id : null; });
            })).then(function(results) {
                var deleted = results.filter(Boolean);
                _allComments = _allComments.filter(function(c) { return deleted.indexOf(c.id) < 0; });
                renderCommentPanel();
            }).catch(function() {
                alert('部分删除失败');
                showCommentPanel();
            });
        } catch(e) { alert('删除失败'); }
    }

    // ---- 暴露到全局 ----
    window._allComments = _allComments;
    window._cpFilter = _cpFilter;
    window._cpSort = _cpSort;
    window.showCommentPanel = showCommentPanel;
    window.renderCommentPanel = renderCommentPanel;
    window.cpFilterChange = cpFilterChange;
    window.getFilteredComments = getFilteredComments;
    window.cpSort = cpSort;
    window.renderCommentTable = renderCommentTable;
    window.cpToggleAll = cpToggleAll;
    window.cpUpdateSelected = cpUpdateSelected;
    window.deleteSingleComment = deleteSingleComment;
    window.batchDeleteComments = batchDeleteComments;
})();
