(function() {
    'use strict';

    // ============================================================
    // 常量 & 配置
    // ============================================================
    var AUTOSAVE_KEY = 'ayoo_editor_draft';
    var AUTOSAVE_DELAY = 3000;
    var API = {
        getArticle:  function(id) { return '/api/articles/' + id; },
        createArticle: '/api/articles',
        updateArticle: function(id) { return '/api/articles/' + id; },
        tags: '/api/tags',
        uploadImage: '/api/images'
    };

    // Markdown 工具栏命令表
    var MD_CMDS = {
        bold:       { before: '**',     after: '**',        ph: '加粗文字',   inline: true },
        italic:     { before: '*',      after: '*',         ph: '斜体文字',   inline: true },
        strike:     { before: '~~',     after: '~~',        ph: '删除线文字', inline: true },
        code:       { before: '`',      after: '`',         ph: '代码',       inline: true },
        link:       { before: '[',      after: '](url)',    ph: '链接文字',   inline: true },
        image:      { before: '![',     after: '](url)',    ph: '图片描述',   inline: true },
        h2:         { before: '## ',    after: '',          ph: '二级标题',   block: true },
        h3:         { before: '### ',   after: '',          ph: '三级标题',   block: true },
        heading:    { before: '## ',    after: '',          ph: '标题',       block: true },
        quote:      { before: '> ',     after: '',          ph: '引用内容',   block: true },
        ul:         { before: '- ',     after: '',          ph: '列表项',     block: true },
        ol:         { before: '1. ',    after: '',          ph: '列表项',     block: true },
        codeblock:  { before: '```\n',  after: '\n```',     ph: '代码',       block: true },
        codeBlock:  { before: '```\n',  after: '\n```',     ph: '代码',       block: true },
        table:      { before: '| 列1 | 列2 |\n| ----- | ----- |\n| ', after: ' |\n', ph: '内容', block: true },
        hr:         { before: '\n---\n', after: '',         ph: '',           block: true }
    };

    // 斜杠命令列表
    var SLASH_COMMANDS = [
        { key: 'h2',    icon: 'H2',     name: '二级标题',   cmd: 'h2' },
        { key: 'h3',    icon: 'H3',     name: '三级标题',   cmd: 'h3' },
        { key: 'quote', icon: '“',  name: '引用块',     cmd: 'quote' },
        { key: 'code',  icon: '{ }',    name: '代码块',     cmd: 'codeblock' },
        { key: 'ul',    icon: '•',  name: '无序列表',   cmd: 'ul' },
        { key: 'ol',    icon: '1.',     name: '有序列表',   cmd: 'ol' },
        { key: 'hr',    icon: '—',  name: '分割线',     cmd: 'hr' },
        { key: 'table', icon: '■',  name: '表格',       cmd: 'table' },
        { key: 'image', icon: '📷', name: '图片',  cmd: 'image' },
        { key: 'link',  icon: '🔗', name: '链接',  cmd: 'link' }
    ];

    // ============================================================
    // 状态
    // ============================================================
    var state = {
        editId: null,
        isDirty: false,
        isSaving: false,
        lastSaved: null,
        slugManuallyEdited: false,
        sidebarOpen: false,
        tags: [],
        selectedTags: [],
        autoSaveTimer: null,
        undoStack: [],
        redoStack: [],
        lastSavedValue: null,
        slashMenuOpen: false,
        slashMenuIndex: 0,
        slashQuery: '',
        slashStartPos: 0,
        articleStatus: 'draft'  // draft, published, scheduled
    };

    // ============================================================
    // DOM 元素引用
    // ============================================================
    var dom = {};

    // ============================================================
    // 工具函数
    // ============================================================
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }
    function esc(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
    }

    function debounce(fn, delay) {
        var timer;
        return function() {
            var ctx = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
        };
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function formatTime(date) {
        if (!date) return '';
        var d = date instanceof Date ? date : new Date(date);
        return d.getFullYear() + '/' + pad2(d.getMonth()+1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    function relativeTime(date) {
        if (!date) return '';
        var d = date instanceof Date ? date : new Date(date);
        var diff = Date.now() - d.getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
        return formatTime(d);
    }

    function countWords(text) {
        if (!text) return 0;
        var chinese = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
        var english = text.replace(/[一-鿿㐀-䶿]/g, ' ').trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
        return chinese + english;
    }

    function calcReadTime(text) {
        var words = countWords(text);
        var minutes = Math.max(1, Math.ceil(words / 300));
        return '约 ' + minutes + ' 分钟';
    }

    function generateSlug(title) {
        if (!title) return '';
        var slug = title
            .toLowerCase()
            .replace(/[一-鿿㐀-䶿]+/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        if (!slug) slug = 'post-' + Date.now().toString(36);
        return slug.slice(0, 80);
    }

    async function apiFetch(url, opts) {
        opts = opts || {};
        if (!opts.headers) opts.headers = {};
        var token = localStorage.getItem('ayoo_token') || '';
        if (token && !opts.headers['Authorization']) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }
        return fetch(url, opts);
    }

    // ============================================================
    // 1. 初始化
    // ============================================================
    function init() {
        cacheDom();
        bindEvents();
        loadTags();

        var params = new URLSearchParams(window.location.search);
        var id = params.get('id');

        if (id) {
            state.editId = id;
            loadArticle(id);
        } else {
            var draft = loadDraftFromStorage();
            if (draft) {
                restoreDraft(draft);
            }
        }

        updateStatusBar();
        setupBeforeUnload();
    }

    function cacheDom() {
        dom.titleInput      = $('#editor-title');
        dom.contentArea     = $('#editor-content');
        dom.slugDisplay     = $('#editor-slug-display');
        dom.slugText        = $('#slug-text');
        dom.slugInput       = $('#editor-slug-input');
        dom.sidebarSlug     = $('#sidebar-slug');
        dom.summaryInput    = $('#sidebar-summary');
        dom.coverInput      = $('#sidebar-cover');
        dom.coverPreview    = $('#cover-preview');
        dom.coverUpload     = $('#sidebar-cover-upload');
        dom.authorInput     = $('#sidebar-author');
        dom.titlePreview    = $('#editor-title-preview');
        dom.saveStatus      = $('#editor-save-status');
        dom.publishBtn      = $('#editor-publish-btn');
        dom.publishDropdown = $('#publish-dropdown');
        dom.tagChips        = $('#sidebar-tag-chips');
        dom.tagInput        = $('#sidebar-tags-input');
        dom.tagPickBtn      = $('#sidebar-tag-pick');
        dom.tagPanel        = $('#tag-selector-panel');
        dom.sidebar         = $('#editor-sidebar');
        dom.sidebarToggle   = $('#sb-sidebar-toggle');
        dom.backBtn         = $('#editor-back');
        dom.floatingToolbar = $('#floating-toolbar');
        dom.slashMenu       = $('#slash-menu');
        dom.mobileToolbar   = $('#mobile-toolbar');
        dom.wordCount       = $('#sb-words');
        dom.readTime        = $('#sb-reading-time');
        dom.lastEditTime    = $('#sb-last-edit');
        dom.statusDisplay   = $('#article-status-display');
        dom.scheduleSection = $('#schedule-section');
        dom.scheduleInput   = $('#sidebar-schedule');
        dom.scheduleDialog  = $('#schedule-dialog-overlay');
        dom.scheduleTime    = $('#schedule-dialog-time');
    }

    // ============================================================
    // 2. 事件绑定
    // ============================================================
    function bindEvents() {
        // 标题输入
        if (dom.titleInput) {
            dom.titleInput.addEventListener('input', onTitleInput);
        }

        // 内容编辑区
        if (dom.contentArea) {
            dom.contentArea.addEventListener('input', onContentInput);
            dom.contentArea.addEventListener('keydown', onContentKeydown);
            dom.contentArea.addEventListener('mouseup', onContentMouseUp);
            dom.contentArea.addEventListener('keyup', onContentKeyUp);
            dom.contentArea.addEventListener('blur', function() {
                setTimeout(hideFloatingToolbar, 200);
            });
            // Tab 键插入缩进
            dom.contentArea.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    saveUndoState(dom.contentArea);
                    var s = dom.contentArea.selectionStart;
                    var end = dom.contentArea.selectionEnd;
                    if (e.shiftKey) {
                        var lineStart = dom.contentArea.value.lastIndexOf('\n', s - 1) + 1;
                        var lineText = dom.contentArea.value.substring(lineStart, s);
                        if (lineText.startsWith('  ')) {
                            dom.contentArea.value = dom.contentArea.value.substring(0, lineStart) + dom.contentArea.value.substring(lineStart + 2);
                            dom.contentArea.selectionStart = dom.contentArea.selectionEnd = Math.max(lineStart, s - 2);
                        }
                    } else {
                        dom.contentArea.value = dom.contentArea.value.substring(0, s) + '  ' + dom.contentArea.value.substring(end);
                        dom.contentArea.selectionStart = dom.contentArea.selectionEnd = s + 2;
                    }
                    dom.contentArea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }

        // Slug 显示点击 -> 编辑
        if (dom.slugDisplay) {
            dom.slugDisplay.addEventListener('click', function() {
                dom.slugDisplay.classList.add('hidden');
                dom.slugInput.classList.remove('hidden');
                dom.slugInput.value = dom.sidebarSlug.value || dom.slugText.textContent.replace(/^\//, '').trim();
                dom.slugInput.focus();
                dom.slugInput.select();
            });
        }

        // Slug 输入框失焦 -> 回到显示
        if (dom.slugInput) {
            dom.slugInput.addEventListener('blur', function() {
                var val = dom.slugInput.value.trim();
                dom.slugDisplay.classList.remove('hidden');
                dom.slugInput.classList.add('hidden');
                if (val) {
                    dom.slugText.textContent = '/ ' + val;
                    dom.sidebarSlug.value = val;
                } else {
                    dom.slugText.textContent = '/  slug 将自动生成';
                }
                state.slugManuallyEdited = !!val;
                markDirty();
            });
            dom.slugInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    dom.slugInput.blur();
                }
                if (e.key === 'Escape') {
                    dom.slugInput.blur();
                }
            });
        }

        // Sidebar slug 同步
        if (dom.sidebarSlug) {
            dom.sidebarSlug.addEventListener('input', function() {
                state.slugManuallyEdited = true;
                dom.slugText.textContent = '/ ' + (dom.sidebarSlug.value || 'slug 将自动生成');
                markDirty();
            });
        }

        // 摘要、封面输入
        if (dom.summaryInput) dom.summaryInput.addEventListener('input', markDirty);
        if (dom.coverInput) {
            dom.coverInput.addEventListener('input', function() {
                updateCoverPreview();
                markDirty();
            });
        }
        if (dom.authorInput) dom.authorInput.addEventListener('input', markDirty);

        // Markdown 工具栏按钮
        $$('.eh-tool-btn[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = this.getAttribute('data-action');
                if (action) insertMD(action);
            });
        });

        // 上传图片
        var uploadInput = $('#editor-upload-image');
        if (uploadInput) {
            uploadInput.addEventListener('change', onImageUpload);
        }

        // 发布按钮 + 下拉菜单
        if (dom.publishBtn) {
            dom.publishBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                togglePublishDropdown();
            });
        }
        $$('.eh-dropdown-item[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = this.getAttribute('data-action');
                closePublishDropdown();
                if (mode === 'schedule') {
                    showScheduleDialog();
                } else {
                    doPublish(mode);
                }
            });
        });

        // 侧边栏切换
        if (dom.sidebarToggle) {
            dom.sidebarToggle.addEventListener('click', toggleSidebar);
        }

        // 返回按钮
        if (dom.backBtn) {
            dom.backBtn.addEventListener('click', onBack);
        }

        // 封面上传
        if (dom.coverUpload) {
            dom.coverUpload.addEventListener('change', onCoverUpload);
        }

        // 标签输入
        if (dom.tagInput) {
            dom.tagInput.addEventListener('keydown', onTagInputKeydown);
        }

        // 标签选择面板切换
        if (dom.tagPickBtn) {
            dom.tagPickBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleTagPanel();
            });
        }

        // 浮动工具栏按钮
        $$('.eh-float-btn[data-action]').forEach(function(btn) {
            btn.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var action = this.getAttribute('data-action');
                if (action) insertMD(action);
                hideFloatingToolbar();
            });
        });

        // 斜杠命令菜单项点击
        $$('.eh-slash-item[data-cmd]').forEach(function(item) {
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var cmd = this.getAttribute('data-cmd');
                if (cmd) executeSlashCommand(MD_CMDS[cmd] ? cmd : cmd);
            });
            item.addEventListener('mouseenter', function() {
                $$('.eh-slash-item').forEach(function(el) { el.classList.remove('active'); });
                this.classList.add('active');
                var items = Array.prototype.slice.call($$('.eh-slash-item'));
                state.slashMenuIndex = items.indexOf(this);
            });
        });

        // 移动端底部工具栏
        $$('.eh-mt-btn[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = this.getAttribute('data-action');
                if (action === 'publish') {
                    togglePublishDropdown();
                } else if (action) {
                    insertMD(action);
                }
            });
        });

        // 定时发布对话框
        var scheduleCancel = $('#schedule-dialog-cancel');
        var scheduleConfirm = $('#schedule-dialog-confirm');
        if (scheduleCancel) {
            scheduleCancel.addEventListener('click', hideScheduleDialog);
        }
        if (scheduleConfirm) {
            scheduleConfirm.addEventListener('click', function() {
                if (dom.scheduleTime && !dom.scheduleTime.value) {
                    alert('请选择发布时间');
                    return;
                }
                if (dom.scheduleInput && dom.scheduleTime) {
                    dom.scheduleInput.value = dom.scheduleTime.value;
                }
                hideScheduleDialog();
                doPublish('schedule');
            });
        }

        // 全局点击关闭菜单
        document.addEventListener('click', onDocumentClick);

        // 全局快捷键
        document.addEventListener('keydown', onGlobalKeydown);

        // 移动端侧栏 backdrop（动态创建）
        if (window.innerWidth <= 768) {
            var backdrop = document.createElement('div');
            backdrop.id = 'sidebar-backdrop';
            document.body.appendChild(backdrop);
            backdrop.addEventListener('click', closeSidebar);
        }
    }

    // ============================================================
    // 3. 标题输入
    // ============================================================
    function onTitleInput() {
        var val = dom.titleInput.value;

        // 自动生成 slug
        if (!state.slugManuallyEdited) {
            var slug = generateSlug(val);
            if (dom.sidebarSlug) dom.sidebarSlug.value = slug;
            if (dom.slugText) dom.slugText.textContent = slug ? '/ ' + slug : '/  slug 将自动生成';
        }

        // 更新顶栏标题预览
        if (dom.titlePreview) {
            dom.titlePreview.textContent = val || '新文章';
        }

        markDirty();
        scheduleAutoSave();
    }

    // ============================================================
    // 4. Markdown 工具栏 - insertMD
    // ============================================================
    function insertMD(type) {
        var cmd = MD_CMDS[type];
        if (!cmd) { console.warn('Unknown MD command:', type); return; }
        var ta = dom.contentArea;
        if (!ta) return;

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

                saveUndoState(ta);

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
            }
        });
    }

    // ============================================================
    // 5. 斜杠命令
    // ============================================================
    function onContentInput() {
        markDirty();
        scheduleAutoSave();
        updateStatusBar();

        var ta = dom.contentArea;
        if (!ta) return;
        var pos = ta.selectionStart;
        var val = ta.value;

        var slashIdx = val.lastIndexOf('/', pos);
        if (slashIdx !== -1 && slashIdx >= pos - 20) {
            var charBefore = slashIdx > 0 ? val[slashIdx - 1] : '\n';
            if (charBefore === '\n' || charBefore === ' ' || slashIdx === 0) {
                var query = val.substring(slashIdx + 1, pos);
                if (query.indexOf(' ') === -1) {
                    state.slashStartPos = slashIdx;
                    showSlashMenu(query);
                    return;
                }
            }
        }
        hideSlashMenu();
    }

    function showSlashMenu(query) {
        var menu = dom.slashMenu;
        if (!menu) return;

        var filtered = SLASH_COMMANDS.filter(function(c) {
            if (!query) return true;
            return c.key.indexOf(query.toLowerCase()) !== -1 ||
                   c.name.indexOf(query) !== -1;
        });

        if (!filtered.length) {
            hideSlashMenu();
            return;
        }

        state.slashMenuOpen = true;
        state.slashQuery = query;
        state.slashMenuIndex = 0;

        // 更新菜单项高亮
        var items = menu.querySelectorAll('.eh-slash-item');
        items.forEach(function(item, i) {
            var cmd = item.getAttribute('data-cmd');
            var match = filtered.some(function(f) { return f.cmd === cmd; });
            item.style.display = match ? 'flex' : 'none';
            item.classList.toggle('active', i === 0 && match);
        });

        // 定位
        positionSlashMenu(menu);
        menu.classList.remove('hidden');
    }

    function hideSlashMenu() {
        state.slashMenuOpen = false;
        if (dom.slashMenu) {
            dom.slashMenu.classList.add('hidden');
        }
    }

    function positionSlashMenu(menu) {
        var ta = dom.contentArea;
        if (!ta) return;

        var mirror = document.createElement('div');
        var cs = getComputedStyle(ta);
        mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;'
            + 'font:' + cs.font
            + ';padding:' + cs.padding
            + ';width:' + ta.clientWidth + 'px'
            + ';line-height:' + cs.lineHeight;
        document.body.appendChild(mirror);

        var textBefore = ta.value.substring(0, state.slashStartPos);
        mirror.textContent = textBefore;

        var span = document.createElement('span');
        span.textContent = '|';
        mirror.appendChild(span);

        var taRect = ta.getBoundingClientRect();
        var spanRect = span.getBoundingClientRect();
        var mirrorRect = mirror.getBoundingClientRect();

        var top = taRect.top + (spanRect.top - mirrorRect.top) - ta.scrollTop + 24;
        var left = taRect.left + (spanRect.left - mirrorRect.left);

        if (top + 320 > window.innerHeight) {
            top = taRect.top + (spanRect.top - mirrorRect.top) - ta.scrollTop - 320 - 8;
        }

        menu.style.top = top + 'px';
        menu.style.left = Math.min(left, window.innerWidth - 240) + 'px';

        document.body.removeChild(mirror);
    }

    function executeSlashCommand(cmd) {
        var ta = dom.contentArea;
        if (!ta) return;

        var pos = ta.selectionStart;
        var val = ta.value;

        var before = val.substring(0, state.slashStartPos);
        var after = val.substring(pos);

        saveUndoState(ta);
        ta.value = before + after;
        ta.selectionStart = ta.selectionEnd = state.slashStartPos;

        hideSlashMenu();

        insertMD(cmd);
    }

    // ============================================================
    // 6. 浮动工具栏
    // ============================================================
    function onContentMouseUp() {
        checkSelection();
    }

    function onContentKeyUp(e) {
        if (e.shiftKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key) !== -1) {
            checkSelection();
        }
    }

    function checkSelection() {
        var ta = dom.contentArea;
        if (!ta) return;
        var s = ta.selectionStart, e = ta.selectionEnd;
        if (s !== e) {
            showFloatingToolbar(s, e);
        } else {
            hideFloatingToolbar();
        }
    }

    function showFloatingToolbar(selStart, selEnd) {
        var toolbar = dom.floatingToolbar;
        var ta = dom.contentArea;
        if (!toolbar || !ta) return;

        var mirror = document.createElement('div');
        var cs = getComputedStyle(ta);
        mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;'
            + 'font:' + cs.font
            + ';padding:' + cs.padding
            + ';width:' + ta.clientWidth + 'px'
            + ';line-height:' + cs.lineHeight;
        document.body.appendChild(mirror);

        var textBefore = ta.value.substring(0, selStart);
        var textSel = ta.value.substring(selStart, selEnd);

        mirror.textContent = textBefore;
        var startSpan = document.createElement('span');
        startSpan.textContent = textSel.substring(0, 1) || '|';
        mirror.appendChild(startSpan);

        var endSpan = document.createElement('span');
        endSpan.textContent = textSel.slice(1) || '';
        mirror.appendChild(endSpan);

        var taRect = ta.getBoundingClientRect();
        var startRect = startSpan.getBoundingClientRect();
        var mirrorRect = mirror.getBoundingClientRect();

        var top = taRect.top + (startRect.top - mirrorRect.top) - ta.scrollTop - 44;
        var left = taRect.left + (startRect.left - mirrorRect.left);

        if (top < 56) {
            top = taRect.top + (startRect.top - mirrorRect.top) - ta.scrollTop + 24;
        }

        toolbar.style.top = top + 'px';
        toolbar.style.left = Math.max(8, Math.min(left, window.innerWidth - 200)) + 'px';
        toolbar.classList.remove('hidden');

        document.body.removeChild(mirror);
    }

    function hideFloatingToolbar() {
        if (dom.floatingToolbar) {
            dom.floatingToolbar.classList.add('hidden');
        }
    }

    // ============================================================
    // 7. 快捷键
    // ============================================================
    function onContentKeydown(e) {
        var ta = dom.contentArea;
        if (!ta) return;

        if (state.slashMenuOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateSlashMenu(1);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSlashMenu(-1);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                var visibleItems = Array.prototype.slice.call($$('.eh-slash-item')).filter(function(el) {
                    return el.style.display !== 'none';
                });
                if (visibleItems[state.slashMenuIndex]) {
                    executeSlashCommand(visibleItems[state.slashMenuIndex].getAttribute('data-cmd'));
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                hideSlashMenu();
                return;
            }
        }
    }

    function navigateSlashMenu(dir) {
        var visibleItems = Array.prototype.slice.call($$('.eh-slash-item')).filter(function(el) {
            return el.style.display !== 'none';
        });
        if (!visibleItems.length) return;

        visibleItems[state.slashMenuIndex].classList.remove('active');
        state.slashMenuIndex = (state.slashMenuIndex + dir + visibleItems.length) % visibleItems.length;
        visibleItems[state.slashMenuIndex].classList.add('active');
        visibleItems[state.slashMenuIndex].scrollIntoView({ block: 'nearest' });
    }

    function onGlobalKeydown(e) {
        var isCtrl = e.ctrlKey || e.metaKey;

        if (isCtrl && e.key === 'b') {
            e.preventDefault();
            insertMD('bold');
        }
        if (isCtrl && e.key === 'i') {
            e.preventDefault();
            insertMD('italic');
        }
        if (isCtrl && e.key === 'k') {
            e.preventDefault();
            insertMD('link');
        }
        if (isCtrl && e.key === 's') {
            e.preventDefault();
            doPublish('draft');
        }
        if (isCtrl && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            redo();
        }
    }

    // ============================================================
    // 8. 撤销/重做
    // ============================================================
    function saveUndoState(ta) {
        var current = ta.value;
        if (current === state.lastSavedValue) return;
        state.undoStack.push({ value: current, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = [];
        state.lastSavedValue = current;
    }

    function undo() {
        var ta = dom.contentArea;
        if (!ta || !state.undoStack.length) return;
        state.redoStack.push({ value: ta.value, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
        var st = state.undoStack.pop();
        ta.value = st.value;
        ta.selectionStart = st.selStart;
        ta.selectionEnd = st.selEnd;
        state.lastSavedValue = st.value;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function redo() {
        var ta = dom.contentArea;
        if (!ta || !state.redoStack.length) return;
        state.undoStack.push({ value: ta.value, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
        var st = state.redoStack.pop();
        ta.value = st.value;
        ta.selectionStart = st.selStart;
        ta.selectionEnd = st.selEnd;
        state.lastSavedValue = st.value;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ============================================================
    // 9. 自动保存
    // ============================================================
    function scheduleAutoSave() {
        clearTimeout(state.autoSaveTimer);
        state.autoSaveTimer = setTimeout(autoSaveToStorage, AUTOSAVE_DELAY);
    }

    function autoSaveToStorage() {
        var data = collectFormData();
        if (!data.title && !data.content) return;

        try {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
            state.lastSaved = new Date();
            updateSaveStatus('saved');
        } catch(e) {
            console.error('Auto-save failed:', e);
        }
    }

    function loadDraftFromStorage() {
        try {
            var raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch(e) {
            return null;
        }
    }

    function clearDraftStorage() {
        localStorage.removeItem(AUTOSAVE_KEY);
    }

    function restoreDraft(draft) {
        if (!draft) return;
        if (dom.titleInput)    dom.titleInput.value = draft.title || '';
        if (dom.contentArea)   dom.contentArea.value = draft.content || '';
        if (dom.sidebarSlug)   dom.sidebarSlug.value = draft.slug || '';
        if (dom.summaryInput)  dom.summaryInput.value = draft.summary || '';
        if (dom.coverInput)    dom.coverInput.value = draft.cover || '';
        if (dom.titlePreview)  dom.titlePreview.textContent = draft.title || '新文章';

        if (draft.slug) {
            dom.slugText.textContent = '/ ' + draft.slug;
            state.slugManuallyEdited = true;
        }

        if (draft.tags) {
            state.selectedTags = typeof draft.tags === 'string'
                ? draft.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
                : (draft.tags || []);
            renderSelectedTags();
        }

        updateCoverPreview();
        updateStatusBar();
    }

    function collectFormData() {
        return {
            title: dom.titleInput ? dom.titleInput.value : '',
            content: dom.contentArea ? dom.contentArea.value : '',
            slug: dom.sidebarSlug ? dom.sidebarSlug.value : '',
            summary: dom.summaryInput ? dom.summaryInput.value : '',
            cover: dom.coverInput ? dom.coverInput.value : '',
            tags: state.selectedTags.join(', '),
            ts: Date.now()
        };
    }

    function updateSaveStatus(status) {
        if (!dom.saveStatus) return;
        dom.saveStatus.classList.remove('saving', 'saved', 'error');
        switch (status) {
            case 'saving':
                dom.saveStatus.classList.add('saving');
                dom.saveStatus.textContent = '保存中...';
                break;
            case 'saved':
                dom.saveStatus.classList.add('saved');
                dom.saveStatus.textContent = '已保存';
                break;
            case 'error':
                dom.saveStatus.classList.add('error');
                dom.saveStatus.textContent = '保存失败';
                break;
            case 'unsaved':
                dom.saveStatus.textContent = '未保存';
                break;
            default:
                dom.saveStatus.textContent = '';
        }
    }

    function markDirty() {
        if (!state.isDirty) {
            state.isDirty = true;
            updateSaveStatus('unsaved');
        }
    }

    // ============================================================
    // 10. 发布功能
    // ============================================================
    function togglePublishDropdown() {
        if (dom.publishDropdown) {
            dom.publishDropdown.classList.toggle('open');
        }
    }

    function closePublishDropdown() {
        if (dom.publishDropdown) {
            dom.publishDropdown.classList.remove('open');
        }
    }

    function showScheduleDialog() {
        if (dom.scheduleDialog) {
            dom.scheduleDialog.classList.add('active');
            if (dom.scheduleTime) {
                // 默认设置为明天同一时间
                var tomorrow = new Date(Date.now() + 86400000);
                dom.scheduleTime.value = tomorrow.getFullYear() + '-' + pad2(tomorrow.getMonth()+1) + '-' + pad2(tomorrow.getDate()) + 'T' + pad2(tomorrow.getHours()) + ':' + pad2(tomorrow.getMinutes());
            }
        }
    }

    function hideScheduleDialog() {
        if (dom.scheduleDialog) {
            dom.scheduleDialog.classList.remove('active');
        }
    }

    async function doPublish(mode) {
        var title = dom.titleInput ? dom.titleInput.value.trim() : '';
        if (!title) {
            alert('请填写标题');
            dom.titleInput && dom.titleInput.focus();
            return;
        }

        if (mode === 'schedule' && dom.scheduleInput && !dom.scheduleInput.value) {
            showScheduleDialog();
            return;
        }

        updateSaveStatus('saving');
        state.isSaving = true;

        var body = {
            title: title,
            slug: dom.sidebarSlug ? dom.sidebarSlug.value.trim() : '',
            summary: dom.summaryInput ? dom.summaryInput.value.trim() : '',
            cover_image: dom.coverInput ? dom.coverInput.value.trim() : '',
            content_md: dom.contentArea ? dom.contentArea.value : '',
            author: dom.authorInput ? dom.authorInput.value : 'Admin',
            tags: state.selectedTags.join(', '),
            is_published: mode === 'publish' ? 1 : 0,
            scheduled_at: mode === 'schedule' && dom.scheduleInput ? dom.scheduleInput.value : null
        };

        try {
            var url = state.editId ? API.updateArticle(state.editId) : API.createArticle;
            var method = state.editId ? 'PUT' : 'POST';
            var res = await apiFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                var data = await res.json();
                state.isDirty = false;
                state.isSaving = false;
                state.lastSaved = new Date();
                updateSaveStatus('saved');

                // 更新文章状态
                if (mode === 'publish') {
                    state.articleStatus = 'published';
                } else if (mode === 'schedule') {
                    state.articleStatus = 'scheduled';
                } else {
                    state.articleStatus = 'draft';
                }
                updateStatusBadge();

                clearDraftStorage();

                if (!state.editId && data.id) {
                    state.editId = data.id;
                    var newUrl = new URL(window.location);
                    newUrl.searchParams.set('id', data.id);
                    window.history.replaceState(null, '', newUrl);
                }

                closePublishDropdown();

                if (mode === 'publish' || mode === 'draft') {
                    setTimeout(function() {
                        window.location.href = '/admin.html#articles';
                    }, 800);
                }
            } else if (res.status === 401) {
                alert('登录已过期，请重新登录');
                window.location.href = '/admin.html';
            } else {
                var err = await res.json().catch(function() { return {}; });
                alert('操作失败: ' + (err.error || '未知错误'));
                state.isSaving = false;
                updateSaveStatus('error');
            }
        } catch(e) {
            console.error('Publish error:', e);
            alert('操作失败: 网络错误');
            state.isSaving = false;
            updateSaveStatus('error');
        }
    }

    function updateStatusBadge() {
        if (!dom.statusDisplay) return;
        dom.statusDisplay.className = 'es-status-badge';
        switch (state.articleStatus) {
            case 'published':
                dom.statusDisplay.classList.add('es-status-published');
                dom.statusDisplay.textContent = '已发布';
                break;
            case 'scheduled':
                dom.statusDisplay.classList.add('es-status-scheduled');
                dom.statusDisplay.textContent = '定时发布';
                break;
            default:
                dom.statusDisplay.classList.add('es-status-draft');
                dom.statusDisplay.textContent = '草稿';
        }
    }

    // ============================================================
    // 11. 侧边栏
    // ============================================================
    function toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
        if (dom.sidebar) {
            dom.sidebar.classList.toggle('open', state.sidebarOpen);
        }
        var backdrop = $('#sidebar-backdrop');
        if (backdrop) {
            backdrop.classList.toggle('visible', state.sidebarOpen);
        }
    }

    function closeSidebar() {
        state.sidebarOpen = false;
        if (dom.sidebar) {
            dom.sidebar.classList.remove('open');
        }
        var backdrop = $('#sidebar-backdrop');
        if (backdrop) {
            backdrop.classList.remove('visible');
        }
    }

    function updateCoverPreview() {
        if (!dom.coverPreview || !dom.coverInput) return;
        var url = dom.coverInput.value.trim();
        if (url) {
            dom.coverPreview.innerHTML = '<img src="' + esc(url) + '" alt="封面">';
            var img = dom.coverPreview.querySelector('img');
            img.onerror = function() {
                dom.coverPreview.innerHTML = '<span>图片加载失败</span>';
            };
        } else {
            dom.coverPreview.innerHTML = '<span>无封面</span>';
        }
    }

    async function onCoverUpload(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('图片不能超过 5MB');
            e.target.value = '';
            return;
        }

        var formData = new FormData();
        formData.append('image', file);

        try {
            updateSaveStatus('saving');
            var res = await apiFetch(API.uploadImage, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                var data = await res.json();
                if (dom.coverInput) dom.coverInput.value = data.url || data.src || '';
                updateCoverPreview();
                markDirty();
                updateSaveStatus('unsaved');
            } else {
                alert('上传失败');
                updateSaveStatus('unsaved');
            }
        } catch(err) {
            alert('上传失败: 网络错误');
            updateSaveStatus('error');
        }
        e.target.value = '';
    }

    async function onImageUpload(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('图片不能超过 5MB');
            e.target.value = '';
            return;
        }

        var formData = new FormData();
        formData.append('image', file);

        try {
            updateSaveStatus('saving');
            var res = await apiFetch(API.uploadImage, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                var data = await res.json();
                var url = data.url || data.src || '';
                insertMD('image');
                // 替换 (url) 部分
                var ta = dom.contentArea;
                if (ta && url) {
                    var pos = ta.value.indexOf('](url)', ta.selectionStart - 10);
                    if (pos !== -1) {
                        ta.value = ta.value.substring(0, pos + 2) + url + ta.value.substring(pos + 5);
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                updateSaveStatus('unsaved');
            } else {
                alert('上传失败');
                updateSaveStatus('unsaved');
            }
        } catch(err) {
            alert('上传失败: 网络错误');
            updateSaveStatus('error');
        }
        e.target.value = '';
    }

    // ============================================================
    // 12. 标签选择器
    // ============================================================
    async function loadTags() {
        try {
            var res = await apiFetch(API.tags);
            if (res.ok) {
                var data = await res.json();
                state.tags = data.tags || data || [];
                renderTagPanel();
            }
        } catch(e) {
            console.error('Load tags failed:', e);
        }
    }

    function renderTagPanel() {
        if (!dom.tagPanel) return;

        if (!state.tags.length) {
            dom.tagPanel.innerHTML = '<span style="font-size:0.8rem;color:var(--text-tertiary);">暂无标签</span>';
            return;
        }

        dom.tagPanel.innerHTML = state.tags.map(function(tag) {
            var name = typeof tag === 'string' ? tag : (tag.name || tag.tag || '');
            var color = typeof tag === 'object' ? (tag.color || '#6b7280') : '#6b7280';
            var isSelected = state.selectedTags.indexOf(name) !== -1;
            return '<span class="es-tag-selector-item' + (isSelected ? ' selected' : '') + '" '
                + 'data-tag="' + esc(name) + '" '
                + 'style="background:' + esc(color) + '">'
                + esc(name) + '</span>';
        }).join('');

        dom.tagPanel.querySelectorAll('.es-tag-selector-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var tag = this.getAttribute('data-tag');
                toggleTag(tag);
            });
        });
    }

    function toggleTagPanel() {
        if (!dom.tagPanel) return;
        dom.tagPanel.classList.toggle('hidden');
        if (!dom.tagPanel.classList.contains('hidden')) {
            renderTagPanel();
        }
    }

    function toggleTag(tag) {
        var idx = state.selectedTags.indexOf(tag);
        if (idx !== -1) {
            state.selectedTags.splice(idx, 1);
        } else {
            state.selectedTags.push(tag);
        }
        renderSelectedTags();
        renderTagPanel();
        markDirty();
        scheduleAutoSave();
    }

    function renderSelectedTags() {
        if (!dom.tagChips) return;
        if (!state.selectedTags.length) {
            dom.tagChips.innerHTML = '';
            return;
        }

        // 找到标签颜色映射
        var tagColorMap = {};
        state.tags.forEach(function(tag) {
            if (typeof tag === 'object') {
                tagColorMap[tag.name || tag.tag] = tag.color || '#6b7280';
            }
        });

        dom.tagChips.innerHTML = state.selectedTags.map(function(tag) {
            var color = tagColorMap[tag] || '#6b7280';
            return '<span class="es-tag-chip" style="background:' + esc(color) + '">'
                + esc(tag)
                + ' <span class="es-tag-chip-remove" data-tag="' + esc(tag) + '">&times;</span></span>';
        }).join('');

        dom.tagChips.querySelectorAll('.es-tag-chip-remove').forEach(function(btn) {
            btn.addEventListener('click', function() {
                toggleTag(this.getAttribute('data-tag'));
            });
        });
    }

    function onTagInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var val = dom.tagInput.value.trim();
            if (val && state.selectedTags.indexOf(val) === -1) {
                state.selectedTags.push(val);
                renderSelectedTags();
                renderTagPanel();
                markDirty();
                scheduleAutoSave();
            }
            dom.tagInput.value = '';
        }
    }

    // ============================================================
    // 13. 加载文章（编辑模式）
    // ============================================================
    async function loadArticle(id) {
        try {
            updateSaveStatus('saving');
            var res = await apiFetch(API.getArticle(id));
            if (!res.ok) {
                if (res.status === 401) {
                    alert('登录已过期');
                    window.location.href = '/admin.html';
                    return;
                }
                alert('加载文章失败');
                return;
            }
            var a = await res.json();

            if (dom.titleInput)    dom.titleInput.value = a.title || '';
            if (dom.contentArea)   dom.contentArea.value = a.content_md || '';
            if (dom.sidebarSlug)   dom.sidebarSlug.value = a.slug || '';
            if (dom.summaryInput)  dom.summaryInput.value = a.summary || '';
            if (dom.coverInput)    dom.coverInput.value = a.cover_image || '';
            if (dom.authorInput)   dom.authorInput.value = a.author || 'Admin';
            if (dom.titlePreview)  dom.titlePreview.textContent = a.title || '新文章';

            // Slug 显示
            if (a.slug) {
                dom.slugText.textContent = '/ ' + a.slug;
                state.slugManuallyEdited = true;
            }

            // 标签
            if (a.tags) {
                state.selectedTags = a.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
                renderSelectedTags();
                renderTagPanel();
            }

            // 文章状态
            if (a.is_published) {
                state.articleStatus = 'published';
            } else if (a.scheduled_at) {
                state.articleStatus = 'scheduled';
                if (dom.scheduleInput) {
                    var d = new Date(a.scheduled_at + (a.scheduled_at.indexOf('Z') !== -1 ? '' : 'Z'));
                    dom.scheduleInput.value = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
                    if (dom.scheduleSection) dom.scheduleSection.classList.remove('hidden');
                }
            } else {
                state.articleStatus = 'draft';
            }
            updateStatusBadge();

            updateCoverPreview();
            updateSaveStatus('saved');
            state.lastSaved = new Date();
            state.isDirty = false;
            updateStatusBar();

        } catch(e) {
            console.error('Load article error:', e);
            alert('加载文章失败: 网络错误');
        }
    }

    // ============================================================
    // 14. 状态栏
    // ============================================================
    function updateStatusBar() {
        var content = dom.contentArea ? dom.contentArea.value : '';
        var words = countWords(content);
        var readTime = calcReadTime(content);

        if (dom.wordCount) dom.wordCount.textContent = words.toLocaleString() + ' 字';
        if (dom.readTime) dom.readTime.textContent = readTime;
        if (dom.lastEditTime) dom.lastEditTime.textContent = state.lastSaved ? '最后编辑：' + relativeTime(state.lastSaved) : '最后编辑：--';
    }

    // ============================================================
    // 15. 页面离开确认
    // ============================================================
    function setupBeforeUnload() {
        window.addEventListener('beforeunload', function(e) {
            if (state.isDirty) {
                e.preventDefault();
                e.returnValue = '有未保存的修改，确定要离开吗？';
                return e.returnValue;
            }
        });
    }

    function onBack() {
        if (state.isDirty) {
            if (!confirm('有未保存的修改，确定要离开吗？')) return;
        }
        if (state.isDirty) autoSaveToStorage();
        window.location.href = '/admin.html#articles';
    }

    // ============================================================
    // 16. 全局点击关闭菜单
    // ============================================================
    function onDocumentClick(e) {
        // 关闭发布下拉菜单
        if (dom.publishDropdown && !dom.publishBtn.contains(e.target) && !dom.publishDropdown.contains(e.target)) {
            closePublishDropdown();
        }
        // 关闭标签面板
        if (dom.tagPanel && !dom.tagPanel.classList.contains('hidden') &&
            !dom.tagPickBtn.contains(e.target) && !dom.tagPanel.contains(e.target)) {
            dom.tagPanel.classList.add('hidden');
        }
        // 关闭斜杠菜单
        if (state.slashMenuOpen && dom.slashMenu && !dom.slashMenu.contains(e.target)) {
            hideSlashMenu();
        }
    }

    // ============================================================
    // 启动
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
