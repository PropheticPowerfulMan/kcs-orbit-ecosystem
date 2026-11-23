import {describe,it,expect,vi,beforeEach} from 'vitest';
import {api,invalidateApiMemoryCache,peekApiResponse,getCachedApiResponse,getPendingApiWrites} from './api';
const storage=new Map<string,string>();
beforeEach(()=>{storage.clear();vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});invalidateApiMemoryCache()});
describe('bounded account-scoped memory cache',()=>{
 it('deduplicates parallel reads and returns fresh data without a second fetch',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({balance:42}),{status:200}));vi.stubGlobal('fetch',fetcher);const path='/api/qa-cache/parallel';const [a,b]=await Promise.all([api(path),api(path)]);expect(a).toEqual(b);expect(fetcher).toHaveBeenCalledTimes(1);expect(await api(path)).toEqual(a);expect(fetcher).toHaveBeenCalledTimes(1)});
 it('does not expose another account’s response',async()=>{storage.set('edupay_token','account-a');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"owner":"a"}',{status:200})));await api('/api/qa-cache/account');storage.set('edupay_token','account-b');expect(peekApiResponse('/api/qa-cache/account')).toBeNull()});
 it('does not revive a pending stale read after a mutation invalidates the cache',async()=>{let resolve!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{resolve=r})));const pending=api('/api/qa-cache/race');await Promise.resolve();invalidateApiMemoryCache();resolve(new Response('{"balance":10}',{status:200}));await pending;expect(peekApiResponse('/api/qa-cache/race')).toBeNull();expect(getCachedApiResponse('/api/qa-cache/race')).toBeNull()});
});

describe('offline cache and account transitions',()=>{
 it('does not return account A offline data to account B',async()=>{
 storage.set('edupay_token','qa-a');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"owner":"a"}',{status:200})));await api('/api/qa/offline');
 expect(getCachedApiResponse('/api/qa/offline')).toEqual({owner:'a'});storage.set('edupay_token','qa-b');expect(getCachedApiResponse('/api/qa/offline')).toBeNull();
 });
 it('rejects a late response from a previous account',async()=>{
 storage.set('edupay_token','qa-a');let resolve!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{resolve=r})));const pending=api('/api/qa/account-switch');await Promise.resolve();storage.set('edupay_token','qa-b');resolve(new Response('{"owner":"a"}',{status:200}));await expect(pending).rejects.toThrow('Session changed');expect(getCachedApiResponse('/api/qa/account-switch')).toBeNull();
 });
 it('holds the reload guard until a mutation is acknowledged',async()=>{
 let resolve!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{resolve=r})));const pending=api('/api/qa/write',{method:'POST',body:'{}'});await Promise.resolve();expect(getPendingApiWrites()).toBe(1);resolve(new Response('{}',{status:200}));await pending;expect(getPendingApiWrites()).toBe(0);
 });
});
