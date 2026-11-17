import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'
import { lockAcademicYears,academicPeriodAccess } from './academicPeriodAccess.service.js'
import { academicPeriodIsReadOnly,quarterTerms } from '../utils/academicPeriodPolicy.js'
import { automaticAcademicClosures,SCHOOL_CLOSURE_TIME_ZONE } from '../utils/academicAutoClosure.js'
import type { Calendar } from './reportAttendance.service.js'

type Input={academicYear:string;term:string;calendar:Calendar;calendars:Calendar[];actorId?:string|null;automatic?:boolean;graceEndDate?:string;now?:Date;language?:'fr'|'en'}
export async function closeAcademicPeriod(input:Input,db:typeof prisma=prisma){
 const calendar=input.calendar,actorId=input.actorId??null,now=input.now??new Date()
 const tr=(fr:string,en:string)=>input.language==='en'?en:fr
 if(![...quarterTerms,'Semester 1','Semester 2','Annual final'].includes(input.term))throw new ApiError(400,'Choose an official academic period')
 if(input.automatic&&!automaticAcademicClosures([calendar],now).some(p=>p.academicYear===input.academicYear&&p.term===input.term))throw new ApiError(409,'Automatic closure is not due for this published academic period')
  const id = 'academic-period-closed-' + createHash('sha256').update(input.academicYear + '::' + input.term).digest('hex')
  return await db.$transaction(async tx => {
    await lockAcademicYears(tx, [input.academicYear], true)
    const previous = await tx.auditLog.findUnique({ where: { id } })
    if (previous) return { alreadyClosed: true, closedAt: previous.createdAt }
    const access = await academicPeriodAccess(tx,undefined,input.calendars)
    const quarterIndex = quarterTerms.indexOf(input.term)
    const required = quarterIndex > 0 ? quarterTerms.slice(0, quarterIndex)
      : input.term === 'Semester 1' ? quarterTerms.slice(0, 2)
      : input.term === 'Semester 2' ? quarterTerms : input.term === 'Annual final' ? quarterTerms : []
    if (required.some(term => !academicPeriodIsReadOnly(access, input.academicYear, term))) throw new ApiError(409, tr('Clôturez d’abord les quarters précédents après finalisation de leurs notes et bulletins.','Close the preceding quarters after their grades are finalized before closing this period'))
    const period = calendar.periods?.find(item => quarterIndex >= 0 ? ['QUARTER','TRIMESTER'].includes(item.type) && item.sequence === quarterIndex + 1 : item.type === 'SEMESTER' && input.term === 'Semester ' + item.sequence)
    if (new Date(period?.startDate ?? calendar.startDate) > now) throw new ApiError(409, tr('Une période scolaire future ne peut pas être clôturée avant son début.','A future academic period cannot be closed before it starts'))
    const workspaces = await tx.teacherWorkspace.findMany({ select: { id: true, state: true }, orderBy: { id: 'asc' } })
    let frozenCourseWeights = 0
    for (const workspace of workspaces) {
      const state = workspace.state as Record<string, any>
      const frozen = { ...(state.gradebookClosedCategoryWeightsByCycle || {}) }
      const snapshots = new Map<string, any>(Object.entries(state.advancedGradebookByCycle || {}).filter(([key]) => key.endsWith('::' + input.academicYear)))
      if (input.academicYear === '2026-2027') for (const [courseId, snapshot] of Object.entries(state.advancedGradebookByCourse || {})) {
        if (!snapshots.has(courseId + '::' + input.academicYear)) snapshots.set(courseId + '::' + input.academicYear, snapshot)
      }
      for (const [cycle, weights] of Object.entries(state.gradebookCategoryWeightsByCycle || {})) {
        if (cycle.endsWith('::' + input.academicYear) && !snapshots.has(cycle)) snapshots.set(cycle, weights)
      }
      for (const [cycle, snapshot] of snapshots) {
        frozen[cycle + '::' + input.term] = { categories: state.gradebookCategoryWeightsByCycle?.[cycle]?.categories ?? snapshot.categories ?? [], closedAt: now.toISOString() }
        frozenCourseWeights++
      }
      if (snapshots.size) await tx.teacherWorkspace.update({ where: { id: workspace.id }, data: { state: { ...state, gradebookClosedCategoryWeightsByCycle: frozen } as Prisma.InputJsonValue, revision: { increment: 1 } } })
    }
    const audit = await tx.auditLog.create({ data: { id, actorId, action: 'ACADEMIC_PERIOD_CLOSED', targetType: 'AcademicPeriodClosure', targetId: input.academicYear + '::' + input.term, metadata: { academicYear: input.academicYear, term: input.term, frozenCourseWeights, closureMode: input.automatic ? 'AUTOMATIC_CALENDAR_END_PLUS_7_DAYS' : 'EXPLICIT_SUPERADMIN_AFTER_GRADE_FINALIZATION', ...(input.automatic ? { graceDays: 7, graceEndDate: input.graceEndDate ?? null, timeZone: SCHOOL_CLOSURE_TIME_ZONE } : {}) } } })
    return { alreadyClosed: false, closedAt: audit.createdAt, frozenCourseWeights }
  }, { maxWait: 10000, timeout: 60000 })

}
