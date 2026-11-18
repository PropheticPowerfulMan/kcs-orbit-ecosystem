import assert from 'node:assert/strict';import{createRequire}from'node:module';const require=createRequire(process.cwd()+'/package.json'),jwt=require('jsonwebtoken');const root=jwt.sign({sub:'configured-superadmin',role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'}),media=jwt.sign({sub:'qa-media-site',role:'staff'},process.env.JWT_SECRET,{expiresIn:'1h'});
const call=async(path,method='GET',body,token=media)=>{const r=await fetch('http://127.0.0.1:5000/api'+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json(),cache:r.headers.get('cache-control')}};const ok=(r,s=200)=>{assert.equal(r.status,s,r.body.message);return r.body.data};let checks=0;const pass=s=>console.log('PASS '+(++checks)+' '+s);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1kAAAAASUVORK5CYII=','base64');
const cover=async(token)=>{const f=new FormData();f.set('file',new Blob([png],{type:'image/png'}),'cover.png');f.set('title','Synthetic video cover');f.set('type','IMAGE');f.set('category','Video covers');return ok(await call('/media/upload','POST',f,token),201)};
try{
 const a=await cover(media),b=await cover(root);
 assert.equal((await fetch('http://127.0.0.1:5000'+a.url)).status,200);
 let v=ok(await call('/media/video-link','POST',{title:'Uploaded cover fixture',description:'Caption below cover',url:'https://www.youtube.com/watch?v=t4cC3GGRapE',thumbnailUrl:a.url}),201)
 assert.equal(v.thumbnailUrl,a.url);pass('Media and SuperAdmin upload real cover files and publish a relative school URL')
 v=ok(await call('/media/'+v.id,'PUT',{version:v.version,title:v.title,description:v.description,category:v.category,tags:v.tags,thumbnailUrl:b.url},root));assert.equal(v.thumbnailUrl,b.url)
 ok(await call('/media/'+v.id,'PUT',{version:'0'.repeat(64),title:v.title,description:v.description,category:v.category,tags:v.tags,thumbnailUrl:a.url},root),409)
 pass('Editing a video updates its cover and preserves optimistic concurrency')
 for(const bad of ['javascript:alert(1)','//external.invalid/x','http://external.invalid/a.png'])ok(await call('/media/video-link','POST',{title:'Bad cover',url:'https://vimeo.com/1234',thumbnailUrl:bad}),400)
 ok(await call('/media/video-link','POST',{title:'No access',url:'https://vimeo.com/1234',thumbnailUrl:a.url},null),401)
 const published=ok(await call('/media','GET',null,null));assert.equal(published.find(i=>i.id===v.id).thumbnailUrl,b.url)
 pass('Public gallery reads the saved cover; invalid links and unauthorized publication are rejected')
 ok(await call('/media/'+b.id,'DELETE',null,root));assert.equal(ok(await call('/media','GET',null,null)).find(i=>i.id===v.id).thumbnailUrl,null)
 const cms=await call('/site-content?page=home&language=en');ok(cms);assert.match(cms.cache,/no-store/)
 pass('Removing a cover leaves the video intact; published page content cannot be served from a stale HTTP cache')
 console.log(JSON.stringify({status:'PASS',checks,realUpload:true,syntheticOnly:true}))
}catch(e){console.error(e.stack);process.exitCode=1}
