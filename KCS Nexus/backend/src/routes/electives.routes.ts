import { createHash } from 'node:crypto'
import { Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
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
}).superRefine((value, context) => {
  if (value.opensAt && value.closesAt && new Date(value.closesAt) <= new Date(value.opensAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['closesAt'], message: 'Choice closing must be after choice opening' })
  }
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

const requireAdministrator = () => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin' || req.user.sub === 'configured-superadmin') return next(new ApiError(403, 'Administrator access required'))
  next()
}
const cycleWindowIsOpen = (cycle: { opensAt: Date | null; closesAt: Date | null }) => {
  const now = new Date()
  return (!cycle.opensAt || cycle.opensAt <= now) && (!cycle.closesAt || cycle.closesAt >= now)
}
const cycleOr404 = async (id: string) => {
  const cycle = await prisma.electiveCycle.findUnique({ where: { id } })
  if (!cycle) throw new ApiError(404, 'Elective cycle not found')
  return cycle
}

const fairKey = (cycleId: string, studentId: string) => createHash('sha256').update(cycleId + ':' + studentId).digest('hex')
const activeEligibleStudents = (grades: string[]) => prisma.studentProfile.findMany({
  where: { status: { equals: 'active', mode: 'insensitive' }, grade: { in: grades } },
  select: { id: true, grade: true },
})

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

electivesRouter.get('/teachers', authenticate, requireAdministrator(), asyncHandler(async (_req, res) => {
  const teachers = await prisma.user.findMany({ where:{ teacherProfile:{isNot:null} }, select:{id:true,firstName:true,middleName:true,lastName:true,email:true}, orderBy:[{lastName:'asc'},{firstName:'asc'}] })
  return success(res, teachers)
}))

electivesRouter.post('/', authenticate, requireAdministrator(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = cycleSchema.parse(req.body)
  const duplicate=await prisma.electiveCycle.findUnique({where:{academicYear_semester:{academicYear:data.academicYear,semester:data.semester}},select:{id:true}})
  if(duplicate)throw new ApiError(409,'An elective cycle already exists for this academic year and semester')
  const cycle = await prisma.electiveCycle.create({ data:{...data, opensAt:data.opensAt?new Date(data.opensAt):null, closesAt:data.closesAt?new Date(data.closesAt):null, createdById:req.user!.sub} })
  return success(res, cycle, 'Elective cycle created', 201)
}))

electivesRouter.patch('/:cycleId/status', authenticate, requireAdministrator(), asyncHandler(async (req, res) => {
  const cycleId=String(req.params.cycleId); const current=await cycleOr404(cycleId)
  const {status}=statusSchema.parse(req.body)
  const allowedTransitions: Record<string,string[]> = { DRAFT:['OPEN'], OPEN:['CLOSED'], CLOSED:['OPEN'] }
  if(!(allowedTransitions[current.status]||[]).includes(status))throw new ApiError(409, 'Invalid elective cycle transition: '+current.status+' to '+status)
  if(status==='OPEN'){
    const cycle=current
    const approved=await prisma.electiveOffering.findMany({where:{cycleId,status:'APPROVED'}})
    if(approved.some(item=>item.capacity<1||item.capacity>24))throw new ApiError(409,'Every approved elective must have a capacity between 1 and 24')
    const missingTeacher=approved.filter(item=>!item.teacherUserId)
    if(missingTeacher.length)throw new ApiError(409,'Every approved elective must have an assigned teacher before opening choices')
    const students=await activeEligibleStudents(cycle.eligibleGrades)
    const insufficient=cycle.eligibleGrades.filter(grade=>approved.filter(item=>item.eligibleGrades.includes(grade)).length<cycle.choicesPerStudent)
    if(insufficient.length)throw new ApiError(409,'At least six approved electives are required for every eligible grade: '+insufficient.join(', '))
    const capacityShortages=cycle.eligibleGrades.filter(grade=>approved.filter(item=>item.eligibleGrades.includes(grade)).reduce((sum,item)=>sum+item.capacity,0)<students.filter(student=>student.grade===grade).length*cycle.choicesPerStudent)
    if(capacityShortages.length)throw new ApiError(409,'Insufficient capacity for every active student in: '+capacityShortages.join(', '))
    if(approved.reduce((sum,item)=>sum+item.capacity,0)<students.length*cycle.choicesPerStudent)throw new ApiError(409,'The catalogue does not contain enough total seats for all eligible students')
  }
  const cycle=await prisma.electiveCycle.update({where:{id:cycleId},data:{status}})
  return success(res,cycle,'Elective cycle status updated')
}))

electivesRouter.post('/:cycleId/offerings', authenticate, requireRoles('admin','teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(cycle.status!=='DRAFT')throw new ApiError(409,'Course creation and teacher proposals are only allowed while the catalogue is in draft')
  const data=offeringSchema.parse(req.body)
  if(data.eligibleGrades.some(grade=>!cycle.eligibleGrades.includes(grade)))throw new ApiError(400,'Every course grade must belong to the elective cycle')
  const teacherUserId=req.user!.role==='teacher'?req.user!.sub:data.teacherUserId||null
  if(teacherUserId){
    const teacher=await prisma.user.findFirst({where:{id:teacherUserId,teacherProfile:{isNot:null}},select:{id:true}})
    if(!teacher)throw new ApiError(400,'Assigned teacher was not found')
  }
  const offering=await prisma.electiveOffering.create({data:{...data,cycleId,teacherUserId,proposedById:req.user!.sub,status:req.user!.role==='teacher'?'PROPOSED':'APPROVED'}})
  return success(res,offering,req.user!.role==='teacher'?'Proposal submitted for approval':'Elective added',201)
}))

electivesRouter.patch('/offerings/:offeringId', authenticate, requireAdministrator(), asyncHandler(async (req, res) => {
  const offeringId=String(req.params.offeringId)
  const existing=await prisma.electiveOffering.findUnique({where:{id:offeringId},include:{cycle:{select:{status:true,eligibleGrades:true}}}})
  if(!existing)throw new ApiError(404,'Elective offering not found')
  if(existing.cycle.status!=='DRAFT')throw new ApiError(409,'The catalogue is locked after choices open')
  const data=offeringSchema.partial().extend({status:z.enum(['PROPOSED','APPROVED','REJECTED']).optional()}).parse(req.body)
  if(data.eligibleGrades?.some(grade=>!existing.cycle.eligibleGrades.includes(grade)))throw new ApiError(400,'Every course grade must belong to the elective cycle')
  if(data.capacity && data.capacity>24)throw new ApiError(400,'Capacity cannot exceed 24')
  const offering=await prisma.electiveOffering.update({where:{id:offeringId},data})
  return success(res,offering,'Elective updated')
}))

electivesRouter.delete('/offerings/:offeringId', authenticate, requireAdministrator(), asyncHandler(async (req, res) => {
  const offeringId=String(req.params.offeringId)
  const existing=await prisma.electiveOffering.findUnique({where:{id:offeringId},include:{cycle:{select:{status:true}},_count:{select:{choices:true,allocations:true}}}})
  if(!existing)throw new ApiError(404,'Elective offering not found')
  if(existing.cycle.status!=='DRAFT')throw new ApiError(409,'The catalogue is locked after choices open')
  if(existing._count.choices||existing._count.allocations)throw new ApiError(409,'This elective already has student choices or allocations and cannot be deleted')
  await prisma.electiveOffering.delete({where:{id:offeringId}})
  return success(res,{id:offeringId},'Elective removed')
}))

electivesRouter.put('/:cycleId/choices', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(cycle.status!=='OPEN')throw new ApiError(409,'Elective choices are not open')
  if(!cycleWindowIsOpen(cycle))throw new ApiError(409,'The elective choice window is not currently active')
  const student=await prisma.studentProfile.findUnique({where:{userId:req.user!.sub}})
  if(!student||student.status.toLowerCase()!=='active'||!cycle.eligibleGrades.includes(student.grade))throw new ApiError(403,'Student is not eligible for this elective cycle')
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

electivesRouter.post('/:cycleId/allocate', authenticate, requireAdministrator(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(!['CLOSED','ALLOCATED'].includes(cycle.status))throw new ApiError(409,'Close student choices before allocation')
  const [offerings,choices,students]=await Promise.all([
    prisma.electiveOffering.findMany({where:{cycleId,status:'APPROVED'}}),
    prisma.electiveChoice.findMany({where:{cycleId},orderBy:[{rank:'asc'},{studentProfileId:'asc'}]}),
    activeEligibleStudents(cycle.eligibleGrades),
  ])
  const participantIds=new Set(choices.map(choice=>choice.studentProfileId))
  const participants=students.filter(student=>participantIds.has(student.id))
  const grades=new Map(participants.map(student=>[student.id,student.grade]))
  const capacity=new Map(offerings.map(o=>[o.id,o.capacity]))
  const assigned=new Map<string,Set<string>>()
  const rows:{cycleId:string;studentProfileId:string;offeringId:string;preferenceRank:number;published:boolean}[]=[]
  for(let rank=1;rank<=cycle.choicesPerStudent;rank++){
    const round=choices.filter(c=>c.rank===rank).sort((a,b)=>fairKey(cycleId,a.studentProfileId).localeCompare(fairKey(cycleId,b.studentProfileId)))
    for(const choice of round){
      const own=assigned.get(choice.studentProfileId)??new Set<string>()
      if(own.size>=cycle.choicesPerStudent||own.has(choice.offeringId)||(capacity.get(choice.offeringId)??0)<=0)continue
      own.add(choice.offeringId);assigned.set(choice.studentProfileId,own)
      capacity.set(choice.offeringId,(capacity.get(choice.offeringId)??0)-1)
      rows.push({cycleId,studentProfileId:choice.studentProfileId,offeringId:choice.offeringId,preferenceRank:rank,published:false})
    }
  }
  for(const student of participants.sort((a,b)=>fairKey(cycleId,a.id).localeCompare(fairKey(cycleId,b.id)))){
    const own=assigned.get(student.id)??new Set<string>()
    const fallbacks=offerings.filter(item=>item.eligibleGrades.includes(grades.get(student.id)??'')&&!own.has(item.id)&&(capacity.get(item.id)??0)>0).sort((a,b)=>(capacity.get(b.id)??0)-(capacity.get(a.id)??0)||a.code.localeCompare(b.code))
    for(const offering of fallbacks){
      if(own.size>=cycle.choicesPerStudent)break
      own.add(offering.id);capacity.set(offering.id,(capacity.get(offering.id)??0)-1)
      rows.push({cycleId,studentProfileId:student.id,offeringId:offering.id,preferenceRank:cycle.choicesPerStudent+1,published:false})
    }
    assigned.set(student.id,own)
  }
  await prisma.$transaction(async tx=>{
    await tx.electiveAllocation.deleteMany({where:{cycleId}})
    if(rows.length)await tx.electiveAllocation.createMany({data:rows})
    await tx.electiveCycle.update({where:{id:cycleId},data:{status:'ALLOCATED',publishedAt:null}})
  })
  const studentIds=new Set(choices.map(c=>c.studentProfileId))
  const incomplete=[...studentIds].filter(id=>(assigned.get(id)?.size??0)<cycle.choicesPerStudent)
  const fallbacks=rows.filter(row=>row.preferenceRank>cycle.choicesPerStudent).length
  return success(res,{students:studentIds.size,allocations:rows.length,complete:studentIds.size-incomplete.length,incomplete:incomplete.length,fallbacks,remainingCapacity:Object.fromEntries(capacity)},'Allocation completed')
}))

electivesRouter.post('/:cycleId/publish', authenticate, requireAdministrator(), asyncHandler(async (req, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  if(cycle.status!=='ALLOCATED')throw new ApiError(409,'Run allocation before publication')
  const [participants,allocations,eligibleStudents]=await Promise.all([
    prisma.electiveChoice.findMany({where:{cycleId},distinct:['studentProfileId'],select:{studentProfileId:true}}),
    prisma.electiveAllocation.findMany({where:{cycleId},select:{studentProfileId:true,offeringId:true}}),
    activeEligibleStudents(cycle.eligibleGrades),
  ])
  if(participants.length!==eligibleStudents.length)throw new ApiError(409,'Publication blocked: '+(eligibleStudents.length-participants.length)+' eligible student(s) have not submitted six choices')
  const incomplete=participants.filter(item=>allocations.filter(row=>row.studentProfileId===item.studentProfileId).length!==cycle.choicesPerStudent)
  if(incomplete.length)throw new ApiError(409,'Publication blocked: '+incomplete.length+' student allocation(s) are incomplete. Review the final report, adjust the catalogue, reopen choices if necessary, then calculate again.')
  const offerings=await prisma.electiveOffering.findMany({where:{cycleId},select:{id:true,capacity:true}})
  const overCapacity=offerings.filter(offering=>allocations.filter(row=>row.offeringId===offering.id).length>offering.capacity)
  if(overCapacity.length)throw new ApiError(409,'Publication blocked: one or more electives exceed the strict capacity of 24 students')
  const result=await prisma.$transaction(async tx=>{
    await tx.electiveAllocation.updateMany({where:{cycleId},data:{published:true}})
    return tx.electiveCycle.update({where:{id:cycleId},data:{status:'PUBLISHED',publishedAt:new Date()}})
  })
  return success(res,result,'Final elective lists published')
}))

electivesRouter.get('/:cycleId/report', authenticate, requireAdministrator(), asyncHandler(async (req, res) => {
  const cycleId=String(req.params.cycleId); const cycle=await cycleOr404(cycleId)
  const [offerings,allocations,studentCount,eligibleStudents,rankedChoices]=await Promise.all([
    prisma.electiveOffering.findMany({where:{cycleId},include:{teacher:{select:{firstName:true,middleName:true,lastName:true}},_count:{select:{choices:true,allocations:true}}},orderBy:{name:'asc'}}),
    prisma.electiveAllocation.findMany({where:{cycleId},include:{offering:true,student:{include:{user:{select:{firstName:true,middleName:true,lastName:true,email:true}}}}},orderBy:[{offeringId:'asc'},{studentProfileId:'asc'}]}),
    prisma.electiveChoice.findMany({where:{cycleId},distinct:['studentProfileId'],select:{studentProfileId:true}}),
    prisma.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'},grade:{in:cycle.eligibleGrades}},select:{id:true,studentNumber:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true,email:true}}},orderBy:[{grade:'asc'},{section:'asc'},{user:{lastName:'asc'}}]}),
    prisma.electiveChoice.findMany({where:{cycleId},include:{offering:{select:{id:true,code:true,name:true}},student:{include:{user:{select:{firstName:true,middleName:true,lastName:true,email:true}}}}},orderBy:[{studentProfileId:'asc'},{rank:'asc'}]}),
  ])
  const incomplete=studentCount.filter(s=>allocations.filter(a=>a.studentProfileId===s.studentProfileId).length<cycle.choicesPerStudent).length
  const submittedIds=new Set(studentCount.map(item=>item.studentProfileId))
  const missingStudents=eligibleStudents.filter(item=>!submittedIds.has(item.id))
  return success(res,{cycle,offerings,allocations,rankedChoices,missingStudents,summary:{eligible:eligibleStudents.length,participants:studentCount.length,missing:missingStudents.length,allocations:allocations.length,complete:studentCount.length-incomplete,incomplete,fallbacks:allocations.filter(item=>item.preferenceRank>cycle.choicesPerStudent).length}})
}))
