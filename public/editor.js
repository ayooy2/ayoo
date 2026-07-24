/**
 * editor.js — 文章编辑器主入口
 * 导入各模块，处理初始化、Markdown 插入、浮动工具栏、
 * 键盘快捷键、撤销/重做、侧边栏、加载文章
 *
 * 模块拆分：
 *   config.js   — 常量 & 配置
 *   utils.js    — 工具函数
 *   state.js    — 共享状态 & DOM 引用
 *   upload.js   — 文件上传
 *   import.js   — 文件导入
 *   tags.js     — 标签选择器
 *   codelang.js — 斜杠命令 + 代码语言选择器
 *   publish.js  — 发布功能
 *   draft.js    — 自动保存 & 草稿
 *   events.js   — 事件绑定
 */

import { AUTOSAVE_KEY, API, MD_CMDS } from './editor/config.js';
import { state, dom, cacheDom } from './editor/state.js';
import { $, $$, pad2, apiFetch, getCursorPixelPos, countWords, calcReadTime, relativeTime } from './editor/utils.js';
import { updateCoverPreview } from './editor/upload.js';
import { loadTags, renderSelectedTags, renderTagPanel } from './editor/tags.js';
import { checkMenus, hideSlashMenu, handleCodeLangKeydown, handleSlashKeydown } from './editor/codelang.js';
import { updateStatusBadge, doPublish, closePublishDropdown, togglePublishDropdown } from './editor/publish.js';
import { autoSaveToStorage, loadDraftFromStorage, restoreDraft, clearDraftStorage, updateSaveStatus, markDirty, scheduleAutoSave, updateStatusBar } from './editor/draft.js';
import { bindEvents } from './editor/events.js';

// ============================================================
// 跨模块回调注册
// ============================================================
state._insertMD = insertMD;
state._saveUndoState = saveUndoState;
state._renderSelectedTags = renderSelectedTags;

// ============================================================
// 1. 初始化
// ============================================================
function init() {
    cacheDom();
    bindEvents({
        insertMD: insertMD,
        onContentKeydown: onContentKeydown,
        onContentMouseUp: onContentMouseUp,
        onContentKeyUp: onContentKeyUp,
        hideFloatingToolbar: hideFloatingToolbar,
        saveUndoState: saveUndoState,
        onGlobalKeydown: onGlobalKeydown,
        onBack: onBack,
        toggleSidebar: toggleSidebar,
        closeSidebar: closeSidebar,
        onDocumentClick: onDocumentClick,
        checkMenus: checkMenus
    });
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
// 2. Markdown 工具栏 - insertMD
// ============================================================
function insertMD(type, lang) {
    if (type === 'map') {
        var upload = import('./editor/upload.js');
        upload.then(function(m) { m.insertMap(); });
        return;
    }
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
// 3. 浮动工具栏
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
// 4. 快捷键
// ============================================================
function onContentKeydown(e) {
    if (handleCodeLangKeydown(e)) return;
    if (handleSlashKeydown(e)) return;
}

function onGlobalKeydown(e) {
    var isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key === 's') {
        e.preventDefault();
        doPublish('draft', { updateSaveStatus: updateSaveStatus, clearDraftStorage: clearDraftStorage });
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
// 5. 撤销/重做
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
// 6. 侧边栏
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
// 7. 加载文章（编辑模式）
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
// 8. 页面离开确认
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
// 9. 全局点击关闭菜单
// ============================================================
function onDocumentClick(e) {
    var publishBtn = dom.publishBtn;
    var publishDropdown = dom.publishDropdown;
    if (publishDropdown && publishBtn && !publishBtn.contains(e.target) && !publishDropdown.contains(e.target)) {
        closePublishDropdown();
    }
    if (dom.tagPanel && !dom.tagPanel.classList.contains('hidden') &&
        dom.tagPickBtn && !dom.tagPickBtn.contains(e.target) && !dom.tagPanel.contains(e.target)) {
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
