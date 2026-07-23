/**
 * admin/core.js — 后台管理核心逻辑
 * 功能：网站 CRUD、设置管理、图片管理、认证、导出/保存
 * 依赖：无（独立 IIFE，通过全局 apiFetch 暴露接口）
 */
(function() {
    // ---- 常量 ----
    var API_BASE = '/api/sites';
    var API_SETTINGS = '/api/settings';
    var API_AUTH = '/api/auth';

    // ---- 工具函数 ----
    function apiFetch(url, opts) {
        opts = opts || {};
        opts.credentials = 'same-origin';
        return fetch(url, opts);
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ---- 主题初始化 ----
    (function() {
        var saved = localStorage.getItem('theme') || 'light';
        if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        var btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.textContent = saved === 'dark' ? '☀' : '☽';
            btn.addEventListener('click', function() {
                var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                if (isDark) {
                    document.documentElement.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                    btn.textContent = '☽';
                } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                    btn.textContent = '☀';
                }
            });
        }
    })();

    // ---- 退出登录 ----
    function logout() {
        apiFetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(function() {
            window.location.href = '/login.html';
        });
    }

    // ---- 修改密码 ----
    function togglePw(btn) {
        var inp = btn.parentElement.querySelector('input');
        if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '隐藏'; }
        else { inp.type = 'password'; btn.textContent = '显示'; }
    }

    function openPwModal() {
        document.getElementById('pw-error').style.display = 'none';
        document.getElementById('pw-success').style.display = 'none';
        document.getElementById('pw-current').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-confirm').value = '';
        document.getElementById('pw-modal').classList.add('active');
    }

    function closePwModal() {
        document.getElementById('pw-modal').classList.remove('active');
    }

    async function changePassword(e) {
        e.preventDefault();
        var errEl = document.getElementById('pw-error');
        var okEl = document.getElementById('pw-success');
        errEl.style.display = 'none';
        okEl.style.display = 'none';

        var cur = document.getElementById('pw-current').value;
        var nw = document.getElementById('pw-new').value;
        var cf = document.getElementById('pw-confirm').value;

        if (!cur) {
            errEl.textContent = '请输入当前密码';
            errEl.style.display = 'block';
            return;
        }

        if (nw !== cf) {
            errEl.textContent = '两次输入的新密码不一致';
            errEl.style.display = 'block';
            return;
        }

        if (nw.length < 8) {
            errEl.textContent = '密码长度至少为 8 个字符';
            errEl.style.display = 'block';
            return;
        }

        try {
            var res = await apiFetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: cur, new_password: nw })
            });
            var data = await res.json();
            if (!res.ok) {
                errEl.textContent = data.error || '修改失败';
                errEl.style.display = 'block';
                return;
            }
            okEl.style.display = 'block';
            setTimeout(function() { window.location.href = '/login.html'; }, 1500);
        } catch (err) {
            errEl.textContent = '网络错误，请重试';
            errEl.style.display = 'block';
        }
    }

    // ---- 导出数据 ----
    async function exportData() {
        try {
            var res = await apiFetch('/api/export');
            if (!res.ok) {
                if (res.status === 401) { alert('登录已过期'); logout(); return; }
                alert('导出失败');
                return;
            }
            var blob = await res.blob();
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'ayoo-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('导出失败，请稍后再试');
        }
    }

    // ---- 导入数据 ----
    async function importData() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async function() {
            var file = input.files[0];
            if (!file) return;
            if (!confirm('⚠️ 导入将覆盖当前所有数据，确定继续吗？')) return;
            try {
                var text = await file.text();
                var data = JSON.parse(text);
                if (!data.tables) { alert('数据格式错误：缺少 tables 字段'); return; }
                var res = await apiFetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res.ok) {
                    var err = await res.json().catch(function(){ return {error:'未知错误'} });
                    alert('导入失败: ' + (err.error || res.status));
                    return;
                }
                var result = await res.json();
                var summary = [];
                for (var t in result.results) {
                    var r = result.results[t];
                    if (r.skipped) continue;
                    summary.push(t + ': ' + r.imported + ' 条' + (r.error ? ' (错误: ' + r.error + ')' : ''));
                }
                alert('导入完成！\n\n' + summary.join('\n'));
                location.reload();
            } catch (e) {
                alert('导入失败: ' + e.message);
            }
        };
        input.click();
    }

    // ---- 暴露到全局 ----
    window.API_BASE = API_BASE;
    window.API_SETTINGS = API_SETTINGS;
    window.API_AUTH = API_AUTH;
    window.apiFetch = apiFetch;
    window.escapeHtml = escapeHtml;
    window.logout = logout;
    window.togglePw = togglePw;
    window.openPwModal = openPwModal;
    window.closePwModal = closePwModal;
    window.changePassword = changePassword;
    window.exportData = exportData;
    window.importData = importData;
})();
