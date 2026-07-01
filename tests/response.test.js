import { describe, it, expect } from 'vitest';
import { json, error } from '../functions/lib/response.js';

describe('json()', () => {
  it('返回 JSON 响应', () => {
    const res = json({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('支持自定义状态码', () => {
    const res = json({ created: true }, 201);
    expect(res.status).toBe(201);
  });

  it('包含 X-Content-Type-Options 头', () => {
    const res = json({ ok: true });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('error()', () => {
  it('返回错误响应', () => {
    const res = error('出错了', 400);
    expect(res.status).toBe(400);
  });

  it('默认 400 状态码', () => {
    const res = error('请求错误');
    expect(res.status).toBe(400);
  });

  it('响应体包含 error 字段', async () => {
    const res = error('测试错误', 422);
    const body = await res.json();
    expect(body.error).toBe('测试错误');
  });

  it('包含 X-Content-Type-Options 头', () => {
    const res = error('test');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
