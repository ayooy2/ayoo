(function() {
    // ---- 文章管理 ----
    var _commentMap = {};
    var _articleData = { published: [], drafts: [] };
    var _undoStack = [];
    var _redoStack = [];
    var _lastSavedValue = null;
    var _autoSaveTimer = null;
    var AUTOSAVE_KEY = 'ayoo_draft';

    // Markdown 工具栏命令表
    var MD_CMDS = {
        bold:       { before: '**',     after: '**',        ph: '加粗文字',   inline: true },
        italic:     { before: '*',      after: '*',         ph: '斜体文字',   inline: true },
        strike:     { before: '~~',     after: '~~',        ph: '删除线文字', inline: true },
        code:       { before: '`',      after: '`',         ph: '代码',       inline: true },
        link:       { before: '[',      after: '](url)',    ph: '链接文字',   inline: true },
        image:      { before: '![',     after: '](url)',    ph: '图片描述',   inline: true },
        h1:         { before: '# ',     after: '',          ph: '标题',       block: true },
        h2:         { before: '## ',    after: '',          ph: '二级标题',   block: true },
        h3:         { before: '### ',   after: '',          ph: '三级标题',   block: true },
        quote:      { before: '> ',     after: '',          ph: '引用内容',   block: true },
        ul:         { before: '- ',     after: '',          ph: '列表项',     block: true },
        ol:         { before: '1. ',    after: '',          ph: '列表项',     block: true },
        codeblock:  { before: '```\n',  after: '\n```',     ph: '代码',       block: true },
        table:      { before: '| 列1 | 列2 |\n| ----- | ----- |\n| ', after: ' |\n', ph: '内容', block: true },
        hr:         { before: '\n---\n', after: '',         ph: '',           block: true }
    };

    // ---- 文章列表 ----
    async function loadArticles() {
        try {
            var [articlesRes, commentsRes] = await Promise.all([
                apiFetch('/api/articles?all=1'),
                apiFetch('/api/comments?all=1', { headers: {} })
            ]);
            var articlesData = await articlesRes.json();
            var commentsData = await commentsRes.json();
            _commentMap = {};
            (commentsData.comments || []).forEach(function(c) {
                if (!_commentMap[c.article_id]) _commentMap[c.article_id] = [];
                _commentMap[c.article_id].push(c);
            });
            renderArticleList(articlesData.articles || []);
        } catch(e) {
            document.getElementById('article-list-area').innerHTML = '<p style="text-align:center;color:var(--color-danger);padding:2rem;">加载失败</p>';
        }
    }

    function isArticlePublished(a) {
        if (a.scheduled_at) {
            var sd = new Date(a.scheduled_at + (a.scheduled_at.includes('Z') ? '' : 'Z'));
            return sd <= new Date() ? true : false;
        }
        return !!a.is_published;
    }

    function isArticleScheduled(a) {
        if (!a.scheduled_at) return false;
        var sd = new Date(a.scheduled_at + (a.scheduled_at.includes('Z') ? '' : 'Z'));
        return sd > new Date();
    }

    function formatArticleStatus(a) {
        if (isArticleScheduled(a)) {
            var sd = new Date(a.scheduled_at + (a.scheduled_at.includes('Z') ? '' : 'Z'));
            return '<span class="status-tag status-scheduled">⏰ ' + sd.toLocaleDateString('zh-CN') + ' ' + sd.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) + '</span>';
        }
        if (a.is_published) return '<span class="status-tag status-published">● 已发布</span>';
        return '<span class="status-tag status-draft">○ 草稿</span>';
    }

    function buildArticleRow(a) {
        var time = (a.created_at || '').slice(0, 10);
        var cc = (_commentMap[a.id] || []).length;
        var ccHtml = cc ? ' <span class="comment-count-badge">' + cc + '</span>' : '';
        return '<tr><td><strong>' + escapeHtml(a.title) + '</strong>' + ccHtml + '</td><td>' + escapeHtml(a.author) + '</td><td>' + formatArticleStatus(a) + '</td><td>' + escapeHtml(a.tags||'') + '</td><td>' + time + '</td><td class="actions"><button class="btn btn-secondary btn-sm" onclick="editArticle(' + a.id + ')">编辑</button><button class="btn btn-danger btn-sm" onclick="deleteArticle(' + a.id + ')">删除</button></td></tr>';
    }

    function renderArticleList(articles) {
        var area = document.getElementById('article-list-area');
        if (!articles.length) {
            area.innerHTML = '<p style="text-align:center;color:var(--color-text-placeholder);padding:2rem;">暂无文章，点击上方按钮写一篇</p>';
            return;
        }

        _articleData.published = [];
        _articleData.drafts = [];
        for (var i = 0; i < articles.length; i++) {
            if (isArticlePublished(articles[i]) || isArticleScheduled(articles[i])) {
                _articleData.published.push(articles[i]);
            } else {
                _articleData.drafts.push(articles[i]);
            }
        }

        var html = '<div class="article-tabs">'
            + '<button class="article-tab active" onclick="switchArticleTab(this,\'published\')">已发布 <span class="tab-count">' + _articleData.published.length + '</span></button>'
            + '<button class="article-tab" onclick="switchArticleTab(this,\'drafts\')">草稿 <span class="tab-count">' + _articleData.drafts.length + '</span></button>'
            + '</div>'
            + '<div id="article-tab-content"></div>';

        area.innerHTML = html;
        renderArticleTabContent('published');
    }

    function switchArticleTab(btn, tab) {
        var tabs = document.querySelectorAll('.article-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        btn.classList.add('active');
        renderArticleTabContent(tab);
    }

    function renderArticleTabContent(tab) {
        var list = _articleData[tab];
        var container = document.getElementById('article-tab-content');
        if (!list.length) {
            container.innerHTML = '<p class="empty-hint">' + (tab === 'published' ? '暂无已发布文章' : '暂无草稿') + '</p>';
            return;
        }
        var thead = '<thead><tr><th>标题</th><th>作者</th><th>状态</th><th>标签</th><th>日期</th><th style="width:140px;">操作</th></tr></thead>';
        container.innerHTML = '<table class="data-table">' + thead + '<tbody>' + list.map(buildArticleRow).join('') + '</tbody></table>';
    }

    // ---- 文章编辑器 ----
    function openArticleEditor(id) {
        document.getElementById('article-modal').classList.add('active');
        document.getElementById('article-form').reset();
        document.getElementById('article-edit-id').value = '';
        document.getElementById('article-preview').innerHTML = '';
        document.getElementById('article-modal-title').textContent = '写文章';
        document.getElementById('schedule-datetime').style.display = 'none';
        // 清空撤销栈
        _undoStack = []; _redoStack = []; _lastSavedValue = null;

        if (id) {
            document.getElementById('article-modal-title').textContent = '编辑文章';
            apiFetch('/api/articles/' + id).then(function(r){return r.json();}).then(function(a){
                document.getElementById('article-edit-id').value = a.id;
                document.getElementById('article-title').value = a.title || '';
                document.getElementById('article-slug').value = a.slug || '';
                document.getElementById('article-summary').value = a.summary || '';
                document.getElementById('article-cover').value = a.cover_image || '';
                document.getElementById('article-content-md').value = a.content_md || '';
                document.getElementById('article-author').value = a.author || 'Admin';
                document.getElementById('article-tags').value = a.tags || '';
                updateArticleTagChips();
                if (a.scheduled_at) {
                    var d = new Date(a.scheduled_at + (a.scheduled_at.includes('Z') ? '' : 'Z'));
                    var pad = function(n) { return n < 10 ? '0' + n : n; };
                    document.getElementById('article-scheduled').value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
                }
                updateArticlePreview();
                document.getElementById('article-content-md').focus();
            });
        } else {
            var draft = loadDraft();
            if (draft && draft.content) {
                restoreDraft(draft);
            } else {
                updateArticleTagChips();
            }
        }
    }

    function closeArticleEditor() {
        document.getElementById('article-modal').classList.remove('active');
        // 关闭时如果有内容，自动保存一次草稿
        var content = document.getElementById('article-content-md').value;
        if (content) scheduleAutoSave();
    }

    function toggleSchedule() {
        var el = document.getElementById('schedule-datetime');
        el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }

    async function doPublish(mode) {
        var title = document.getElementById('article-title').value.trim();
        if (!title) { alert('请填写标题'); return; }
        var id = document.getElementById('article-edit-id').value;
        var scheduledVal = document.getElementById('article-scheduled').value;
        if (mode === 'schedule' && !scheduledVal) { alert('请选择定时发布时间'); return; }

        var body = {
            title: title,
            slug: document.getElementById('article-slug').value.trim(),
            summary: document.getElementById('article-summary').value.trim(),
            cover_image: document.getElementById('article-cover').value.trim(),
            content_md: document.getElementById('article-content-md').value,
            author: document.getElementById('article-author').value.trim(),
            tags: document.getElementById('article-tags').value.trim(),
            is_published: mode === 'publish' ? 1 : 0,
            scheduled_at: mode === 'schedule' ? scheduledVal : null
        };

        var url = id ? '/api/articles/' + id : '/api/articles';
        var res = await apiFetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) { clearDraft(); closeArticleEditor(); loadArticles(); }
        else if (res.status === 401) { alert('登录已过期'); logout(); }
        else { alert('操作失败: ' + ((await res.json()).error || '')); }
    }

    async function deleteArticle(id) {
        if (!confirm('确定删除这篇文章？相关评论和点赞也会被删除。')) return;
        var res = await apiFetch('/api/articles/' + id, {
            method: 'DELETE',
            headers: {}
        });
        if (res.ok) loadArticles();
        else if (res.status === 401) { alert('登录已过期'); logout(); }
    }

    function editArticle(id) { openArticleEditor(id); }

    // ---- Markdown 快速插入 ----
    function _saveUndoState(ta) {
        var current = ta.value;
        if (current === _lastSavedValue) return;
        _undoStack.push({ value: current, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
        if (_undoStack.length > 50) _undoStack.shift();
        _redoStack = [];
        _lastSavedValue = current;
    }

    function _undo(ta) {
        if (!_undoStack.length) return;
        _redoStack.push({ value: ta.value, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
        var state = _undoStack.pop();
        ta.value = state.value;
        ta.selectionStart = state.selStart;
        ta.selectionEnd = state.selEnd;
        _lastSavedValue = state.value;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function _redo(ta) {
        if (!_redoStack.length) return;
        _undoStack.push({ value: ta.value, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
        var state = _redoStack.pop();
        ta.value = state.value;
        ta.selectionStart = state.selStart;
        ta.selectionEnd = state.selEnd;
        _lastSavedValue = state.value;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function insertMD(type) {
        var cmd = MD_CMDS[type];
        if (!cmd) { console.warn('Unknown MD command:', type); return; }
        var ta = document.getElementById('article-content-md');
        if (!ta) { console.error('Textarea not found'); return; }

        ta.focus();

        requestAnimationFrame(function() {
            try {
                var s = ta.selectionStart, e = ta.selectionEnd;
                var val = ta.value;
                var sel = val.substring(s, e);
                var hasSel = s !== e;
                var text = sel || cmd.ph;
                var result;

                if (cmd.block) {
                    var ls = val.lastIndexOf('\n', s - 1) + 1;
                    var lineBefore = val.substring(ls, s);

                    if (hasSel && sel.indexOf('\n') !== -1) {
                        result = sel.split('\n').map(function(l) { return cmd.before + l; }).join('\n') + cmd.after;
                    } else if (lineBefore.trim() === '') {
                        result = cmd.before + text + cmd.after;
                    } else {
                        result = '\n' + cmd.before + text + cmd.after;
                    }
                } else {
                    result = cmd.before + text + cmd.after;
                }

                _saveUndoState(ta);

                var newVal = val.substring(0, s) + result + val.substring(e);
                ta.value = newVal;

                if (cmd.inline && !hasSel) {
                    ta.selectionStart = s + cmd.before.length;
                    ta.selectionEnd = s + cmd.before.length + text.length;
                } else {
                    ta.selectionStart = ta.selectionEnd = s + result.length;
                }

                ta.dispatchEvent(new Event('input', { bubbles: true }));

            } catch(err) {
                console.error('insertMD error:', err);
                alert('工具栏操作失败: ' + err.message);
            }
        });
    }

    // ---- Markdown 预览 ----
    function updateArticlePreview() {
        var md = document.getElementById('article-content-md').value || '';
        var chars = md.length;
        var words = md.trim() ? md.trim().split(/\s+/).length : 0;
        document.getElementById('md-status').textContent = chars + ' 字符 · ' + words + ' 词';
        var preview = document.getElementById('article-preview');
        if (!md) { preview.innerHTML = ''; return; }
        try {
            if (typeof marked !== 'undefined' && marked.parse) {
                preview.innerHTML = marked.parse(md);
            } else {
                preview.innerHTML = '<em style="color:var(--color-text-muted);">marked.js 加载中...</em>';
                setTimeout(updateArticlePreview, 300);
            }
        } catch(e) {
            preview.innerHTML = '<em style="color:var(--color-danger);">Markdown 解析错误</em>';
        }
    }

    // ---- 自动保存 ----
    function scheduleAutoSave() {
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(autoSave, 300);
    }

    function autoSave() {
        var data = {
            title: document.getElementById('article-title').value,
            slug: document.getElementById('article-slug').value,
            summary: document.getElementById('article-summary').value,
            cover: document.getElementById('article-cover').value,
            content: document.getElementById('article-content-md').value,
            author: document.getElementById('article-author').value,
            tags: document.getElementById('article-tags').value,
            scheduled: document.getElementById('article-scheduled').value,
            ts: Date.now()
        };
        try {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
            var hint = document.getElementById('auto-save-hint');
            hint.classList.add('show');
            setTimeout(function() { hint.classList.remove('show'); }, 1500);
        } catch(e) { /* localStorage 满了就忽略 */ }
    }

    function loadDraft() {
        try {
            var raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch(e) { return null; }
    }

    function clearDraft() {
        localStorage.removeItem(AUTOSAVE_KEY);
    }

    function restoreDraft(draft) {
        if (!draft) return;
        document.getElementById('article-edit-id').value = '';
        document.getElementById('article-title').value = draft.title || '';
        document.getElementById('article-slug').value = draft.slug || '';
        document.getElementById('article-summary').value = draft.summary || '';
        document.getElementById('article-cover').value = draft.cover || '';
        document.getElementById('article-content-md').value = draft.content || '';
        document.getElementById('article-author').value = draft.author || 'Admin';
        document.getElementById('article-tags').value = draft.tags || '';
        updateArticleTagChips();
        if (draft.scheduled) {
            document.getElementById('article-scheduled').value = draft.scheduled;
        }
        document.getElementById('article-content-md').dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 监听所有表单字段的输入，触发自动保存
    function bindAutoSaveListeners() {
        var fields = ['article-title','article-slug','article-summary','article-cover','article-content-md','article-author','article-tags','article-scheduled'];
        fields.forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            if (id === 'article-content-md') {
                el.addEventListener('input', function() { updateArticlePreview(); scheduleAutoSave(); });
            } else if (id === 'article-tags') {
                el.addEventListener('input', function() { updateArticleTagChips(); scheduleAutoSave(); });
            } else {
                el.addEventListener('input', scheduleAutoSave);
            }
        });
    }

    // ---- 导入 .md 文件 ----
    function importMDFile(input) {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('文件不能超过 2MB'); input.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            var ta = document.getElementById('article-content-md');
            var existing = ta.value;
            if (existing && !confirm('当前编辑器已有内容，导入会覆盖。确定继续？')) { input.value = ''; return; }
            ta.value = e.target.result;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            var titleEl = document.getElementById('article-title');
            if (!titleEl.value) {
                var name = file.name.replace(/\.(md|txt|markdown)$/i, '');
                titleEl.value = name;
                document.getElementById('article-slug').value = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
            updateArticlePreview();
            scheduleAutoSave();
        };
        reader.readAsText(file);
        input.value = '';
    }

    // ---- 暴露到全局 ----
    window._commentMap = _commentMap;
    window._articleData = _articleData;
    window.loadArticles = loadArticles;
    window.isArticlePublished = isArticlePublished;
    window.isArticleScheduled = isArticleScheduled;
    window.formatArticleStatus = formatArticleStatus;
    window.buildArticleRow = buildArticleRow;
    window.renderArticleList = renderArticleList;
    window.switchArticleTab = switchArticleTab;
    window.renderArticleTabContent = renderArticleTabContent;
    window.openArticleEditor = openArticleEditor;
    window.closeArticleEditor = closeArticleEditor;
    window.toggleSchedule = toggleSchedule;
    window.doPublish = doPublish;
    window.deleteArticle = deleteArticle;
    window.editArticle = editArticle;
    window.MD_CMDS = MD_CMDS;
    window._saveUndoState = _saveUndoState;
    window._undo = _undo;
    window._redo = _redo;
    window.insertMD = insertMD;
    window.updateArticlePreview = updateArticlePreview;
    window.scheduleAutoSave = scheduleAutoSave;
    window.autoSave = autoSave;
    window.loadDraft = loadDraft;
    window.clearDraft = clearDraft;
    window.restoreDraft = restoreDraft;
    window.bindAutoSaveListeners = bindAutoSaveListeners;
    window.importMDFile = importMDFile;
})();
