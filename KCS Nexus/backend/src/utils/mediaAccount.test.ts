import test from 'node:test'
import assert from 'node:assert/strict'
import {isMediaAccount,mediaRequestAllowed} from './mediaAccount.js'
test('the restricted website capability is explicit and independent of an ordinary staff title',()=>{assert.equal(isMediaAccount({permissions:['nexus:media-only']}),true);assert.equal(isMediaAccount({permissions:[]}),false);assert.equal(isMediaAccount(undefined),false)})
test('Media can publish website news, images, videos and broadcasts',()=>{for(const[method,path]of[['POST','/api/news'],['PUT','/api/news/c123'],['DELETE','/api/media/c123'],['POST','/api/media/upload'],['POST','/api/media/video-link'],['PUT','/api/events/c123']])assert.equal(mediaRequestAllowed(method,path,'media-id'),true,path)})
test('Media cannot reach academic, financial, registry, messaging or official-signature administration',()=>{for(const path of['/api/registry/directory','/api/admin/overview','/api/academic-records/report-cards','/api/finance','/api/messages','/api/academic-calendar','/api/auth/signature','/api/auth/document-assets','/api/auth/email'])for(const method of['GET','PUT','POST','DELETE'])assert.equal(mediaRequestAllowed(method,path,'media-id'),false,method+' '+path)})
test('personal settings and private photos remain tied to the signed-in identity',()=>{assert.equal(mediaRequestAllowed('GET','/api/auth/avatar/media-id?scope=nexus-personal-v2','media-id'),true);assert.equal(mediaRequestAllowed('GET','/api/auth/avatar/someone-else','media-id'),false);assert.equal(mediaRequestAllowed('PUT','/api/auth/change-password','media-id'),true);assert.equal(mediaRequestAllowed('PUT','/api/auth/profile','media-id'),true);assert.equal(mediaRequestAllowed('DELETE','/api/auth/profile','media-id'),false)})
test('a namespace prefix and parent-directory traversal cannot bypass the restriction',()=>{for(const path of['/api/newsletter','/api/media/../../registry/directory','/api/media/%2e%2e/students','/api/medias/upload'])assert.equal(mediaRequestAllowed('POST',path,'media-id'),false,path)})

test('Media co-manages only the exact website page catalog and preserves method restrictions',()=>{
 assert.equal(mediaRequestAllowed('GET','/api/site-content/manage','media-id'),true)
 for(const page of['home','about','academics','admissions','news','gallery','contact','school-handbook','shared'])assert.equal(mediaRequestAllowed('PUT','/api/site-content/'+page,'media-id'),true)
 for(const[method,path]of[['DELETE','/api/site-content/home'],['POST','/api/site-content/home'],['GET','/api/site-content/private'],['PUT','/api/site-content/manage'],['PUT','/api/site-content/home/extra'],['PUT','/api/site-content/../registry/directory']])assert.equal(mediaRequestAllowed(method,path,'media-id'),false)
})
