import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireAdmin, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

export const studentGovernmentRouter = Router()

const canonical = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const classMatches = (position: { scope: string; grade: string | null; section: string | null }, student: { grade: string; section: string }) => {
  if (position.scope === 'GLOBAL') return true
  if (canonical(position.grade) !== canonical(student.grade)) return false
  return !canonical(position.section) || canonical(position.section) === canonical(student.section)
}
const confirmationCode = () => `KCS-SG-${randomBytes(6).toString('hex').toUpperCase()}`
const electionInclude = Prisma.validator<Prisma.StudentGovernmentElectionInclude>()({
  positions: {
    include: { candidates: { where: { active: true }, orderBy: [{ ballotNumber: 'asc' }, { lastName: 'asc' }] } },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  },
})

studentGovernmentRouter.get('/ballot', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const now = new Date()
  const student = await prisma.studentProfile.findUnique({
    where: { userId: req.user!.sub },
    select: { id: true, studentNumber: true, grade: true, section: true, status: true, user: { select: { firstName: true, middleName: true, lastName: true } } },
  })
  if (!student || canonical(student.status) !== 'active') throw new ApiError(403, 'Only an active KCS learner can vote in the student-government election.')
  const election = await prisma.studentGovernmentElection.findFirst({
    where: { status: 'OPEN', startAt: { lte: now }, endAt: { gte: now } },
    include: electionInclude,
    orderBy: { startAt: 'desc' },
  })
  if (!election) return success(res, { election: null, voter: student, positions: [], hasVoted: false })
  const previousVote = await prisma.studentGovernmentVote.findUnique({
    where: { electionId_voterUserId: { electionId: election.id, voterUserId: req.user!.sub } },
    select: { confirmationCode: true, submittedAt: true },
  })
  const positions = election.positions.filter((position) => classMatches(position, student))
  return success(res, {
    election: { id: election.id, title: election.title, academicYear: election.academicYear, startAt: election.startAt, endAt: election.endAt },
    voter: student,
    positions,
    hasVoted: Boolean(previousVote),
    receipt: previousVote,
  })
}))

studentGovernmentRouter.post('/vote', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = z.object({
    electionId: z.string().min(1),
    choices: z.array(z.object({ positionId: z.string().min(1), candidateId: z.string().min(1) })).min(1).max(100),
  }).parse(req.body)
  if (new Set(payload.choices.map((choice) => choice.positionId)).size !== payload.choices.length) throw new ApiError(400, 'Each office must be selected exactly once.')
  const now = new Date()
  const [student, election] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: req.user!.sub }, select: { id: true, grade: true, section: true, status: true } }),
    prisma.studentGovernmentElection.findUnique({ where: { id: payload.electionId }, include: electionInclude }),
  ])
  if (!student || canonical(student.status) !== 'active') throw new ApiError(403, 'Active student profile required.')
  if (!election || election.status !== 'OPEN' || now < election.startAt || now > election.endAt) throw new ApiError(409, 'The official voting window is not open.')
  const positions = election.positions.filter((position) => classMatches(position, student))
  if (payload.choices.length !== positions.length) throw new ApiError(400, 'The complete eligible ballot must be submitted.')
  const positionById = new Map(positions.map((position) => [position.id, position]))
  for (const choice of payload.choices) {
    const position = positionById.get(choice.positionId)
    if (!position || !position.candidates.some((candidate) => candidate.id === choice.candidateId)) throw new ApiError(400, 'One or more ballot choices are invalid for this learner.')
  }
  if (await prisma.studentGovernmentVote.findUnique({ where: { electionId_voterUserId: { electionId: election.id, voterUserId: req.user!.sub } }, select: { id: true } })) {
    throw new ApiError(409, 'This learner has already voted in this election.')
  }
  const receipt = confirmationCode()
  const vote = await prisma.$transaction(async (tx) => tx.studentGovernmentVote.create({
    data: {
      electionId: election.id,
      voterUserId: req.user!.sub,
      voterStudentProfileId: student.id,
      voterGrade: student.grade,
      voterSection: student.section || null,
      confirmationCode: receipt,
      choices: { create: payload.choices.map((choice) => ({ positionId: choice.positionId, candidateId: choice.candidateId })) },
    },
    select: { confirmationCode: true, submittedAt: true },
  }))
  return success(res, vote, 'Your anonymous student-government ballot was recorded.', 201)
}))

const admin = [authenticate, requireAdmin()]
studentGovernmentRouter.get('/admin', ...admin, asyncHandler(async (_req, res) => {
  const elections = await prisma.studentGovernmentElection.findMany({
    include: {
      positions: {
        include: {
          candidates: {
            include: { choices: { select: { id: true } } },
            orderBy: [{ ballotNumber: 'asc' }, { lastName: 'asc' }],
          },
          choices: { select: { id: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      },
      votes: { select: { id: true, voterGrade: true, voterSection: true, submittedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, elections.map((election) => ({
    ...election,
    positions: election.positions.map((position) => ({
      ...position,
      totalVotes: position.choices.length,
      candidates: position.candidates.map((candidate) => ({ ...candidate, votes: candidate.choices.length, choices: undefined })),
      choices: undefined,
    })),
    totalVoters: election.votes.length,
  })))
}))

studentGovernmentRouter.post('/admin/elections', ...admin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = z.object({
    title: z.string().trim().min(5).max(180),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }).parse(req.body)
  if (new Date(payload.endAt) <= new Date(payload.startAt)) throw new ApiError(400, 'Voting must end after it starts.')
  const election = await prisma.studentGovernmentElection.create({
    data: {
      ...payload,
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
      createdById: req.user!.sub,
      positions: {
        create: [
          { name: 'Student President', scope: 'GLOBAL', displayOrder: 1 },
          { name: 'Student Vice President', scope: 'GLOBAL', displayOrder: 2 },
        ],
      },
    },
    include: electionInclude,
  })
  return success(res, election, 'Student-government election created with the two school-wide offices.', 201)
}))

studentGovernmentRouter.post('/admin/elections/:electionId/positions', ...admin, asyncHandler(async (req, res) => {
  const electionId = String(req.params.electionId)
  const payload = z.object({
    name: z.string().trim().min(3).max(120),
    scope: z.enum(['GLOBAL', 'CLASS']),
    grade: z.string().trim().max(40).nullable().optional(),
    section: z.string().trim().max(20).nullable().optional(),
    displayOrder: z.number().int().min(0).max(500).default(10),
  }).parse(req.body)
  const election = await prisma.studentGovernmentElection.findUnique({ where: { id: electionId }, select: { status: true } })
  if (!election) throw new ApiError(404, 'Election not found.')
  if (election.status !== 'DRAFT') throw new ApiError(409, 'Positions can only be changed while the election is in draft.')
  if (payload.scope === 'CLASS' && !payload.grade) throw new ApiError(400, 'A class office requires a grade.')
  const position = await prisma.studentGovernmentPosition.create({ data: { ...payload, grade: payload.scope === 'CLASS' ? payload.grade : null, section: payload.scope === 'CLASS' ? payload.section || null : null, electionId } })
  return success(res, position, 'Election office added.', 201)
}))

studentGovernmentRouter.post('/admin/elections/:electionId/candidates', ...admin, asyncHandler(async (req, res) => {
  const electionId = String(req.params.electionId)
  const payload = z.object({
    positionId: z.string().min(1),
    studentProfileId: z.string().min(1),
    ballotNumber: z.number().int().min(1).max(999),
    manifesto: z.string().trim().max(4000).nullable().optional(),
  }).parse(req.body)
  const [election, position, student] = await Promise.all([
    prisma.studentGovernmentElection.findUnique({ where: { id: electionId }, select: { status: true } }),
    prisma.studentGovernmentPosition.findFirst({ where: { id: payload.positionId, electionId } }),
    prisma.studentProfile.findUnique({ where: { id: payload.studentProfileId }, include: { user: { select: { firstName: true, middleName: true, lastName: true, avatar: true } } } }),
  ])
  if (!election || !position) throw new ApiError(404, 'Election or office not found.')
  if (election.status !== 'DRAFT') throw new ApiError(409, 'Candidates can only be changed while the election is in draft.')
  if (!student || canonical(student.status) !== 'active') throw new ApiError(404, 'Active candidate student not found.')
  if (!classMatches(position, student)) throw new ApiError(400, 'This candidate does not belong to the selected class constituency.')
  const candidate = await prisma.studentGovernmentCandidate.create({
    data: {
      electionId,
      positionId: position.id,
      studentProfileId: student.id,
      ballotNumber: payload.ballotNumber,
      firstName: student.user.firstName,
      middleName: student.user.middleName,
      lastName: student.user.lastName,
      grade: student.grade,
      section: student.section || null,
      manifesto: payload.manifesto || null,
      photoUrl: student.user.avatar || student.officialAvatar || null,
    },
  })
  return success(res, candidate, 'Candidate added to the official ballot.', 201)
}))

studentGovernmentRouter.patch('/admin/elections/:electionId/status', ...admin, asyncHandler(async (req, res) => {
  const electionId = String(req.params.electionId)
  const { status } = z.object({ status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'ARCHIVED']) }).parse(req.body)
  const election = await prisma.studentGovernmentElection.findUnique({ where: { id: electionId }, include: { positions: { include: { candidates: { where: { active: true }, select: { id: true } } } } } })
  if (!election) throw new ApiError(404, 'Election not found.')
  const transitions: Record<string, string[]> = { DRAFT: ['OPEN'], OPEN: ['CLOSED'], CLOSED: ['OPEN', 'PUBLISHED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: [] }
  if (!transitions[election.status]?.includes(status)) throw new ApiError(409, `Invalid election transition: ${election.status} to ${status}.`)
  if (status === 'OPEN' && (election.positions.length < 2 || election.positions.some((position) => position.candidates.length < 1))) throw new ApiError(409, 'Every office needs at least one active candidate before voting opens.')
  const updated = await prisma.studentGovernmentElection.update({ where: { id: electionId }, data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : undefined } })
  return success(res, updated, 'Election status updated.')
}))

studentGovernmentRouter.get('/students', ...admin, asyncHandler(async (req, res) => {
  const query = String(req.query.q ?? '').trim()
  const students = await prisma.studentProfile.findMany({
    where: {
      status: { equals: 'active', mode: 'insensitive' },
      ...(query ? { OR: [
        { studentNumber: { contains: query, mode: 'insensitive' } },
        { grade: { contains: query, mode: 'insensitive' } },
        { section: { contains: query, mode: 'insensitive' } },
        { user: { firstName: { contains: query, mode: 'insensitive' } } },
        { user: { lastName: { contains: query, mode: 'insensitive' } } },
      ] } : {}),
    },
    select: { id: true, studentNumber: true, grade: true, section: true, user: { select: { firstName: true, middleName: true, lastName: true } } },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }, { user: { lastName: 'asc' } }],
    take: 300,
  })
  return success(res, students)
}))
