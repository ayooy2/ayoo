/**
 * 清理 marked 生成的 HTML 中的危险标签和事件属性
 * 移除: script/style/iframe/object/embed/form + on*事件 + javascript:协议
 */
function sanitizeMD(html){
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi,'')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi,'')
    .replace(/<embed[^>]*>/gi,'')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi,'')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi,'')
    .replace(/\son\w+\s*=\s*[^\s>\/]*/gi,'')
    .replace(/\/\s*on\w+\s*=\s*(['"])[\s\S]*?\1/gi,'')
    .replace(/\/\s*on\w+\s*=\s*[^\s>]*/gi,'')
    .replace(/javascript:/gi,'')
    .replace(/data:/gi,'')
    .replace(/vbscript:/gi,'');
}
