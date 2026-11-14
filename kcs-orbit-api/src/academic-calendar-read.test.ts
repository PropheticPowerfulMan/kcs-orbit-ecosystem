import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { prisma } from './db';
import { createApp } from './app';
test('scoped calendar consumers can read published dates but cannot write through the read API',async()=>{
 const previousKey=process.env.KCS_SENTINEL_INTEGRATION_KEY;process.env.KCS_SENTINEL_INTEGRATION_KEY='calendar-test-only-key';
 const original=prisma.academicYear.findMany;let queries=0;
 (prisma.academicYear.findMany as any)=async(query:any)=>{queries++;assert.equal(query.where.organizationId,'school-test');return [{name:'2026-2027',periods:[]}]};
 const server=createServer(createApp());await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/integration/read/academic-calendar';
 try {
  assert.equal((await fetch(base+'?organizationId=school-test')).status,401);
  assert.equal((await fetch(base+'?organizationId=school-test',{headers:{'x-app-slug':'KCS_SENTINEL','x-api-key':'wrong'}})).status,401);
  const headers={'x-app-slug':'KCS_SENTINEL','x-api-key':'calendar-test-only-key'};
  assert.equal((await fetch(base,{headers})).status,400);
  const result=await fetch(base+'?organizationId=school-test',{headers});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal((await result.json()).calendars[0].name,'2026-2027');
  const write=await fetch(base+'?organizationId=school-test',{method:'PUT',headers});assert.ok([404,405].includes(write.status));assert.equal(queries,1);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));prisma.academicYear.findMany=original;if(previousKey===undefined)delete process.env.KCS_SENTINEL_INTEGRATION_KEY;else process.env.KCS_SENTINEL_INTEGRATION_KEY=previousKey}
});
