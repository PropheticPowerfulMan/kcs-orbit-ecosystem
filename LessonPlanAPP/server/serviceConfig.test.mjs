import test from "node:test";
import assert from "node:assert/strict";
import {serviceUrl} from "./serviceConfig.mjs";
test("Supabase project and legacy REST URLs resolve to the same project",()=>{
  for(const value of ["https://example.supabase.co","https://example.supabase.co/","https://example.supabase.co/rest/v1","https://example.supabase.co/rest/v1/"])
    assert.equal(serviceUrl(value,"SUPABASE_URL",{supabase:true}),"https://example.supabase.co");
});
test("Docker Nexus URL retains its valid port",()=>assert.equal(serviceUrl("http://nexus_api:5000/","NEXUS_API_URL"),"http://nexus_api:5000"));
test("Broken ports and credentials fail before starting a misleadingly healthy service",()=>{
  for(const value of ["http://nexus_api:5000n","file:///etc/passwd","https://user:secret@example.com","https://example.com?secret=value"])
    assert.throws(()=>serviceUrl(value,"NEXUS_API_URL"),/NEXUS_API_URL/);
});
test("Supabase endpoints cannot be appended twice",()=>assert.throws(()=>serviceUrl("https://example.supabase.co/auth/v1","SUPABASE_URL",{supabase:true}),/project/));
