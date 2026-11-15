import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../config/prisma.js';
import {authenticate,requireRoles,type AuthenticatedRequest} from '../middleware/auth.js';
import {ensureTeacherProfile} from '../utils/teacherProfile.js';
import {academicPeriodAccess,assertAcademicPeriodOpen,lockAcademicYears} from '../services/academicPeriodAccess.service.js';
import {coursePeriodStates,saveCoursePeriods} from '../services/courseTeachingPeriods.service.js';
import {validAcademicYear} from '../utils/courseTeachingPeriods.js';
import {ApiError,asyncHandler,success} from '../utils/api.js';
export const teachingPeriodSchema=z.object({academicYear:z.string().refine(validAcademicYear,'Choose a valid school year.'),semesters:z.array(z.number().int().min(1).max(2)).min(1).max(2).refine(s=>new Set(s).size===s.length,'Choose each semester once.')});
export const teacherCoursePeriodsRouter=Router();
teacherCoursePeriodsRouter.use(authenticate,requireRoles('teacher'));
teacherCoursePeriodsRouter.get('/',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const teacher=await ensureTeacherProfile(req.user!.sub);
 const [courses,access]=await Promise.all([prisma.course.findMany({where:{teacherId:teacher.id},select:{id:true}}),academicPeriodAccess()]);
 const states=await coursePeriodStates(courses.map(c=>c.id));res.setHeader('Cache-Control','private, no-store');
 return success(res,{courses:courses.map(c=>({id:c.id,...(states.get(c.id)||{periods:[],revision:0})})),calendars:access.calendars,activeAcademicYear:access.activeAcademicYear,activeEntryTerm:access.activeEntryTerm});
}));
teacherCoursePeriodsRouter.put('/',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const input=teachingPeriodSchema.extend({courses:z.array(z.object({id:z.string().min(1).max(120),revision:z.number().int().min(0)})).min(1).max(100),mode:z.enum(['add','replace']).default('add')}).strict().parse(req.body);
 if(new Set(input.courses.map(c=>c.id)).size!==input.courses.length)throw new ApiError(400,'Duplicate course selection.');
 const teacher=await ensureTeacherProfile(req.user!.sub);
 const access=await academicPeriodAccess();
 if(!(access.calendars||[]).some(c=>c.name===input.academicYear))throw new ApiError(400,'Choose a school year published by Super Administration.');
 input.semesters.forEach(s=>assertAcademicPeriodOpen(access,input.academicYear,'Semester '+s));
 const result=await prisma.$transaction(async tx=>{
  await lockAcademicYears(tx,[input.academicYear]);
  const currentAccess=await academicPeriodAccess(tx);input.semesters.forEach(s=>assertAcademicPeriodOpen(currentAccess,input.academicYear,'Semester '+s));
  const courses=await tx.course.findMany({where:{id:{in:input.courses.map(c=>c.id)},teacherId:teacher.id},select:{id:true}});
  if(courses.length!==input.courses.length)throw new ApiError(403,'Only your own official courses can be organized.');
  const results=[];for(const course of [...input.courses].sort((a,b)=>a.id.localeCompare(b.id)))results.push({id:course.id,...await saveCoursePeriods(tx,{courseId:course.id,actorId:req.user!.sub,academicYear:input.academicYear,semesters:input.semesters,mode:input.mode,expectedRevision:course.revision})});return results;
 },{maxWait:10000,timeout:30000});
 return success(res,result,'Course organization saved. Existing grades and rosters are unchanged.');
}));
