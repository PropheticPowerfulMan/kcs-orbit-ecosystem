import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

export const electivesRouter = Router()
const allowedGrades = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
const cycleSchema = z.object({
  title: z.string().trim().min(3).max(140),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  semester: z.number().int().min(1).max(2),
  eligibleGrades: z.array(z.enum(['Grade 9','Grade 10','Grade 11','Grade 12'])).min(1).default(['Grade 9','Grade 10','Grade 11','Grade 12']),
  opensAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
})
const offeringSchema = z.object({
  code: z.string().trim().min(2).max(30).transform(v => v.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  eligibleGrades: z.array(z.enum(['Grade 9','Grade 10','Grade 11','Grade 12'])).min(1),
  capacity: z.number().int().min(1).max(24).default(24),
  teacherUserId: z.string().trim().optional().nullable(),
})
const statusSchema = z.object({ status: z.enum(['DRAFT','OPEN','CLOSED']) })
const choiceSchema = z.object({ offeringIds: z.array(z.string()).length(6) })

const assertSuperAdmin = (req: AuthenticatedRequest) => {
  if (req.user?.sub !== 'configured-superadmin') throw new ApiError(403, 'Superadministrator access required')
}
const cycleOr404 = async (id: string) => {
  const cycle = await prisma.electiveCycle.findUnique({ where: { id } })
  if (!cycle) throw new ApiError(404, 'Elective cycle not found')
  return cycle
}

electivesRouter.get('/', authenticate, requireRoles('admin','teacher','student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const role = req.user!.role
  const cycles = await prisma.electiveCycle.findMany({
    where: role === 'student' ? { status: { in: ['OPEN','CLOSED','ALLOCATED','PUBLISHED'] } } : {},
    include: {
      offerings: { include: { teacher: { select: { id:true, firstName:true, middleName:true, lastName:true } }, proposedBy: { select: { id:true, firstName:true, middleName:true, lastName:true } } }, orderBy: { name: 'asc' } },
      _count: { select: { choices:true, allocations:true } },
    },
    orderBy: [{ academicYear:'desc' }, { semester:'desc' }],
  })
  if (role === 'student') {
    const student = await prisma.studentProfile.findUnique({ where: { userId:req.user!.sub } })
    if (!student || !allowedGrades.includes(student.grade)) return success(res, { eligible:false, cycles:[] })
    const relevant = cycles.filter(c => c.eligibleGrades.includes(student.grade))
    const [choices, allocations] = await Promise.all([
      prisma.electiveChoice.findMany({ where: { studentProfileId:student.id }, orderBy:{rank:'asc'} }),
      prisma.electiveAllocation.findMany({ where: { studentProfileId:student.id, published:true }, include:{offering:true}, orderBy:{preferenceRank:'asc'} }),
    ])
    return success(res, { eligible:true, grade:student.grade, cycles:relevant, choices, allocations })
  }
  return success(res, { eligible:true, cycles })
}))

electivesRouter.get('/teachers', authenticate, requireSuperAdmin(), asyncHandler(async (_req, res) => {
  const teachers = await prisma.user.findMany({ where:{ teacherProfile:{isNot:null} }, select:{id:true,firstName:true,middleName:true,lastName:true,email:true}, orderBy:[{lastName:'asc'},{firstName:'asc'}] })
  return success(res, teachers)
}))

electivesRouter.post('/', authenticate, requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = cycleSchema.parse(req.body)
  const cycle = await prisma.electiveCycle.create({ data:{...data, opensAt:data.opensAt?new Date(data.opensAt):null, closesAt:data.closesAt?new Date(data.closesAt):null, createdById:req.user!.sub==='configured-superadmin'?null:req.user!.sub} })
  return success(res, cycle, 'Elective cycle created', 201)
}))

electivesRouter.patch('/:cycleId/status', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const cycleId=String(req.params.cycleId); await cycleOr404(cycleId)
  const {status}=statusSchema.parse(req.body)
  if(status==='OPEN'){
    const approved=await prisma.electiveOffering.count({where:{cycleId,status:'APPROVED'}})
    if(approved<6)throw new ApiError(409,'At least six approved electives are required before opening choices')
  }
  const cycle=await prisma.electiveCycle.update({where:{id:cycleId},data:{status}})
  return success(res,cycle,'Elective cycle status updated')
}))

electivesRouter.post('/:cycleId/offerings', authenticate, requireRoles('admin','teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(!['DRAFT','OPEN'].includes(cycle.status))throw new ApiError(409,'This elective catalogue is locked')
  const data=offeringSchema.parse(req.body)
  const teacherUserId=req.user!.role==='teacher'?req.user!.sub:data.teacherUserId||null
  if(teacherUserId){
    const teacher=await prisma.user.findFirst({where:{id:teacherUserId,teacherProfile:{isNot:null}},select:{id:true}})
    if(!teacher)throw new ApiError(400,'Assigned teacher was not found')
  }
  const offering=await prisma.electiveOffering.create({data:{...data,cycleId,teacherUserId,proposedById:req.user!.sub==='configured-superadmin'?null:req.user!.sub,status:req.user!.role==='teacher'?'PROPOSED':'APPROVED'}})
  return success(res,offering,req.user!.role==='teacher'?'Proposal submitted for approval':'Elective added',201)
}))

electivesRouter.patch('/offerings/:offeringId', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const offeringId=String(req.params.offeringId)
  const data=offeringSchema.partial().extend({status:z.enum(['PROPOSED','APPROVED','REJECTED']).optional()}).parse(req.body)
  if(data.capacity && data.capacity>24)throw new ApiError(400,'Capacity cannot exceed 24')
  const offering=await prisma.electiveOffering.update({where:{id:offeringId},data})
  return success(res,offering,'Elective updated')
}))

electivesRouter.delete('/offerings/:offeringId', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const offeringId=String(req.params.offeringId)
  const used=await prisma.electiveChoice.count({where:{offeringId}})
  if(used)throw new ApiError(409,'This elective already has student choices; reject it instead of deleting it')
  await prisma.electiveOffering.delete({where:{id:offeringId}})
  return success(res,{id:offeringId},'Elective removed')
}))

electivesRouter.put('/:cycleId/choices', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(cycle.status!=='OPEN')throw new ApiError(409,'Elective choices are not open')
  const student=await prisma.studentProfile.findUnique({where:{userId:req.user!.sub}})
  if(!student||!cycle.eligibleGrades.includes(student.grade))throw new ApiError(403,'Student is not eligible for this elective cycle')
  const {offeringIds}=choiceSchema.parse(req.body)
  if(cycle.choicesPerStudent!==6)throw new ApiError(409,'This cycle is not configured for six choices')
  if(new Set(offeringIds).size!==6)throw new ApiError(400,'Six different electives are required')
  const valid=await prisma.electiveOffering.findMany({where:{id:{in:offeringIds},cycleId,status:'APPROVED'}})
  if(valid.length!==6||valid.some(x=>!x.eligibleGrades.includes(student.grade)))throw new ApiError(400,'One or more electives are unavailable for this grade')
  const now=new Date()
  await prisma.$transaction(async tx=>{
    await tx.electiveChoice.deleteMany({where:{cycleId,studentProfileId:student.id}})
    await tx.electiveChoice.createMany({data:offeringIds.map((offeringId,index)=>({cycleId,studentProfileId:student.id,offeringId,rank:index+1,submittedAt:now}))})
  })
  return success(res,{submitted:true,count:6},'Six ranked elective choices submitted')
}))

electivesRouter.post('/:cycleId/allocate', authenticate, requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(!['CLOSED','ALLOCATED'].includes(cycle.status))throw new ApiError(409,'Close student choices before allocation')
  const [offerings,choices]=await Promise.all([
    prisma.electiveOffering.findMany({where:{cycleId,status:'APPROVED'}}),
    prisma.electiveChoice.findMany({where:{cycleId},orderBy:[{rank:'asc'},{submittedAt:'asc'},{studentProfileId:'asc'}]}),
  ])
  const capacity=new Map(offerings.map(o=>[o.id,o.capacity]))
  const assigned=new Map<string,Set<string>>()
  const rows:{cycleId:string;studentProfileId:string;offeringId:string;preferenceRank:number;published:boolean}[]=[]
  for(let rank=1;rank<=cycle.choicesPerStudent;rank++){
    for(const choice of choices.filter(c=>c.rank===rank)){
      const own=assigned.get(choice.studentProfileId)??new Set<string>()
      if(own.size>=cycle.choicesPerStudent||own.has(choice.offeringId)||(capacity.get(choice.offeringId)??0)<=0)continue
      own.add(choice.offeringId);assigned.set(choice.studentProfileId,own)
      capacity.set(choice.offeringId,(capacity.get(choice.offeringId)??0)-1)
      rows.push({cycleId,studentProfileId:choice.studentProfileId,offeringId:choice.offeringId,preferenceRank:rank,published:false})
    }
  }
  await prisma.$transaction(async tx=>{
    await tx.electiveAllocation.deleteMany({where:{cycleId}})
    if(rows.length)await tx.electiveAllocation.createMany({data:rows})
    await tx.electiveCycle.update({where:{id:cycleId},data:{status:'ALLOCATED',publishedAt:null}})
  })
  const students=new Set(choices.map(c=>c.studentProfileId))
  const incomplete=[...students].filter(id=>(assigned.get(id)?.size??0)<cycle.choicesPerStudent)
  return success(res,{students:students.size,allocations:rows.length,complete:students.size-incomplete.length,incomplete:incomplete.length,remainingCapacity:Object.fromEntries(capacity)},'Allocation completed')
}))

electivesRouter.post('/:cycleId/publish', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(cycle.status!=='ALLOCATED')throw new ApiError(409,'Run allocation before publication')
  const result=await prisma.$transaction(async tx=>{
    await tx.electiveAllocation.updateMany({where:{cycleId},data:{published:true}})
    return tx.electiveCycle.update({where:{id:cycleId},data:{status:'PUBLISHED',publishedAt:new Date()}})
  })
  return success(res,result,'Final elective lists published')
}))

electivesRouter.get('/:cycleId/report', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  const [offerings,allocations,studentCount]=await Promise.all([
    prisma.electiveOffering.findMany({where:{cycleId},include:{teacher:{select:{firstName:true,middleName:true,lastName:true}},_count:{select:{choices:true,allocations:true}}},orderBy:{name:'asc'}}),
    prisma.electiveAllocation.findMany({where:{cycleId},include:{offering:true,student:{include:{user:{select:{firstName:true,middleName:true,lastName:true,email:true}}}}},orderBy:[{offeringId:'asc'},{studentProfileId:'asc'}]}),
    prisma.electiveChoice.findMany({where:{cycleId},distinct:['studentProfileId'],select:{studentProfileId:true}}),
  ])
  const incomplete=studentCount.filter(s=>allocations.filter(a=>a.studentProfileId===s.studentProfileId).length<cycle.choicesPerStudent).length
  return success(res,{cycle,offerings,allocations,summary:{participants:studentCount.length,allocations:allocations.length,complete:studentCount.length-incomplete,incomplete}})
}))
