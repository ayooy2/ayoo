/**
 * editor/codelang.js — 斜杠命令菜单 + 代码块语言选择器
 * Typora 风格：输入 ``` 后弹出语言选择，输入 / 后弹出命令菜单
 */

import { SLASH_COMMANDS, CODE_LANGUAGES, MD_CMDS } from './config.js';
import { state, dom } from './state.js';
import { getCursorPixelPos } from './utils.js';

// 代码块语言选择器状态
var codeLangMenuOpen = false;
var codeLangMenuIndex = 0;
var codeLangStartPos = -1;

/**
 * 检测并显示斜杠命令或代码语言菜单
 * 由 content input 事件触发
 */
export function checkMenus() {
    var ta = dom.contentArea;
    if (!ta) return;
    var pos = ta.selectionStart;
    var val = ta.value;

    // 检测代码块语言选择器（Typora 风格）
    var lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    var currentLine = val.substring(lineStart, pos);
    if (currentLine === '```' || currentLine.match(/^```[\w+#]*$/)) {
        codeLangStartPos = lineStart;
        var query = currentLine.substring(3);
        showCodeLangMenu(query);
        return;
    }

    // 检测斜杠命令
    var slashIdx = val.lastIndexOf('/', pos);
    if (slashIdx !== -1 && slashIdx >= pos - 20) {
        var charBefore = slashIdx > 0 ? val[slashIdx - 1] : '\n';
        if (charBefore === '\n' || charBefore === ' ' || slashIdx === 0) {
            var slashQuery = val.substring(slashIdx + 1, pos);
            if (slashQuery.indexOf(' ') === -1) {
                state.slashStartPos = slashIdx;
                showSlashMenu(slashQuery);
                return;
            }
        }
    }
    hideSlashMenu();
    hideCodeLangMenu();
}

// ── 代码块语言选择器 ──

function showCodeLangMenu(query) {
    var menu = document.getElementById('code-lang-menu');
    var list = document.getElementById('code-lang-list');
    var input = document.getElementById('code-lang-input');
    if (!menu || !list) return;

    codeLangMenuOpen = true;
    codeLangMenuIndex = 0;

    var filtered = CODE_LANGUAGES.filter(function(lang) {
        if (!query) return true;
        var q = query.toLowerCase();
        return lang.key.indexOf(q) !== -1 ||
               lang.name.toLowerCase().indexOf(q) !== -1 ||
               lang.aliases.some(function(a) { return a.indexOf(q) !== -1; });
    });

    var html = '';
    filtered.forEach(function(lang, i) {
        html += '<button class="eh-code-lang-item' + (i === 0 ? ' active' : '') + '" data-lang="' + lang.key + '">' +
                '<span class="lang-key">' + lang.key.substring(0, 4) + '</span>' +
                '<span class="lang-name">' + lang.name + '</span></button>';
    });
    list.innerHTML = html;

    list.querySelectorAll('.eh-code-lang-item').forEach(function(item) {
        item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectCodeLang(item.getAttribute('data-lang'));
        });
        item.addEventListener('mouseenter', function() {
            list.querySelectorAll('.eh-code-lang-item').forEach(function(el) { el.classList.remove('active'); });
            item.classList.add('active');
            codeLangMenuIndex = Array.prototype.indexOf.call(list.children, item);
        });
    });

    if (input) {
        input.value = query;
        input.focus();
        input.oninput = function() {
            showCodeLangMenu(input.value);
        };
    }

    positionCodeLangMenu(menu);
    menu.classList.remove('hidden');
}

function hideCodeLangMenu() {
    codeLangMenuOpen = false;
    var menu = document.getElementById('code-lang-menu');
    if (menu) menu.classList.add('hidden');
}

function positionCodeLangMenu(menu) {
    var ta = dom.contentArea;
    if (!ta) return;
    var pos = getCursorPixelPos(ta, ta.selectionStart);
    var top = pos.top + 24;
    var left = pos.left;

    if (top + 320 > window.innerHeight) {
        top = pos.top - 320 - 5;
    }
    if (left + 280 > window.innerWidth) {
        left = window.innerWidth - 290;
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
}

function selectCodeLang(lang) {
    var ta = dom.contentArea;
    if (!ta || codeLangStartPos === -1) return;

    var pos = ta.selectionStart;
    var val = ta.value;

    var before = val.substring(0, codeLangStartPos);
    var after = val.substring(pos);

    saveUndoState(ta);
    ta.value = before + '```' + lang + '\n\n```' + after;
    ta.selectionStart = ta.selectionEnd = codeLangStartPos + lang.length + 4;

    hideCodeLangMenu();
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── 斜杠命令菜单 ──

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

    var items = menu.querySelectorAll('.eh-slash-item');
    items.forEach(function(item, i) {
        var cmd = item.getAttribute('data-cmd');
        var match = filtered.some(function(f) { return f.cmd === cmd; });
        item.style.display = match ? 'flex' : 'none';
        item.classList.toggle('active', i === 0 && match);
    });

    positionSlashMenu(menu);
    menu.classList.remove('hidden');
}

export function hideSlashMenu() {
    state.slashMenuOpen = false;
    if (dom.slashMenu) {
        dom.slashMenu.classList.add('hidden');
    }
}

function positionSlashMenu(menu) {
    var ta = dom.contentArea;
    if (!ta) return;
    var pos = getCursorPixelPos(ta, state.slashStartPos);
    var top = pos.top + 24;
    var left = pos.left;

    if (top + 320 > window.innerHeight) {
        top = pos.top - 320 - 8;
    }

    menu.style.top = top + 'px';
    menu.style.left = Math.min(left, window.innerWidth - 240) + 'px';
}

export function executeSlashCommand(cmd, lang) {
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

    // 调用 insertMD（由 editor.js 提供）
    if (typeof state._insertMD === 'function') {
        state._insertMD(cmd, lang);
    }
}

// ── 键盘导航 ──

export function handleCodeLangKeydown(e) {
    if (!codeLangMenuOpen) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateCodeLangMenu(1);
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateCodeLangMenu(-1);
        return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        var list = document.getElementById('code-lang-list');
        if (list) {
            var items = list.querySelectorAll('.eh-code-lang-item');
            if (items[codeLangMenuIndex]) {
                selectCodeLang(items[codeLangMenuIndex].getAttribute('data-lang'));
            }
        }
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideCodeLangMenu();
        return true;
    }
    return false;
}

export function handleSlashKeydown(e) {
    if (!state.slashMenuOpen) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSlashMenu(1);
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSlashMenu(-1);
        return true;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        var visibleItems = Array.prototype.slice.call(dom.slashMenu.querySelectorAll('.eh-slash-item')).filter(function(el) {
            return el.style.display !== 'none';
        });
        if (visibleItems[state.slashMenuIndex]) {
            var selectedItem = visibleItems[state.slashMenuIndex];
            executeSlashCommand(selectedItem.getAttribute('data-cmd'), selectedItem.getAttribute('data-lang'));
        }
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideSlashMenu();
        return true;
    }
    return false;
}

function navigateSlashMenu(dir) {
    var visibleItems = Array.prototype.slice.call(dom.slashMenu.querySelectorAll('.eh-slash-item')).filter(function(el) {
        return el.style.display !== 'none';
    });
    if (!visibleItems.length) return;

    visibleItems[state.slashMenuIndex].classList.remove('active');
    state.slashMenuIndex = (state.slashMenuIndex + dir + visibleItems.length) % visibleItems.length;
    visibleItems[state.slashMenuIndex].classList.add('active');
    visibleItems[state.slashMenuIndex].scrollIntoView({ block: 'nearest' });
}

function navigateCodeLangMenu(dir) {
    var list = document.getElementById('code-lang-list');
    if (!list) return;
    var items = list.querySelectorAll('.eh-code-lang-item');
    if (!items.length) return;

    items[codeLangMenuIndex].classList.remove('active');
    codeLangMenuIndex = (codeLangMenuIndex + dir + items.length) % items.length;
    items[codeLangMenuIndex].classList.add('active');
    items[codeLangMenuIndex].scrollIntoView({ block: 'nearest' });
}

// 保存撤销状态（需要从 editor.js 注入）
function saveUndoState(ta) {
    if (typeof state._saveUndoState === 'function') {
        state._saveUndoState(ta);
    }
}
