/**
 * editor/config.js — 常量 & 配置
 * API 地址、Markdown 命令表、斜杠命令列表、代码语言列表
 */

// 自动保存 localStorage key 和延迟（毫秒）
export var AUTOSAVE_KEY = 'ayoo_editor_draft';
export var AUTOSAVE_DELAY = 3000;

// API 端点
export var API = {
    getArticle:  function(id) { return '/api/articles/' + id; },
    createArticle: '/api/articles',
    updateArticle: function(id) { return '/api/articles/' + id; },
    tags: '/api/tags',
    uploadImage: '/api/media',
    uploadMedia: '/api/media'
};

// Markdown 工具栏命令表
export var MD_CMDS = {
    bold:       { before: '**',     after: '**',        ph: '加粗文字',   inline: true },
    italic:     { before: '*',      after: '*',         ph: '斜体文字',   inline: true },
    strike:     { before: '~~',     after: '~~',        ph: '删除线文字', inline: true },
    code:       { before: '`',      after: '`',         ph: '代码',       inline: true },
    link:       { before: '[',      after: '](url)',    ph: '链接文字',   inline: true },
    image:      { before: '![',     after: '](url)',    ph: '图片描述',   inline: true },
    h2:         { before: '## ',    after: '',          ph: '二级标题',   block: true },
    h3:         { before: '### ',   after: '',          ph: '三级标题',   block: true },
    heading:    { before: '## ',    after: '',          ph: '标题',       block: true },
    quote:      { before: '> ',     after: '',          ph: '引用内容',   block: true },
    ul:         { before: '- ',     after: '',          ph: '列表项',     block: true },
    ol:         { before: '1. ',    after: '',          ph: '列表项',     block: true },
    codeblock:  { before: '```\n',  after: '\n```',     ph: '代码',       block: true, lang: true },
    codeBlock:  { before: '```\n',  after: '\n```',     ph: '代码',       block: true, lang: true },
    table:      { before: '| 列1 | 列2 |\n| ----- | ----- |\n| ', after: ' |\n', ph: '内容', block: true },
    hr:         { before: '\n---\n', after: '',         ph: '',           block: true },
    video:      { before: '<video src="', after: '" controls></video>', ph: '视频链接', inline: true },
    audio:      { before: '<audio src="', after: '" controls></audio>', ph: '音频链接', inline: true },
    map:        { before: '', after: '', ph: '', block: true }
};

// 斜杠命令列表
export var SLASH_COMMANDS = [
    { key: 'h2',    icon: 'H2',     name: '二级标题',   cmd: 'h2' },
    { key: 'h3',    icon: 'H3',     name: '三级标题',   cmd: 'h3' },
    { key: 'quote', icon: '"',  name: '引用块',     cmd: 'quote' },
    { key: 'code',  icon: '{ }',    name: '代码块',     cmd: 'codeblock', lang: true },
    { key: 'js',    icon: 'JS',     name: 'JavaScript', cmd: 'codeblock', lang: 'javascript' },
    { key: 'ts',    icon: 'TS',     name: 'TypeScript', cmd: 'codeblock', lang: 'typescript' },
    { key: 'py',    icon: 'PY',     name: 'Python',     cmd: 'codeblock', lang: 'python' },
    { key: 'java',  icon: 'JV',     name: 'Java',       cmd: 'codeblock', lang: 'java' },
    { key: 'c',     icon: 'C',      name: 'C',          cmd: 'codeblock', lang: 'c' },
    { key: 'cpp',   icon: 'C++',    name: 'C++',        cmd: 'codeblock', lang: 'cpp' },
    { key: 'cs',    icon: 'C#',     name: 'C#',         cmd: 'codeblock', lang: 'csharp' },
    { key: 'go',    icon: 'GO',     name: 'Go',         cmd: 'codeblock', lang: 'go' },
    { key: 'rust',  icon: 'RS',     name: 'Rust',       cmd: 'codeblock', lang: 'rust' },
    { key: 'php',   icon: 'PHP',    name: 'PHP',        cmd: 'codeblock', lang: 'php' },
    { key: 'rb',    icon: 'RB',     name: 'Ruby',       cmd: 'codeblock', lang: 'ruby' },
    { key: 'swift', icon: 'SW',     name: 'Swift',      cmd: 'codeblock', lang: 'swift' },
    { key: 'kt',    icon: 'KT',     name: 'Kotlin',     cmd: 'codeblock', lang: 'kotlin' },
    { key: 'html',  icon: '<>',     name: 'HTML',       cmd: 'codeblock', lang: 'html' },
    { key: 'css',   icon: '#',      name: 'CSS',        cmd: 'codeblock', lang: 'css' },
    { key: 'scss',  icon: 'SC',     name: 'SCSS',       cmd: 'codeblock', lang: 'scss' },
    { key: 'sql',   icon: 'DB',     name: 'SQL',        cmd: 'codeblock', lang: 'sql' },
    { key: 'shell', icon: '$_',     name: 'Shell',      cmd: 'codeblock', lang: 'bash' },
    { key: 'bash',  icon: '$_',     name: 'Bash',       cmd: 'codeblock', lang: 'bash' },
    { key: 'ps',    icon: 'PS',     name: 'PowerShell', cmd: 'codeblock', lang: 'powershell' },
    { key: 'json',  icon: '{}',     name: 'JSON',       cmd: 'codeblock', lang: 'json' },
    { key: 'yaml',  icon: 'YML',    name: 'YAML',       cmd: 'codeblock', lang: 'yaml' },
    { key: 'xml',   icon: '<>',     name: 'XML',        cmd: 'codeblock', lang: 'xml' },
    { key: 'md',    icon: 'MD',     name: 'Markdown',   cmd: 'codeblock', lang: 'markdown' },
    { key: 'docker',icon: 'DK',     name: 'Dockerfile', cmd: 'codeblock', lang: 'dockerfile' },
    { key: 'make',  icon: 'MK',     name: 'Makefile',   cmd: 'codeblock', lang: 'makefile' },
    { key: 'lua',   icon: 'Lua',    name: 'Lua',        cmd: 'codeblock', lang: 'lua' },
    { key: 'r',     icon: 'R',      name: 'R',          cmd: 'codeblock', lang: 'r' },
    { key: 'scala', icon: 'SC',     name: 'Scala',      cmd: 'codeblock', lang: 'scala' },
    { key: 'perl',  icon: 'PL',     name: 'Perl',       cmd: 'codeblock', lang: 'perl' },
    { key: 'dart',  icon: 'DT',     name: 'Dart',       cmd: 'codeblock', lang: 'dart' },
    { key: 'text',  icon: 'TXT',    name: '纯文本',     cmd: 'codeblock', lang: 'text' },
    { key: 'ul',    icon: '•',  name: '无序列表',   cmd: 'ul' },
    { key: 'ol',    icon: '1.',     name: '有序列表',   cmd: 'ol' },
    { key: 'hr',    icon: '—',  name: '分割线',     cmd: 'hr' },
    { key: 'table', icon: '■',  name: '表格',       cmd: 'table' },
    { key: 'image', icon: '📷', name: '图片',  cmd: 'image' },
    { key: 'link',  icon: '🔗', name: '链接',  cmd: 'link' },
    { key: 'video', icon: '🎬', name: '视频',  cmd: 'video' },
    { key: 'audio', icon: '🎵', name: '音频',  cmd: 'audio' },
    { key: 'map',   icon: '🗺️', name: 'Google 地图', cmd: 'map' }
];

// 代码块语言列表（与 highlight.js 兼容）
export var CODE_LANGUAGES = [
    { key: 'javascript', name: 'JavaScript', aliases: ['js'] },
    { key: 'typescript', name: 'TypeScript', aliases: ['ts'] },
    { key: 'python', name: 'Python', aliases: ['py'] },
    { key: 'java', name: 'Java', aliases: [] },
    { key: 'c', name: 'C', aliases: [] },
    { key: 'cpp', name: 'C++', aliases: ['c++'] },
    { key: 'csharp', name: 'C#', aliases: ['cs', 'c#'] },
    { key: 'go', name: 'Go', aliases: ['golang'] },
    { key: 'rust', name: 'Rust', aliases: ['rs'] },
    { key: 'php', name: 'PHP', aliases: [] },
    { key: 'ruby', name: 'Ruby', aliases: ['rb'] },
    { key: 'swift', name: 'Swift', aliases: [] },
    { key: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
    { key: 'html', name: 'HTML', aliases: [] },
    { key: 'css', name: 'CSS', aliases: [] },
    { key: 'scss', name: 'SCSS', aliases: ['sass'] },
    { key: 'less', name: 'LESS', aliases: [] },
    { key: 'sql', name: 'SQL', aliases: [] },
    { key: 'bash', name: 'Bash', aliases: ['sh', 'shell'] },
    { key: 'powershell', name: 'PowerShell', aliases: ['ps'] },
    { key: 'json', name: 'JSON', aliases: [] },
    { key: 'yaml', name: 'YAML', aliases: ['yml'] },
    { key: 'xml', name: 'XML', aliases: [] },
    { key: 'markdown', name: 'Markdown', aliases: ['md'] },
    { key: 'dockerfile', name: 'Dockerfile', aliases: ['docker'] },
    { key: 'makefile', name: 'Makefile', aliases: ['make'] },
    { key: 'lua', name: 'Lua', aliases: [] },
    { key: 'r', name: 'R', aliases: [] },
    { key: 'scala', name: 'Scala', aliases: [] },
    { key: 'perl', name: 'Perl', aliases: ['pl'] },
    { key: 'dart', name: 'Dart', aliases: [] },
    { key: 'haskell', name: 'Haskell', aliases: ['hs'] },
    { key: 'elixir', name: 'Elixir', aliases: ['ex'] },
    { key: 'erlang', name: 'Erlang', aliases: ['erl'] },
    { key: 'clojure', name: 'Clojure', aliases: ['clj'] },
    { key: 'hcl', name: 'HCL/Terraform', aliases: ['terraform', 'tf'] },
    { key: 'graphql', name: 'GraphQL', aliases: ['gql'] },
    { key: 'protobuf', name: 'Protocol Buffers', aliases: ['proto'] },
    { key: 'nginx', name: 'Nginx', aliases: [] },
    { key: 'apache', name: 'Apache', aliases: [] },
    { key: 'text', name: '纯文本', aliases: ['txt', 'plain'] }
];
