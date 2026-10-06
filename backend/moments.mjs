const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const validID = id => /^[a-f0-9]{64}$/.test(id);
const newID = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export const momentsStyles = `.moment{display:grid;grid-template-columns:44px minmax(0,1fr);gap:16px}.avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#264cf0;color:white;font-weight:700}.moment-name{font-weight:600;color:#264cf0}.moment-copy{white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0}.moment-meta{display:block;color:#667086;font-size:14px}.moment-images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:520px;margin:16px 0}.moment-images.single{grid-template-columns:1fr;max-width:360px}.moment-images img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}.moment-images.single img{aspect-ratio:auto;max-height:440px;object-fit:contain}.moment-images a:focus-visible{outline:3px solid #264cf0}select{font:inherit;background:white;border:1px solid #c8cedc;padding:10px;border-radius:8px;max-width:100%}.editor label{font-weight:600}.editor textarea{min-height:160px;resize:vertical}.editor .image-input{min-height:90px}.editor small{display:block}.error{color:#a32236}.notice{color:#264cf0}.secondary{background:#e8edff;color:#264cf0}details{margin:24px 0}summary{cursor:pointer;font-weight:600}@media(max-width:480px){.moment{grid-template-columns:36px minmax(0,1fr);gap:12px}.avatar{width:36px;height:36px}.moment-images{gap:5px}}`;

function cursorParams(value) {
 if (!value) return null;
 const match = /^(\d{13}):([a-f0-9]{64})$/.exec(value);
 if (!match) throw new Error('Invalid cursor');
 return [Number(match[1]),match[2]];
}
async function list(env, publicOnly, before='') {
 const cursor = cursorParams(before);
 const conditions = ['deleted_at IS NULL'];
 if(publicOnly) conditions.push("visibility='public'");
 if(cursor) conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
 const query=env.DB.prepare(`SELECT id,body,images,visibility,created_at,updated_at FROM moments WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT 21`);
 const result=await (cursor?query.bind(cursor[0],cursor[0],cursor[1]):query).all();
 const posts=result.results.slice(0,20).map(row=>({...row,images:JSON.parse(row.images)}));
 const last=posts.at(-1);
 return {posts,next:result.results.length>20?`${last.created_at}:${last.id}`:null};
}
export async function publicMoments(request,env) {
 const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'https://zyx20060831.github.io','X-Content-Type-Options':'nosniff'};
 if(request.method!=='GET') return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'GET'}});
 let before=new URL(request.url).searchParams.get('before')??'';
 try { cursorParams(before); } catch {return Response.json({error:'Invalid cursor'},{status:400,headers});}
 const result=await list(env,true,before);
 result.posts=result.posts.map(post=>({...post,images:post.images.map(src=>new URL(src,request.url).href)}));
 return Response.json(result,{headers});
}
export async function photoResponse(request,env,getSession,adminID){
 if(request.method!=='GET')return new Response(null,{status:405});
 const id=new URL(request.url).pathname.slice('/photos/'.length);
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 if(!validID(id))return new Response(null,{status:404,headers});
 // Check visibility before reading the image bytes; revoked access takes effect on every request.
 const photo=await env.DB.prepare('SELECT p.id,p.post_id,m.visibility FROM moment_photos p JOIN moments m ON p.post_id=m.id WHERE p.id=? AND m.deleted_at IS NULL').bind(id).first();
 if(!photo)return new Response(null,{status:404,headers});
 if(photo.visibility!=='public'){
  const user=await getSession(request,env);
  if(!user)return new Response(null,{status:404,headers});
  const approved=user.user_id===adminID|| (await env.DB.prepare('SELECT status FROM access_requests WHERE user_id=?').bind(user.user_id).first())?.status==='approved';
  if(!approved)return new Response(null,{status:404,headers});
 }
 const bytes=await env.DB.prepare('SELECT content_type,data FROM moment_photos WHERE id=?').bind(id).first();
 return new Response(new Uint8Array(bytes.data),{headers:{...headers,'Content-Type':bytes.content_type,'Content-Disposition':'inline'}});
}
function imagesMarkup(images) {
 return images.length?`<div class="moment-images${images.length===1?' single':''}">${images.map((src,index)=>`<a href="${escape(src)}" target="_blank" rel="noopener noreferrer"><img src="${escape(src)}" alt="动态配图 ${index+1}" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')}</div>`:'';
}
function card(post,admin,user,csrfForm) {
 const images=Array.isArray(post.images)?post.images:JSON.parse(post.images);
 return `<section><article class="moment"><div class="avatar" aria-hidden="true">TR</div><div><div class="moment-name">Tracy Reznik</div><p class="moment-copy">${escape(post.body)}</p>${imagesMarkup(images)}<time class="moment-meta" datetime="${new Date(post.created_at).toISOString()}">${date(post.created_at)}${post.updated_at>post.created_at?' · 已编辑':''} · ${post.visibility==='approved'?'仅已批准访客可见':'所有人可见'}</time>${admin?`<div class="actions"><a href="/admin/moments?edit=${post.id}">编辑</a><form method="post" action="/admin/moments/trash">${csrfForm(user)}<input type="hidden" name="id" value="${post.id}"><button class="secondary">移入回收站</button></form></div>`:''}</div></article></section>`;
}
function editor(user,csrfForm,post={},error='') {
 const editing=Boolean(post.id);
 const existing=Array.isArray(post.images)?post.images:[];
 return `<section class="editor"><h2>${editing?'编辑动态':'发布动态'}</h2>${error?`<p class="error" role="alert">${escape(error)}</p>`:''}<form method="post" action="/admin/moments/save" enctype="multipart/form-data">${csrfForm(user)}<input type="hidden" name="id" value="${escape(post.id??'')}"><input type="hidden" name="submission_id" value="${escape(post.submission_id??newID())}"><input type="hidden" name="images_present" value="1"><label for="body">这一刻的想法</label><textarea id="body" name="body" maxlength="3000" placeholder="写下最近的生活、想法或正在做的事……">${escape(post.body??'')}</textarea><small>最多 3000 字，可只发文字或只发照片。</small>${existing.length?`<label>已添加的照片</label><div class="moment-images">${existing.map(src=>`<label><img src="${escape(src)}" alt="已有照片"><input type="checkbox" name="keep_photos" value="${src.slice('/photos/'.length)}" checked> 保留</label>`).join('')}</div>`:''}<label for="photos">添加照片</label><input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple><small>每条动态最多 9 张。上传时自动缩小照片尺寸；建议使用 JPG、PNG 或 WebP。</small><div class="moment-images" id="photo-preview" aria-label="待上传照片预览"></div><label for="visibility">谁可以看</label><select id="visibility" name="visibility"><option value="public"${post.visibility!=='approved'?' selected':''}>所有访客</option><option value="approved"${post.visibility==='approved'?' selected':''}>仅已批准访客</option></select><p><small>照片与动态使用相同的可见范围。</small></p><p id="upload-status" role="status" aria-live="polite">${escape(error)}</p><div class="actions"><button type="submit">${editing?'保存修改':'发布动态'}</button>${editing?'<a href="/admin/moments">取消编辑</a>':''}</div></form></section><script src="/assets/moments-editor.js" defer></script>`;
}
async function validatePost(form,existing) {
 const body=String(form.get('body')??'').trim();
 const visibility=String(form.get('visibility')??'');
 const id=String(form.get('id')??'');
 const submission_id=String(form.get('submission_id')??newID());
 const selected=form.getAll('keep_photos').map(String);
 const current=existing?JSON.parse(existing.images):[];
 const images=form.has('images_present')?current.filter(src=>selected.includes(src.slice('/photos/'.length))):current;
 const files=form.getAll('photos').filter(file=>typeof file!=='string'&&file.size>0);
 const draft={id,body,images,visibility,submission_id};
 if(id&&!validID(id))return {draft,error:'动态编号无效。'};
 if(!validID(submission_id))return {draft,error:'发布校验失败，请重新打开发布页面。'};
 if(body.length>3000||(!body&&!images.length&&!files.length))return {draft,error:'请填写文字或照片，文字最多 3000 字。'};
 if(images.length+files.length>9)return {draft,error:'每条动态最多 9 张照片。'};
 if(!['public','approved'].includes(visibility))return {draft,error:'请选择谁可以看这条动态。'};
 const uploaded=[];
 for(const file of files){
  if(file.size>600000)return {draft,error:'照片太大，请启用浏览器脚本自动压缩，或上传小于 600 KB 的照片。'};
  const bytes=await file.arrayBuffer();const magic=new Uint8Array(bytes.slice(0,12));
  let type;
  if(magic[0]===255&&magic[1]===216&&magic[2]===255)type='image/jpeg';
  else if([137,80,78,71,13,10,26,10].every((v,i)=>magic[i]===v))type='image/png';
  else if(String.fromCharCode(...magic.slice(0,4))==='RIFF'&&String.fromCharCode(...magic.slice(8,12))==='WEBP')type='image/webp';
  else return {draft,error:'照片格式无法读取，请使用 JPG、PNG 或 WebP。'};
  uploaded.push({id:newID(),type,bytes});
 }
 return {draft,uploaded};
}
export async function momentRoute(request,context) {
 const {env,url,user,admin,page,redirect,csrfForm,authorizedForm,logoutForm,random}=context;
 const path=url.pathname;
 if(path.startsWith('/admin/moments')) {
  if(!admin)return page('无权访问','<p>仅管理员可发布和管理动态。</p>',403);
  if(request.method==='POST') {
   if(Number(request.headers.get('Content-Length')??0)>7000000)return page('照片太大','<p>请分批上传或缩小照片尺寸。</p>',413);
   const form=await authorizedForm(request,user);
   if(!form)return page('操作失败','<p>请求校验失败。</p>',403);
   if(path==='/admin/moments/save') {
    const requestedID=String(form.get('id')??'');
    const existing=validID(requestedID)?await env.DB.prepare('SELECT id,images FROM moments WHERE id=? AND deleted_at IS NULL').bind(requestedID).first():null;
    if(requestedID&&!existing)return page('动态不存在','<a href="/admin/moments">返回动态管理</a>',404);
    const {draft,error,uploaded}=await validatePost(form,existing);
    if(error)return page(draft.id?'编辑动态':'发布动态',editor(user,csrfForm,draft,error),400);
    const now=Date.now(),postID=draft.id||draft.submission_id;
    // Retrying a successful new submission does not create duplicate posts or photos.
    if(!draft.id&&await env.DB.prepare('SELECT id FROM moments WHERE id=?').bind(postID).first())return redirect('/admin/moments?saved=1');
    const photoList=[...draft.images,...uploaded.map(photo=>`/photos/${photo.id}`)];
    const queries=[draft.id?
     env.DB.prepare('UPDATE moments SET body=?,images=?,visibility=?,updated_at=? WHERE id=? AND deleted_at IS NULL').bind(draft.body,JSON.stringify(photoList),draft.visibility,now,postID):
     env.DB.prepare('INSERT INTO moments (id,body,images,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(postID,draft.body,JSON.stringify(photoList),draft.visibility,now,now)];
    for(const photo of uploaded)queries.push(env.DB.prepare('INSERT INTO moment_photos (id,post_id,content_type,data) VALUES (?,?,?,?)').bind(photo.id,postID,photo.type,photo.bytes));
    // Delete only attachments explicitly removed from this post while editing.
    const removed=existing?JSON.parse(existing.images).filter(src=>!draft.images.includes(src)):[];
    for(const src of removed)queries.push(env.DB.prepare('DELETE FROM moment_photos WHERE id=? AND post_id=?').bind(src.slice('/photos/'.length),postID));
    await env.DB.batch(queries);
    return redirect('/admin/moments?saved=1');
   }
   if(path==='/admin/moments/trash'||path==='/admin/moments/restore') {
    const id=String(form.get('id')??'');
    if(!validID(id))return page('无效操作','<p>动态编号无效。</p>',400);
    const removing=path.endsWith('/trash');
    const result=await env.DB.prepare(`UPDATE moments SET deleted_at=? WHERE id=? AND deleted_at IS ${removing?'NULL':'NOT NULL'}`).bind(removing?Date.now():null,id).run();
    if(!result.meta.changes)return page('动态不存在','<a href="/admin/moments">返回动态管理</a>',404);
    return redirect(`/admin/moments?${removing?'trashed':'restored'}=1`);
   }
   return page('页面不存在','<a href="/admin/moments">返回动态管理</a>',404);
  }
  if(request.method!=='GET')return page('不支持此操作','',405);
  if(path!=='/admin/moments')return page('页面不存在','<a href="/admin/moments">返回动态管理</a>',404);
  const editID=url.searchParams.get('edit');let editing;
  if(editID){if(!validID(editID))return page('动态不存在','',404);editing=await env.DB.prepare('SELECT * FROM moments WHERE id=? AND deleted_at IS NULL').bind(editID).first();if(!editing)return page('动态不存在','<a href="/admin/moments">返回动态管理</a>',404);editing.images=JSON.parse(editing.images);}
  let posts;try{posts=await list(env,false,url.searchParams.get('before')??'');}catch{return page('无效页码','<a href="/admin/moments">返回动态管理</a>',400);}
  const trash=await env.DB.prepare('SELECT id,body,created_at FROM moments WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100').all();
  const notice=url.searchParams.has('saved')?'动态已保存。':url.searchParams.has('trashed')?'动态已移入回收站。':url.searchParams.has('restored')?'动态已恢复。':'';
  return page('动态管理',`<p>管理员：${escape(user.login)}</p><div class="actions"><a href="/admin">访客申请管理</a><a href="/moments">查看动态</a></div>${notice?`<p class="notice" role="status">${notice}</p>`:''}${editor(user,csrfForm,editing)}<h2>已发布</h2>${posts.posts.map(post=>card(post,true,user,csrfForm)).join('')||'<p>还没有发布动态。</p>'}${posts.next?`<a href="/admin/moments?before=${encodeURIComponent(posts.next)}">更早的动态</a>`:''}<details><summary>回收站（${trash.results.length}）</summary>${trash.results.map(post=>`<section><p class="moment-copy">${escape(post.body||'图片动态')}</p><small>${date(post.created_at)}</small><form method="post" action="/admin/moments/restore">${csrfForm(user)}<input type="hidden" name="id" value="${post.id}"><button class="secondary">恢复动态</button></form></section>`).join('')||'<p>回收站为空。</p>'}</details>${logoutForm(user)}`);
 }
 if(path==='/moments') {
  if(request.method!=='GET')return page('不支持此操作','',405);
  const approval=admin?null:await env.DB.prepare('SELECT status FROM access_requests WHERE user_id=?').bind(user.user_id).first();
  if(!admin&&approval?.status!=='approved')return page('查看更多动态','<p>仅已批准访客可查看完整动态。</p><a class="button" href="/private">申请查看</a>',403);
  let posts;try{posts=await list(env,false,url.searchParams.get('before')??'');}catch{return page('无效页码','<a href="/moments">返回动态</a>',400);}
  return page('Tracy 的动态',`${admin?'<a href="/admin/moments">发布和管理动态</a>':''}${posts.posts.map(post=>card(post,false,user,csrfForm)).join('')||'<section><p>Tracy 还没有发布动态。</p></section>'}${posts.next?`<a href="/moments?before=${encodeURIComponent(posts.next)}">更早的动态</a>`:''}${logoutForm(user)}`);
 }
 return null;
}
