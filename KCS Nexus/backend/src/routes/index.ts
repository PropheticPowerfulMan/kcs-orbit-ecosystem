import {schoolAnnouncementsRouter} from './school-announcements.routes.js'
import {learningRouter} from './learning.routes.js'
import {certificateReceiptsRouter} from './certificate-receipts.routes.js'
import{personalPortraitsRouter}from'./personal-portraits.routes.js'
import {messageReceiptsRouter} from './message-receipts.routes.js'
import {disciplineDirectorRouter} from './discipline-director.routes.js'
import {earlyYearsRouter} from './early-years.routes.js'
import {electionsRouter} from './elections.routes.js'
import {pedagogyRouter} from './pedagogy.routes.js'
import {schoolHistoryRouter} from './school-history.routes.js'
import {transcriptReceiptsRouter} from './transcript-receipts.routes.js'
import {schoolDocumentsRouter} from './school-documents.routes.js'
import {seniorTeacherRouter} from './senior-teacher.routes.js'
import { teachingAttendanceRouter } from './teaching-attendance.routes.js'
import { reportCardReceiptsRouter } from './report-card-receipts.routes.js'
import { documentDownloadRouter } from './document-download.routes.js'
import {academicVisibilityResponseGuard} from '../middleware/academicVisibility.js'
import {academicVisibilityRouter} from './academic-visibility.routes.js'
import {accountAccessRouter} from './account-access.routes.js'
import {siteContentRouter} from './site-content.routes.js'
import { Router } from 'express'
import { academyRouter } from './academy.routes.js'
import { adminRouter } from './admin.routes.js'
import { admissionsRouter } from './admissions.routes.js'
import { aiRouter } from './ai.routes.js'
import { authRouter } from './auth.routes.js'
import { contactRouter } from './contact.routes.js'
import { coursesRouter } from './courses.routes.js'
import { eventsRouter } from './events.routes.js'
import { mediaRouter } from './media.routes.js'
import { newsRouter } from './news.routes.js'
import { notificationsRouter } from './notifications.routes.js'
import { studentsRouter } from './students.routes.js'
import { teachersRouter } from './teachers.routes.js'
import { registryRouter } from './registry.routes.js'
import { forumRouter } from './forum.routes.js'
import { studentForumRouter } from './student-forum.routes.js'
import { intelligenceRouter } from './intelligence.routes.js'
import { financeRouter } from './finance.routes.js'
import { messagesRouter } from './messages.routes.js'
import { suggestionsRouter } from './suggestions.routes.js'
import { incidentReportsRouter } from './incident-reports.routes.js'
import { dataMigrationRouter } from './data-migration.routes.js'
import { academicCalendarRouter } from './academic-calendar.routes.js'
import { employeesRouter } from './employees.routes.js'
import { diagnosticRouter } from './diagnostic.routes.js'
import { schoolManagementRouter } from './school-management.routes.js'
import { academicRecordsRouter } from './academic-records.routes.js'
import { attendanceRouter } from './attendance.routes.js'
import { electivesRouter } from './electives.routes.js'
import { shiningStudentsRouter } from './shining-students.routes.js'
import { syllabiRouter } from './syllabi.routes.js'
import { kitchenNotificationsRouter } from './kitchen-notifications.routes.js'
import { lessonPlanRouter } from './lesson-plan.routes.js'
import { studentGovernmentRouter } from './student-government.routes.js'
import { sentinelNotificationsRouter } from './sentinel-notifications.routes.js'

export const router = Router()
router.use('/message-receipts',messageReceiptsRouter)
router.use('/report-card-receipts', reportCardReceiptsRouter)
router.use('/transcript-receipts',transcriptReceiptsRouter)
router.use('/certificate-receipts',certificateReceiptsRouter)
router.use('/personal-portraits',personalPortraitsRouter)
router.use('/learning',learningRouter)
router.use('/school-announcements',schoolAnnouncementsRouter)
router.use(academicVisibilityResponseGuard)
router.use('/academic-visibility',academicVisibilityRouter)

router.use('/account-access',accountAccessRouter)
router.use('/site-content',siteContentRouter)
router.use('/school-documents',schoolDocumentsRouter)
router.use('/auth', authRouter)
router.use('/documents', documentDownloadRouter)
router.use('/academy', academyRouter)
router.use('/lesson-plan', lessonPlanRouter)
router.use('/student-government', studentGovernmentRouter)
router.use('/news', newsRouter)
router.use('/events', eventsRouter)
router.use('/students', studentsRouter)
router.use('/teachers', teachersRouter)
router.use('/courses', coursesRouter)
router.use('/admissions', admissionsRouter)
router.use('/media', mediaRouter)
router.use('/contact', contactRouter)
router.use('/notifications', notificationsRouter)
router.use('/ai', aiRouter)
router.use('/admin', adminRouter)
router.use('/registry', registryRouter)
router.use('/forum', forumRouter)
router.use('/student-forum', studentForumRouter)
router.use('/intelligence', intelligenceRouter)
router.use('/finance', financeRouter)
router.use('/messages', messagesRouter)
router.use('/suggestions', suggestionsRouter)
router.use('/incident-reports', incidentReportsRouter)
router.use('/data-migration', dataMigrationRouter)

router.use('/school-history',schoolHistoryRouter)
router.use('/academic-calendar', academicCalendarRouter)
router.use('/academic-records', academicRecordsRouter)
router.use('/attendance', attendanceRouter)
router.use('/teaching-attendance', teachingAttendanceRouter)
router.use('/senior-teacher', seniorTeacherRouter)
router.use('/discipline-director', disciplineDirectorRouter)
router.use('/pedagogy', pedagogyRouter)
router.use('/early-years', earlyYearsRouter)
router.use('/elections', electionsRouter)
router.use('/electives', electivesRouter)
router.use('/shining-students', shiningStudentsRouter)
router.use('/syllabi', syllabiRouter)

router.use('/employees', employeesRouter)
router.use('/kitchen-notifications', kitchenNotificationsRouter)
router.use('/sentinel-notifications', sentinelNotificationsRouter)
router.use('/', diagnosticRouter)
router.use('/school-management', schoolManagementRouter)
