import test from 'node:test'
import assert from 'node:assert/strict'
import {publishedFields,editorFields} from './sitePublication.js'
const text=(v:string)=>({kind:'text',original:'Original',value:v}),image=(v:string)=>({kind:'image',original:'/images/original.jpg',value:v})
test('published photographs are shared while translated text remains independent',()=>{
 const state={published:{en:{title:text('English'),hero:image('/new-en.jpg')},fr:{title:text('Français'),hero:image('/old-fr.jpg')}},visuals:{hero:image('/new-shared.jpg')}}
 assert.equal(publishedFields(state,'fr').title.value,'Français')
 assert.equal(publishedFields(state,'en').title.value,'English')
 assert.equal(publishedFields(state,'fr').hero.value,'/new-shared.jpg')
})
test('legacy pages use the last published language for photographs, not visitor language',()=>{
 const state={published:{en:{hero:image('/latest.jpg')},fr:{hero:image('/old.jpg')}}}
 assert.equal(publishedFields(state,'fr','en').hero.value,'/latest.jpg')
 assert.equal(publishedFields(state,'en','fr').hero.value,'/old.jpg')
})
test('draft photos remain private and survive reloading the editor',()=>{
 const state={draft:{en:{hero:image('/unpublished.jpg')},fr:{hero:image('/old.jpg')}},published:{en:{hero:image('/old.jpg')},fr:{hero:image('/old.jpg')}},visuals:{hero:image('/published.jpg')}}
 assert.equal(editorFields(state,'en').hero.value,'/unpublished.jpg')
 assert.equal(editorFields(state,'fr').hero.value,'/published.jpg')
 assert.equal(publishedFields(state,'en').hero.value,'/published.jpg')
})
