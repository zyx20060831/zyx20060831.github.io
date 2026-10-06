const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function emailLinks(value){
 const address=String(value??'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return escape(address);
 const domains={'qq.com':['https://mail.qq.com/','QQ 邮箱'],'gmail.com':['https://mail.google.com/mail/','Gmail'],'outlook.com':['https://outlook.live.com/mail/','Outlook'],'outook.com':['https://outlook.live.com/mail/','Outlook'],'smail.nju.edu.cn':['https://mail.smail.nju.edu.cn/','南大学生邮箱']};
 const provider=domains[address.split('@').at(-1).toLowerCase()];
 return `<a href="mailto:${encodeURIComponent(address).replace('%40','@')}">${escape(address)}</a>${provider?` <a class="webmail" href="${provider[0]}" target="_blank" rel="noopener noreferrer" aria-label="打开${provider[1]}网页版">网页版</a>`:''}`;
}
