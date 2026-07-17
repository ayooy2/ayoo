/**
 * 清理 marked 生成的 HTML 中的危险标签和事件属性
 * 移除: script/style/object/embed/form + on*事件 + javascript:/vbscript:协议
 * iframe: 只允许 google.com/maps 来源，仅保留 src/width/height/style/allowfullscreen/loading/sandbox 属性
 * 阻止危险的 data: URI（text/html, application/javascript 等），允许安全的（image/*）
 */
function sanitizeMD(html){
  // 先提取 Google Maps iframe 并重建安全版本
  var iframes=[];
  html=html.replace(/<iframe([^>]*)>([\s\S]*?<\/iframe>|\/?>)/gi,function(match,attrs){
    var srcMatch=attrs.match(/src=["']([^"']+)["']/i);
    if(srcMatch&&srcMatch[1].indexOf('google.com/maps')!==-1){
      var src=srcMatch[1];
      // 仅保留安全属性
      var safeAttrs='src="'+src+'"';
      var width=attrs.match(/\bwidth=["'](\d+)["']/i);
      var height=attrs.match(/\bheight=["'](\d+)["']/i);
      if(width) safeAttrs+=' width="'+width[1]+'"';
      if(height) safeAttrs+=' height="'+height[1]+'"';
      safeAttrs+=' style="border:0" allowfullscreen loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer"';
      var idx=iframes.length;
      iframes.push('<iframe '+safeAttrs+'></iframe>');
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
  // 还原 Google Maps iframe（用函数避免 $ 模式问题）
  for(var i=0;i<iframes.length;i++){
    var placeholder='__IFRAME_'+i+'__';
    var idx=result.indexOf(placeholder);
    if(idx!==-1){
      result=result.substring(0,idx)+iframes[i]+result.substring(idx+placeholder.length);
    }
  }
  return result;
}
