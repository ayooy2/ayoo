/**
 * editor/import.js — 文件导入
 * 支持 .md / .txt / .html 文件导入，自动解析 Front Matter
 */

import { state, dom } from './state.js';

// 导入文件
export function onFileImport(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert('文件不能超过 2MB');
        e.target.value = '';
        return;
    }

    var reader = new FileReader();
    reader.onload = function(ev) {
        var content = ev.target.result;
        var fileName = file.name.toLowerCase();

        if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
            content = convertHtmlToMarkdown(content);
        }

        if (state.isDirty) {
            if (!confirm('当前有未保存的修改，导入将覆盖现有内容，是否继续？')) {
                e.target.value = '';
                return;
            }
        }

        var parsed = parseFrontMatter(content);

        if (dom.titleInput && parsed.title) {
            dom.titleInput.value = parsed.title;
            dom.titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (dom.contentArea) {
            dom.contentArea.value = parsed.content;
            dom.contentArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (dom.summaryInput && parsed.summary) {
            dom.summaryInput.value = parsed.summary;
        }
        if (dom.coverInput && parsed.cover) {
            dom.coverInput.value = parsed.cover;
        }
        if (parsed.tags && parsed.tags.length > 0) {
            state.selectedTags = parsed.tags;
            // renderSelectedTags 由 editor.js 中的 bindTagsModule 设置
            if (typeof state._renderSelectedTags === 'function') {
                state._renderSelectedTags();
            }
        }

        state.isDirty = true;
        if (dom.saveStatus) {
            dom.saveStatus.textContent = '未保存';
        }
        alert('导入成功！');
    };

    reader.onerror = function() {
        alert('读取文件失败');
    };

    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
}

// 解析 Front Matter
function parseFrontMatter(content) {
    var result = {
        title: '',
        content: content,
        summary: '',
        cover: '',
        tags: []
    };

    if (!content.startsWith('---')) {
        return result;
    }

    var endIndex = content.indexOf('---', 3);
    if (endIndex === -1) {
        return result;
    }

    var frontMatter = content.substring(3, endIndex).trim();
    var body = content.substring(endIndex + 3).trim();

    var lines = frontMatter.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        var key = line.substring(0, colonIndex).trim().toLowerCase();
        var value = line.substring(colonIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }

        switch (key) {
            case 'title':
                result.title = value;
                break;
            case 'description':
            case 'summary':
            case 'excerpt':
                result.summary = value;
                break;
            case 'cover':
            case 'cover_image':
            case 'thumbnail':
            case 'image':
                result.cover = value;
                break;
            case 'tags':
                if (value.startsWith('[') && value.endsWith(']')) {
                    result.tags = value.substring(1, value.length - 1)
                        .split(',')
                        .map(function(t) { return t.trim().replace(/['"]/g, ''); })
                        .filter(function(t) { return t; });
                } else {
                    result.tags = value.split(',')
                        .map(function(t) { return t.trim(); })
                        .filter(function(t) { return t; });
                }
                break;
        }
    }

    result.content = body;
    return result;
}

// HTML 转 Markdown
function convertHtmlToMarkdown(html) {
    var div = document.createElement('div');
    div.innerHTML = html;

    function processNode(node) {
        if (node.nodeType === 3) return node.textContent;
        if (node.nodeType !== 1) return '';

        var tag = node.tagName.toLowerCase();
        var children = '';
        for (var i = 0; i < node.childNodes.length; i++) {
            children += processNode(node.childNodes[i]);
        }

        switch (tag) {
            case 'h1': return '# ' + children.trim() + '\n\n';
            case 'h2': return '## ' + children.trim() + '\n\n';
            case 'h3': return '### ' + children.trim() + '\n\n';
            case 'h4': return '#### ' + children.trim() + '\n\n';
            case 'h5': return '##### ' + children.trim() + '\n\n';
            case 'h6': return '###### ' + children.trim() + '\n\n';
            case 'p': return children.trim() + '\n\n';
            case 'br': return '\n';
            case 'strong':
            case 'b': return '**' + children + '**';
            case 'em':
            case 'i': return '*' + children + '*';
            case 'del':
            case 's': return '~~' + children + '~~';
            case 'code':
                if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
                    return children;
                }
                return '`' + children + '`';
            case 'pre':
                var codeEl = node.querySelector('code');
                var lang = '';
                if (codeEl) {
                    var className = codeEl.className || '';
                    var match = className.match(/language-(\w+)/);
                    if (match) lang = match[1];
                }
                return '```' + lang + '\n' + children.trim() + '\n```\n\n';
            case 'a':
                var href = node.getAttribute('href') || '';
                return '[' + children + '](' + href + ')';
            case 'img':
                var src = node.getAttribute('src') || '';
                var alt = node.getAttribute('alt') || '';
                return '![' + alt + '](' + src + ')';
            case 'ul': return children;
            case 'ol': return children;
            case 'li':
                if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol') {
                    return '1. ' + children.trim() + '\n';
                }
                return '- ' + children.trim() + '\n';
            case 'blockquote': return '> ' + children.trim() + '\n\n';
            case 'hr': return '---\n\n';
            case 'table': return convertTableToMarkdown(node);
            case 'div':
            case 'section':
            case 'article': return children;
            default: return children;
        }
    }

    var result = processNode(div);
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
}

// 表格转 Markdown
function convertTableToMarkdown(table) {
    var rows = table.querySelectorAll('tr');
    if (!rows.length) return '';

    var result = '';
    var maxCols = 0;

    rows.forEach(function(row) {
        var cells = row.querySelectorAll('th, td');
        if (cells.length > maxCols) maxCols = cells.length;
    });

    rows.forEach(function(row, rowIndex) {
        var cells = row.querySelectorAll('th, td');
        var line = '|';
        for (var i = 0; i < maxCols; i++) {
            if (cells[i]) {
                line += ' ' + cells[i].textContent.trim() + ' |';
            } else {
                line += ' |';
            }
        }
        result += line + '\n';

        if (rowIndex === 0) {
            result += '| ' + Array(maxCols).fill('---').join(' | ') + ' |\n';
        }
    });

    return result + '\n';
}
