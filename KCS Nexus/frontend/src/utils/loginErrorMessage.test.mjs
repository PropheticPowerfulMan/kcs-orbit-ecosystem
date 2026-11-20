import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
const source=fs.readFileSync(new URL('./loginErrorMessage.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {loginErrorMessage}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
test('wrong credentials never display malformed provider text',()=>{
 const error={response:{status:401,data:{message:'Identifiants erronÃ©s â€” rÃ©essayez'}}}
 assert.equal(loginErrorMessage(error,'fr'),'Identifiant ou mot de passe incorrect.')
 assert.equal(loginErrorMessage(error,'en'),'Incorrect identifier or password.')
})
test('lockouts show a human-readable number of minutes in either language',()=>{
 assert.equal(loginErrorMessage({response:{status:423,data:{message:'verrouillÃ©. RÃ©essayez dans 12 minutes.'}}},'fr'),'Compte temporairement verrouillé. Réessayez dans 12 minutes.')
 assert.match(loginErrorMessage({response:{status:429,data:{retryAfterMinutes:1}}},'en'),/in 1 minute\./)
})
test('two-factor, network failures and service failures remain distinct',()=>{
 assert.match(loginErrorMessage({response:{status:428}},'en'),/6-digit/)
 assert.match(loginErrorMessage({response:{status:401,data:{message:'Invalid two-factor authentication code'}}},'en'),/^Invalid authentication/)
 assert.match(loginErrorMessage({code:'ERR_NETWORK'},'fr'),/Connexion indisponible/)
 assert.doesNotMatch(loginErrorMessage({response:{status:500,data:{message:'Internal secret diagnostic'}}},'en'),/secret/)
})
