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

    // Markdown 工具栏命令表（复用现有设计）
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

    // 斜杠命令列表
    var SLASH_COMMANDS = [
        { key: 'h1',      icon: 'H<sub>1</sub>', name: '一级标题',   desc: '大标题',       cmd: 'h1' },
        { key: 'h2',      icon: 'H<sub>2</sub>', name: '二级标题',   desc: '中标题',       cmd: 'h2' },
        { key: 'h3',      icon: 'H<sub>3</sub>', name: '三级标题',   desc: '小标题',       cmd: 'h3' },
        { key: 'quote',   icon: '&ldquo;',       name: '引用块',     desc: '引用内容',     cmd: 'quote' },
        { key: 'ul',      icon: '&bull;',        name: '无序列表',   desc: '项目列表',     cmd: 'ul' },
        { key: 'ol',      icon: '1.',            name: '有序列表',   desc: '编号列表',     cmd: 'ol' },
        { key: 'code',    icon: '&lt;/&gt;',     name: '代码块',     desc: '插入代码',     cmd: 'codeblock' },
        { key: 'image',   icon: '&#128247;',     name: '图片',       desc: '插入图片',     cmd: 'image' },
        { key: 'link',    icon: '&#128279;',     name: '链接',       desc: '插入链接',     cmd: 'link' },
        { key: 'table',   icon: '&#9638;',       name: '表格',       desc: '插入表格',     cmd: 'table' },
        { key: 'hr',      icon: '&mdash;',       name: '分割线',     desc: '水平分割线',   cmd: 'hr' }
    ];

    // ============================================================
    // 状态
    // ============================================================
    var state = {
        editId: null,           // 编辑模式的文章 ID
        isDirty: false,         // 有未保存的修改
        isSaving: false,        // 正在保存中
        lastSaved: null,        // 最后保存时间
        slugManuallyEdited: false,
        sidebarOpen: false,
        tags: [],               // 所有可用标签
        selectedTags: [],       // 已选标签
        autoSaveTimer: null,
        undoStack: [],
        redoStack: [],
        lastSavedValue: null,
        slashMenuOpen: false,
        slashMenuIndex: 0,
        slashQuery: '',
        slashStartPos: 0
    };

    // ============================================================
    // DOM 元素引用（init 后填充）
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

    // 中文字符计数
    function countWords(text) {
        if (!text) return 0;
        var chinese = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
        var english = text.replace(/[一-鿿㐀-䶿]/g, ' ').trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
        return chinese + english;
    }

    function calcReadTime(text) {
        var words = countWords(text);
        var minutes = Math.max(1, Math.ceil(words / 300));
        return minutes + ' 分钟';
    }

    // 简单 slug 生成（中文保留拼音首字母简化版，实际用英文数字横杠）
    function generateSlug(title) {
        if (!title) return '';
        var slug = title
            .toLowerCase()
            .replace(/[一-鿿㐀-䶿]+/g, function(m) {
                // 中文段落替换为拼音首字母占位（简化处理用 pinyin 需要外部库，这里用时间戳简代）
                return m.split('').map(function() { return ''; }).join('');
            })
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        // 如果纯中文导致 slug 为空，用时间戳
        if (!slug) slug = 'post-' + Date.now().toString(36);
        return slug.slice(0, 80);
    }

    // API 请求封装
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
            // 新建模式：尝试恢复草稿
            var draft = loadDraftFromStorage();
            if (draft) {
                restoreDraft(draft);
            }
        }

        updateStatusBar();
        setupBeforeUnload();
        setupMobileViewport();
    }

    function cacheDom() {
        dom.titleInput      = $('#editor-title');
        dom.contentArea     = $('#editor-content');
        dom.slugInput       = $('#editor-slug');
        dom.summaryInput    = $('#editor-summary');
        dom.coverInput      = $('#editor-cover');
        dom.coverPreview    = $('#cover-preview');
        dom.headerTitle     = $('#header-title');
        dom.saveStatus      = $('#save-status');
        dom.publishBtn      = $('#publish-btn');
        dom.publishDropdown = $('#publish-dropdown');
        dom.tagContainer    = $('#tag-container');
        dom.tagInput        = $('#tag-input');
        dom.sidebar         = $('#editor-sidebar');
        dom.sidebarToggle   = $('#sidebar-toggle');
        dom.sidebarClose    = $('#sidebar-close');
        dom.floatingToolbar = $('#floating-toolbar');
        dom.slashMenu       = $('#slash-menu');
        dom.mobileToolbar   = $('#mobile-toolbar');
        dom.wordCount       = $('#word-count');
        dom.readTime        = $('#read-time');
        dom.lastEditTime    = $('#last-edit-time');
        dom.backBtn         = $('#back-btn');
        dom.scheduleSection = $('#schedule-section');
        dom.scheduleInput   = $('#schedule-datetime');
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
            dom.contentArea.addEventListener('blur', hideFloatingToolbar);
        }

        // Slug 输入
        if (dom.slugInput) {
            dom.slugInput.addEventListener('input', function() {
                state.slugManuallyEdited = true;
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

        // Markdown 工具栏按钮
        $$('.md-toolbar-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var type = this.getAttribute('data-cmd');
                if (type) insertMD(type);
            });
        });

        // 发布按钮
        if (dom.publishBtn) {
            dom.publishBtn.addEventListener('click', togglePublishDropdown);
        }
        $$('.publish-option').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = this.getAttribute('data-mode');
                doPublish(mode);
            });
        });

        // 侧边栏
        if (dom.sidebarToggle) {
            dom.sidebarToggle.addEventListener('click', toggleSidebar);
        }
        if (dom.sidebarClose) {
            dom.sidebarClose.addEventListener('click', closeSidebar);
        }

        // 返回按钮
        if (dom.backBtn) {
            dom.backBtn.addEventListener('click', onBack);
        }

        // 封面上传
        var coverUpload = $('#cover-upload');
        if (coverUpload) {
            coverUpload.addEventListener('change', onCoverUpload);
        }

        // 标签输入
        if (dom.tagInput) {
            dom.tagInput.addEventListener('keydown', onTagInputKeydown);
        }

        // 全局点击关闭菜单
        document.addEventListener('click', onDocumentClick);

        // 全局快捷键
        document.addEventListener('keydown', onGlobalKeydown);

        // 移动端底部工具栏
        $$('.mobile-toolbar-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var type = this.getAttribute('data-cmd');
                if (type) insertMD(type);
            });
        });

        // 移动端侧边栏按钮
        var mobileSidebarBtn = $('#mobile-sidebar-btn');
        if (mobileSidebarBtn) {
            mobileSidebarBtn.addEventListener('click', toggleSidebar);
        }

        // 浮动工具栏按钮
        $$('.float-toolbar-btn').forEach(function(btn) {
            btn.addEventListener('mousedown', function(e) {
                e.preventDefault(); // 防止 textarea 失焦
                var type = this.getAttribute('data-cmd');
                if (type) insertMD(type);
                hideFloatingToolbar();
            });
        });

        // 定时发布复选框
        var scheduleToggle = $('#schedule-toggle');
        if (scheduleToggle) {
            scheduleToggle.addEventListener('change', function() {
                if (dom.scheduleSection) {
                    dom.scheduleSection.style.display = this.checked ? 'block' : 'none';
                }
            });
        }
    }

    // ============================================================
    // 3. 标题输入
    // ============================================================
    function onTitleInput(e) {
        var ta = e.target;
        // 自动调整高度
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';

        // 自动生成 slug
        if (!state.slugManuallyEdited && dom.slugInput) {
            dom.slugInput.value = generateSlug(ta.value);
        }

        // 更新顶栏标题预览
        if (dom.headerTitle) {
            dom.headerTitle.textContent = ta.value || '无标题';
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

        // 检测斜杠命令
        var ta = dom.contentArea;
        if (!ta) return;
        var pos = ta.selectionStart;
        var val = ta.value;

        // 查找光标前最近的 /
        var slashIdx = val.lastIndexOf('/', pos);
        if (slashIdx !== -1 && slashIdx >= pos - 20) {
            // 确保 / 在行首或前面是空白
            var charBefore = slashIdx > 0 ? val[slashIdx - 1] : '\n';
            if (charBefore === '\n' || charBefore === ' ' || slashIdx === 0) {
                var query = val.substring(slashIdx + 1, pos);
                // 查询中不能有空格（除非是刚输入 /）
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

        var html = filtered.map(function(c, i) {
            return '<div class="slash-menu-item' + (i === 0 ? ' selected' : '') + '" data-cmd="' + c.cmd + '" data-index="' + i + '">'
                + '<div class="slash-icon">' + c.icon + '</div>'
                + '<div class="slash-info">'
                + '<div class="slash-name">' + esc(c.name) + '</div>'
                + '<div class="slash-desc">' + esc(c.desc) + '</div>'
                + '</div></div>';
        }).join('');

        menu.innerHTML = html;
        menu.style.display = 'block';

        // 定位到光标附近
        positionSlashMenu(menu);

        // 绑定点击
        menu.querySelectorAll('.slash-menu-item').forEach(function(item) {
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                executeSlashCommand(this.getAttribute('data-cmd'));
            });
            item.addEventListener('mouseenter', function() {
                menu.querySelectorAll('.slash-menu-item').forEach(function(el) { el.classList.remove('selected'); });
                this.classList.add('selected');
                state.slashMenuIndex = parseInt(this.getAttribute('data-index'));
            });
        });
    }

    function hideSlashMenu() {
        state.slashMenuOpen = false;
        if (dom.slashMenu) {
            dom.slashMenu.style.display = 'none';
            dom.slashMenu.innerHTML = '';
        }
    }

    function positionSlashMenu(menu) {
        var ta = dom.contentArea;
        if (!ta) return;

        // 创建一个临时元素来计算光标位置
        var mirror = document.createElement('div');
        mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;'
            + 'font:' + getComputedStyle(ta).font
            + ';padding:' + getComputedStyle(ta).padding
            + ';width:' + ta.clientWidth + 'px;'
            + ';line-height:' + getComputedStyle(ta).lineHeight;
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

        // 确保不超出视口
        if (top + 320 > window.innerHeight) {
            top = taRect.top + (spanRect.top - mirrorRect.top) - ta.scrollTop - 320 - 8;
        }

        menu.style.top = (top + window.scrollY) + 'px';
        menu.style.left = Math.min(left, window.innerWidth - 300) + 'px';

        document.body.removeChild(mirror);
    }

    function executeSlashCommand(cmd) {
        var ta = dom.contentArea;
        if (!ta) return;

        var pos = ta.selectionStart;
        var val = ta.value;

        // 删除 / 和查询文本
        var before = val.substring(0, state.slashStartPos);
        var after = val.substring(pos);

        saveUndoState(ta);
        ta.value = before + after;
        ta.selectionStart = ta.selectionEnd = state.slashStartPos;

        hideSlashMenu();

        // 插入对应的 Markdown
        insertMD(cmd);
    }

    // ============================================================
    // 6. 浮动工具栏
    // ============================================================
    function onContentMouseUp() {
        checkSelection();
    }

    function onContentKeyUp(e) {
        // 方向键 + Shift 也可以选中文本
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

        // 计算选区位置
        var mirror = document.createElement('div');
        mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;'
            + 'font:' + getComputedStyle(ta).font
            + ';padding:' + getComputedStyle(ta).padding
            + ';width:' + ta.clientWidth + 'px;'
            + ';line-height:' + getComputedStyle(ta).lineHeight;
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

        // 如果上方空间不够，放到下方
        if (top < 0) {
            top = taRect.top + (startRect.top - mirrorRect.top) - ta.scrollTop + 24;
        }

        toolbar.style.top = (top + window.scrollY) + 'px';
        toolbar.style.left = Math.max(8, Math.min(left, window.innerWidth - 300)) + 'px';
        toolbar.style.display = 'flex';

        document.body.removeChild(mirror);
    }

    function hideFloatingToolbar() {
        if (dom.floatingToolbar) {
            dom.floatingToolbar.style.display = 'none';
        }
    }

    // ============================================================
    // 7. 快捷键
    // ============================================================
    function onContentKeydown(e) {
        var ta = dom.contentArea;
        if (!ta) return;

        // 斜杠菜单打开时的键盘导航
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
                var selected = dom.slashMenu.querySelector('.slash-menu-item.selected');
                if (selected) executeSlashCommand(selected.getAttribute('data-cmd'));
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                hideSlashMenu();
                return;
            }
        }

        // Tab 缩进
        if (e.key === 'Tab') {
            e.preventDefault();
            saveUndoState(ta);
            var s = ta.selectionStart, end = ta.selectionEnd;
            if (e.shiftKey) {
                // 减少缩进：删除行首的空格/tab
                var lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
                var lineText = ta.value.substring(lineStart, s);
                if (lineText.startsWith('  ')) {
                    ta.value = ta.value.substring(0, lineStart) + ta.value.substring(lineStart + 2);
                    ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s - 2);
                }
            } else {
                ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 2;
            }
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function navigateSlashMenu(dir) {
        var items = dom.slashMenu.querySelectorAll('.slash-menu-item');
        if (!items.length) return;

        items[state.slashMenuIndex].classList.remove('selected');
        state.slashMenuIndex = (state.slashMenuIndex + dir + items.length) % items.length;
        items[state.slashMenuIndex].classList.add('selected');
        items[state.slashMenuIndex].scrollIntoView({ block: 'nearest' });
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
            doSaveDraft();
        }
        if (isCtrl && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            redo();
        }
        if (isCtrl && e.key === 'Enter') {
            e.preventDefault();
            insertMD('hr');
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
        if (!data.title && !data.content) return; // 空内容不保存

        try {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
            state.lastSaved = new Date();
            updateSaveStatus('saved');
        } catch(e) {
            console.error('Auto-save failed:', e);
            updateSaveStatus('error');
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
        if (dom.slugInput)     dom.slugInput.value = draft.slug || '';
        if (dom.summaryInput)  dom.summaryInput.value = draft.summary || '';
        if (dom.coverInput)    dom.coverInput.value = draft.cover || '';
        if (dom.headerTitle)   dom.headerTitle.textContent = draft.title || '无标题';
        if (draft.tags) {
            state.selectedTags = typeof draft.tags === 'string' ? draft.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : (draft.tags || []);
            renderSelectedTags();
        }
        updateCoverPreview();
        updateStatusBar();

        // 调整标题高度
        if (dom.titleInput) {
            dom.titleInput.style.height = 'auto';
            dom.titleInput.style.height = dom.titleInput.scrollHeight + 'px';
        }
    }

    function collectFormData() {
        return {
            title: dom.titleInput ? dom.titleInput.value : '',
            content: dom.contentArea ? dom.contentArea.value : '',
            slug: dom.slugInput ? dom.slugInput.value : '',
            summary: dom.summaryInput ? dom.summaryInput.value : '',
            cover: dom.coverInput ? dom.coverInput.value : '',
            tags: state.selectedTags.join(', '),
            ts: Date.now()
        };
    }

    function updateSaveStatus(status) {
        if (!dom.saveStatus) return;
        switch (status) {
            case 'saving':
                dom.saveStatus.innerHTML = '<span class="save-dot saving"></span> 保存中...';
                break;
            case 'saved':
                dom.saveStatus.innerHTML = '<span class="save-dot saved"></span> 草稿已保存';
                break;
            case 'error':
                dom.saveStatus.innerHTML = '<span class="save-dot error"></span> 保存失败';
                break;
            case 'unsaved':
                dom.saveStatus.innerHTML = '<span class="save-dot"></span> 未保存';
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
    function togglePublishDropdown(e) {
        e.stopPropagation();
        if (dom.publishDropdown) {
            var isOpen = dom.publishDropdown.style.display === 'block';
            dom.publishDropdown.style.display = isOpen ? 'none' : 'block';
        }
    }

    async function doPublish(mode) {
        // mode: 'publish', 'draft', 'schedule'
        var title = dom.titleInput ? dom.titleInput.value.trim() : '';
        if (!title) {
            alert('请填写标题');
            dom.titleInput && dom.titleInput.focus();
            return;
        }

        if (mode === 'schedule' && dom.scheduleInput && !dom.scheduleInput.value) {
            alert('请选择定时发布时间');
            return;
        }

        updateSaveStatus('saving');
        state.isSaving = true;

        var body = {
            title: title,
            slug: dom.slugInput ? dom.slugInput.value.trim() : '',
            summary: dom.summaryInput ? dom.summaryInput.value.trim() : '',
            cover_image: dom.coverInput ? dom.coverInput.value.trim() : '',
            content_md: dom.contentArea ? dom.contentArea.value : '',
            author: 'Admin',
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

                // 清除本地草稿
                clearDraftStorage();

                // 如果是新建，更新 editId
                if (!state.editId && data.id) {
                    state.editId = data.id;
                    var newUrl = new URL(window.location);
                    newUrl.searchParams.set('id', data.id);
                    window.history.replaceState(null, '', newUrl);
                }

                // 关闭发布菜单
                if (dom.publishDropdown) dom.publishDropdown.style.display = 'none';

                // 跳转回文章列表
                if (mode === 'publish' || mode === 'draft') {
                    setTimeout(function() {
                        window.location.href = '/admin.html#articles';
                    }, 500);
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

    function doSaveDraft() {
        doPublish('draft');
    }

    // ============================================================
    // 11. 侧边栏
    // ============================================================
    function toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
        if (dom.sidebar) {
            dom.sidebar.classList.toggle('open', state.sidebarOpen);
        }
    }

    function closeSidebar() {
        state.sidebarOpen = false;
        if (dom.sidebar) {
            dom.sidebar.classList.remove('open');
        }
    }

    function updateCoverPreview() {
        if (!dom.coverPreview || !dom.coverInput) return;
        var url = dom.coverInput.value.trim();
        if (url) {
            dom.coverPreview.src = url;
            dom.coverPreview.style.display = 'block';
            dom.coverPreview.onerror = function() {
                dom.coverPreview.style.display = 'none';
            };
        } else {
            dom.coverPreview.style.display = 'none';
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
            var res = await apiFetch(API.uploadImage, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                var data = await res.json();
                if (dom.coverInput) dom.coverInput.value = data.url || data.src || '';
                updateCoverPreview();
                markDirty();
            } else {
                alert('上传失败');
            }
        } catch(err) {
            alert('上传失败: 网络错误');
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
                renderTagList();
            }
        } catch(e) {
            console.error('Load tags failed:', e);
        }
    }

    function renderTagList() {
        var container = $('#tag-list');
        if (!container) return;

        if (!state.tags.length) {
            container.innerHTML = '<span class="tag-empty">暂无标签</span>';
            return;
        }

        container.innerHTML = state.tags.map(function(tag) {
            var name = typeof tag === 'string' ? tag : (tag.name || tag.tag || '');
            var isSelected = state.selectedTags.indexOf(name) !== -1;
            return '<button type="button" class="tag-chip' + (isSelected ? ' selected' : '') + '" data-tag="' + esc(name) + '">'
                + esc(name) + (isSelected ? ' &times;' : ' +') + '</button>';
        }).join('');

        container.querySelectorAll('.tag-chip').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tag = this.getAttribute('data-tag');
                toggleTag(tag);
            });
        });
    }

    function toggleTag(tag) {
        var idx = state.selectedTags.indexOf(tag);
        if (idx !== -1) {
            state.selectedTags.splice(idx, 1);
        } else {
            state.selectedTags.push(tag);
        }
        renderSelectedTags();
        renderTagList();
        markDirty();
        scheduleAutoSave();
    }

    function renderSelectedTags() {
        if (!dom.tagContainer) return;
        if (!state.selectedTags.length) {
            dom.tagContainer.innerHTML = '<span class="tag-placeholder">未选择标签</span>';
            return;
        }
        dom.tagContainer.innerHTML = state.selectedTags.map(function(tag) {
            return '<span class="selected-tag">' + esc(tag)
                + ' <button type="button" class="tag-remove" data-tag="' + esc(tag) + '">&times;</button></span>';
        }).join('');

        dom.tagContainer.querySelectorAll('.tag-remove').forEach(function(btn) {
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
                renderTagList();
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
            if (dom.slugInput)     dom.slugInput.value = a.slug || '';
            if (dom.summaryInput)  dom.summaryInput.value = a.summary || '';
            if (dom.coverInput)    dom.coverInput.value = a.cover_image || '';
            if (dom.headerTitle)   dom.headerTitle.textContent = a.title || '无标题';

            // 标签
            if (a.tags) {
                state.selectedTags = a.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
                renderSelectedTags();
                renderTagList();
            }

            // 定时发布
            if (a.scheduled_at && dom.scheduleInput) {
                var d = new Date(a.scheduled_at + (a.scheduled_at.includes('Z') ? '' : 'Z'));
                dom.scheduleInput.value = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
                var scheduleToggle = $('#schedule-toggle');
                if (scheduleToggle) scheduleToggle.checked = true;
                if (dom.scheduleSection) dom.scheduleSection.style.display = 'block';
            }

            state.slugManuallyEdited = true; // 编辑模式不自动覆盖 slug
            updateCoverPreview();
            updateSaveStatus('saved');
            state.lastSaved = new Date();
            state.isDirty = false;

            // 调整标题高度
            if (dom.titleInput) {
                dom.titleInput.style.height = 'auto';
                dom.titleInput.style.height = dom.titleInput.scrollHeight + 'px';
            }

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
        if (dom.lastEditTime) dom.lastEditTime.textContent = state.lastSaved ? '最后编辑: ' + relativeTime(state.lastSaved) : '';
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
        // 保存草稿到 localStorage 再离开
        if (state.isDirty) autoSaveToStorage();
        window.location.href = '/admin.html#articles';
    }

    // ============================================================
    // 16. 移动端适配
    // ============================================================
    function setupMobileViewport() {
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', function() {
                document.documentElement.style.setProperty('--viewport-height', window.visualViewport.height + 'px');
            });
        }
    }

    // ============================================================
    // 17. 全局点击关闭菜单
    // ============================================================
    function onDocumentClick(e) {
        // 关闭发布下拉菜单
        if (dom.publishDropdown && !dom.publishBtn.contains(e.target) && !dom.publishDropdown.contains(e.target)) {
            dom.publishDropdown.style.display = 'none';
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
