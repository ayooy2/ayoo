/**
 * editor/tags.js — 标签选择器
 * 加载标签列表、渲染标签面板、管理已选标签
 */

import { API } from './config.js';
import { state, dom } from './state.js';
import { apiFetch, esc } from './utils.js';

// 加载标签列表
export async function loadTags() {
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

// 渲染标签选择面板
export function renderTagPanel() {
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

// 切换标签面板显示
export function toggleTagPanel() {
    if (!dom.tagPanel) return;
    dom.tagPanel.classList.toggle('hidden');
    if (!dom.tagPanel.classList.contains('hidden')) {
        renderTagPanel();
    }
}

// 切换标签选中状态
export function toggleTag(tag) {
    var idx = state.selectedTags.indexOf(tag);
    if (idx !== -1) {
        state.selectedTags.splice(idx, 1);
    } else {
        state.selectedTags.push(tag);
    }
    renderSelectedTags();
    renderTagPanel();
    state.isDirty = true;
}

// 渲染已选标签
export function renderSelectedTags() {
    if (!dom.tagChips) return;
    if (!state.selectedTags.length) {
        dom.tagChips.innerHTML = '';
        return;
    }

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

// 标签输入框回车处理
export function onTagInputKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        var val = dom.tagInput.value.trim();
        if (val && state.selectedTags.indexOf(val) === -1) {
            state.selectedTags.push(val);
            renderSelectedTags();
            renderTagPanel();
            state.isDirty = true;
        }
        dom.tagInput.value = '';
    }
}
