import{test}from'node:test';import assert from'node:assert/strict';import{createPreparedPreviewCache}from'./preparedPreview.mjs';
test('identical pending preview requests share one preparation; changed content, settings and identity do not',async()=>{
 let calls=0,release;const cache=createPreparedPreviewCache(),make=()=>{calls++;return new Promise(r=>release=r)};
 const first=cache.get('actorA:lesson1:content1:portrait:en',make),second=cache.get('actorA:lesson1:content1:portrait:en',make);
 assert.equal(first,second);await Promise.resolve();assert.equal(calls,1);release('verified PDF');assert.equal(await second,'verified PDF');
 assert.equal(await cache.get('actorA:lesson1:content1:portrait:en',async()=>{throw Error('unnecessary request')}),'verified PDF');
 for(const key of['actorB:lesson1:content1:portrait:en','actorA:lesson1:content2:portrait:en','actorA:lesson1:content1:landscape:en','actorA:lesson1:content1:portrait:fr'])assert.equal(await cache.get(key,async()=>key),key);
});
test('expired, explicitly refreshed, cleared or failed previews never trap the editor on an obsolete promise',async()=>{
 let now=0,calls=0;const cache=createPreparedPreviewCache({now:()=>now,ttl:10}),make=async()=>++calls;
 assert.equal(await cache.get('key',make),1);assert.equal(await cache.get('key',make,true),2);now=20;assert.equal(await cache.get('key',make),3);
 cache.clear();assert.equal(await cache.get('key',make),4);await assert.rejects(cache.get('failed',async()=>{throw Error('network')}));
 assert.equal(await cache.get('failed',make),5);
});
