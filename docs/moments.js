(() => {
 const backend='https://tracy-reznik-access.kuoyi-0705.workers.dev';
 const feed=document.getElementById('moments-feed');
 const more=document.getElementById('moments-more');
 if(!feed||!more)return;
 let cursor=null,loading=false;
 const seen=new Set();
 const dateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 const dialog=element('dialog','moments-lightbox');
 const close=element('button','', '关闭');close.type='button';close.addEventListener('click',()=>dialog.close());
 const fullImage=element('img');dialog.append(close,fullImage);document.body.append(dialog);
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{fullImage.removeAttribute('src');});
 const card=post=>{
  const article=element('article','moment-card');
  const avatar=element('div','moment-avatar','TR');avatar.setAttribute('aria-hidden','true');
  const content=element('div');content.append(element('div','moment-author','Tracy Reznik'));
  if(post.body)content.append(element('p','moment-text',post.body));
  if(post.images.length){
   const grid=element('div','moment-photo-grid'+(post.images.length===1?' single':''));
   post.images.forEach((src,index)=>{
    if(!src.startsWith(backend+'/photos/'))return;
    const button=element('button','moment-photo-button');button.type='button';button.setAttribute('aria-label','放大第 '+(index+1)+' 张照片');
    const image=element('img');image.src=src;image.alt='Tracy 的动态配图 '+(index+1);image.loading='lazy';image.referrerPolicy='no-referrer';button.append(image);
    button.addEventListener('click',()=>{fullImage.src=src;fullImage.alt=image.alt;dialog.showModal();});grid.append(button);
   });
   content.append(grid);
  }
  const time=element('time','moment-time',dateFormat.format(new Date(post.created_at))+(post.updated_at>post.created_at?' · 已编辑':''));time.dateTime=new Date(post.created_at).toISOString();content.append(time);
  article.append(avatar,content);return article;
 };
 async function load(){
  if(loading)return;loading=true;more.disabled=true;feed.setAttribute('aria-busy','true');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch(backend+'/api/moments'+(cursor?'?before='+encodeURIComponent(cursor):''),{credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('Failed');const data=await response.json();if(!Array.isArray(data.posts))throw new Error('Failed');
   if(!cursor){feed.replaceChildren();seen.clear();}
   feed.querySelector('.moments-error')?.remove();
   for(const post of data.posts){if(seen.has(post.id))continue;seen.add(post.id);feed.append(card(post));}
   if(!seen.size){const empty=element('div','moments-empty');empty.append(element('strong','','Tracy 还没有发布动态。'),element('p','','下一次更新，再来看看吧。'));feed.append(empty);}
   cursor=data.next;more.hidden=!cursor;more.textContent='加载更多';
  }catch{
   if(!cursor)feed.replaceChildren();
   feed.querySelector('.moments-error')?.remove();
   const error=element('div','moments-error');error.append(element('p','','动态暂时无法加载，请稍后重试。'));
   const retry=element('button','moments-more','重新加载');retry.type='button';retry.addEventListener('click',load);error.append(retry);feed.append(error);more.hidden=true;
  }finally{clearTimeout(timer);loading=false;more.disabled=false;feed.setAttribute('aria-busy','false');}
 }
 more.addEventListener('click',load);load();
})();
