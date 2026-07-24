/**
 * editor/draft.js — 自动保存 & 草稿管理
 * 定时自动保存到 localStorage、加载/恢复草稿、收集表单数据、保存状态显示
 */

import { AUTOSAVE_KEY, AUTOSAVE_DELAY } from './config.js';
import { state, dom } from './state.js';
import { relativeTime } from './utils.js';
import { updateCoverPreview } from './upload.js';
import { renderSelectedTags } from './tags.js';

export function scheduleAutoSave() {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(autoSaveToStorage, AUTOSAVE_DELAY);
}

export function autoSaveToStorage() {
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

export function loadDraftFromStorage() {
    try {
        var raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch(e) {
        return null;
    }
}

export function clearDraftStorage() {
    localStorage.removeItem(AUTOSAVE_KEY);
}

export function restoreDraft(draft) {
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

export function collectFormData() {
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

export function updateSaveStatus(status) {
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

export function markDirty() {
    if (!state.isDirty) {
        state.isDirty = true;
        updateSaveStatus('unsaved');
    }
}

// 状态栏更新
export function updateStatusBar() {
    var content = dom.contentArea ? dom.contentArea.value : '';
    var words = 0;
    if (content) {
        var chinese = (content.match(/[一-鿿㐀-䶿]/g) || []).length;
        var english = content.replace(/[一-鿿㐀-䶿]/g, ' ').trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
        words = chinese + english;
    }
    var minutes = Math.max(1, Math.ceil(words / 300));

    if (dom.wordCount) dom.wordCount.textContent = words.toLocaleString() + ' 字';
    if (dom.readTime) dom.readTime.textContent = '约 ' + minutes + ' 分钟';
    if (dom.lastEditTime) dom.lastEditTime.textContent = state.lastSaved ? '最后编辑：' + relativeTime(state.lastSaved) : '最后编辑：--';
}
