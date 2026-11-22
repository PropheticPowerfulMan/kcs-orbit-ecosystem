import { prisma } from './db';
import { getOrCreateCurrentAcademicCalendar, saveAcademicCalendar } from './services/academic-calendar.service';
import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultAcademicCalendar } from "@ecosystem/shared-contracts";
import { getDefaultAcademicStartYear, validateAcademicCalendar } from "./services/academic-calendar.service";

test("August 2026 defaults to 2026-2027", () => {
  assert.equal(getDefaultAcademicStartYear(new Date("2026-08-31T12:00:00Z")), 2026);
});
test("February 2027 remains in 2026-2027", () => {
  assert.equal(getDefaultAcademicStartYear(new Date("2027-02-10T12:00:00Z")), 2026);
});
test("2026-2027 calendar follows the official KCS instruction dates", () => {
  const calendar = validateAcademicCalendar(buildDefaultAcademicCalendar(2026, "org-kcs"));
  assert.equal(calendar.name, "2026-2027");
  assert.equal(calendar.startDate.toISOString().slice(0, 10), "2026-09-07");
  assert.equal(calendar.endDate.toISOString().slice(0, 10), "2027-06-11");
  assert.equal(calendar.periods.filter((p) => p.type === "SEMESTER").length, 2);
  assert.equal(calendar.periods.filter((p) => p.type === "QUARTER").length, 4);
  assert.deepEqual(
    calendar.periods.map((period) => [period.code, period.startDate.toISOString().slice(0, 10), period.endDate.toISOString().slice(0, 10)]),
    [
      ["S1", "2026-09-07", "2027-01-29"],
      ["S2", "2027-02-01", "2027-06-11"],
      ["Q1", "2026-09-07", "2026-11-06"],
      ["Q2", "2026-11-09", "2027-01-29"],
      ["Q3", "2027-02-01", "2027-04-02"],
      ["Q4", "2027-04-05", "2027-06-11"]
    ]
  );
});
test("July end date is rejected", () => {
  const calendar = buildDefaultAcademicCalendar(2026, "org-kcs");
  calendar.endDate = new Date("2027-07-01T00:00:00Z");
  assert.throws(() => validateAcademicCalendar(calendar), /during June/);
});
test("overlapping periods are rejected", () => {
  const calendar = buildDefaultAcademicCalendar(2026, "org-kcs");
  calendar.periods.find((p) => p.code === "Q2")!.startDate = new Date("2026-10-01T00:00:00Z");
  assert.throws(() => validateAcademicCalendar(calendar), /must not overlap/);
});

test("reading a previously closed year never activates another academic year", async () => {
 const original = prisma.academicYear.findFirst;
 const originalTransaction = prisma.$transaction;
 let reads = 0;
 const closed = {name:'2026-2027',isCurrent:false,status:'CLOSED',periods:[]};
 (prisma.academicYear.findFirst as any) = async () => ++reads === 1 ? null : closed;
 (prisma.$transaction as any) = async () => { throw new Error('Unexpected implicit activation'); };
 try { assert.equal(await getOrCreateCurrentAcademicCalendar('school-test',new Date('2028-10-01T12:00:00Z')),closed);assert.equal(reads,2); }
 finally { prisma.academicYear.findFirst=original;prisma.$transaction=originalTransaction; }
});


test('calendar correction keeps stable period IDs and full before/after versions',async()=>{
 const original=prisma.$transaction;const input=buildDefaultAcademicCalendar(2026,'school-test');const periods=new Map<string,any>();input.periods.forEach((p,i)=>periods.set(p.type+':'+p.sequence,{id:'stable-'+i,academicYearId:'year-2026',...p}));let before:any=null,after:any=null,audit:any=null;
 const current=()=>({id:'year-2026',name:input.name,periods:[...periods.values()]});
 const tx={academicYear:{findUnique:async()=>{before=structuredClone(current());return before},updateMany:async()=>({count:0}),upsert:async()=>({id:'year-2026'}),findUniqueOrThrow:async()=>{after=structuredClone(current());return after}},academicPeriod:{upsert:async(args:any)=>{const key=args.where.academicYearId_type_sequence.type+':'+args.where.academicYearId_type_sequence.sequence;const row=periods.get(key);assert.ok(row);periods.set(key,{...row,...args.update})},deleteMany:async()=>{throw Error('Period references must never be deleted on edit')}},auditLog:{create:async(args:any)=>{audit=args.data}}};
 (prisma.$transaction as any)=async(fn:any)=>fn(tx);
 try{input.periods[0].name='Semester One';await saveAcademicCalendar(input,'KCS_NEXUS');assert.equal(periods.get('SEMESTER:1').id,'stable-0');assert.equal(audit.metadata.before.periods[0].name,before.periods[0].name);assert.equal(audit.metadata.after.periods[0].name,'Semester One');assert.equal(after.periods.length,6)}finally{prisma.$transaction=original}
});
