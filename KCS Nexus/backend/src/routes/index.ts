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

export const router = Router()

router.use('/auth', authRouter)
router.use('/academy', academyRouter)
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

router.use('/academic-calendar', academicCalendarRouter)
router.use('/academic-records', academicRecordsRouter)

router.use('/employees', employeesRouter)
router.use('/', diagnosticRouter)
router.use('/school-management', schoolManagementRouter)
