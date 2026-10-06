import {emailLinks} from './email-links.mjs';
import {momentsStyles, publicMoments, photoResponse, momentRoute} from './moments.mjs';
import {editorScript} from './editor-client.mjs';
import {questionPublicRoute,questionAdminRoute} from './questions.mjs';
const encoder = new TextEncoder();
const ADMIN_ID = '242745826';
const PUBLIC_HOME = 'https://zyx20060831.github.io/';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n=>n.toString(16).padStart(2,'0')).join('');
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))), n=>n.toString(16).padStart(2,'0')).join('');
const challenge = async text => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function cookie(request,name){const entry=(request.headers.get('Cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));return entry?.slice(name.length+1)??'';}
const setCookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const common={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' blob:; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const redirect=(path,extra={})=>new Response(null,{status:303,headers:{...common,Location:path,...extra}});
function page(title,body,status=200){return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Tracy Reznik</title><style>body{font:16px/1.8 system-ui,sans-serif;background:#f8f9fc;color:#161b2c;max-width:850px;margin:auto;padding:32px 24px}a{color:#264cf0}h1{font-size:36px;line-height:1.3}h2{font-size:22px}section{border:1px solid #dfe3ed;border-radius:14px;background:white;padding:24px;margin:24px 0}button,.button{font:inherit;background:#264cf0;color:white;padding:8px 18px;border:0;border-radius:8px;cursor:pointer;display:inline-block;text-decoration:none}textarea{font:inherit;box-sizing:border-box;width:100%;min-height:120px;padding:12px;border:1px solid #c8cedc;border-radius:8px}dt{color:#667086}dd{margin:0 0 14px;overflow-wrap:anywhere}.actions{display:flex;gap:12px;flex-wrap:wrap}.reason{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#667086}label{display:block;margin:12px 0}form{margin:12px 0}button:focus-visible,a:focus-visible{outline:3px solid #677ffa;outline-offset:3px}.webmail{display:inline-block;font-size:14px;margin-left:12px}${momentsStyles}</style><body><a href="${PUBLIC_HOME}">返回个人主页</a><h1>${escape(title)}</h1>${body}</body></html>`,{status,headers:{...common,'Content-Type':'text/html; charset=utf-8'}});}
async function session(request,env){const token=cookie(request,'__Host-tracy');if(!/^[a-f0-9]{64}$/.test(token))return null;return env.DB.prepare('SELECT user_id, login, csrf FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token),Date.now()).first();}
function csrfForm(user){return `<input type="hidden" name="csrf" value="${escape(user.csrf)}">`;}
function logoutForm(user){return `<form action="/logout" method="post">${csrfForm(user)}<button>退出登录</button></form>`;}
async function authorizedForm(request,user){if(request.headers.get('Origin')!==new URL(request.url).origin)return null;const form=await request.formData();return form.get('csrf')===user.csrf?form:null;}
async function handle(request,env){
 const url=new URL(request.url);const path=url.pathname;
 if(path==='/health')return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 if(!env.DB)return page('暂时无法访问','<p>服务尚未完成配置，请稍后再试。</p>',503);
 if(path==='/api/moments')return publicMoments(request,env);
 if(path.startsWith('/photos/'))return photoResponse(request,env,session,ADMIN_ID);
 if(path==='/assets/moments-editor.js'&&request.method==='GET')return new Response(editorScript,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 const questionPage=await questionPublicRoute(request,{env,url,page,redirect,random,digest,cookie,setCookie,session,common});if(questionPage)return questionPage;
 if(path==='/auth/login'&&request.method==='GET'){
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)return page('登录尚未开放','<p>GitHub 登录正在配置，请稍后再试。</p>',503);
  const state=random(),verifier=random();await env.DB.prepare('INSERT INTO oauth_states (state_hash, verifier, expires_at) VALUES (?, ?, ?)').bind(await digest(state),verifier,Date.now()+600000).run();
  const target=new URL('https://github.com/login/oauth/authorize');target.searchParams.set('client_id',env.GITHUB_CLIENT_ID);target.searchParams.set('redirect_uri',url.origin+'/auth/callback');target.searchParams.set('state',state);target.searchParams.set('code_challenge',await challenge(verifier));target.searchParams.set('code_challenge_method','S256');target.searchParams.set('scope','');
  const next=url.searchParams.get('next');const returnTo=['/private','/admin','/admin/moments','/moments','/questions/ask','/admin/questions'].includes(next)?next:'/private';
  const loginHeaders=new Headers({...common,Location:target.href});loginHeaders.append('Set-Cookie',setCookie('__Host-oauth',state,600));loginHeaders.append('Set-Cookie',setCookie('__Host-return',encodeURIComponent(returnTo),600));return new Response(null,{status:303,headers:loginHeaders});
 }
 if(path==='/auth/callback'&&request.method==='GET'){
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||!code||state!==cookie(request,'__Host-oauth'))return page('登录失败','<p>登录校验失败，请重新登录。</p>',400);
  const key=await digest(state);const flow=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING verifier').bind(key,Date.now()).first();if(!flow)return page('登录已过期','<a href="/auth/login">重新登录</a>',400);
  const exchanged=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:url.origin+'/auth/callback',code_verifier:flow.verifier})});
  const token=await exchanged.json();if(!exchanged.ok||!token.access_token)return page('登录失败','<a href="/auth/login">重新登录</a>',400);
  const response=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'Tracy-personal-site'}});const account=await response.json();if(!response.ok||!Number.isSafeInteger(account.id)||typeof account.login!=='string')return page('登录失败','<a href="/auth/login">重新登录</a>',400);
  const sessionToken=random();await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,login,csrf,expires_at) VALUES (?,?,?,?,?)').bind(await digest(sessionToken),String(account.id),account.login,random(),Date.now()+604800000).run();
  const returnPath=cookie(request,'__Host-return');const returnTo=['%2Fprivate','%2Fadmin','%2Fadmin%2Fmoments','%2Fmoments','%2Fquestions%2Fask','%2Fadmin%2Fquestions'].includes(returnPath)?decodeURIComponent(returnPath):'/private';
  const headers=new Headers({...common,Location:returnTo});headers.append('Set-Cookie',setCookie('__Host-tracy',sessionToken,604800));headers.append('Set-Cookie',setCookie('__Host-oauth','',0));headers.append('Set-Cookie',setCookie('__Host-return','',0));return new Response(null,{status:303,headers});
 }
 const user=await session(request,env);if(!user){const next=['/admin','/admin/moments','/admin/questions','/moments'].includes(path)?path:'/private';return page(path.startsWith('/admin')?'管理员登录':'查看受限信息',`${path.startsWith('/admin')?'<p>请使用网站管理员的 GitHub 账号登录。</p>':'<p>登录 GitHub 后提交申请，由网站管理员审批。</p>'}<a class="button" href="/auth/login?next=${encodeURIComponent(next)}">使用 GitHub 登录</a>`,401);}
 const admin=user.user_id===ADMIN_ID;
 const momentPage=await momentRoute(request,{env,url,user,admin,page,redirect,csrfForm,authorizedForm,logoutForm,random});if(momentPage)return momentPage;
 const questionAdminPage=await questionAdminRoute(request,{env,url,user,admin,page,redirect,csrfForm,authorizedForm,logoutForm});if(questionAdminPage)return questionAdminPage;
 if(path==='/logout'&&request.method==='POST'){if(!await authorizedForm(request,user))return page('操作失败','<p>请求校验失败。</p>',403);await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(cookie(request,'__Host-tracy'))).run();return redirect('/private',{'Set-Cookie':setCookie('__Host-tracy','',0)});}
 if(path==='/apply'&&request.method==='POST'){
  const form=await authorizedForm(request,user);if(!form)return page('操作失败','<p>请求校验失败。</p>',403);const reason=String(form.get('reason')??'').trim();if(reason.length<2||reason.length>500)return page('申请说明不符合要求','<p>请输入 2–500 字申请说明。</p><a href="/private">返回申请页面</a>',400);
  await env.DB.prepare("INSERT INTO access_requests (user_id,login,reason,status,created_at,updated_at) VALUES (?,?,?,'pending',?,?) ON CONFLICT(user_id) DO UPDATE SET login=excluded.login,reason=excluded.reason,status='pending',created_at=excluded.created_at,updated_at=excluded.updated_at WHERE access_requests.status = 'rejected'").bind(user.user_id,user.login,reason,Date.now(),Date.now()).run();return redirect('/private');
 }
 if(path==='/admin/decision'&&request.method==='POST'){
  if(!admin)return page('无权访问','<p>仅管理员可审批。</p>',403);const form=await authorizedForm(request,user);if(!form)return page('操作失败','<p>请求校验失败。</p>',403);const id=String(form.get('user_id')??''),status=String(form.get('status')??'');if(!/^\d+$/.test(id)||!['approved','rejected'].includes(status))return page('无效操作','<p>审批参数无效。</p>',400);await env.DB.prepare('UPDATE access_requests SET status=?,updated_at=? WHERE user_id=?').bind(status,Date.now(),id).run();return redirect('/admin');
 }
 if(request.method!=='GET')return page('不支持此操作','<p>请返回主页。</p>',405);
 if(path==='/admin'){
  if(!admin)return page('无权访问','<p>仅管理员可审批。</p>',403);const list=await env.DB.prepare('SELECT user_id,login,reason,status,created_at FROM access_requests ORDER BY created_at DESC LIMIT 200').all();const cards=list.results.map(row=>`<section><h2>${escape(row.login)}</h2><small>GitHub ID: ${escape(row.user_id)} · ${escape(row.status==='approved'?'已批准':row.status==='rejected'?'已拒绝':'待审批')}</small><p class="reason">${escape(row.reason)}</p><div class="actions">${['approved','rejected'].filter(status=>status!==row.status).map(status=>`<form method="post" action="/admin/decision">${csrfForm(user)}<input type="hidden" name="user_id" value="${escape(row.user_id)}"><input type="hidden" name="status" value="${status}"><button>${status==='approved'?'批准':row.status==='approved'?'撤销权限':'拒绝'}</button></form>`).join('')}</div></section>`).join('');return page('访客申请管理',`<p>管理员：${escape(user.login)}</p><div class="actions"><a href="/private">查看受限信息</a><a href="/admin/moments">发布和管理动态</a><a href="/admin/questions">回复访客提问</a></div>${cards||'<p>暂无申请。</p>'}${logoutForm(user)}`);
 }
 if(path!=='/private'&&path!=='/')return page('页面不存在','<a href="/private">返回</a>',404);
 const approval=await env.DB.prepare('SELECT status FROM access_requests WHERE user_id=?').bind(user.user_id).first();const approved=admin||approval?.status==='approved';
 let body=`<p>当前账号：${escape(user.login)}</p><div class="actions">${admin?'<a href="/admin">申请管理</a><a href="/admin/moments">发布动态</a>':''}<a href="/moments">查看完整动态</a></div>`;
 if(approved){if(!env.PRIVATE_PROFILE_JSON)return page('暂时无法读取信息','<p>受限信息尚未完成配置。</p>',503);const profile=JSON.parse(env.PRIVATE_PROFILE_JSON);body+=`<section><h2>联系信息</h2><dl>${profile.information.map(row=>`<dt>${escape(row.label)}</dt><dd>${emailLinks(row.value)}</dd>`).join('')}</dl></section><section><h2>更早的教育经历</h2>${profile.education.map(row=>`<h3>${escape(row.period)} · ${escape(row.school)}</h3><p>${escape(row.description)}</p>`).join('')}</section>`;}
 else if(approval?.status==='pending')body+='<section><h2>等待审批</h2><p>申请已提交，请等待管理员审批。</p><a href="/private">刷新申请状态</a></section>';
 else body+=`<section><h2>申请查看更多信息</h2><p>邮箱 1、邮箱 4、QQ、微信、真实生日及南京大学之前的教育经历需批准后查看。</p>${approval?.status==='rejected'?'<p>上次申请未获批准，你可以补充说明后重新申请。</p>':''}<form method="post" action="/apply">${csrfForm(user)}<label for="reason">申请说明</label><textarea id="reason" name="reason" minlength="2" maxlength="500" required></textarea><button>提交申请</button></form></section>`;
 return page('受限信息',body+logoutForm(user));
}
export default {async fetch(request,env){try{return await handle(request,env);}catch{return page('服务暂时不可用','<p>请稍后重试。申请信息不会在服务异常时公开。</p>',503);}}};
