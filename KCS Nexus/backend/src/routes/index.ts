import { Router } from 'express'
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

export const router = Router()

router.use('/auth', authRouter)
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
