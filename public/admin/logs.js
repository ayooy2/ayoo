(function() {
    var _logsData = [];

    async function loadLogs() {
        try {
            var level = document.getElementById('logs-filter-level').value;
            var url = '/api/error-logs?limit=100' + (level ? '&level=' + level : '');
            var res = await apiFetch(url);
            if (!res.ok) return;
            var data = await res.json();
            _logsData = data.logs || [];
            document.getElementById('logs-count').textContent = data.total || 0;
            renderLogsTable();
        } catch(e) {
            document.getElementById('logs-table-area').innerHTML = '<p style="text-align:center;color:var(--color-danger);padding:2rem;">加载失败</p>';
        }
    }

    function renderLogsTable() {
        var area = document.getElementById('logs-table-area');
        if (!_logsData.length) {
            area.innerHTML = '<div class="empty-state"><p>暂无错误日志</p></div>';
            return;
        }

        var levelColors = { error: 'var(--color-danger)', warn: '#ed8936', info: 'var(--color-primary)' };
        var levelLabels = { error: 'ERROR', warn: 'WARN', info: 'INFO' };

        var html = '<table class="data-table"><thead><tr>'
            + '<th style="width:80px">级别</th>'
            + '<th>信息</th>'
            + '<th style="width:150px">路径</th>'
            + '<th style="width:150px">时间</th>'
            + '</tr></thead><tbody>';

        for (var i = 0; i < _logsData.length; i++) {
            var log = _logsData[i];
            var time = (log.created_at || '').slice(0, 16).replace('T', ' ');
            var color = levelColors[log.level] || 'var(--color-text)';
            var label = levelLabels[log.level] || log.level;
            html += '<tr>'
                + '<td><span style="color:' + color + ';font-weight:600;font-size:0.78rem;">' + label + '</span></td>'
                + '<td style="max-width:400px;word-break:break-all;">' + escapeHtml(log.message) + '</td>'
                + '<td style="font-size:0.82rem;color:var(--color-text-muted);">' + escapeHtml(log.path || '-') + '</td>'
                + '<td style="white-space:nowrap;font-size:0.82rem;">' + time + '</td>'
                + '</tr>';
        }

        html += '</tbody></table>';
        area.innerHTML = html;
    }

    async function clearLogs() {
        if (!confirm('确定清空所有错误日志？')) return;
        try {
            var res = await apiFetch('/api/error-logs', { method: 'DELETE' });
            if (res.ok) {
                _logsData = [];
                document.getElementById('logs-count').textContent = 0;
                renderLogsTable();
            } else {
                alert('清空失败');
            }
        } catch(e) {
            alert('清空失败');
        }
    }

    // 暴露到全局
    window.loadLogs = loadLogs;
    window.clearLogs = clearLogs;
})();
