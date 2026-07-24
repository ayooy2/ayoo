/**
 * editor/events.js — 事件绑定
 * 集中处理所有 DOM 事件监听器的注册
 */

import { MD_CMDS } from './config.js';
import { state, dom } from './state.js';
import { $, $$, generateSlug } from './utils.js';
import { updateCoverPreview, onCoverUpload, onImageUpload, onVideoUpload, onAudioUpload } from './upload.js';
import { onFileImport } from './import.js';
import { toggleTagPanel, onTagInputKeydown } from './tags.js';
import { hideSlashMenu, executeSlashCommand } from './codelang.js';
import { togglePublishDropdown, closePublishDropdown, showScheduleDialog, hideScheduleDialog, doPublish } from './publish.js';
import { markDirty, scheduleAutoSave, autoSaveToStorage, updateStatusBar, updateSaveStatus } from './draft.js';

/**
 * 绑定所有事件监听器
 * @param {object} callbacks - 回调函数集合
 * @param {function} callbacks.insertMD - 插入 Markdown
 * @param {function} callbacks.onContentKeydown - 内容区键盘事件
 * @param {function} callbacks.onContentMouseUp - 内容区鼠标事件
 * @param {function} callbacks.onContentKeyUp - 内容区键盘抬起
 * @param {function} callbacks.hideFloatingToolbar - 隐藏浮动工具栏
 * @param {function} callbacks.saveUndoState - 保存撤销状态
 * @param {function} callbacks.onGlobalKeydown - 全局键盘事件
 * @param {function} callbacks.onBack - 返回按钮
 * @param {function} callbacks.toggleSidebar - 侧边栏切换
 * @param {function} callbacks.closeSidebar - 关闭侧边栏
 * @param {function} callbacks.onDocumentClick - 全局点击
 */
export function bindEvents(callbacks) {
    // 标题输入
    if (dom.titleInput) {
        dom.titleInput.addEventListener('input', function() {
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
        });
    }

    // 内容编辑区
    if (dom.contentArea) {
        dom.contentArea.addEventListener('input', function() {
            markDirty();
            scheduleAutoSave();
            updateStatusBar();
            // 检测斜杠命令和代码语言菜单
            if (callbacks.checkMenus) callbacks.checkMenus();
        });
        if (callbacks.onContentKeydown) dom.contentArea.addEventListener('keydown', callbacks.onContentKeydown);
        if (callbacks.onContentMouseUp) dom.contentArea.addEventListener('mouseup', callbacks.onContentMouseUp);
        if (callbacks.onContentKeyUp) dom.contentArea.addEventListener('keyup', callbacks.onContentKeyUp);
        if (callbacks.hideFloatingToolbar) {
            dom.contentArea.addEventListener('blur', function() {
                setTimeout(callbacks.hideFloatingToolbar, 200);
            });
        }
        // Tab 键插入缩进
        dom.contentArea.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                if (callbacks.saveUndoState) callbacks.saveUndoState(dom.contentArea);
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
            if (action && callbacks.insertMD) callbacks.insertMD(action);
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
                doPublish(mode, {
                    updateSaveStatus: updateSaveStatus,
                    clearDraftStorage: function() {
                        var draft = import('./draft.js');
                        draft.then(function(m) { m.clearDraftStorage(); });
                    }
                });
            }
        });
    });

    // 侧边栏切换
    if (dom.sidebarToggle && callbacks.toggleSidebar) {
        dom.sidebarToggle.addEventListener('click', callbacks.toggleSidebar);
    }

    // 返回按钮
    if (dom.backBtn && callbacks.onBack) {
        dom.backBtn.addEventListener('click', callbacks.onBack);
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
            if (action && callbacks.insertMD) callbacks.insertMD(action);
            if (callbacks.hideFloatingToolbar) callbacks.hideFloatingToolbar();
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
            } else if (action && callbacks.insertMD) {
                callbacks.insertMD(action);
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
            doPublish('schedule', {
                updateSaveStatus: updateSaveStatus,
                clearDraftStorage: function() {}
            });
        });
    }

    // 全局点击关闭菜单
    if (callbacks.onDocumentClick) document.addEventListener('click', callbacks.onDocumentClick);

    // 全局快捷键
    if (callbacks.onGlobalKeydown) document.addEventListener('keydown', callbacks.onGlobalKeydown);

    // 移动端侧栏 backdrop
    if (window.innerWidth <= 768) {
        var backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
        if (callbacks.closeSidebar) backdrop.addEventListener('click', callbacks.closeSidebar);
    }
}
