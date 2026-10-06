export const editorScript = String.raw`
const form=document.querySelector('.editor form');
if(form){
 const input=form.querySelector('[name="photos"]');
 const preview=document.getElementById('photo-preview');
 const status=document.getElementById('upload-status');
 let previewURLs=[];
 input.addEventListener('change',()=>{
  previewURLs.forEach(URL.revokeObjectURL);previewURLs=[];preview.replaceChildren();
  for(const file of input.files){const image=document.createElement('img');const url=URL.createObjectURL(file);previewURLs.push(url);image.src=url;image.alt=file.name;preview.append(image);}
  status.textContent=input.files.length>9?'每条动态最多 9 张照片，请重新选择。':'';
 });
 const compress=async file=>{
  let image;try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('无法读取照片“'+file.name+'”，请改用 JPG、PNG 或 WebP。');}
  try{
   const scale=Math.min(1,1600/Math.max(image.width,image.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
   const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.85,.65,.45]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=600000)return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});}
   throw new Error('照片“'+file.name+'”过大，请选择尺寸更小的照片。');
  }finally{image.close();}
 };
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button[type="submit"]');
  if(button.disabled)return;
  const kept=form.querySelectorAll('[name="keep_photos"]:checked').length;
  if(input.files.length+kept>9){status.textContent='每条动态最多 9 张照片，请取消部分照片。';return;}
  button.disabled=true;status.textContent='正在处理照片并保存，请稍候……';
  try{
   const data=new FormData(form);data.delete('photos');
   for(const file of input.files)data.append('photos',await compress(file));
   const response=await fetch(form.action,{method:'POST',body:data,credentials:'same-origin'});
   if(response.ok&&response.redirected){location.assign(response.url);return;}
   const page=new DOMParser().parseFromString(await response.text(),'text/html');
   throw new Error(page.querySelector('.error')?.textContent||page.querySelector('h1')?.textContent||'保存失败，请稍后再试。');
  }catch(error){status.textContent=error.message||'连接失败，已保留文字和照片，请稍后再试。';button.disabled=false;}
 });
}
`;
