/**
 * editor.js — 文章编辑器主入口
 * 导入各模块，处理初始化、事件绑定、Markdown 插入、浮动工具栏、
 * 键盘快捷键、撤销/重做、自动保存、发布、侧边栏、状态栏
 *
 * 模块拆分：
 *   config.js   — 常量 & 配置（API、MD_CMDS、SLASH_COMMANDS、CODE_LANGUAGES）
 *   utils.js    — 工具函数（DOM 查询、转义、防抖、时间、字数、Slug、API 请求）
 *   state.js    — 共享状态 & DOM 引用
 *   upload.js   — 文件上传（图片、视频、音频、封面、地图）
 *   import.js   — 文件导入（.md / .txt / .html + Front Matter 解析）
 *   tags.js     — 标签选择器
 *   codelang.js — 斜杠命令菜单 + 代码块语言选择器
 */

import { AUTOSAVE_KEY, AUTOSAVE_DELAY, API, MD_CMDS } from './editor/config.js';
import { state, dom, cacheDom } from './editor/state.js';
import { $, $$, esc, pad2, relativeTime, countWords, calcReadTime, generateSlug, apiFetch, getCursorPixelPos } from './editor/utils.js';
import { updateCoverPreview, onCoverUpload, onImageUpload, onVideoUpload, onAudioUpload, insertMap } from './editor/upload.js';
import { onFileImport } from './editor/import.js';
import { loadTags, renderSelectedTags, renderTagPanel, toggleTagPanel, toggleTag, onTagInputKeydown } from './editor/tags.js';
import { checkMenus, hideSlashMenu, handleCodeLangKeydown, handleSlashKeydown, executeSlashCommand } from './editor/codelang.js';

// ============================================================
// 跨模块回调注册
// ============================================================
// codelang.js 需要调用 insertMD 和 saveUndoState
state._insertMD = insertMD;
state._saveUndoState = saveUndoState;
// import.js 需要调用 renderSelectedTags
state._renderSelectedTags = renderSelectedTags;

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
            if (e.key === 'Enter') { e.preventDefault(); dom.slugInput.blur(); }
            if (e.key === 'Escape') { dom.slugInput.blur(); }
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

    // 摘要、封面、作者输入
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

    // 上传文件
    var uploadInput = $('#editor-upload-image');
    if (uploadInput) uploadInput.addEventListener('change', onImageUpload);
    var videoUpload = $('#editor-video-upload');
    if (videoUpload) videoUpload.addEventListener('change', onVideoUpload);
    var audioUpload = $('#editor-audio-upload');
    if (audioUpload) audioUpload.addEventListener('change', onAudioUpload);
    var importInput = $('#editor-import-file');
    if (importInput) importInput.addEventListener('change', onFileImport);

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
            var lang = this.getAttribute('data-lang');
            if (cmd) executeSlashCommand(MD_CMDS[cmd] ? cmd : cmd, lang);
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

    // 移动端侧栏 backdrop
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

    if (!state.slugManuallyEdited) {
        var slug = generateSlug(val);
        if (dom.sidebarSlug) dom.sidebarSlug.value = slug;
        if (dom.slugText) dom.slugText.textContent = slug ? '/ ' + slug : '/  slug 将自动生成';
    }

    if (dom.titlePreview) {
        dom.titlePreview.textContent = val || '新文章';
    }

    markDirty();
    scheduleAutoSave();
}

// ============================================================
// 4. Markdown 工具栏 - insertMD
// ============================================================
function insertMD(type, lang) {
    if (type === 'map') { insertMap(); return; }
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

            var before = cmd.before;
            var after = cmd.after;
            if (cmd.lang && lang) {
                before = '```' + lang + '\n';
            }

            if (cmd.block) {
                var ls = val.lastIndexOf('\n', s - 1) + 1;
                var lineBefore = val.substring(ls, s);

                if (hasSel && sel.indexOf('\n') !== -1) {
                    result = sel.split('\n').map(function(l) { return before + l; }).join('\n') + after;
                } else if (lineBefore.trim() === '') {
                    result = before + text + after;
                } else {
                    result = '\n' + before + text + after;
                }
            } else {
                result = before + text + after;
            }

            saveUndoState(ta);

            var newVal = val.substring(0, s) + result + val.substring(e);
            ta.value = newVal;

            if (cmd.inline && !hasSel) {
                ta.selectionStart = s + before.length;
                ta.selectionEnd = s + before.length + text.length;
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
// 5. 内容输入
// ============================================================
function onContentInput() {
    markDirty();
    scheduleAutoSave();
    updateStatusBar();
    checkMenus();
}

// ============================================================
// 6. 浮动工具栏
// ============================================================
function onContentMouseUp() { checkSelection(); }

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

    var pos = getCursorPixelPos(ta, selStart);
    var top = pos.top - 44;
    var left = pos.left;

    if (top < 56) {
        top = pos.top + 24;
    }

    toolbar.style.top = top + 'px';
    toolbar.style.left = Math.max(8, Math.min(left, window.innerWidth - 200)) + 'px';
    toolbar.classList.remove('hidden');
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
    // 代码语言菜单优先
    if (handleCodeLangKeydown(e)) return;
    // 斜杠命令菜单
    if (handleSlashKeydown(e)) return;
}

function onGlobalKeydown(e) {
    var isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key === 's') {
        e.preventDefault();
        doPublish('draft');
        return;
    }
    if (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        redo();
        return;
    }
    if (isCtrl && !e.shiftKey && e.key === 'z') {
        var ta = dom.contentArea;
        if (ta && document.activeElement === ta && state.undoStack.length > 0) {
            e.preventDefault();
            undo();
            return;
        }
    }
    if (isCtrl && e.key === 'b' && document.activeElement === dom.contentArea) {
        e.preventDefault();
        insertMD('bold');
        return;
    }
    if (isCtrl && e.key === 'i' && document.activeElement === dom.contentArea) {
        e.preventDefault();
        insertMD('italic');
        return;
    }
    if (isCtrl && e.key === 'k' && document.activeElement === dom.contentArea) {
        e.preventDefault();
        insertMD('link');
        return;
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
    if (dom.publishDropdown) dom.publishDropdown.classList.toggle('open');
}

function closePublishDropdown() {
    if (dom.publishDropdown) dom.publishDropdown.classList.remove('open');
}

function showScheduleDialog() {
    if (dom.scheduleDialog) {
        dom.scheduleDialog.classList.add('active');
        if (dom.scheduleTime) {
            var tomorrow = new Date(Date.now() + 86400000);
            dom.scheduleTime.value = tomorrow.getFullYear() + '-' + pad2(tomorrow.getMonth()+1) + '-' + pad2(tomorrow.getDate()) + 'T' + pad2(tomorrow.getHours()) + ':' + pad2(tomorrow.getMinutes());
        }
    }
}

function hideScheduleDialog() {
    if (dom.scheduleDialog) dom.scheduleDialog.classList.remove('active');
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

    if (state.isSaving) return;
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
            window.location.href = '/login.html';
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
    if (dom.sidebar) dom.sidebar.classList.toggle('open', state.sidebarOpen);
    var backdrop = $('#sidebar-backdrop');
    if (backdrop) backdrop.classList.toggle('visible', state.sidebarOpen);
}

function closeSidebar() {
    state.sidebarOpen = false;
    if (dom.sidebar) dom.sidebar.classList.remove('open');
    var backdrop = $('#sidebar-backdrop');
    if (backdrop) backdrop.classList.remove('visible');
}

// ============================================================
// 12. 加载文章（编辑模式）
// ============================================================
async function loadArticle(id) {
    try {
        updateSaveStatus('saving');
        var res = await apiFetch(API.getArticle(id));
        if (!res.ok) {
            if (res.status === 401) {
                alert('登录已过期');
                window.location.href = '/login.html';
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

        if (a.slug) {
            dom.slugText.textContent = '/ ' + a.slug;
            state.slugManuallyEdited = true;
        }

        if (a.tags) {
            state.selectedTags = a.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
            renderSelectedTags();
            renderTagPanel();
        }

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
// 13. 状态栏
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
// 14. 页面离开确认
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
// 15. 全局点击关闭菜单
// ============================================================
function onDocumentClick(e) {
    if (dom.publishDropdown && !dom.publishBtn.contains(e.target) && !dom.publishDropdown.contains(e.target)) {
        closePublishDropdown();
    }
    if (dom.tagPanel && !dom.tagPanel.classList.contains('hidden') &&
        !dom.tagPickBtn.contains(e.target) && !dom.tagPanel.contains(e.target)) {
        dom.tagPanel.classList.add('hidden');
    }
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
