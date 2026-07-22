/**
 * editor/state.js — 共享状态 & DOM 引用
 * 所有模块通过 import 引用同一份 state/dom 对象
 */

// 编辑器状态
export var state = {
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

// DOM 元素引用（在 cacheDom() 中填充）
export var dom = {};

// 缓存 DOM 元素引用
export function cacheDom() {
    var $ = function(s) { return document.querySelector(s); };
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
