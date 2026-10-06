(() => {
 const feed=document.getElementById('questions-feed');if(!feed)return;
 const make=(tag,className,text)=>{const item=document.createElement(tag);item.className=className;item.textContent=text;return item;};
 async function load(){
  feed.setAttribute('aria-busy','true');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch('https://tracy-reznik-access.kuoyi-0705.workers.dev/api/questions',{credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.questions))throw new Error();
   feed.replaceChildren();
   for(const question of data.questions){
    const article=make('article','question-card','');
    article.append(make('p','question-author',question.author+' 提问'),make('p','question-text',question.question),make('p','question-reply-label','Tracy 的回复'),make('p','question-text',question.answer));
    const time=make('time','moment-time',new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(question.updated_at)));time.dateTime=new Date(question.updated_at).toISOString();article.append(time);feed.append(article);
   }
   if(!data.questions.length){const empty=make('div','moments-empty','');empty.append(make('strong','','还没有公开的问答。'),make('p','','有什么想问的，就留一个问题吧。'));feed.append(empty);}
  }catch{
   feed.replaceChildren();const error=make('div','moments-error','');error.append(make('p','','问答暂时无法加载，请稍后重试。'));const retry=make('button','moments-more','重新加载');retry.type='button';retry.addEventListener('click',load);error.append(retry);feed.append(error);
  }finally{clearTimeout(timer);feed.setAttribute('aria-busy','false');}
 }
 load();
})();
