import {Prisma}from'@prisma/client'
import {shiningSupervision}from'../services/shiningSupervision.service.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {academicCalendars} from '../services/reportAttendance.service.js'
import {nonSchoolSettings} from '../services/attendanceCalendarSettings.service.js'
import {schoolDayDecision} from '../utils/schoolDayPolicy.js'
import { createHash } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'
import { sendSchoolSms } from '../utils/sms.js'

export const shiningStudentsRouter = Router()
shiningStudentsRouter.use(authenticate)

const divisionForGrade = (grade: string): 'LOWER' | 'MIDDLE_UPPER' | null => {
  const normalized = grade.trim().toLowerCase()
  if (/^k[3-5]$/.test(normalized)) return 'LOWER'
  const match = normalized.match(/(?:grade|gr|g)?\s*(\d{1,2})/)
  const level = match ? Number(match[1]) : NaN
  if (level >= 1 && level <= 5) return 'LOWER'
  if (level >= 6 && level <= 12) return 'MIDDLE_UPPER'
  return null
}

const utcDate = (value: string) => {
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid calendar date.')
  return date
}
const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const isWeekday = (date: Date) => date.getUTCDay() >= 1 && date.getUTCDay() <= 5
const addDay = (date: Date) => new Date(date.getTime() + 86_400_000)
const weekMonday = (date: Date) => {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() - (copy.getUTCDay() === 0 ? 6 : copy.getUTCDay() - 1))
  return isoDay(copy)
}
const deterministicIndex = (date: Date, division: string, length: number) =>
  Number.parseInt(createHash('sha256').update(`${isoDay(date)}:${division}`).digest('hex').slice(0, 8), 16) % length

const scheduleInclude = {
  student: {
    include: {
      user: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true } },
      parentLinks: { include: { parent: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true } } } },
    },
  },
} as const

shiningStudentsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const from = typeof req.query.from === 'string' ? utcDate(req.query.from) : new Date(Date.now() - 30 * 86_400_000)
  const to = typeof req.query.to === 'string' ? utcDate(req.query.to) : new Date(Date.now() + 120 * 86_400_000)
  const storedUser = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { role: true, studentProfile: { select: { id: true } }, parentLinks: { select: { studentId: true } } },
  })
  const user=storedUser||(req.user!.sub==='configured-superadmin'&&req.user!.role==='admin'?{role:'ADMIN' as const,studentProfile:null,parentLinks:[]}:null)
  if (!user) throw new ApiError(404, 'Account not found.')
  const allowedStudentIds = user.role === 'STUDENT'
    ? [user.studentProfile?.id].filter(Boolean) as string[]
    : user.role === 'PARENT' ? user.parentLinks.map((link) => link.studentId) : null
  const schedules = await prisma.shiningStudentSchedule.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(allowedStudentIds ? { studentId: { in: allowedStudentIds } } : {}),
    },
    include: scheduleInclude,
    orderBy: [{ date: 'asc' }, { division: 'asc' }],
  })
  const enriched=await shiningSupervision(schedules,req.user!.sub,req.user!.role)
  return success(res, req.user!.role==='teacher'?enriched.filter(row=>row.teacherVisible):enriched)
}))

shiningStudentsRouter.get('/supervisors',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 if(!['admin','teacher','student'].includes(req.user!.role))throw new ApiError(403,'Teacher or learner access required')
 return success(res,await prisma.user.findMany({where:{accountBlockedAt:null,teacherProfile:{isNot:null}},select:{id:true,firstName:true,middleName:true,lastName:true},orderBy:[{lastName:'asc'},{firstName:'asc'}]}))
}))
shiningStudentsRouter.patch('/:id/supervisor',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=z.object({teacherUserId:z.string().min(1).nullable(),revision:z.string().min(1)}).parse(req.body),id=String(req.params.id),actorId=await databaseActorId(req.user!.sub)
 const updated=await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShiningStudentSchedule" WHERE id=${id} FOR UPDATE`)
  const schedule=await tx.shiningStudentSchedule.findUnique({where:{id},include:scheduleInclude});if(!schedule)throw new ApiError(404,'Presentation not found / Présentation introuvable')
  const current=(await shiningSupervision([schedule],req.user!.sub,req.user!.role,tx))[0]
  if(!current.canAssignSupervisor)throw new ApiError(403,'Only the learner, main teacher or administration can choose the supervisor / Choix réservé à l’élève, au main teacher ou à l’administration')
  if(current.supervision.revision!==payload.revision)throw new ApiError(409,'Supervisor changed; refresh before retrying / Superviseur modifié, actualisez avant de réessayer')
  if(payload.teacherUserId&&!await tx.teacherProfile.findUnique({where:{userId:payload.teacherUserId},select:{user:{select:{accountBlockedAt:true}}}}).then(t=>t&&!t.user.accountBlockedAt))throw new ApiError(400,'Choose an active KCS teacher / Choisissez un enseignant KCS actif')
  await tx.auditLog.create({data:{createdAt:new Date(Math.max(Date.now(),current.supervision.updatedAt?Date.parse(current.supervision.updatedAt)+1:0)),actorId,action:'SHINING_SUPERVISOR_ASSIGNED',targetType:'ShiningStudentSchedule',targetId:id,metadata:{teacherUserId:payload.teacherUserId,previousTeacherUserId:current.supervision.supervisor?.id||null}}})
  if(payload.teacherUserId&&payload.teacherUserId!==current.supervision.supervisor?.id)await tx.notification.create({data:{userId:payload.teacherUserId,title:'Shining Student · Supervision',message:'Une présentation vous est confiée. / A learner presentation has been assigned to you.',type:'INFO',link:'/shining-students'}})
  return(await shiningSupervision([schedule],req.user!.sub,req.user!.role,tx))[0]
 })
 return success(res,updated,'Supervision saved / Supervision enregistrée')
}))

shiningStudentsRouter.post('/generate', requireAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = z.object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    excludedDates: z.array(z.string().date()).max(366).default([]),
  }).parse(req.body)
  const start = utcDate(payload.startDate)
  const end = utcDate(payload.endDate)
  if (end < start) throw new ApiError(400, 'The end date must be on or after the start date.')
  if ((end.getTime() - start.getTime()) / 86_400_000 > 370) throw new ApiError(400, 'Generation is limited to one school year.')
  const calendars=await academicCalendars()
  if(!calendars.length)throw new ApiError(503,'Publish the official school calendar before generating presentations.')
  const rules=new Map(await Promise.all(calendars.map(async c=>[c.name,(await nonSchoolSettings(c.name)).ranges] as const)))
  const excluded = new Set(payload.excludedDates)
  const students = await prisma.studentProfile.findMany({
    where: { status: { equals: 'active', mode: 'insensitive' } },
    include: scheduleInclude.student.include,
    orderBy: [{ grade: 'asc' }, { user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  })
  const pools = {
    LOWER: students.filter((student) => divisionForGrade(student.grade) === 'LOWER'),
    MIDDLE_UPPER: students.filter((student) => divisionForGrade(student.grade) === 'MIDDLE_UPPER'),
  }
  if (!pools.LOWER.length || !pools.MIDDLE_UPPER.length) {
    throw new ApiError(409, 'Both Lower School and Middle/Upper School need active students before generation.')
  }
  const existing = await prisma.shiningStudentSchedule.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true, division: true, studentId: true },
  })
  const occupied = new Set(existing.map((item) => `${isoDay(item.date)}:${item.division}`))
  const counts = new Map<string, number>()
  const history = await prisma.shiningStudentSchedule.groupBy({ by: ['studentId'], _count: { studentId: true } })
  history.forEach((item) => counts.set(item.studentId, item._count.studentId))
  const actorId=await databaseActorId(req.user!.sub)
  const createdIds: string[] = []
  for (let date = start; date <= end; date = addDay(date)) {
    const day=isoDay(date),year=calendars.find(c=>day>=c.startDate.slice(0,10)&&day<=c.endDate.slice(0,10))
    if (!isWeekday(date) || excluded.has(day)||!schoolDayDecision(day,calendars,year?rules.get(year.name)||[]:[]).allowed) continue
    for (const division of ['LOWER', 'MIDDLE_UPPER'] as const) {
      if (occupied.has(`${isoDay(date)}:${division}`)) continue
      const minimum = Math.min(...pools[division].map((student) => counts.get(student.id) || 0))
      const fairCandidates = pools[division].filter((student) => (counts.get(student.id) || 0) === minimum)
      const student = fairCandidates[deterministicIndex(date, division, fairCandidates.length)]
      const created = await prisma.shiningStudentSchedule.create({
        data: { date, division, studentId: student.id, createdById: actorId },
        select: { id: true },
      })
      createdIds.push(created.id)
      counts.set(student.id, minimum + 1)
    }
  }
  const created = await prisma.shiningStudentSchedule.findMany({
    where: { id: { in: createdIds } },
    include: scheduleInclude,
    orderBy: [{ date: 'asc' }, { division: 'asc' }],
  })
  await Promise.all(created.map(async (item) => {
    const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(item.date)
    const title = 'Shining Student — votre passage est programmé'
    const message = `Vous avez été sélectionné(e) pour présenter devant l’école le ${dateLabel}. Choisissez librement votre sujet dans KCS Nexus.`
    const recipients = [item.student.user, ...item.student.parentLinks.map((link) => link.parent)]
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({ userId: recipient.id, title, message, type: 'INFO' as const, link: '/shining-students' })),
    })
    await Promise.allSettled(recipients.filter((recipient) => recipient.email).map((recipient) =>
      sendSchoolMail({
        to: recipient.email,
        subject: title,
        text: message,
        html: `<h2>Shining Student</h2><p>Bonjour ${recipient.firstName},</p><p>${message}</p><p>Connectez-vous à KCS Nexus pour confirmer le sujet choisi.</p>`,
      })
    ))
    await prisma.shiningStudentSchedule.update({ where: { id: item.id }, data: { notifiedAt: new Date() } })
  }))
  const administrativeRecipients = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        {
          role: 'STAFF',
          OR: [
            { staffFunction: { contains: 'admin', mode: 'insensitive' } },
            { staffProfile: { is: { OR: [{ function: { contains: 'admin', mode: 'insensitive' } }, { department: { contains: 'admin', mode: 'insensitive' } }] } } },
          ],
        },
      ],
    },
    select: { id: true, firstName: true, email: true, phone: true },
  })
  const weeklyGroups = new Map<string, typeof created>()
  created.forEach((item) => {
    const key = weekMonday(item.date)
    weeklyGroups.set(key, [...(weeklyGroups.get(key) || []), item])
  })
  const weeklyDelivery: Array<{ week: string; recipients: number }> = []
  for (const [week, schedules] of weeklyGroups) {
    const lines = schedules.map((item) => {
      const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(item.date)
      return `${day} — ${item.division === 'LOWER' ? 'Lower School' : 'Middle/Upper School'} — ${[item.student.user.lastName, item.student.user.middleName, item.student.user.firstName].filter(Boolean).join(' ')} (${item.student.grade}${item.student.section ? ' ' + item.student.section : ''})`
    })
    const subject = `Shining Student — planning de la semaine du ${week}`
    const body = `Planning officiel Shining Student :\n\n${lines.join('\n')}\n\nLes sujets choisis et les statuts sont consultables dans KCS Nexus.`
    await prisma.notification.createMany({
      data: administrativeRecipients.map((recipient) => ({ userId: recipient.id, title: subject, message: lines.join(' · '), type: 'INFO' as const, link: '/shining-students' })),
    })
    await Promise.allSettled(administrativeRecipients.flatMap((recipient) => [
      ...(recipient.email ? [sendSchoolMail({ to: recipient.email, subject, text: body, html: `<h2>${subject}</h2><ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul><p>Consultez KCS Nexus pour les sujets et le suivi.</p>` })] : []),
      ...(recipient.phone ? [sendSchoolSms(recipient.phone, `${subject}\n${lines.join('\n')}`, { brand: false })] : []),
    ]))
    weeklyDelivery.push({ week, recipients: administrativeRecipients.length })
  }
  return success(res, { created: created.length, schedules: created, weeklyDelivery }, `${created.length} Shining Student assignments generated and notified.`, 201)
}))

shiningStudentsRouter.patch('/:id/topic', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = z.object({ topic: z.string().trim().min(3).max(180), topicNotes: z.string().trim().max(1200).nullable().optional() }).parse(req.body)
  const scheduleId = String(req.params.id)
  const schedule = await prisma.shiningStudentSchedule.findUnique({ where: { id: scheduleId }, include: scheduleInclude })
  if (!schedule) throw new ApiError(404, 'Shining Student assignment not found.')
  const supervised=(await shiningSupervision([schedule],req.user!.sub,req.user!.role))[0]
  if (!supervised.canEditTopic) throw new ApiError(403, 'Only the learner, assigned supervisor or administration may edit this topic / Modification réservée à l’élève, au superviseur désigné ou à l’administration')
  if (schedule.date < new Date()) throw new ApiError(409, 'The presentation date has passed.')
  const updated = await prisma.shiningStudentSchedule.update({
    where: { id: schedule.id },
    data: { topic: payload.topic, topicNotes: payload.topicNotes || null, status: 'TOPIC_SUBMITTED' },
    include: scheduleInclude,
  })
  return success(res, updated, 'Shining Student topic saved.')
}))

shiningStudentsRouter.patch('/:id/status', requireAdmin(), asyncHandler(async (req, res) => {
  const payload = z.object({ status: z.enum(['SCHEDULED', 'TOPIC_SUBMITTED', 'PRESENTED', 'EXCUSED']) }).parse(req.body)
  const updated = await prisma.shiningStudentSchedule.update({ where: { id: String(req.params.id) }, data: { status: payload.status }, include: scheduleInclude })
  return success(res, updated, 'Shining Student status updated.')
}))

shiningStudentsRouter.delete('/:id', requireAdmin(), asyncHandler(async (req, res) => {
  const scheduleId = String(req.params.id)
  await prisma.shiningStudentSchedule.delete({ where: { id: scheduleId } })
  return success(res, { id: scheduleId }, 'Shining Student assignment removed.')
}))
