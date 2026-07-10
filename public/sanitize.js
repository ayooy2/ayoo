/**
 * 清理 marked 生成的 HTML 中的危险标签和事件属性
 * 移除: script/style/object/embed/form + on*事件 + javascript:/vbscript:协议
 * iframe: 只允许 google.com/maps 来源，其他全部移除
 * 阻止危险的 data: URI（text/html, application/javascript 等），允许安全的（image/*）
 */
function sanitizeMD(html){
  // 先提取 Google Maps iframe 并替换为占位符
  var iframes=[];
  html=html.replace(/<iframe([^>]*)>[\s\S]*?<\/iframe>/gi,function(match,attrs){
    var srcMatch=attrs.match(/src=["']([^"']+)["']/i);
    if(srcMatch&&srcMatch[1].indexOf('google.com/maps')!==-1){
      var idx=iframes.length;
      iframes.push(match);
      return '__IFRAME_'+idx+'__';
    }
    return '';
  });
  var result=html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi,'')
    .replace(/<embed[^>]*>/gi,'')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi,'')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi,'')
    .replace(/\son\w+\s*=\s*[^\s>\/]*/gi,'')
    .replace(/\/\s*on\w+\s*=\s*(['"])[\s\S]*?\1/gi,'')
    .replace(/\/\s*on\w+\s*=\s*[^\s>]*/gi,'')
    .replace(/javascript:/gi,'')
    .replace(/data:(?!image\/)/gi,'')
    .replace(/vbscript:/gi,'');
  // 还原 Google Maps iframe
  for(var i=0;i<iframes.length;i++){
    result=result.replace('__IFRAME_'+i+'__',iframes[i]);
  }
  return result;
}
