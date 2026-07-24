/**
 * editor/publish.js — 发布功能
 * 发布/草稿/定时发布、发布下拉菜单、定时对话框、状态徽章
 */

import { API } from './config.js';
import { state, dom } from './state.js';
import { pad2, apiFetch } from './utils.js';

export function togglePublishDropdown() {
    if (dom.publishDropdown) dom.publishDropdown.classList.toggle('open');
}

export function closePublishDropdown() {
    if (dom.publishDropdown) dom.publishDropdown.classList.remove('open');
}

export function showScheduleDialog() {
    if (dom.scheduleDialog) {
        dom.scheduleDialog.classList.add('active');
        if (dom.scheduleTime) {
            var tomorrow = new Date(Date.now() + 86400000);
            dom.scheduleTime.value = tomorrow.getFullYear() + '-' + pad2(tomorrow.getMonth()+1) + '-' + pad2(tomorrow.getDate()) + 'T' + pad2(tomorrow.getHours()) + ':' + pad2(tomorrow.getMinutes());
        }
    }
}

export function hideScheduleDialog() {
    if (dom.scheduleDialog) dom.scheduleDialog.classList.remove('active');
}

export async function doPublish(mode, callbacks) {
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
    if (callbacks && callbacks.updateSaveStatus) callbacks.updateSaveStatus('saving');
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
            if (callbacks && callbacks.updateSaveStatus) callbacks.updateSaveStatus('saved');

            if (mode === 'publish') {
                state.articleStatus = 'published';
            } else if (mode === 'schedule') {
                state.articleStatus = 'scheduled';
            } else {
                state.articleStatus = 'draft';
            }
            updateStatusBadge();

            if (callbacks && callbacks.clearDraftStorage) callbacks.clearDraftStorage();

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
            if (callbacks && callbacks.updateSaveStatus) callbacks.updateSaveStatus('error');
        }
    } catch(e) {
        console.error('Publish error:', e);
        alert('操作失败: 网络错误');
        state.isSaving = false;
        if (callbacks && callbacks.updateSaveStatus) callbacks.updateSaveStatus('error');
    }
}

export function updateStatusBadge() {
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
