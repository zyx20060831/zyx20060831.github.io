const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validKey=value=>/^[a-f0-9]{64}$/.test(value);
const date=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const author=row=>row.anonymous?'匿名访客':row.author_login;
export async function questionPublicRoute(request,context){
 const {env,url,page,redirect,random,digest,cookie,setCookie,session,common}=context;
 const path=url.pathname;
 if(path==='/api/questions'){
  const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'https://zyx20060831.github.io','X-Content-Type-Options':'nosniff'};
  if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers});
  const results=await env.DB.prepare('SELECT id,question,answer,anonymous,author_login,created_at,updated_at FROM questions WHERE published=1 AND archived=0 ORDER BY created_at DESC,id DESC LIMIT 50').all();
  return Response.json({questions:results.results.map(row=>({id:row.id,question:row.question,answer:row.answer,author:author(row),created_at:row.created_at,updated_at:row.updated_at}))},{headers});
 }
 if(path==='/questions/ask'&&request.method==='GET'){
  const anonymous=url.searchParams.get('mode')==='anonymous';
  const user=anonymous?null:await session(request,env);
  if(!anonymous&&!user)return page('实名提问','<p>使用 GitHub 登录后，以你的 GitHub 昵称署名提问。</p><a class="button" href="/auth/login?next=%2Fquestions%2Fask">使用 GitHub 登录</a><p><a href="/questions/ask?mode=anonymous">改为匿名提问</a></p>',401);
  const csrf=random(),lookup=random(),id=random();
  const body=`<p>${anonymous?'这条提问不展示或记录你的账号身份。':`这条提问将署名为 GitHub 用户 <strong>${escape(user.login)}</strong>。`}</p><p><small>问题先发给 Tracy，回复并选择公开后才会出现在主页。请勿填写密码、联系方式等不想公开的内容。</small></p><section><form method="post" action="/questions/submit"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="lookup" value="${lookup}"><input type="hidden" name="id" value="${id}"><input type="hidden" name="mode" value="${anonymous?'anonymous':'named'}"><label for="question">想问 Tracy 什么？</label><textarea id="question" name="question" minlength="2" maxlength="1000" required placeholder="写下你的问题……"></textarea><p><small>2–1000 字。每小时最多提交 5 条提问。</small></p><button>提交提问</button></form></section><a href="/questions/ask${anonymous?'':'?mode=anonymous'}">${anonymous?'改为实名提问':'改为匿名提问'}</a>`;
  const response=page(anonymous?'匿名提问':'实名提问',body);response.headers.append('Set-Cookie',setCookie('__Host-question',csrf,3600));return response;
 }
 if(path==='/questions/submit'&&request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return page('提交失败','<p>请求校验失败。</p>',403);
  if(Number(request.headers.get('Content-Length')??0)>16000)return page('问题太长','<p>问题最多 1000 字。</p>',413);
  const form=await request.formData();const csrf=String(form.get('csrf')??'');
  if(!validKey(csrf)||csrf!==cookie(request,'__Host-question'))return page('提交失败','<p>页面已过期，请重新打开提问页面。</p>',403);
  const question=String(form.get('question')??'').trim(),mode=String(form.get('mode')??''),lookup=String(form.get('lookup')??''),id=String(form.get('id')??'');
  const back=`/questions/ask${mode==='anonymous'?'?mode=anonymous':''}`;
  if(!validKey(lookup)||!validKey(id)||!['anonymous','named'].includes(mode)||question.length<2||question.length>1000)return page('提交失败',`<p>问题需要 2–1000 字，请返回修改。</p><a href="${back}">返回提问</a>`,400);
  const user=mode==='anonymous'?null:await session(request,env);
  if(mode==='named'&&!user)return page('需要登录',`<p>请登录后以 GitHub 昵称署名提问。</p><a href="/auth/login?next=%2Fquestions%2Fask">登录</a>`,401);
  const lookupHash=await digest(lookup);
  const existing=await env.DB.prepare('SELECT id FROM questions WHERE lookup_hash=?').bind(lookupHash).first();
  if(existing)return redirect('/questions/status?key='+lookup);
  const hour=Math.floor(Date.now()/3600000),source=user?'account:'+user.user_id:'address:'+(request.headers.get('CF-Connecting-IP')??'unknown');
  const bucket=await digest(`${hour}:${source}`);
  const allowed=await env.DB.prepare('INSERT INTO question_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE question_limits.count<5 RETURNING count').bind(bucket,(hour+2)*3600000).first();
  if(!allowed)return page('稍后再问','<p>本小时提问次数已用完，请稍后再试。</p>',429);
  const now=Date.now();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO questions (id,question,anonymous,author_id,author_login,lookup_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,question,mode==='anonymous'?1:0,user?.user_id??null,user?.login??null,lookupHash,now,now),
   env.DB.prepare('DELETE FROM question_limits WHERE expires_at < ?').bind(now)
  ]);
  return redirect('/questions/status?key='+lookup);
 }
 if(path==='/questions/status'&&request.method==='GET'){
  const key=url.searchParams.get('key')??'';
  if(!validKey(key))return page('提问不存在','<p>请检查你的查询链接。</p>',404);
  const row=await env.DB.prepare('SELECT question,answer,anonymous,author_login,created_at,archived FROM questions WHERE lookup_hash=?').bind(await digest(key)).first();
  if(!row)return page('提问不存在','<p>请检查你的查询链接。</p>',404);
  const response=page('你的提问',`<p class="notice">提问已收到。</p><p><small>请收藏这个页面。查询链接仅属于你，请勿转发。</small></p><section><small>${escape(author(row))} · ${date(row.created_at)}</small><p class="reason">${escape(row.question)}</p><h2>Tracy 的回复</h2>${row.answer?`<p class="reason">${escape(row.answer)}</p>`:`<p>${row.archived?'这条提问已关闭。':'还没有回复，稍后再来看看。'}</p>`}</section><a href="/questions/ask?mode=anonymous">再问一个问题</a>`);
  // The lookup token stays out of all subsequent referrer headers.
  response.headers.set('Referrer-Policy','no-referrer');return response;
 }
 return null;
}
export async function questionAdminRoute(request,context){
 const {env,url,user,admin,page,redirect,csrfForm,authorizedForm,logoutForm}=context;
 if(!url.pathname.startsWith('/admin/questions'))return null;
 if(!admin)return page('无权访问','<p>仅管理员可回复和管理提问。</p>',403);
 if(request.method==='POST'){
  const form=await authorizedForm(request,user);if(!form)return page('操作失败','<p>请求校验失败。</p>',403);
  const id=String(form.get('id')??'');if(!validKey(id))return page('无效操作','<p>提问编号无效。</p>',400);
  let result;
  if(url.pathname==='/admin/questions/save'){
   const answer=String(form.get('answer')??'').trim(),published=form.get('published')==='1';
   if(answer.length>3000||(!answer&&published))return page('无法保存','<p>公开展示前需要填写回复，回复最多 3000 字。</p><a href="/admin/questions">返回提问管理</a>',400);
   result=await env.DB.prepare('UPDATE questions SET answer=?,published=?,updated_at=? WHERE id=? AND archived=0').bind(answer,published?1:0,Date.now(),id).run();
  }else if(url.pathname==='/admin/questions/archive'||url.pathname==='/admin/questions/restore'){
   const archived=url.pathname.endsWith('/archive')?1:0;
   result=await env.DB.prepare('UPDATE questions SET archived=?,published=0,updated_at=? WHERE id=?').bind(archived,Date.now(),id).run();
  }else return page('页面不存在','',404);
  if(!result.meta.changes)return page('提问不存在','<a href="/admin/questions">返回提问管理</a>',404);
  return redirect('/admin/questions?saved=1');
 }
 if(request.method!=='GET')return page('不支持此操作','',405);
 if(url.pathname!=='/admin/questions')return page('页面不存在','',404);
 const list=await env.DB.prepare('SELECT id,question,answer,anonymous,author_login,published,created_at,archived FROM questions ORDER BY archived ASC,created_at DESC LIMIT 200').all();
 const cards=list.results.map(row=>`<section><small>${escape(author(row))} · ${date(row.created_at)} · ${row.archived?'已关闭':row.answer?'已回复':'待回复'}</small><p class="reason">${escape(row.question)}</p>${row.archived?`<form method="post" action="/admin/questions/restore">${csrfForm(user)}<input type="hidden" name="id" value="${row.id}"><button class="secondary">恢复提问</button></form>`:`<form method="post" action="/admin/questions/save">${csrfForm(user)}<input type="hidden" name="id" value="${row.id}"><label for="answer-${row.id}">你的回复</label><textarea id="answer-${row.id}" name="answer" maxlength="3000">${escape(row.answer)}</textarea><label><input type="checkbox" name="published" value="1"${row.published?' checked':''}> 公开展示问题及回复</label><button>保存回复</button></form><form method="post" action="/admin/questions/archive">${csrfForm(user)}<input type="hidden" name="id" value="${row.id}"><button class="secondary">关闭提问</button></form>`}</section>`).join('');
 return page('访客提问管理',`<p>管理员：${escape(user.login)}</p><div class="actions"><a href="/admin">访客申请</a><a href="/admin/moments">动态管理</a></div>${url.searchParams.has('saved')?'<p class="notice" role="status">已保存。</p>':''}${cards||'<section><p>还没有收到提问。</p></section>'}${logoutForm(user)}`);
}
