import assert from 'node:assert/strict'
import test from 'node:test'
import {resolveUploadRoot,isMountedUploadPath} from './uploadStorage.js'
test('production upload storage never depends on the image working directory',()=>{
 assert.equal(resolveUploadRoot({NODE_ENV:'production'},'/workspace/KCS Nexus/backend'),'/app/uploads')
 assert.equal(resolveUploadRoot({NODE_ENV:'production'},'/different/image'),'/app/uploads')
})
test('explicit storage root and development isolation are preserved',()=>{
 assert.equal(resolveUploadRoot({NEXUS_UPLOADS_DIR:'/persistent/files'},'/work'),'/persistent/files')
 assert.equal(resolveUploadRoot({NODE_ENV:'test'},'/work'),'/work/uploads')
})
test('a disposable container root never counts as persistent storage',()=>{
 const root='90 1 0:12 / / rw - overlay overlay rw'
 assert.equal(isMountedUploadPath('/app/uploads',root),false)
 assert.equal(isMountedUploadPath('/app/uploads',root+'\n91 1 0:13 / /app/uploads-other rw - ext4 /dev/sda rw'),false)
})
test('the actual upload mount or an enclosing data mount is required',()=>{
 assert.equal(isMountedUploadPath('/app/uploads','91 1 0:13 / /app/uploads rw - ext4 /dev/sda rw'),true)
 assert.equal(isMountedUploadPath('/data/uploads','91 1 0:13 / /data rw - ext4 /dev/sda rw'),true)
 assert.equal(isMountedUploadPath('/data store/uploads','91 1 0:13 / /data\\040store rw - ext4 /dev/sda rw'),true)
})
