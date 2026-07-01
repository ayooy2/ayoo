import { describe, it, expect } from 'vitest';
import { esc, sanitizeMD } from '../functions/lib/sanitize.js';

describe('esc()', () => {
  it('转义 & 字符', () => {
    expect(esc('a&b')).toBe('a&amp;b');
  });

  it('转义 < 和 >', () => {
    expect(esc('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
  });

  it('转义双引号', () => {
    expect(esc('a="b"')).toBe('a=&quot;b&quot;');
  });

  it('转义单引号', () => {
    expect(esc("a='b'")).toBe('a=&#39;b&#39;');
  });

  it('处理 null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('处理空字符串', () => {
    expect(esc('')).toBe('');
  });

  it('处理数字', () => {
    expect(esc(123)).toBe('123');
  });

  it('组合转义', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

describe('sanitizeMD()', () => {
  it('移除 script 标签', () => {
    expect(sanitizeMD('<p>hello</p><script>alert(1)</script>')).toBe('<p>hello</p>');
  });

  it('移除 style 标签', () => {
    expect(sanitizeMD('<p>text</p><style>body{color:red}</style>')).toBe('<p>text</p>');
  });

  it('移除 iframe', () => {
    expect(sanitizeMD('<p>ok</p><iframe src="evil"></iframe>')).toBe('<p>ok</p>');
  });

  it('移除 on* 事件属性', () => {
    const result = sanitizeMD('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
    expect(result).toContain('src="x"');
  });

  it('移除 javascript: 协议', () => {
    expect(sanitizeMD('<a href="javascript:alert(1)">click</a>')).toBe('<a href="alert(1)">click</a>');
  });

  it('移除 vbscript: 协议', () => {
    expect(sanitizeMD('<a href="vbscript:msgbox">click</a>')).toBe('<a href="msgbox">click</a>');
  });

  it('阻止危险的 data: URI', () => {
    const result = sanitizeMD('<a href="data:text/html,evil">click</a>');
    expect(result).not.toContain('data:');
    expect(result).toContain('click</a>');
  });

  it('允许安全的 data:image/ URI', () => {
    expect(sanitizeMD('<img src="data:image/png;base64,abc">')).toBe('<img src="data:image/png;base64,abc">');
  });

  it('保留正常 HTML', () => {
    expect(sanitizeMD('<p>Hello <strong>world</strong></p>')).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('移除 form 标签', () => {
    expect(sanitizeMD('<p>text</p><form action="/submit"></form>')).toBe('<p>text</p>');
  });

  it('移除 embed 和 object', () => {
    expect(sanitizeMD('<embed src="x"><object data="y"></object>')).toBe('');
  });
});

describe('safeUrl 协议检查', () => {
  // 模拟 safeUrl 逻辑
  function safeUrl(u) {
    if (!u) return '';
    if (/^javascript:|^data:|^vbscript:/i.test(u)) return '#';
    return u;
  }

  it('允许 http/https', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('允许相对路径', () => {
    expect(safeUrl('/blog/post')).toBe('/blog/post');
  });

  it('阻止 javascript:', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
  });

  it('阻止 data:', () => {
    expect(safeUrl('data:text/html,<script>')).toBe('#');
  });

  it('阻止 vbscript:', () => {
    expect(safeUrl('vbscript:msgbox')).toBe('#');
  });

  it('处理空值', () => {
    expect(safeUrl('')).toBe('');
    expect(safeUrl(null)).toBe('');
    expect(safeUrl(undefined)).toBe('');
  });
});
