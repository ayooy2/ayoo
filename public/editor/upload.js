/**
 * editor/upload.js — 文件上传（图片、视频、音频、封面）
 * 处理文件选择、上传到 API、插入到编辑区
 */

import { API } from './config.js';
import { state, dom } from './state.js';
import { apiFetch, esc } from './utils.js';

// 通用状态更新
function updateSaveStatus(s) {
    if (!dom.saveStatus) return;
    dom.saveStatus.classList.remove('saving', 'saved', 'error');
    switch (s) {
        case 'saving': dom.saveStatus.classList.add('saving'); dom.saveStatus.textContent = '保存中...'; break;
        case 'saved':  dom.saveStatus.classList.add('saved');  dom.saveStatus.textContent = '已保存'; break;
        case 'error':  dom.saveStatus.classList.add('error');  dom.saveStatus.textContent = '保存失败'; break;
        case 'unsaved': dom.saveStatus.textContent = '未保存'; break;
        default: dom.saveStatus.textContent = '';
    }
}

// 封面预览
export function updateCoverPreview() {
    if (!dom.coverPreview || !dom.coverInput) return;
    var url = dom.coverInput.value.trim();
    if (url) {
        dom.coverPreview.innerHTML = '<img src="' + esc(url) + '" alt="封面">';
        var img = dom.coverPreview.querySelector('img');
        img.onerror = function() {
            dom.coverPreview.innerHTML = '<span>图片加载失败</span>';
        };
    } else {
        dom.coverPreview.innerHTML = '<span>无封面</span>';
    }
}

// 封面上传
export async function onCoverUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        alert('图片不能超过 10MB');
        e.target.value = '';
        return;
    }

    var formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'image');

    try {
        updateSaveStatus('saving');
        var res = await apiFetch(API.uploadImage, { method: 'POST', body: formData });
        if (res.ok) {
            var data = await res.json();
            if (dom.coverInput) dom.coverInput.value = data.url || data.src || '';
            updateCoverPreview();
            state.isDirty = true;
            updateSaveStatus('unsaved');
        } else {
            alert('上传失败');
            updateSaveStatus('unsaved');
        }
    } catch(err) {
        alert('上传失败: 网络错误');
        updateSaveStatus('error');
    }
    e.target.value = '';
}

// 文章内图片上传（插入 Markdown 图片语法）
export async function onImageUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        alert('图片不能超过 10MB');
        e.target.value = '';
        return;
    }

    var formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'image');

    try {
        updateSaveStatus('saving');
        var res = await apiFetch(API.uploadImage, { method: 'POST', body: formData });
        if (res.ok) {
            var data = await res.json();
            var url = data.url || data.src || '';
            var ta = dom.contentArea;
            if (ta && url) {
                var imgTag = '\n![图片描述](' + url + ')\n';
                var pos = ta.selectionStart;
                ta.value = ta.value.substring(0, pos) + imgTag + ta.value.substring(pos);
                ta.selectionStart = ta.selectionEnd = pos + imgTag.length;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
            updateSaveStatus('unsaved');
        } else {
            alert('上传失败');
            updateSaveStatus('unsaved');
        }
    } catch(err) {
        alert('上传失败: 网络错误');
        updateSaveStatus('error');
    }
    e.target.value = '';
}

// 视频上传
export async function onVideoUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        alert('视频不能超过 50MB');
        e.target.value = '';
        return;
    }

    var formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'video');

    try {
        updateSaveStatus('saving');
        var res = await apiFetch(API.uploadMedia, { method: 'POST', body: formData });
        if (res.ok) {
            var data = await res.json();
            var url = data.url || '';
            var ta = dom.contentArea;
            if (ta && url) {
                var videoTag = '\n<video src="' + url + '" controls></video>\n';
                var pos = ta.selectionStart;
                ta.value = ta.value.substring(0, pos) + videoTag + ta.value.substring(pos);
                ta.selectionStart = ta.selectionEnd = pos + videoTag.length;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
            updateSaveStatus('unsaved');
        } else {
            alert('上传失败');
            updateSaveStatus('unsaved');
        }
    } catch(err) {
        alert('上传失败: 网络错误');
        updateSaveStatus('error');
    }
    e.target.value = '';
}

// 音频上传
export async function onAudioUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        alert('音频不能超过 10MB');
        e.target.value = '';
        return;
    }

    var formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'audio');

    try {
        updateSaveStatus('saving');
        var res = await apiFetch(API.uploadMedia, { method: 'POST', body: formData });
        if (res.ok) {
            var data = await res.json();
            var url = data.url || '';
            var ta = dom.contentArea;
            if (ta && url) {
                var audioTag = '\n<audio src="' + url + '" controls></audio>\n';
                var pos = ta.selectionStart;
                ta.value = ta.value.substring(0, pos) + audioTag + ta.value.substring(pos);
                ta.selectionStart = ta.selectionEnd = pos + audioTag.length;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
            updateSaveStatus('unsaved');
        } else {
            alert('上传失败');
            updateSaveStatus('unsaved');
        }
    } catch(err) {
        alert('上传失败: 网络错误');
        updateSaveStatus('error');
    }
    e.target.value = '';
}

// Google 地图嵌入
export function insertMap() {
    var mapUrl = prompt('请输入 Google 地图链接 (https://www.google.com/maps/...):');
    if (!mapUrl) return;

    var parsed;
    try { parsed = new URL(mapUrl); } catch(e) {
        alert('请输入有效的 URL');
        return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        alert('请输入有效的 URL（以 http:// 或 https:// 开头）');
        return;
    }
    var host = parsed.hostname.toLowerCase();
    var isGoogleMaps = host === 'google.com' || host.endsWith('.google.com');
    var isShortLink = host === 'maps.app.goo.gl' || host === 'goo.gl';
    if (!isGoogleMaps && !isShortLink) {
        alert('请输入 Google 地图链接');
        return;
    }

    var embedUrl = mapUrl;
    if (isGoogleMaps) {
        if (mapUrl.indexOf('/maps/place/') !== -1) {
            embedUrl = mapUrl.replace('/maps/place/', '/maps/embed?pb=');
        } else if (mapUrl.indexOf('/maps/@') !== -1) {
            var coords = mapUrl.match(/@([-\d.]+),([-\d.]+)/);
            if (coords) {
                embedUrl = 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d10000!2d' + coords[2] + '!3d' + coords[1];
            }
        }
    } else {
        alert('请先在浏览器中打开短链接，然后复制展开后的完整链接');
        return;
    }

    var ta = dom.contentArea;
    if (ta) {
        var mapTag = '\n<iframe src="' + embedUrl + '" width="600" height="450" style="border:0" allowfullscreen loading="lazy"></iframe>\n';
        var pos = ta.selectionStart;
        ta.value = ta.value.substring(0, pos) + mapTag + ta.value.substring(pos);
        ta.selectionStart = ta.selectionEnd = pos + mapTag.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
