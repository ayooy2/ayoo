/**
 * response.js — HTTP 响应工具
 * 功能：统一的 JSON 响应和错误响应格式
 * 导出：json(), error()
 * 依赖：无
 * 使用：所有 API 端点使用此模块返回响应
 */
export function json(data, extraHeaders = {}, status = 200) {
  if (typeof extraHeaders === 'number') { status = extraHeaders; extraHeaders = {}; }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}
