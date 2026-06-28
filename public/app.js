// Ayoo — Shared client-side JS (theme, clock, mobile menu, command palette)
(function(){
  /* Theme toggle */
  var b=document.getElementById('theme-toggle'),st=localStorage.getItem('theme')||'light';
  if(st==='dark') document.documentElement.setAttribute('data-theme','dark');
  if(b){b.textContent=st==='dark'?'☀':'☽';b.addEventListener('click',function(){
    var d=document.documentElement.getAttribute('data-theme')==='dark';
    if(d){document.documentElement.removeAttribute('data-theme');localStorage.setItem('theme','light');b.textContent='☽'}
    else{document.documentElement.setAttribute('data-theme','dark');localStorage.setItem('theme','dark');b.textContent='☀'}
  })}

  /* Clock — navbar (HH:MM:SS) */
  function updateClock(){var n=new Date(),h=String(n.getHours()).padStart(2,'0'),m=String(n.getMinutes()).padStart(2,'0'),s=String(n.getSeconds()).padStart(2,'0');var el=document.getElementById('clock');if(el) el.textContent=h+':'+m+':'+s}
  updateClock();setInterval(updateClock,1e3);

  /* Mobile menu */
  var hamburger=document.getElementById('nav-hamburger');
  var menu=document.getElementById('mobile-menu');
  var closeBtn=document.getElementById('mobile-menu-close');
  if(hamburger&&menu) hamburger.addEventListener('click',function(){menu.classList.add('active')});
  if(closeBtn&&menu) closeBtn.addEventListener('click',function(){menu.classList.remove('active')});
  if(menu) menu.addEventListener('click',function(e){if(e.target===menu)menu.classList.remove('active')});

  /* Remove animate-in after animation to prevent transform from breaking fixed positioning */
  document.querySelectorAll('.animate-in').forEach(function(el){el.addEventListener('animationend',function(){el.classList.remove('animate-in');el.style.opacity='1'},{once:true})});

  /* Esc exit fullscreen code blocks */
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      var fs=document.querySelector('.code-block-wrapper.fullscreen');
      if(fs){
        fs.classList.remove('fullscreen');
        document.body.style.overflow='';
        var pre=fs.querySelector('pre');if(pre)pre.style.display='';
        var bar=fs.querySelector('.code-block-bar'),arrow=bar?bar.querySelector('.lang-arrow'):null,body=fs.querySelector('.cb-body');
        if(fs._wasFolded){fs.classList.add('folded');if(body)body.classList.add('hidden');if(arrow)arrow.textContent="›";if(bar)bar.title="展开";}
        delete fs._wasFolded;
      }
    }
  });
})();

/* Command Palette */
(function(){
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  var overlay=document.getElementById('cmd-overlay'),input=document.getElementById('cmd-input'),list=document.getElementById('cmd-list');
  if(!overlay||!input||!list) return;
  var items=[],activeIdx=0,loaded=false;
  function load(){if(loaded)return;loaded=true;fetch('/api/command-index').then(function(r){return r.json()}).then(function(d){items=d.items||[];render('')}).catch(function(){})}
  function render(q){
    var q2=q.toLowerCase(),filtered=q2?items.filter(function(x){return(x.title+' '+(x.desc||'')+' '+(x.tags||'')).toLowerCase().indexOf(q2)>=0}):items;
    activeIdx=0;
    if(!filtered.length){list.innerHTML='<div class="cmd-empty">没有结果</div>';return}
    var h='';for(var i=0;i<filtered.length;i++){var x=filtered[i];h+='<div class="cmd-item'+(i===0?' active':'')+'" data-idx="'+i+'"><span class="cmd-item-icon">'+(x.icon||'📄')+'</span><div class="cmd-item-text"><div class="cmd-item-title">'+esc(x.title)+'</div>'+(x.desc?'<div class="cmd-item-desc">'+esc(x.desc)+'</div>':'')+'</div><span class="cmd-item-type">'+x.type+'</span></div>'}
    list.innerHTML=h;
    list.querySelectorAll('.cmd-item').forEach(function(el){el.addEventListener('click',function(){go(parseInt(el.dataset.idx))})})
  }
  function go(idx){var q2=input.value.toLowerCase();var filtered=q2?items.filter(function(x){return(x.title+' '+(x.desc||'')+' '+(x.tags||'')).toLowerCase().indexOf(q2)>=0}):items;if(filtered[idx]){close();window.location.href=filtered[idx].url}}
  function open(){load();overlay.classList.add('active');input.value='';input.focus();render('')}
  function close(){overlay.classList.remove('active')}
  function move(d){var els=list.querySelectorAll('.cmd-item');if(!els.length)return;els[activeIdx].classList.remove('active');activeIdx=(activeIdx+d+els.length)%els.length;els[activeIdx].classList.add('active');els[activeIdx].scrollIntoView({block:'nearest'})}
  document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();overlay.classList.contains('active')?close():open()}if(e.key==='Escape'&&overlay.classList.contains('active'))close()});
  overlay.addEventListener('click',function(e){if(e.target===overlay)close()});
  input.addEventListener('input',function(){render(input.value)});
  input.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();move(1)}if(e.key==='ArrowUp'){e.preventDefault();move(-1)}if(e.key==='Enter'){e.preventDefault();go(activeIdx)}});
})();
