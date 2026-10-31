import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import crypto from 'node:crypto'
import { Prisma, type KitchenRole, type PersonType } from '@prisma/client'
import { z } from 'zod'
import { env } from './config.js'
import { prisma } from './db.js'
import { allow, authenticate, signSession, type AuthRequest, type KitchenIdentity } from './auth.js'
import { calculateSchoolSubsidy } from './staff-subsidy.js'
import { DAILY_STAPLE_PRODUCT_NAMES, ensureOfficialMenu } from './kcs-menu-2026.js'
import { loadDirectory, resolvePerson } from './directory.js'
import { compareClassNames, normalizeClassName } from './class-name.js'
import { processNotificationOutbox } from './notifications.js'
import { procurementRouter } from './procurement.js'
import { getUsdCdfRate } from './exchange-rate.js'
import { queueDailyKitchenReport } from './daily-report.js'
import { canManageOwnKitchenCredentials, reauthenticatedAsSameAccount } from './credential-policy.js'
import { runWithTransactionRetry } from './transaction-retry.js'
import {
  buildStatementArtifact,
  canIssueStatement,
  createStatementDeduplicationKey,
  createStatementDocumentId,
  KITCHEN_STATEMENT_CURRENCY,
  KITCHEN_STATEMENT_DEFAULT_KEY_ID,
  KITCHEN_STATEMENT_LEGACY_KEY_ID,
  KITCHEN_STATEMENT_MAX_ENTRIES,
  resolveStatementPeriod,
  type StatementSigningKey,
  verifyStoredStatement
} from './statement-verification.js'
import {
  buildTransactionReportArtifact,
  createTransactionReportDeduplicationKey,
  createTransactionReportDocumentId,
  KITCHEN_TRANSACTION_REPORT_MAX_ROWS,
  type TransactionReportFilters,
  type TransactionReportRowSnapshot,
  verifyStoredTransactionReport
} from './transaction-report-verification.js'

const app = express()
// Kitchen is exposed through exactly one Caddy hop; this keeps IP-based limits
// per caller without accepting an arbitrary X-Forwarded-For chain.
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(cors({ origin: env.FRONTEND_URL, credentials: false }))
app.use(express.json({ limit: '250kb' }))
app.use(morgan('combined'))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }))

const statementVerificationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, status: 'RATE_LIMITED', message: 'Too many verification requests' }
})

const statementIssueLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  keyGenerator: req => (req as AuthRequest).kitchenUser?.orbitPersonId || 'unauthenticated',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many statement issue requests' }
})

const statementSigningKey: StatementSigningKey = env.STATEMENT_SIGNING_SECRET
  ? {
      keyId: env.STATEMENT_SIGNING_KEY_ID || KITCHEN_STATEMENT_DEFAULT_KEY_ID,
      secret: env.STATEMENT_SIGNING_SECRET
    }
  : { keyId: KITCHEN_STATEMENT_LEGACY_KEY_ID, secret: env.QR_SIGNING_SECRET }

function loadStatementVerificationKeys() {
  const keys: Record<string, string> = {}
  if (env.STATEMENT_VERIFICATION_KEYS) {
    let historical: unknown
    try { historical = JSON.parse(env.STATEMENT_VERIFICATION_KEYS) }
    catch { throw new Error('STATEMENT_VERIFICATION_KEYS must be a JSON object') }
    if (!historical || Array.isArray(historical) || typeof historical !== 'object') {
      throw new Error('STATEMENT_VERIFICATION_KEYS must be a JSON object')
    }
    for (const [keyId, secret] of Object.entries(historical)) {
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(keyId) || typeof secret !== 'string' || secret.length < 16) {
        throw new Error('STATEMENT_VERIFICATION_KEYS contains an invalid key')
      }
      keys[keyId] = secret
    }
  }
  keys[KITCHEN_STATEMENT_LEGACY_KEY_ID] = env.QR_SIGNING_SECRET
  keys[statementSigningKey.keyId] = statementSigningKey.secret
  return Object.freeze(keys)
}

const statementVerificationKeys = loadStatementVerificationKeys()

const asyncRoute = (handler: (req: any, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void handler(req, res, next).catch(next)

function hashLocalPassword(password: string) {
  const salt = crypto.randomBytes(16)
  const digest = crypto.scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${digest.toString('hex')}`
}

function verifyLocalPassword(password: string, stored: string) {
  const [algorithm, saltHex, digestHex] = stored.split(':')
  if (algorithm !== 'scrypt' || !saltHex || !digestHex) return false
  try {
    const expected = Buffer.from(digestHex, 'hex')
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch { return false }
}

function routeParam(req: Request, name: string) { return String(req.params[name] || '') }

function personTypeFrom(kind: string): PersonType {
  if (kind === 'STUDENT') return 'STUDENT'
  if (kind === 'TEACHER') return 'TEACHER'
  if (kind === 'STAFF') return 'STAFF'
  return 'OTHER'
}

function defaultRole(nexusRole: string, personType: PersonType): KitchenRole {
  // Kitchen administration is never inherited from a global Nexus role.
  // Only an explicit KitchenAccess assignment may grant KITCHEN_ADMIN.
  if (nexusRole.toLowerCase() === 'admin') return 'CASHIER'
  if (personType === 'TEACHER') return 'TEACHER'
  if (personType === 'STUDENT') return 'STUDENT'
  return 'STAFF'
}

function canManage(role: KitchenRole) {
  return role === 'KITCHEN_ADMIN' || role === 'FINANCE'
}

async function audit(req: AuthRequest, action: string, entityType: string, entityId: string, oldValue?: unknown, newValue?: unknown, reason?: string) {
  if (!req.kitchenUser) return
  await prisma.auditLog.create({ data: {
    actorId: req.kitchenUser.orbitPersonId,
    actorRole: req.kitchenUser.role,
    action,
    entityType,
    entityId,
    oldValue: oldValue as Prisma.InputJsonValue | undefined,
    newValue: newValue as Prisma.InputJsonValue | undefined,
    reason,
    ipAddress: req.ip
  } })
}

async function balanceFor(orbitPersonId: string) {
  const result = await prisma.kitchenLedgerEntry.aggregate({ where: { orbitPersonId }, _sum: { amount: true } })
  return Number(result._sum.amount || 0)
}

app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'kcs-kitchen-api' }))
app.use('/api', procurementRouter)

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const payload = z.object({
    identifier: z.string().trim().min(2).max(180),
    password: z.string().min(1).max(200),
    accessMode: z.enum(['CUSTOMER', 'CASHIER', 'STAFF', 'ADMIN']).optional()
  }).parse(req.body)

  const normalizedIdentifier = payload.identifier.toLowerCase()
  const requestedMode = payload.accessMode || 'CUSTOMER'
  const cashier = ['CASHIER', 'STAFF'].includes(requestedMode)
    ? await prisma.kitchenCashierAccount.findUnique({ where: { email: normalizedIdentifier } })
    : null
  if (cashier) {
    if (!cashier.isActive || !verifyLocalPassword(payload.password, cashier.passwordHash)) {
      return res.status(401).json({ message: 'Cashier email or password is incorrect' })
    }
    const identity: KitchenIdentity = {
      userId: `kitchen-cashier:${cashier.id}`,
      orbitPersonId: `kitchen-cashier:${cashier.id}`,
      fullName: cashier.fullName,
      email: cashier.email,
      personType: 'STAFF',
      role: 'CASHIER',
      hasOfficialPhoto: false,
      canManageOwnCredentials: false,
    }
    await prisma.kitchenCashierAccount.update({ where: { id: cashier.id }, data: { lastLoginAt: new Date() } })
    return res.json({ token: signSession(identity), user: identity })
  }

  const response = await fetch(new URL('/api/auth/login', env.NEXUS_API_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-kcs-client': 'KCS_KITCHEN' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000)
  })
  const body = await response.json().catch(() => null) as any
  if (!response.ok || !body?.data?.user) {
    return res.status(response.status === 403 ? 403 : 401).json({ message: body?.message || 'Institutional authentication failed' })
  }

  const nexusUser = body.data.user
  const person = await resolvePerson(nexusUser.email || nexusUser.accessCode || payload.identifier)
  const isAdmin = String(nexusUser.role).toLowerCase() === 'admin'
  if (!person && !isAdmin) return res.status(403).json({ message: 'No active Orbit identity is authorized for KCS Kitchen' })

  const orbitPersonId = person?.id || String(nexusUser.id)
  const type = person ? personTypeFrom(person.kind) : 'ADMINISTRATIVE_STAFF'
  const access = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId } })
  const personalRole = defaultRole(String(nexusUser.role), type)
  if (access && !access.isActive) return res.status(403).json({ message: 'KCS Kitchen access is disabled' })

  const identity: KitchenIdentity = {
    userId: String(nexusUser.id),
    orbitPersonId,
    fullName: person?.fullName || [nexusUser.lastName, nexusUser.firstName].filter(Boolean).join(' ') || 'KCS Administrator',
    email: person?.email || nexusUser.email || null,
    personType: access?.personType || type,
    role: access?.role || personalRole,
    hasOfficialPhoto: Boolean(person?.photoData),
    canManageOwnCredentials: canManageOwnKitchenCredentials({
      userId: String(nexusUser.id),
      orbitPersonId,
      explicitKitchenAdmin: Boolean(access?.isActive && access.role === 'KITCHEN_ADMIN'),
    }),
  }
  if (requestedMode === 'CUSTOMER') {
    if (!['TEACHER', 'STAFF', 'STUDENT'].includes(personalRole)) {
      return res.status(403).json({ message: 'This portal is reserved for Kitchen consumers with an active Orbit identity' })
    }
    identity.role = personalRole
    identity.canManageOwnCredentials = false
  }
  if (['CASHIER', 'STAFF'].includes(requestedMode)) {
    if (identity.role === 'KITCHEN_ADMIN') identity.role = 'CASHIER'
    if (identity.role !== 'CASHIER') {
      return res.status(403).json({ message: 'Only the Kitchen cashier may use the Point of sale portal' })
    }
    identity.canManageOwnCredentials = false
  }
  if (requestedMode === 'ADMIN' && identity.role !== 'KITCHEN_ADMIN') {
    return res.status(403).json({ message: 'Only the explicitly assigned Kitchen manager may use the administration portal' })
  }
  res.json({ token: signSession(identity), user: identity })
}))

app.get('/api/me', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const balance = await balanceFor(req.kitchenUser!.orbitPersonId)
  res.json({ user: req.kitchenUser, balance })
}))

app.put('/api/me/change-password', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const access = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId: req.kitchenUser!.orbitPersonId } })
  if (!canManageOwnKitchenCredentials({
    userId: req.kitchenUser!.userId,
    orbitPersonId: req.kitchenUser!.orbitPersonId,
    explicitKitchenAdmin: Boolean(access?.isActive && access.role === 'KITCHEN_ADMIN'),
  })) return res.status(403).json({ message: 'Only the explicitly assigned Kitchen manager may change their own credentials. The Nexus Super Administrator account is protected.' })
  const input = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(14).max(128) }).parse(req.body)
  const identifier = req.kitchenUser!.email
  if (!identifier) return res.status(409).json({ message: 'No institutional email is linked to this Kitchen account' })
  const loginResponse = await fetch(new URL('/api/auth/login', env.NEXUS_API_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-kcs-client': 'KCS_KITCHEN' },
    body: JSON.stringify({ identifier, password: input.currentPassword }),
    signal: AbortSignal.timeout(12_000),
  })
  const loginBody = await loginResponse.json().catch(() => null) as any
  if (!loginResponse.ok || !loginBody?.data?.token) return res.status(400).json({ message: loginBody?.message || 'Current password is incorrect' })
  if (!reauthenticatedAsSameAccount(req.kitchenUser!.userId, loginBody?.data?.user?.id)) {
    return res.status(409).json({ message: 'The reauthenticated account does not match the Kitchen manager session. No credential was changed.' })
  }
  const changeResponse = await fetch(new URL('/api/auth/change-password', env.NEXUS_API_URL), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + loginBody.data.token, 'x-kcs-client': 'KCS_KITCHEN' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(12_000),
  })
  const changeBody = await changeResponse.json().catch(() => null) as any
  if (!changeResponse.ok) return res.status(changeResponse.status).json({ message: changeBody?.message || 'The ecosystem password could not be changed' })
  await audit(req, 'INSTITUTIONAL_PASSWORD_CHANGED_FROM_KITCHEN', 'User', req.kitchenUser!.userId, undefined, { propagatedBy: 'NEXUS' })
  res.json({ changed: true, message: 'Password changed across the KCS ecosystem. Sign in again with the new password.' })
}))

app.put('/api/me/email', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const access = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId: req.kitchenUser!.orbitPersonId } })
  if (!canManageOwnKitchenCredentials({
    userId: req.kitchenUser!.userId,
    orbitPersonId: req.kitchenUser!.orbitPersonId,
    explicitKitchenAdmin: Boolean(access?.isActive && access.role === 'KITCHEN_ADMIN'),
  })) return res.status(403).json({ message: 'Only the explicitly assigned Kitchen manager may change their own credentials. The Nexus Super Administrator account is protected.' })
  const input = z.object({ currentPassword: z.string().min(1).max(200), newEmail: z.string().trim().email().max(180) }).parse(req.body)
  const identifier = req.kitchenUser!.email
  if (!identifier) return res.status(409).json({ message: 'No institutional email is linked to this Kitchen account' })
  const loginResponse = await fetch(new URL('/api/auth/login', env.NEXUS_API_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-kcs-client': 'KCS_KITCHEN' },
    body: JSON.stringify({ identifier, password: input.currentPassword }),
    signal: AbortSignal.timeout(12_000),
  })
  const loginBody = await loginResponse.json().catch(() => null) as any
  if (!loginResponse.ok || !loginBody?.data?.token) return res.status(400).json({ message: loginBody?.message || 'Current password is incorrect' })
  if (!reauthenticatedAsSameAccount(req.kitchenUser!.userId, loginBody?.data?.user?.id)) {
    return res.status(409).json({ message: 'The reauthenticated account does not match the Kitchen manager session. No credential was changed.' })
  }
  const updateResponse = await fetch(new URL('/api/auth/email', env.NEXUS_API_URL), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + loginBody.data.token, 'x-kcs-client': 'KCS_KITCHEN' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(12_000),
  })
  const updateBody = await updateResponse.json().catch(() => null) as any
  if (!updateResponse.ok) return res.status(updateResponse.status).json({ message: updateBody?.message || 'The institutional email could not be changed' })
  await audit(req, 'INSTITUTIONAL_EMAIL_CHANGED_FROM_KITCHEN', 'User', req.kitchenUser!.userId, { email: identifier }, { email: input.newEmail.toLowerCase() })
  res.json({ changed: true, email: input.newEmail.toLowerCase(), message: 'Institutional email updated. Sign in again with the new address.' })
}))
app.get('/api/me/avatar', authenticate, asyncRoute(async (req: AuthRequest, res) => {

  const people = await loadDirectory()
  const photoData = people.find(person => person.id === req.kitchenUser!.orbitPersonId)?.photoData
  const match = photoData?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s)
  if (!match) return res.status(404).json({ message: 'Official profile photo not found' })
  const image = Buffer.from(match[2], 'base64')
  res.type(match[1]).set('Content-Length', String(image.length)).set('Cache-Control', 'private, max-age=3600').set('X-Content-Type-Options', 'nosniff')
  return res.send(image)
}))

app.get('/api/exchange-rate', authenticate, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    res.json(await getUsdCdfRate(req.query.refresh === 'true'))
  } catch {
    res.status(503).json({ message: 'The USD/CDF exchange rate is temporarily unavailable' })
  }
}))

app.get('/api/directory', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR'), asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  const people = await loadDirectory(req.query.refresh === 'true')
  const kind = String(req.query.kind || '').trim().toUpperCase()
  const className = (normalizeClassName(String(req.query.className || '')) || '').toLowerCase()
  const searched = q ? people.filter(person =>
    [person.fullName, person.email, person.phone, person.displayId, person.className, person.department, person.jobTitle, person.subject]
      .some(value => value?.toLowerCase().includes(q))
  ) : people
  const filtered = searched.filter(person => (!kind || person.kind === kind) && (!className || normalizeClassName(person.className)?.toLowerCase() === className))
  const classesByKey = new Map<string, string>()
  people.filter(person => person.kind === 'STUDENT').forEach(person => {
    const canonical = normalizeClassName(person.className)
    if (canonical) classesByKey.set(canonical.toLowerCase(), canonical)
  })
  const classes = [...classesByKey.values()].sort(compareClassNames)
  const counts = people.reduce<Record<string, number>>((totals, person) => ({ ...totals, [person.kind]: (totals[person.kind] || 0) + 1 }), {})
  const publicPeople = filtered.slice(0, 250).map(({ photoData: _photoData, ...person }) => person)
  res.json({ people: publicPeople, total: filtered.length, facets: { classes, counts } })
}))

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.enum(['FOOD', 'DRINK', 'SNACK', 'DESSERT', 'OTHER']),
  currentPrice: z.coerce.number().nonnegative(),
  currency: z.enum(['CDF', 'USD']).default('CDF'),
  photoUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().default(true),
  trackInventory: z.boolean().default(false),
  stockQuantity: z.coerce.number().nonnegative().default(0),
  unit: z.enum(['UNIT', 'BOTTLE', 'CAN', 'KG', 'LITER', 'PORTION', 'OTHER']).default('UNIT'),
  minimumStock: z.coerce.number().nonnegative().default(0),
  reorderLevel: z.coerce.number().nonnegative().default(0)
})

app.get('/api/products', authenticate, asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({
    where: {
      archivedAt: null,
      ...(req.query.all === 'true' ? {} : { isAvailable: true })
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  })
  res.json({ products })
}))

app.post('/api/products', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const data = productSchema.parse(req.body)
  const product = await prisma.product.create({ data: {
    ...data,
    currentPrice: new Prisma.Decimal(data.currentPrice),
    stockQuantity: new Prisma.Decimal(data.stockQuantity),
    minimumStock: new Prisma.Decimal(data.minimumStock),
    reorderLevel: new Prisma.Decimal(data.reorderLevel),
    priceHistory: { create: { price: new Prisma.Decimal(data.currentPrice), currency: data.currency, changedBy: req.kitchenUser!.orbitPersonId } }
  } })
  await audit(req, 'PRODUCT_CREATED', 'Product', product.id, undefined, product)
  res.status(201).json({ product })
}))

app.put('/api/products/:id', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const data = productSchema.partial().parse(req.body)
  const old = await prisma.product.findFirstOrThrow({ where: { id: routeParam(req, 'id'), archivedAt: null } })
  const priceChanged = data.currentPrice != null && Number(old.currentPrice) !== data.currentPrice
  const product = await prisma.product.update({ where: { id: old.id }, data: {
    ...data,
    currentPrice: data.currentPrice == null ? undefined : new Prisma.Decimal(data.currentPrice),
    stockQuantity: data.stockQuantity == null ? undefined : new Prisma.Decimal(data.stockQuantity),
    minimumStock: data.minimumStock == null ? undefined : new Prisma.Decimal(data.minimumStock),
    reorderLevel: data.reorderLevel == null ? undefined : new Prisma.Decimal(data.reorderLevel),
    priceHistory: priceChanged ? { create: { price: new Prisma.Decimal(data.currentPrice!), currency: data.currency || old.currency, changedBy: req.kitchenUser!.orbitPersonId, reason: String(req.body.reason || 'Price update') } } : undefined
  } })
  await audit(req, priceChanged ? 'PRICE_CHANGED' : 'PRODUCT_UPDATED', 'Product', product.id, old, product, req.body.reason)
  res.json({ product })
}))

app.delete('/api/products/:id', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const id = routeParam(req, 'id')
  const old = await prisma.product.findFirstOrThrow({ where: { id, archivedAt: null } })
  const product = await prisma.product.update({
    where: { id },
    data: { isAvailable: false, archivedAt: new Date() }
  })
  await audit(
    req,
    'PRODUCT_REMOVED_FROM_CATALOG',
    'Product',
    product.id,
    old,
    product,
    'Soft removal: financial, sales and inventory history preserved'
  )
  res.json({ product, message: 'Product removed from the active catalog' })
}))

app.get('/api/discount-rules', authenticate, asyncRoute(async (_req, res) => {
  res.json({ rules: await prisma.discountRule.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }) })
}))

app.post('/api/discount-rules', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const data = z.object({
    name: z.string().min(2).max(120),
    type: z.enum(['THRESHOLD_FIXED_TOTAL', 'FIXED_AMOUNT', 'PERCENTAGE', 'CATEGORY_DISCOUNT', 'ROLE_DISCOUNT', 'MANUAL_AUTHORIZED_DISCOUNT']),
    eligibleRole: z.enum(['KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR', 'TEACHER', 'STAFF', 'STUDENT']).optional().nullable(),
    category: z.enum(['FOOD', 'DRINK', 'SNACK', 'DESSERT', 'OTHER']).optional().nullable(),
    thresholdAmount: z.coerce.number().nonnegative().optional().nullable(),
    fixedAmount: z.coerce.number().nonnegative().optional().nullable(),
    targetAmount: z.coerce.number().nonnegative().optional().nullable(),
    percentage: z.coerce.number().min(0).max(100).optional().nullable(),
    priority: z.coerce.number().int().default(100),
    isActive: z.boolean().default(false),
    requiresApproval: z.boolean().default(false)
  }).parse(req.body)
  const rule = await prisma.discountRule.create({ data })
  await audit(req, 'DISCOUNT_RULE_CREATED', 'DiscountRule', rule.id, undefined, rule)
  res.status(201).json({ rule })
}))

app.put('/api/access/:orbitPersonId', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const person = await resolvePerson(routeParam(req, 'orbitPersonId'))
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })
  const data = z.object({
    role: z.enum(['KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR', 'TEACHER', 'STAFF', 'STUDENT']),
    isActive: z.boolean().default(true),
    creditEnabled: z.boolean().default(false),
    emailNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(true),
    creditLimit: z.coerce.number().positive().optional().nullable()
  }).parse(req.body)
  const access = await prisma.$transaction(async tx => {
    const saved = await tx.kitchenAccess.upsert({
      where: { orbitPersonId: person.id },
      create: { orbitPersonId: person.id, personType: personTypeFrom(person.kind), createdBy: req.kitchenUser!.orbitPersonId, ...data },
      update: data
    })
    const currentManager = await tx.kitchenManagerSettings.findUnique({ where: { id: 'primary' } })
    if (saved.role === 'KITCHEN_ADMIN' && saved.isActive) {
      await tx.kitchenManagerSettings.upsert({
        where: { id: 'primary' },
        create: { id: 'primary', managerOrbitPersonId: person.id, reportEmail: person.email || null, updatedBy: req.kitchenUser!.orbitPersonId },
        update: {
          managerOrbitPersonId: person.id,
          reportEmail: currentManager?.reportEmail || person.email || null,
          updatedBy: req.kitchenUser!.orbitPersonId,
        },
      })
    } else if (currentManager?.managerOrbitPersonId === person.id) {
      await tx.kitchenManagerSettings.update({
        where: { id: 'primary' },
        data: { managerOrbitPersonId: null, reportEmail: null, dailyReportEnabled: false, updatedBy: req.kitchenUser!.orbitPersonId },
      })
    }
    return saved
  })
  await audit(req, 'ACCESS_UPDATED', 'KitchenAccess', access.id, undefined, access)
  res.json({ access })
}))

app.get('/api/access/:orbitPersonId', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (req, res) => {
  const person = await resolvePerson(routeParam(req, 'orbitPersonId'))
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })
  const [access, payments, balance] = await Promise.all([
    prisma.kitchenAccess.findUnique({ where: { orbitPersonId: person.id } }),
    prisma.kitchenPayment.findMany({ where: { orbitPersonId: person.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    balanceFor(person.id)
  ])
  res.setHeader('Cache-Control', 'no-store')
  res.json({ person, access, payments, balance })
}))

app.get('/api/debts', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  const [grouped, people] = await Promise.all([
    prisma.kitchenLedgerEntry.groupBy({ by: ['orbitPersonId'], _sum: { amount: true } }),
    loadDirectory()
  ])
  const peopleById = new Map(people.map(person => [person.id, person]))
  const debts = grouped
    .map(row => ({ orbitPersonId: row.orbitPersonId, balance: Number(row._sum.amount || 0), person: peopleById.get(row.orbitPersonId) || null }))
    .filter(row => row.balance > 0.005)
    .sort((left, right) => right.balance - left.balance || (left.person?.fullName || left.orbitPersonId).localeCompare(right.person?.fullName || right.orbitPersonId))
  res.setHeader('Cache-Control', 'no-store')
  res.json({ debts, total: debts.reduce((sum, row) => sum + row.balance, 0), count: debts.length })
}))

app.get('/api/school-subsidies', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined
  const to = req.query.to ? new Date(String(req.query.to)) : undefined
  if (from && Number.isNaN(from.getTime())) return res.status(400).json({ message: 'Invalid start date' })
  if (to && Number.isNaN(to.getTime())) return res.status(400).json({ message: 'Invalid end date' })
  const rows = await prisma.kitchenTransaction.findMany({
    where: {
      status: 'CONFIRMED',
      schoolSubsidy: { gt: 0 },
      ...(from || to ? { createdAt: { gte: from, lte: to } } : {})
    },
    select: {
      id: true, transactionNumber: true, createdAt: true, orbitPersonId: true, personNameSnapshot: true,
      subtotal: true, eligibleSubtotal: true, schoolSubsidy: true, total: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5000
  })
  const grossTotal = rows.reduce((sum, row) => sum + Number(row.schoolSubsidy), 0)
  const payments = await prisma.schoolSubsidyPayment.findMany({
    where: from || to ? { paidAt: { gte: from, lte: to } } : undefined,
    orderBy: { paidAt: 'desc' },
    take: 5000
  })
  const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const outstanding = Math.max(0, grossTotal - paidTotal)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ rows, payments, grossTotal, paidTotal, outstanding, total: outstanding, count: rows.length, currency: 'CDF', generatedAt: new Date().toISOString() })
}))

app.post('/api/school-subsidies/payments', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    amount: z.coerce.number().positive(),
    method: z.enum(['CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY']),
    reference: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(500).optional(),
  }).parse(req.body)
  const aggregate = await prisma.kitchenTransaction.aggregate({ where: { status: 'CONFIRMED', schoolSubsidy: { gt: 0 } }, _sum: { schoolSubsidy: true } })
  const grossTotal = Number(aggregate._sum.schoolSubsidy || 0)
  const paidAggregate = await prisma.schoolSubsidyPayment.aggregate({ _sum: { amount: true } })
  const paidTotal = Number(paidAggregate._sum.amount || 0)
  const outstanding = Math.max(0, grossTotal - paidTotal)
  if (input.amount > outstanding + 0.005) return res.status(409).json({ message: 'Payment exceeds the outstanding KCS school subsidy balance', outstanding })
  const payment = await prisma.schoolSubsidyPayment.create({ data: {
    amount: new Prisma.Decimal(input.amount),
    method: input.method,
    reference: input.reference,
    notes: input.notes,
    recordedBy: req.kitchenUser!.orbitPersonId,
  } })
  await audit(req, 'SCHOOL_SUBSIDY_PAYMENT_RECORDED', 'SchoolSubsidyPayment', payment.id, undefined, payment)
  res.status(201).json({ payment, grossTotal, paidTotal: paidTotal + input.amount, outstanding: Math.max(0, outstanding - input.amount) })
}))

const kitchenDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return [part('year'), part('month'), part('day')].join('-')
}
const receiptSignature = (reference: string) => crypto.createHmac('sha256', env.QR_SIGNING_SECRET).update(`receipt:${reference}`).digest('base64url')
const withReceiptSignature = <T extends { transactionNumber: string }>(transaction: T) => ({ ...transaction, receiptSignature: receiptSignature(transaction.transactionNumber) })
const menuDate = (value: string) => new Date(`${value}T00:00:00.000Z`)

app.get('/api/daily-menus/today', authenticate, asyncRoute(async (_req, res) => {
  const key = kitchenDateKey()
  const menu = await ensureOfficialMenu(prisma, key)
  res.setHeader('Cache-Control', 'no-store')
  if (!menu || menu.status !== 'PUBLISHED') return res.status(404).json({ message: 'No published menu is available for today', date: key })
  res.json({ menu })
}))

app.get('/api/daily-menus', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  const [menus, deletedMenus] = await Promise.all([
    prisma.dailyMenu.findMany({ include: { items: { include: { product: true }, orderBy: { displayOrder: 'asc' } }, _count: { select: { transactions: true } } }, orderBy: { menuDate: 'desc' }, take: 90 }),
    prisma.auditLog.findMany({
      where: { entityType: 'DailyMenu', action: 'DAILY_MENU_DELETED' },
      orderBy: { createdAt: 'desc' },
      take: 90,
      select: { id: true, entityId: true, actorId: true, actorRole: true, action: true, oldValue: true, reason: true, createdAt: true }
    })
  ])
  res.setHeader('Cache-Control', 'no-store')
  res.json({ menus, deletedMenus })
}))
const dailyMenuSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  productIds: z.array(z.string().min(1)).max(80).optional(),
  items: z.array(z.object({ productId: z.string().min(1), unitPrice: z.coerce.number().positive(), currency: z.enum(['CDF', 'USD']).default('CDF') })).min(1).max(80).optional(),
  publish: z.boolean().default(false)
}).refine(value => Boolean(value.items?.length || value.productIds?.length), { message: 'At least one priced menu item is required' })
const auditJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
async function runKitchenSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return runWithTransactionRetry(() => prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }))
}
const menuInputLines = (input: z.infer<typeof dailyMenuSchema>) => {
  const source = input.items?.length ? input.items : (input.productIds || []).map(productId => ({ productId, unitPrice: 0, currency: 'CDF' as const }))
  return [...new Map(source.map(item => [item.productId, item])).values()]
}
async function menuLinesWithRequiredStaples(input: z.infer<typeof dailyMenuSchema>) {
  const lines = menuInputLines(input)
  const staples = await prisma.product.findMany({
    where: { name: { in: DAILY_STAPLE_PRODUCT_NAMES }, archivedAt: null, isAvailable: true },
    orderBy: { name: 'asc' },
  })
  if (staples.length !== DAILY_STAPLE_PRODUCT_NAMES.length) {
    throw Object.assign(new Error('Chicken and fries must both be active catalog products before a daily menu can be saved'), { statusCode: 409 })
  }
  const selectedIds = new Set(lines.map(line => line.productId))
  for (const name of DAILY_STAPLE_PRODUCT_NAMES) {
    const product = staples.find(item => item.name === name)!
    if (!selectedIds.has(product.id)) lines.push({ productId: product.id, unitPrice: Number(product.currentPrice), currency: product.currency === 'USD' ? 'USD' : 'CDF' })
  }
  return lines
}

app.post('/api/daily-menus', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const input = dailyMenuSchema.parse(req.body)
  const lines = await menuLinesWithRequiredStaples(input)
  const ids = lines.map(item => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: ids }, archivedAt: null, isAvailable: true } })
  if (products.length !== ids.length) return res.status(409).json({ message: 'Every menu item must be an active, available catalog product' })
  const date = menuDate(input.date)
  const existing = await prisma.dailyMenu.findUnique({ where: { menuDate: date }, select: { id: true } })
  if (existing) return res.status(409).json({ message: 'A menu already exists for this service date. Open it with Edit to preserve its complete audit history.' })
  const menu = await prisma.$transaction(async tx => {
    const saved = await tx.dailyMenu.create({ data: { menuDate: date, title: input.title, description: input.description, createdBy: req.kitchenUser!.orbitPersonId, status: input.publish ? 'PUBLISHED' : 'DRAFT', publishedAt: input.publish ? new Date() : null } })
    await tx.dailyMenuItem.createMany({ data: lines.map((line, index) => { const product = products.find(item => item.id === line.productId)!; const unitPrice = line.unitPrice > 0 ? line.unitPrice : Number(product.currentPrice); if (unitPrice <= 0) throw new Error(`${product.name} requires a menu price`); return { menuId: saved.id, productId: product.id, unitPrice: new Prisma.Decimal(unitPrice), currency: line.currency || product.currency, displayOrder: index } }) })
    for (const line of lines) if (line.unitPrice > 0) await tx.product.update({ where: { id: line.productId }, data: { currentPrice: new Prisma.Decimal(line.unitPrice), currency: line.currency, isAvailable: true } })
    const complete = await tx.dailyMenu.findUniqueOrThrow({ where: { id: saved.id }, include: { items: { include: { product: true }, orderBy: { displayOrder: 'asc' } }, _count: { select: { transactions: true } } } })
    await tx.auditLog.create({ data: { actorId: req.kitchenUser!.orbitPersonId, actorRole: req.kitchenUser!.role, action: input.publish ? 'DAILY_MENU_PUBLISHED' : 'DAILY_MENU_SAVED', entityType: 'DailyMenu', entityId: saved.id, newValue: auditJson(complete), ipAddress: req.ip } })
    return complete
  })
  res.status(201).json({ menu })
}))

app.get('/api/daily-menus/:id/audit', authenticate, allow('KITCHEN_ADMIN', 'AUDITOR'), asyncRoute(async (req, res) => {
  const id = routeParam(req, 'id')
  const logs = await prisma.auditLog.findMany({ where: { entityType: 'DailyMenu', entityId: id }, orderBy: { createdAt: 'desc' }, take: 100 })
  res.json({ logs })
}))

app.put('/api/daily-menus/:id', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const id = routeParam(req, 'id')
  const input = dailyMenuSchema.parse(req.body)
  const previous = await prisma.dailyMenu.findUnique({ where: { id }, include: { items: { include: { product: true }, orderBy: { displayOrder: 'asc' } }, _count: { select: { transactions: true } } } })
  if (!previous) return res.status(404).json({ message: 'Daily menu not found' })
  if (previous._count.transactions) return res.status(409).json({ message: 'A menu linked to recorded transactions is immutable and cannot be edited.' })
  const date = menuDate(input.date)
  const conflicting = await prisma.dailyMenu.findFirst({ where: { menuDate: date, id: { not: id } }, select: { id: true } })
  if (conflicting) return res.status(409).json({ message: 'Another menu already exists for this service date.' })
  const lines = await menuLinesWithRequiredStaples(input)
  const productIds = lines.map(item => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, archivedAt: null, isAvailable: true } })
  if (products.length !== productIds.length) return res.status(409).json({ message: 'Every menu item must be an active, available catalog product' })
  const menu = await prisma.$transaction(async tx => {
    await tx.dailyMenu.update({ where: { id }, data: { menuDate: date, title: input.title, description: input.description, status: input.publish ? 'PUBLISHED' : 'DRAFT', publishedAt: input.publish ? new Date() : null, closedAt: null } })
    await tx.dailyMenuItem.deleteMany({ where: { menuId: id } })
    await tx.dailyMenuItem.createMany({ data: lines.map((line, index) => { const product = products.find(item => item.id === line.productId)!; const unitPrice = line.unitPrice > 0 ? line.unitPrice : Number(product.currentPrice); if (unitPrice <= 0) throw new Error(`${product.name} requires a menu price`); return { menuId: id, productId: product.id, unitPrice: new Prisma.Decimal(unitPrice), currency: line.currency || product.currency, displayOrder: index } }) })
    for (const line of lines) if (line.unitPrice > 0) await tx.product.update({ where: { id: line.productId }, data: { currentPrice: new Prisma.Decimal(line.unitPrice), currency: line.currency, isAvailable: true } })
    const updated = await tx.dailyMenu.findUniqueOrThrow({ where: { id }, include: { items: { include: { product: true }, orderBy: { displayOrder: 'asc' } }, _count: { select: { transactions: true } } } })
    await tx.auditLog.create({ data: { actorId: req.kitchenUser!.orbitPersonId, actorRole: req.kitchenUser!.role, action: 'DAILY_MENU_UPDATED', entityType: 'DailyMenu', entityId: id, oldValue: auditJson(previous), newValue: auditJson(updated), ipAddress: req.ip } })
    return updated
  })
  res.json({ menu })
}))

app.delete('/api/daily-menus/:id', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const id = routeParam(req, 'id')
  const previous = await prisma.dailyMenu.findUnique({ where: { id }, include: { items: { include: { product: true }, orderBy: { displayOrder: 'asc' } }, _count: { select: { transactions: true } } } })
  if (!previous) return res.status(404).json({ message: 'Daily menu not found' })
  if (previous._count.transactions) return res.status(409).json({ message: 'A menu linked to recorded transactions is retained for accounting traceability and cannot be deleted.' })
  await prisma.$transaction(async tx => {
    await tx.dailyMenu.delete({ where: { id } })
    await tx.auditLog.create({ data: { actorId: req.kitchenUser!.orbitPersonId, actorRole: req.kitchenUser!.role, action: 'DAILY_MENU_DELETED', entityType: 'DailyMenu', entityId: id, oldValue: auditJson(previous), reason: String(req.body?.reason || 'Deleted by Kitchen administration'), ipAddress: req.ip } })
  })
  res.json({ id, deleted: true })
}))
app.post('/api/daily-menus/:id/close', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const previous = await prisma.dailyMenu.findUnique({ where: { id: routeParam(req, 'id') } })
  if (!previous) return res.status(404).json({ message: 'Daily menu not found' })
  const menu = await prisma.dailyMenu.update({ where: { id: previous.id }, data: { status: 'CLOSED', closedAt: new Date() } })
  await audit(req, 'DAILY_MENU_CLOSED', 'DailyMenu', menu.id, previous, menu)
  res.json({ menu })
}))
const saleSchema = z.object({
  orbitPersonId: z.string().min(1),
  dailyMenuId: z.string().min(1),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().positive().max(1000) })).min(1).max(50),
  paymentMode: z.enum(['CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY', 'CREDIT']),
  notes: z.string().trim().max(500).optional(),
  confirmationType: z.enum(['NONE', 'PIN', 'DASHBOARD', 'QR', 'SIGNATURE']).default('NONE')
})

app.post('/api/transactions', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'TEACHER', 'STAFF', 'STUDENT'), asyncRoute(async (req: AuthRequest, res) => {
  const input = saleSchema.parse(req.body)
  const isPersonalOrder = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (isPersonalOrder && input.orbitPersonId !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'A personal Kitchen order may only be placed for the authenticated account' })
  if (isPersonalOrder && !['CASH', 'CREDIT'].includes(input.paymentMode)) return res.status(400).json({ message: 'Choose purchase or debt for a personal Kitchen order' })
  const person = await resolvePerson(input.orbitPersonId)
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })

  const now = new Date()
  const period = await prisma.accountingPeriod.findUnique({ where: { year_month: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 } } })
  if (period?.status === 'CLOSED') {
    await prisma.$transaction(async tx => {
      const reopened = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: { status: 'OPEN', closedAt: null, closedBy: null, archivedAt: null, archivedBy: null, archiveReason: null },
      })
      await tx.auditLog.create({ data: {
        actorId: req.kitchenUser!.orbitPersonId,
        actorRole: req.kitchenUser!.role,
        action: 'CURRENT_MONTH_AUTO_REOPENED_FOR_OPERATION',
        entityType: 'AccountingPeriod',
        entityId: period.id,
        oldValue: auditJson(period),
        newValue: auditJson(reopened),
        reason: 'The active calendar month had been closed prematurely; Kitchen operations resumed with a full audit trail.',
        ipAddress: req.ip,
      } })
    })
  }

  const activeMenu = await prisma.dailyMenu.findUnique({ where: { id: input.dailyMenuId }, include: { items: true } })
  if (!activeMenu || activeMenu.status !== 'PUBLISHED' || activeMenu.menuDate.toISOString().slice(0, 10) !== kitchenDateKey(now)) return res.status(409).json({ message: 'Sales and credit require the published menu for today' })
  const productIds = [...new Set(input.items.map(item => item.productId))]
  const menuItems = new Map(activeMenu.items.filter(item => item.isAvailable).map(item => [item.productId, item]))
  if (productIds.some(id => !menuItems.has(id))) return res.status(409).json({ message: 'One or more selected products are not on today’s menu' })
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  if (products.length !== productIds.length) return res.status(400).json({ message: 'One or more products no longer exist' })
  const needsUsdRate = input.items.some(item => menuItems.get(item.productId)?.currency === 'USD')
  let exchangeRate: Awaited<ReturnType<typeof getUsdCdfRate>> | null = null
  if (needsUsdRate) {
    try { exchangeRate = await getUsdCdfRate() }
    catch {
      return res.status(503).json({ message: 'USD sales are temporarily paused because no reliable server exchange rate is available. No transaction was recorded.' })
    }
  }
  const productMap = new Map(products.map(product => [product.id, product]))
  const lines = input.items.map(item => {
    const product = productMap.get(item.productId)!
    if (!product.isAvailable) throw Object.assign(new Error(product.name + ' is unavailable'), { statusCode: 409 })
    if (product.trackInventory && Number(product.stockQuantity) < item.quantity) {
      throw Object.assign(new Error('Insufficient stock for ' + product.name), { statusCode: 409 })
    }
    const menuItem = menuItems.get(product.id)!
    const unitPriceCdf = Number(menuItem.unitPrice) * (menuItem.currency === 'USD' ? exchangeRate!.rate : 1)
    if (!Number.isFinite(unitPriceCdf) || unitPriceCdf <= 0) {
      throw Object.assign(new Error(product.name + ' requires a manager-configured price before it can be ordered'), { statusCode: 409 })
    }
    return {
      product,
      quantity: item.quantity,
      unitPriceCdf,
      subtotal: unitPriceCdf * item.quantity
    }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)

  let personAccess = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId: person.id } })
  const subsidyRole = person.kind === 'TEACHER' ? 'TEACHER' : ['STAFF', 'ADMINISTRATIVE_STAFF'].includes(person.kind) ? 'STAFF' : person.kind
  const eligibleSubtotal = lines.filter(line => line.product.discountEligible && line.product.category !== 'DRINK').reduce((sum, line) => sum + line.subtotal, 0)
  const schoolSubsidy = calculateSchoolSubsidy(eligibleSubtotal, subsidyRole)
  if (input.paymentMode === 'CREDIT') {
    if (personAccess?.isActive === false) return res.status(403).json({ message: 'Kitchen access is explicitly disabled for this person' })
    if (!personAccess?.creditEnabled) {
      const previousAccess = personAccess
      personAccess = await prisma.kitchenAccess.upsert({
        where: { orbitPersonId: person.id },
        create: {
          orbitPersonId: person.id,
          personType: personTypeFrom(person.kind),
          role: defaultRole(person.kind, personTypeFrom(person.kind)),
          isActive: true,
          creditEnabled: true,
          createdBy: req.kitchenUser!.orbitPersonId
        },
        update: { creditEnabled: true }
      })
      await audit(req, 'CREDIT_AUTO_ENABLED_FOR_DEBT_ORDER', 'KitchenAccess', personAccess.id, previousAccess, personAccess, 'Debt is available to every active institutional Kitchen identity; explicit access suspension remains authoritative.')
    }
    const currentBalance = await balanceFor(person.id)
    if (personAccess.creditLimit != null && currentBalance + Math.max(0, subtotal - schoolSubsidy) > Number(personAccess.creditLimit)) {
      return res.status(409).json({ message: 'Credit limit would be exceeded', currentBalance, creditLimit: personAccess.creditLimit })
    }
  }

  const transaction = await runKitchenSerializableTransaction(async tx => {
    const counterName = 'TRANSACTION-' + now.getUTCFullYear()
    const counter = await tx.kitchenCounter.upsert({
      where: { name: counterName },
      create: { name: counterName, value: 1 },
      update: { value: { increment: 1 } }
    })
    const transactionNumber = 'KITCHEN-' + now.getUTCFullYear() + '-' + String(counter.value).padStart(6, '0')
    const total = Math.max(0, subtotal - schoolSubsidy)
    const isCredit = input.paymentMode === 'CREDIT'

    const created = await tx.kitchenTransaction.create({ data: {
      transactionNumber,
      dailyMenuId: activeMenu.id,
      orbitPersonId: person.id,
      personType: personTypeFrom(person.kind),
      personNameSnapshot: person.fullName,
      cashierOrbitPersonId: req.kitchenUser!.orbitPersonId,
      cashierNameSnapshot: req.kitchenUser!.fullName,
      subtotal: new Prisma.Decimal(subtotal),
      eligibleSubtotal: new Prisma.Decimal(eligibleSubtotal),
      discount: new Prisma.Decimal(schoolSubsidy),
      schoolSubsidy: new Prisma.Decimal(schoolSubsidy),
      total: new Prisma.Decimal(total),
      paymentMode: input.paymentMode,
      paymentStatus: isCredit ? 'CREDIT' : 'PAID',
      status: isPersonalOrder ? 'PENDING' : 'CONFIRMED',
      creditAmount: new Prisma.Decimal(isCredit ? total : 0),
      notes: input.notes,
      confirmationType: input.confirmationType,
      confirmedByPersonAt: isPersonalOrder || input.confirmationType === 'NONE' ? null : now,
      items: { create: lines.map(line => ({
        productId: line.product.id,
        productNameSnapshot: line.product.name,
        quantity: new Prisma.Decimal(line.quantity),
        unitPriceAtPurchase: new Prisma.Decimal(line.unitPriceCdf),
        subtotal: new Prisma.Decimal(line.subtotal)
      })) },
      discounts: schoolSubsidy > 0 ? { create: {
        originalAmount: new Prisma.Decimal(eligibleSubtotal),
        discountAmount: new Prisma.Decimal(schoolSubsidy),
        finalAmount: new Prisma.Decimal(total),
        reason: 'KCS staff/teacher school subsidy',
        appliedAutomatically: true
      } } : undefined,
      ledgerEntries: { create: isPersonalOrder ? [] : [
        { orbitPersonId: person.id, type: 'PURCHASE', amount: new Prisma.Decimal(subtotal), description: 'Consumption ' + transactionNumber, performedBy: req.kitchenUser!.orbitPersonId },
        ...(schoolSubsidy > 0 ? [{ orbitPersonId: person.id, type: 'DISCOUNT' as const, amount: new Prisma.Decimal(-schoolSubsidy), description: 'School subsidy ' + transactionNumber, performedBy: req.kitchenUser!.orbitPersonId }] : []),
        ...(!isCredit ? [{ orbitPersonId: person.id, type: 'PAYMENT' as const, amount: new Prisma.Decimal(-total), description: 'Immediate payment ' + transactionNumber, performedBy: req.kitchenUser!.orbitPersonId }] : [])
      ] }
    }, include: { items: true, discounts: true } })

    for (const line of lines) {
      if (isPersonalOrder) continue
      if (!line.product.trackInventory) continue
      await tx.product.update({ where: { id: line.product.id }, data: { stockQuantity: { decrement: line.quantity } } })
      await tx.stockMovement.create({ data: {
        productId: line.product.id,
        type: 'SALE',
        quantity: new Prisma.Decimal(-line.quantity),
        reason: transactionNumber,
        actor: req.kitchenUser!.orbitPersonId
      } })
    }

    const notificationPayload = { transactionNumber, subtotal, schoolSubsidy, total, currency: 'CDF', paymentMode: input.paymentMode, personName: person.fullName, onlineOrder: isPersonalOrder, items: lines.map(line => `${line.quantity} × ${line.product.name}`) }
    const personChannels = ['IN_APP', ...(personAccess?.emailNotifications !== false ? ['EMAIL'] : []), ...(personAccess?.smsNotifications !== false ? ['SMS'] : [])]
    const kitchenManagers = isPersonalOrder ? await tx.kitchenAccess.findMany({ where: { role: 'KITCHEN_ADMIN', isActive: true }, select: { orbitPersonId: true, emailNotifications: true, smsNotifications: true } }) : []
    await tx.notificationOutbox.createMany({ data: [
      { orbitPersonId: person.id, eventType: isPersonalOrder ? 'KITCHEN_ORDER_PENDING' : 'KITCHEN_TRANSACTION_CREATED', channels: personChannels, payload: notificationPayload },
      ...kitchenManagers.filter(manager => manager.orbitPersonId !== person.id).map(manager => ({ orbitPersonId: manager.orbitPersonId, eventType: 'KITCHEN_ONLINE_ORDER_PLACED', channels: ['IN_APP', ...(manager.emailNotifications ? ['EMAIL'] : []), ...(manager.smsNotifications ? ['SMS'] : [])], payload: notificationPayload }))
    ] })
    return created
  })

  await audit(req, 'TRANSACTION_CREATED', 'KitchenTransaction', transaction.id, undefined, transaction)
  res.status(201).json({ transaction: withReceiptSignature(transaction), balance: await balanceFor(person.id) })
}))

app.get('/api/transactions', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const ownOnly = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  const orbitPersonId = ownOnly ? req.kitchenUser!.orbitPersonId : String(req.query.person || '')
  const from = req.query.from ? new Date(String(req.query.from)) : undefined
  const to = req.query.to ? new Date(String(req.query.to)) : undefined
  const transactions = await prisma.kitchenTransaction.findMany({
    where: {
      ...(orbitPersonId ? { orbitPersonId } : {}),
      ...(from || to ? { createdAt: { gte: from, lte: to } } : {})
    },
    include: { items: true, discounts: true, disputes: true },
    orderBy: { createdAt: 'desc' },
    take: 500
  })
  res.json({ transactions: transactions.map(withReceiptSignature) })
}))

app.post('/api/transactions/:id/confirm-receipt', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const id = routeParam(req, 'id')
  const pending = await prisma.kitchenTransaction.findUnique({ where: { id }, include: { items: true, discounts: true, disputes: true } })
  if (!pending) return res.status(404).json({ message: 'Order not found' })
  if (pending.status !== 'PENDING') return res.status(409).json({ message: 'Only a pending order can be confirmed' })
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (!personal || pending.orbitPersonId !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'Only the customer may confirm receipt of this order' })
  if (pending.confirmedByPersonAt) return res.json({ transaction: withReceiptSignature(pending), awaitingKitchenConfirmation: true })
  const confirmed = await prisma.kitchenTransaction.update({
    where: { id },
    data: { confirmedByPersonAt: new Date() },
    include: { items: true, discounts: true, disputes: true },
  })
  await audit(req, 'ORDER_RECEIPT_AND_PAYMENT_CONFIRMED_BY_CUSTOMER', 'KitchenTransaction', id, pending, confirmed, pending.paymentMode === 'CREDIT' ? 'Customer confirmed receipt of the credited order.' : 'Customer confirmed receipt of the order and handover of payment.')
  res.json({ transaction: withReceiptSignature(confirmed), awaitingKitchenConfirmation: true })
}))

app.post('/api/transactions/:id/deliver', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const id = routeParam(req, 'id')
  const pending = await prisma.kitchenTransaction.findUnique({ where: { id }, include: { items: { include: { product: true } } } })
  if (!pending) return res.status(404).json({ message: 'Order not found' })
  if (pending.status !== 'PENDING') return res.status(409).json({ message: 'Only a pending order can be marked as delivered' })
  if (!pending.confirmedByPersonAt) return res.status(409).json({ message: 'The customer must first confirm actual receipt of the order and, for a purchase, handover of payment' })
  const delivered = await runKitchenSerializableTransaction(async tx => {
    const claim = await tx.kitchenTransaction.updateMany({
      where: { id, status: 'PENDING', confirmedByPersonAt: { not: null }, confirmedByKitchenAt: null },
      data: { confirmedByKitchenAt: new Date() },
    })
    if (claim.count !== 1) throw Object.assign(new Error('This order is already being processed or was already completed'), { statusCode: 409 })
    for (const item of pending.items) {
      if (!item.product.trackInventory) continue
      if (Number(item.product.stockQuantity) < Number(item.quantity)) throw Object.assign(new Error('Insufficient stock for ' + item.productNameSnapshot), { statusCode: 409 })
      await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } })
      await tx.stockMovement.create({ data: { productId: item.productId, type: 'SALE', quantity: new Prisma.Decimal(-Number(item.quantity)), reason: pending.transactionNumber, actor: req.kitchenUser!.orbitPersonId } })
    }
    await tx.kitchenLedgerEntry.createMany({ data: [
      { orbitPersonId: pending.orbitPersonId, type: 'PURCHASE', amount: pending.subtotal, description: 'Consumption ' + pending.transactionNumber, performedBy: req.kitchenUser!.orbitPersonId },
      ...(Number(pending.schoolSubsidy) > 0 ? [{ orbitPersonId: pending.orbitPersonId, type: 'DISCOUNT' as const, amount: new Prisma.Decimal(-Number(pending.schoolSubsidy)), description: 'School subsidy ' + pending.transactionNumber, performedBy: req.kitchenUser!.orbitPersonId }] : []),
      ...(pending.paymentMode !== 'CREDIT' ? [{ orbitPersonId: pending.orbitPersonId, type: 'PAYMENT' as const, amount: new Prisma.Decimal(-Number(pending.total)), description: 'Payment on delivery ' + pending.transactionNumber, performedBy: req.kitchenUser!.orbitPersonId }] : []),
    ] })
    const updated = await tx.kitchenTransaction.update({ where: { id }, data: { status: 'CONFIRMED' }, include: { items: true, discounts: true, disputes: true } })
    const access = await tx.kitchenAccess.findUnique({ where: { orbitPersonId: pending.orbitPersonId } })
    const channels = ['IN_APP', ...(access?.emailNotifications !== false ? ['EMAIL'] : []), ...(access?.smsNotifications !== false ? ['SMS'] : [])]
    await tx.notificationOutbox.create({ data: { orbitPersonId: pending.orbitPersonId, eventType: 'KITCHEN_ORDER_DELIVERED', channels, payload: { transactionNumber: pending.transactionNumber, total: Number(pending.total), paymentMode: pending.paymentMode, deliveredAt: new Date().toISOString() } } })
    return updated
  })
  await audit(req, 'ORDER_DELIVERED_AND_ACCOUNTED', 'KitchenTransaction', id, pending, delivered)
  res.json({ transaction: withReceiptSignature(delivered), balance: await balanceFor(pending.orbitPersonId) })
}))

app.post('/api/transactions/:id/cancel-order', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const id = routeParam(req, 'id')
  const pending = await prisma.kitchenTransaction.findUnique({ where: { id }, include: { items: true, discounts: true } })
  if (!pending) return res.status(404).json({ message: 'Order not found' })
  if (pending.status !== 'PENDING') return res.status(409).json({ message: 'Only a pending order can be cancelled' })
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (personal && pending.orbitPersonId !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'You may only cancel your own pending order' })
  const reason = z.object({ reason: z.string().trim().min(3).max(500).default('Order not received or cancelled before delivery') }).parse(req.body || {}).reason
  const cancelled = await prisma.$transaction(async tx => {
    const claim = await tx.kitchenTransaction.updateMany({ where: { id, status: 'PENDING', confirmedByKitchenAt: null }, data: { status: 'VOIDED', paymentStatus: 'VOIDED', notes: [pending.notes, reason].filter(Boolean).join(' | ') } })
    if (claim.count !== 1) throw Object.assign(new Error('This order is already being processed or was already completed'), { statusCode: 409 })
    const updated = await tx.kitchenTransaction.findUniqueOrThrow({ where: { id }, include: { items: true, discounts: true, disputes: true } })
    const access = await tx.kitchenAccess.findUnique({ where: { orbitPersonId: pending.orbitPersonId } })
    const channels = ['IN_APP', ...(access?.emailNotifications !== false ? ['EMAIL'] : []), ...(access?.smsNotifications !== false ? ['SMS'] : [])]
    await tx.notificationOutbox.create({ data: { orbitPersonId: pending.orbitPersonId, eventType: 'KITCHEN_ORDER_CANCELLED', channels, payload: { transactionNumber: pending.transactionNumber, reason } } })
    return updated
  })
  await audit(req, 'PENDING_ORDER_CANCELLED', 'KitchenTransaction', id, pending, cancelled, reason)
  res.json({ transaction: withReceiptSignature(cancelled), balance: await balanceFor(pending.orbitPersonId) })
}))

app.get('/api/transactions/verify/:reference', asyncRoute(async (req, res) => {
  const reference = routeParam(req, 'reference').trim().toUpperCase()
  const signature = String(req.query.signature || '')
  const expected = receiptSignature(reference)
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(400).json({ valid: false, status: 'INVALID_SIGNATURE' })
  }
  const transaction = await prisma.kitchenTransaction.findUnique({ where: { transactionNumber: reference }, select: { transactionNumber: true, status: true } })
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  if (!transaction) return res.status(404).json({ valid: false, status: 'NOT_FOUND' })
  res.json({ valid: true, documentType: 'KCS_KITCHEN_RECEIPT', reference: transaction.transactionNumber, status: transaction.status })
}))

app.get('/api/transactions/:id', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const transaction = await prisma.kitchenTransaction.findUnique({ where: { id: routeParam(req, 'id') }, include: { items: true, discounts: true, disputes: true, ledgerEntries: true } })
  if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (personal && transaction.orbitPersonId !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'Forbidden' })
  res.json({ transaction: withReceiptSignature(transaction), balance: await balanceFor(transaction.orbitPersonId) })
}))

app.get('/api/people/:orbitPersonId/qr', authenticate, allow('KITCHEN_ADMIN', 'CASHIER'), asyncRoute(async (req, res) => {
  const person = await resolvePerson(routeParam(req, 'orbitPersonId'))
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })
  const payload = Buffer.from(JSON.stringify({ sub: person.id, exp: Date.now() + 365 * 24 * 60 * 60_000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', env.QR_SIGNING_SECRET).update(payload).digest('base64url')
  res.json({ token: payload + '.' + signature })
}))

app.post('/api/qr/resolve', authenticate, allow('KITCHEN_ADMIN', 'CASHIER'), asyncRoute(async (req, res) => {
  const token = z.object({ token: z.string().min(10) }).parse(req.body).token
  const [payload, signature] = token.split('.')
  const expected = crypto.createHmac('sha256', env.QR_SIGNING_SECRET).update(payload || '').digest('base64url')
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(400).json({ message: 'Invalid Kitchen QR' })
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number }
  if (decoded.exp < Date.now()) return res.status(400).json({ message: 'Expired Kitchen QR' })
  const person = await resolvePerson(decoded.sub)
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })
  res.json({ person })
}))

app.post('/api/payments', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    orbitPersonId: z.string().min(1),
    amount: z.coerce.number().positive(),
    method: z.enum(['CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY']),
    reference: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(500).optional()
  }).parse(req.body)
  const person = await resolvePerson(input.orbitPersonId)
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })
  const before = await balanceFor(person.id)
  if (input.amount > before) return res.status(409).json({ message: 'Payment exceeds outstanding balance', balance: before })
  const payment = await prisma.kitchenPayment.create({ data: {
    orbitPersonId: person.id,
    amount: new Prisma.Decimal(input.amount),
    method: input.method,
    reference: input.reference,
    notes: input.notes,
    receivedBy: req.kitchenUser!.orbitPersonId,
    ledgerEntries: { create: {
      orbitPersonId: person.id,
      type: 'PAYMENT',
      amount: new Prisma.Decimal(-input.amount),
      description: 'Kitchen debt payment',
      performedBy: req.kitchenUser!.orbitPersonId
    } }
  } })
  await prisma.notificationOutbox.create({ data: {
    orbitPersonId: person.id,
    eventType: 'KITCHEN_PAYMENT_RECORDED',
    channels: ['IN_APP', 'EMAIL'],
    payload: { paymentId: payment.id, amount: input.amount, method: input.method }
  } })
  await audit(req, 'PAYMENT_RECEIVED', 'KitchenPayment', payment.id, undefined, payment)
  res.status(201).json({ payment, balance: await balanceFor(person.id) })
}))

app.post('/api/transactions/:id/void', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const reason = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body).reason
  const original = await prisma.kitchenTransaction.findUnique({ where: { id: routeParam(req, 'id') }, include: { items: true } })
  if (!original) return res.status(404).json({ message: 'Transaction not found' })
  if (original.status !== 'CONFIRMED') return res.status(409).json({ message: 'Only a confirmed transaction can be voided' })

  const result = await prisma.$transaction(async tx => {
    const counter = await tx.kitchenCounter.upsert({
      where: { name: 'REVERSAL-' + new Date().getUTCFullYear() },
      create: { name: 'REVERSAL-' + new Date().getUTCFullYear(), value: 1 },
      update: { value: { increment: 1 } }
    })
    const number = 'KITCHEN-REV-' + new Date().getUTCFullYear() + '-' + String(counter.value).padStart(6, '0')
    const reversal = await tx.kitchenTransaction.create({ data: {
      transactionNumber: number,
      dailyMenuId: original.dailyMenuId,
      orbitPersonId: original.orbitPersonId,
      personType: original.personType,
      personNameSnapshot: original.personNameSnapshot,
      cashierOrbitPersonId: req.kitchenUser!.orbitPersonId,
      cashierNameSnapshot: req.kitchenUser!.fullName,
      subtotal: new Prisma.Decimal(0),
      discount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
      paymentMode: original.paymentMode,
      paymentStatus: 'VOIDED',
      status: 'REVERSED',
      creditAmount: new Prisma.Decimal(0),
      notes: reason,
      originalTransactionId: original.id,
      ledgerEntries: Number(original.creditAmount) > 0 ? { create: {
        orbitPersonId: original.orbitPersonId,
        type: 'REVERSAL',
        amount: new Prisma.Decimal(-Number(original.total)),
        description: 'Reversal of ' + original.transactionNumber,
        reason,
        performedBy: req.kitchenUser!.orbitPersonId
      } } : undefined
    } })
    await tx.kitchenTransaction.update({ where: { id: original.id }, data: { status: 'VOIDED', paymentStatus: 'VOIDED' } })
    for (const item of original.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } })
      if (!product?.trackInventory) continue
      await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: item.quantity } } })
      await tx.stockMovement.create({ data: {
        productId: product.id,
        type: 'RETURN',
        quantity: item.quantity,
        reason: 'Void ' + original.transactionNumber + ': ' + reason,
        actor: req.kitchenUser!.orbitPersonId
      } })
    }
    return reversal
  })
  await audit(req, 'TRANSACTION_VOIDED', 'KitchenTransaction', original.id, original, result, reason)
  res.json({ reversal: result, balance: await balanceFor(original.orbitPersonId) })
}))

app.post('/api/stock-movements', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    productId: z.string().min(1),
    type: z.enum(['STOCK_IN', 'WASTE', 'EXPIRED', 'DAMAGED', 'LOSS', 'ADJUSTMENT', 'RETURN']),
    quantity: z.coerce.number().positive(),
    reason: z.string().trim().min(3).max(500)
  }).parse(req.body)
  const signed = ['WASTE', 'EXPIRED', 'DAMAGED', 'LOSS'].includes(input.type) ? -input.quantity : input.quantity
  const product = await prisma.product.findUnique({ where: { id: input.productId } })
  if (!product) return res.status(404).json({ message: 'Product not found' })
  if (Number(product.stockQuantity) + signed < 0) return res.status(409).json({ message: 'Stock cannot become negative' })
  const movement = await prisma.$transaction(async tx => {
    await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: signed } } })
    return tx.stockMovement.create({ data: {
      productId: product.id,
      type: input.type,
      quantity: new Prisma.Decimal(signed),
      reason: input.reason,
      actor: req.kitchenUser!.orbitPersonId
    } })
  })
  await audit(req, 'STOCK_CHANGED', 'Product', product.id, { stock: product.stockQuantity }, { movement }, input.reason)
  res.status(201).json({ movement })
}))

app.get('/api/stock-movements', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  const movements = await prisma.stockMovement.findMany({ include: { product: { select: { name: true, unit: true } } }, orderBy: { createdAt: 'desc' }, take: 500 })
  res.json({ movements })
}))

app.post('/api/disputes', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    transactionId: z.string().min(1),
    reason: z.enum(['I_DID_NOT_TAKE_THIS', 'WRONG_ITEM', 'WRONG_QUANTITY', 'WRONG_PRICE', 'WRONG_DATE', 'OTHER']),
    comment: z.string().trim().max(1000).optional()
  }).parse(req.body)
  const transaction = await prisma.kitchenTransaction.findUnique({ where: { id: input.transactionId } })
  if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
  if (!canManage(req.kitchenUser!.role) && transaction.orbitPersonId !== req.kitchenUser!.orbitPersonId) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  const dispute = await prisma.kitchenDispute.create({ data: { ...input, orbitPersonId: transaction.orbitPersonId } })
  const settings = await prisma.kitchenManagerSettings.findUnique({ where: { id: 'primary' } })
  const inbox = await prisma.kitchenManagerInbox.create({ data: {
    kind: 'COMPLAINT', title: `Réclamation Kitchen · ${transaction.transactionNumber}`,
    message: `${transaction.personNameSnapshot} · ${input.reason.replaceAll('_', ' ')}${input.comment ? `\n${input.comment}` : ''}`,
    referenceType: 'KitchenDispute', referenceId: dispute.id,
  } })
  if (settings?.managerOrbitPersonId) await prisma.notificationOutbox.create({ data: {
    orbitPersonId: settings.managerOrbitPersonId,
    eventType: 'KITCHEN_COMPLAINT_OPENED', channels: ['IN_APP', ...(settings.reportEmail ? ['EMAIL'] : [])],
    payload: { title: inbox.title, text: inbox.message, recipientEmail: settings.reportEmail || undefined, inboxId: inbox.id },
  } })
  await audit(req, 'DISPUTE_OPENED', 'KitchenDispute', dispute.id, undefined, dispute)
  res.status(201).json({ dispute })
}))

app.get('/api/disputes', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  const disputes = await prisma.kitchenDispute.findMany({
    where: personal ? { orbitPersonId: req.kitchenUser!.orbitPersonId } : {},
    include: { transaction: { include: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500
  })
  res.json({ disputes })
}))

app.put('/api/disputes/:id', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'REJECTED']),
    resolution: z.string().trim().min(3).max(1000)
  }).parse(req.body)
  const old = await prisma.kitchenDispute.findUniqueOrThrow({ where: { id: routeParam(req, 'id') } })
  const dispute = await prisma.kitchenDispute.update({ where: { id: old.id }, data: {
    ...input,
    resolvedBy: ['RESOLVED', 'REJECTED'].includes(input.status) ? req.kitchenUser!.orbitPersonId : null,
    resolvedAt: ['RESOLVED', 'REJECTED'].includes(input.status) ? new Date() : null
  } })
  await audit(req, 'DISPUTE_RESOLVED', 'KitchenDispute', dispute.id, old, dispute, input.resolution)
  res.json({ dispute })
}))

app.get('/api/ledger/:orbitPersonId', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (personal && routeParam(req, 'orbitPersonId') !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'Forbidden' })
  const from = req.query.from ? new Date(String(req.query.from)) : undefined
  const to = req.query.to ? new Date(String(req.query.to)) : undefined
  const entries = await prisma.kitchenLedgerEntry.findMany({
    where: { orbitPersonId: routeParam(req, 'orbitPersonId'), ...(from || to ? { createdAt: { gte: from, lte: to } } : {}) },
    orderBy: { createdAt: 'asc' }
  })
  const opening = from ? Number((await prisma.kitchenLedgerEntry.aggregate({ where: { orbitPersonId: routeParam(req, 'orbitPersonId'), createdAt: { lt: from } }, _sum: { amount: true } }))._sum.amount || 0) : 0
  const closing = opening + entries.reduce((sum, entry) => sum + Number(entry.amount), 0)
  res.json({ openingBalance: opening, entries, closingBalance: closing })
}))

const issueStatementInput = z.object({
  orbitPersonId: z.string().trim().min(1).max(180).optional(),
  from: z.string().trim().min(1).max(64).optional(),
  to: z.string().trim().min(1).max(64).optional()
})

function statementHttpError(statusCode: number, message: string, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

async function runStatementTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      })
    } catch (error: any) {
      lastError = error
      if (error?.code !== 'P2034' || attempt === 2) throw error
    }
  }
  throw lastError
}

app.post('/api/statements/issue', authenticate, statementIssueLimiter, asyncRoute(async (req: AuthRequest, res) => {
  const input = issueStatementInput.parse(req.body ?? {})
  const requester = req.kitchenUser!
  const requestedOrbitPersonId = (input.orbitPersonId || requester.orbitPersonId).trim()
  let person: Awaited<ReturnType<typeof resolvePerson>>
  try { person = await resolvePerson(requestedOrbitPersonId, true) }
  catch {
    try { person = await resolvePerson(requestedOrbitPersonId) }
    catch { throw statementHttpError(503, 'The official Orbit identity registry is temporarily unavailable', 'ORBIT_IDENTITY_UNAVAILABLE') }
  }
  if (!person || person.id.toLowerCase() !== requestedOrbitPersonId.toLowerCase()) {
    return res.status(404).json({ message: 'Active Orbit identity not found' })
  }
  if (!canIssueStatement(requester, person.id)) {
    return res.status(403).json({ message: 'Only the account owner or a Kitchen administrator may issue this statement' })
  }
  if (!person.fullName.trim()) {
    throw statementHttpError(409, 'The official Orbit identity is incomplete', 'STATEMENT_IDENTITY_INCOMPLETE')
  }

  const issuedAt = new Date()
  let period: ReturnType<typeof resolveStatementPeriod>
  try {
    period = resolveStatementPeriod({ from: input.from, to: input.to }, issuedAt)
  } catch (error) {
    throw statementHttpError(
      400,
      error instanceof Error ? error.message : 'Invalid statement period',
      'INVALID_STATEMENT_PERIOD'
    )
  }

  const holder = {
    orbitPersonId: person.id,
    displayId: person.displayId?.trim() || null,
    fullName: person.fullName.trim(),
    email: person.email?.trim() || null,
    kind: person.kind
  }
  const documentId = createStatementDocumentId(issuedAt)
  const record = await runStatementTransaction(async tx => {
    const [entries, openingGroups] = await Promise.all([
      tx.kitchenLedgerEntry.findMany({
        where: {
          orbitPersonId: person.id,
          createdAt: { gte: period.from, lt: period.toExclusive }
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: KITCHEN_STATEMENT_MAX_ENTRIES + 1
      }),
      tx.kitchenLedgerEntry.groupBy({
        by: ['currency'],
        where: { orbitPersonId: person.id, createdAt: { lt: period.from } },
        _sum: { amount: true }
      })
    ])
    if (entries.length > KITCHEN_STATEMENT_MAX_ENTRIES) {
      throw statementHttpError(
        422,
        `A statement cannot contain more than ${KITCHEN_STATEMENT_MAX_ENTRIES} ledger entries`,
        'STATEMENT_TOO_LARGE'
      )
    }

    const observedCurrencies = new Set([
      ...openingGroups.map(row => row.currency.trim().toUpperCase()),
      ...entries.map(entry => entry.currency.trim().toUpperCase())
    ])
    if ([...observedCurrencies].some(currency => currency !== KITCHEN_STATEMENT_CURRENCY)) {
      throw statementHttpError(
        409,
        'Mixed or non-CDF ledger entries must be corrected before issuing an official statement',
        'STATEMENT_MIXED_CURRENCY'
      )
    }

    const openingBalance = openingGroups.reduce(
      (total, row) => total.plus(row._sum.amount ?? 0),
      new Prisma.Decimal(0)
    )
    const closingBalance = entries.reduce(
      (total, entry) => total.plus(entry.amount),
      openingBalance
    )
    const artifact = buildStatementArtifact({
      documentId,
      holder,
      issuedBy: requester.orbitPersonId,
      issuedAt,
      periodFrom: period.from,
      periodToExclusive: period.toExclusive,
      expiresAt: null,
      currency: KITCHEN_STATEMENT_CURRENCY,
      openingBalance: openingBalance.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
      entries: entries.map(entry => ({
        id: entry.id,
        transactionId: entry.transactionId,
        paymentId: entry.paymentId,
        type: entry.type,
        amount: entry.amount.toFixed(2),
        currency: KITCHEN_STATEMENT_CURRENCY,
        description: entry.description,
        reason: entry.reason,
        performedBy: entry.performedBy,
        createdAt: entry.createdAt.toISOString()
      }))
    }, statementSigningKey)
    const deduplicationKey = createStatementDeduplicationKey(
      person.id,
      period.from,
      period.toExclusive,
      artifact.payloadHash
    )

    const statement = await tx.kitchenStatementVerification.upsert({
      where: { deduplicationKey },
      create: {
        documentId,
        deduplicationKey,
        orbitPersonId: person.id,
        issuedBy: requester.orbitPersonId,
        issuedAt,
        periodFrom: period.from,
        periodTo: period.toExclusive,
        expiresAt: null,
        keyId: statementSigningKey.keyId,
        currency: KITCHEN_STATEMENT_CURRENCY,
        openingBalance,
        closingBalance,
        entryCount: entries.length,
        entriesHash: artifact.entriesHash,
        canonicalPayload: artifact.canonicalPayload,
        payloadHash: artifact.payloadHash,
        signature: artifact.signature,
        version: artifact.payload.version
      },
      update: {}
    })
    const reused = statement.documentId !== documentId
    if (!reused) {
      await tx.auditLog.create({
        data: {
          actorId: requester.orbitPersonId,
          actorRole: requester.role,
          action: 'STATEMENT_ISSUED',
          entityType: 'KitchenStatementVerification',
          entityId: statement.id,
          newValue: {
            documentId,
            orbitPersonId: person.id,
            periodFrom: period.from.toISOString(),
            periodToExclusive: period.toExclusive.toISOString(),
            currency: KITCHEN_STATEMENT_CURRENCY,
            entryCount: entries.length,
            payloadHash: artifact.payloadHash,
            keyId: statementSigningKey.keyId
          },
          ipAddress: req.ip
        }
      })
    }
    return { statement, reused }
  })

  const verification = verifyStoredStatement(
    record.statement,
    record.statement.signature,
    statementVerificationKeys,
    issuedAt
  )
  if (!verification.valid) {
    throw statementHttpError(409, 'The stored statement proof could not be verified', 'STATEMENT_PROOF_INVALID')
  }
  const payload = verification.payload
  res.status(record.reused ? 200 : 201).json({
    statement: {
      documentId: payload.documentId,
      issuer: payload.issuer,
      application: payload.application,
      holder: payload.holder,
      issuedAt: payload.issuedAt,
      periodFrom: payload.periodFrom,
      periodToExclusive: payload.periodToExclusive,
      currency: payload.currency,
      openingBalance: payload.openingBalance,
      closingBalance: payload.closingBalance,
      entryCount: payload.entryCount,
      entries: payload.entries,
      payloadHash: payload.payloadHash,
      keyId: payload.keyId,
      version: payload.version,
      signature: record.statement.signature,
      reused: record.reused
    }
  })
}))

app.get('/api/statements/verify/:documentId', statementVerificationLimiter, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  const documentId = z.string()
    .regex(/^KCS-KIT-STMT-\d{8}-[A-F0-9]{24}$/)
    .parse(routeParam(req, 'documentId'))
  const signature = z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(req.query.signature)
  const statement = await prisma.kitchenStatementVerification.findUnique({ where: { documentId } })
  if (!statement) return res.status(404).json({ valid: false, status: 'NOT_FOUND', documentId })

  const verification = verifyStoredStatement(statement, signature, statementVerificationKeys)
  if (!verification.valid) {
    return res.json({ valid: false, status: verification.status, documentId })
  }
  const payload = verification.payload
  res.json({
    valid: true,
    status: verification.status,
    document: {
      documentId: payload.documentId,
      issuer: payload.issuer,
      application: payload.application,
      issuedAt: payload.issuedAt,
      periodFrom: payload.periodFrom,
      periodToExclusive: payload.periodToExclusive,
      currency: payload.currency,
      entryCount: payload.entryCount,
      payloadHash: payload.payloadHash,
      keyId: payload.keyId,
      version: payload.version
    }
  })
}))

app.get('/api/statements/verify/:documentId/details', authenticate, statementVerificationLimiter, asyncRoute(async (req: AuthRequest, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  const documentId = z.string()
    .regex(/^KCS-KIT-STMT-\d{8}-[A-F0-9]{24}$/)
    .parse(routeParam(req, 'documentId'))
  const signature = z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(req.query.signature)
  const statement = await prisma.kitchenStatementVerification.findUnique({ where: { documentId } })
  if (!statement) return res.status(404).json({ valid: false, status: 'NOT_FOUND', documentId })
  const verification = verifyStoredStatement(statement, signature, statementVerificationKeys)
  if (!verification.valid) return res.json({ valid: false, status: verification.status, documentId })
  const payload = verification.payload
  if (!canIssueStatement(req.kitchenUser!, payload.holder.orbitPersonId)) {
    return res.status(403).json({ message: 'Only the account owner or a Kitchen administrator may view statement details' })
  }
  res.json({
    valid: true,
    status: verification.status,
    details: {
      holder: {
        fullName: payload.holder.fullName,
        displayId: payload.holder.displayId,
        kind: payload.holder.kind
      },
      currency: payload.currency,
      openingBalance: payload.openingBalance,
      closingBalance: payload.closingBalance
    }
  })
}))

app.get('/api/dashboard', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (personal) {
    const orbitPersonId = req.kitchenUser!.orbitPersonId
    const [today, month, disputes, notifications] = await Promise.all([
      prisma.kitchenTransaction.aggregate({ where: { orbitPersonId, status: 'CONFIRMED', createdAt: { gte: start } }, _sum: { total: true }, _count: true }),
      prisma.kitchenTransaction.aggregate({ where: { orbitPersonId, status: 'CONFIRMED', createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, _sum: { total: true }, _count: true }),
      prisma.kitchenDispute.count({ where: { orbitPersonId, status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.notificationOutbox.findMany({ where: { orbitPersonId }, orderBy: { createdAt: 'desc' }, take: 20 })
    ])
    return res.json({ mode: 'personal', today, month, balance: await balanceFor(orbitPersonId), disputes, notifications })
  }

  const [today, credit, outstanding, payments, discounts, schoolSubsidies, disputes, lowStock, unavailable, cashiers, popular, notifications] = await Promise.all([
    prisma.kitchenTransaction.aggregate({ where: { status: 'CONFIRMED', createdAt: { gte: start } }, _sum: { total: true }, _count: true }),
    prisma.kitchenTransaction.aggregate({ where: { status: 'CONFIRMED', paymentMode: 'CREDIT', createdAt: { gte: start } }, _sum: { total: true } }),
    prisma.kitchenLedgerEntry.aggregate({ _sum: { amount: true } }),
    prisma.kitchenPayment.aggregate({ where: { createdAt: { gte: start } }, _sum: { amount: true } }),
    prisma.discountApplication.aggregate({ where: { createdAt: { gte: start } }, _sum: { discountAmount: true } }),
    prisma.kitchenTransaction.aggregate({ where: { status: 'CONFIRMED', schoolSubsidy: { gt: 0 } }, _sum: { schoolSubsidy: true } }),
    prisma.kitchenDispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.product.findMany({ where: { trackInventory: true, archivedAt: null }, select: { id: true, name: true, stockQuantity: true, reorderLevel: true, unit: true } }).then(rows => rows.filter(row => Number(row.stockQuantity) <= Number(row.reorderLevel))),
    prisma.product.count({ where: { isAvailable: false } }),
    prisma.kitchenAccess.count({ where: { role: 'CASHIER', isActive: true } }),
    prisma.kitchenTransactionItem.groupBy({ by: ['productId', 'productNameSnapshot'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    prisma.notificationOutbox.findMany({ where: { orbitPersonId: req.kitchenUser!.orbitPersonId }, orderBy: { createdAt: 'desc' }, take: 20 })
  ])
  res.json({ mode: 'operations', today, credit, outstanding: outstanding._sum.amount || 0, payments, discounts, schoolSubsidies, disputes, lowStock: lowStock.length, lowStockItems: lowStock, unavailable, cashiers, popular, notifications })
}))

app.get('/api/pos/overview', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [todayRows, monthRows, ledgerRows, people] = await Promise.all([
    prisma.kitchenTransaction.groupBy({ by: ['personType'], where: { status: 'CONFIRMED', createdAt: { gte: todayStart } }, _sum: { total: true }, _count: true }),
    prisma.kitchenTransaction.groupBy({ by: ['personType'], where: { status: 'CONFIRMED', createdAt: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.kitchenLedgerEntry.groupBy({ by: ['orbitPersonId'], _sum: { amount: true } }),
    loadDirectory(),
  ])
  const summarize = (rows: typeof todayRows) => rows.reduce((summary, row) => {
    const group = row.personType === 'STUDENT' ? summary.students : summary.others
    group.amount += Number(row._sum.total || 0)
    group.count += row._count
    return summary
  }, { students: { amount: 0, count: 0 }, others: { amount: 0, count: 0 } })
  const peopleById = new Map(people.map(person => [person.id, person]))
  const debts = ledgerRows.reduce((summary, row) => {
    const amount = Number(row._sum.amount || 0)
    if (amount <= 0.005) return summary
    const group = peopleById.get(row.orbitPersonId)?.kind === 'STUDENT' ? summary.students : summary.others
    group.amount += amount
    group.count += 1
    return summary
  }, { students: { amount: 0, count: 0 }, others: { amount: 0, count: 0 } })
  res.setHeader('Cache-Control', 'no-store')
  res.json({ generatedAt: now.toISOString(), today: summarize(todayRows), month: summarize(monthRows), debts })
}))

app.get('/api/reports/monthly/:orbitPersonId', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (personal && routeParam(req, 'orbitPersonId') !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'Forbidden' })
  const year = z.coerce.number().int().min(2020).max(2100).parse(req.query.year)
  const month = z.coerce.number().int().min(1).max(12).parse(req.query.month)
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 1))
  const entries = await prisma.kitchenLedgerEntry.findMany({ where: { orbitPersonId: routeParam(req, 'orbitPersonId'), createdAt: { gte: from, lt: to } }, orderBy: { createdAt: 'asc' } })
  const opening = Number((await prisma.kitchenLedgerEntry.aggregate({ where: { orbitPersonId: routeParam(req, 'orbitPersonId'), createdAt: { lt: from } }, _sum: { amount: true } }))._sum.amount || 0)
  const sumType = (type: string) => entries.filter(entry => entry.type === type).reduce((sum, entry) => sum + Number(entry.amount), 0)
  res.json({
    title: 'KCS KITCHEN MONTHLY STATEMENT',
    year,
    month,
    openingBalance: opening,
    purchases: sumType('PURCHASE'),
    discounts: sumType('DISCOUNT'),
    adjustments: sumType('ADJUSTMENT') + sumType('REVERSAL') + sumType('REFUND'),
    payments: sumType('PAYMENT'),
    closingBalance: opening + entries.reduce((sum, entry) => sum + Number(entry.amount), 0),
    entries
  })
}))

function csvCell(value: unknown) {
  const raw = String(value ?? '')
  const safe = /^[=+\-@]/.test(raw) ? "'" + raw : raw
  return '"' + safe.replace(/"/g, '""') + '"'
}

app.get('/api/reports/transactions.csv', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60_000)
  const to = req.query.to ? new Date(String(req.query.to)) : new Date()
  const rows = await prisma.kitchenTransaction.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' } })
  const header = ['Transaction', 'Date', 'Person', 'Cashier', 'Subtotal', 'Eligible subtotal', 'School subsidy', 'Customer payable', 'Mode', 'Status']
  const csv = [header, ...rows.map(row => [row.transactionNumber, row.createdAt.toISOString(), row.personNameSnapshot, row.cashierNameSnapshot, row.subtotal, row.eligibleSubtotal, row.schoolSubsidy, row.total, row.paymentMode, row.status])]
    .map(row => row.map(csvCell).join(',')).join('\r\n')
  res.setHeader('content-type', 'text/csv; charset=utf-8')
  res.setHeader('content-disposition', 'attachment; filename="kcs-kitchen-transactions.csv"')
  res.send('\ufeff' + csv)
}))

const transactionReportInput = z.object({
  from: z.string().trim().min(1).max(64).optional(),
  to: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['CONFIRMED', 'VOIDED', 'REVERSED', 'REFUNDED']).nullable().optional(),
  paymentMode: z.enum(['CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY', 'CREDIT']).nullable().optional()
}).strict()

app.post('/api/reports/transactions/issue', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), statementIssueLimiter, asyncRoute(async (req: AuthRequest, res) => {
  const input = transactionReportInput.parse(req.body ?? {})
  const issuedAt = new Date()
  let period: ReturnType<typeof resolveStatementPeriod>
  try {
    period = resolveStatementPeriod({ from: input.from, to: input.to }, issuedAt)
  } catch (error) {
    throw statementHttpError(
      400,
      error instanceof Error ? error.message : 'Invalid transaction register period',
      'INVALID_TRANSACTION_REGISTER_PERIOD'
    )
  }
  const filters: TransactionReportFilters = {
    status: input.status || null,
    paymentMode: input.paymentMode || null
  }
  const where: Prisma.KitchenTransactionWhereInput = {
    createdAt: { gte: period.from, lt: period.toExclusive },
    ...(filters.status ? { status: filters.status as any } : {}),
    ...(filters.paymentMode ? { paymentMode: filters.paymentMode as any } : {})
  }
  const sourceRows = await prisma.kitchenTransaction.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: KITCHEN_TRANSACTION_REPORT_MAX_ROWS + 1
  })
  if (sourceRows.length > KITCHEN_TRANSACTION_REPORT_MAX_ROWS) {
    throw statementHttpError(
      422,
      `A transaction register cannot contain more than ${KITCHEN_TRANSACTION_REPORT_MAX_ROWS} rows`,
      'TRANSACTION_REGISTER_TOO_LARGE'
    )
  }
  const currencies = new Set(sourceRows.map(row => row.currency.trim().toUpperCase()))
  if ([...currencies].some(currency => currency !== KITCHEN_STATEMENT_CURRENCY)) {
    throw statementHttpError(
      409,
      'Mixed or non-CDF transactions must be corrected before issuing an official register',
      'TRANSACTION_REGISTER_MIXED_CURRENCY'
    )
  }

  const rows: TransactionReportRowSnapshot[] = sourceRows.map(row => ({
    id: row.id,
    transactionNumber: row.transactionNumber,
    createdAt: row.createdAt.toISOString(),
    personName: row.personNameSnapshot,
    cashierName: row.cashierNameSnapshot,
    subtotal: row.subtotal.toFixed(2),
    discount: row.discount.toFixed(2),
    total: row.total.toFixed(2),
    currency: KITCHEN_STATEMENT_CURRENCY,
    paymentMode: row.paymentMode,
    paymentStatus: row.paymentStatus,
    status: row.status
  }))
  const confirmedRows = sourceRows.filter(row => row.status === 'CONFIRMED')
  const confirmedSubtotal = confirmedRows.reduce((sum, row) => sum.plus(row.subtotal), new Prisma.Decimal(0))
  const confirmedDiscount = confirmedRows.reduce((sum, row) => sum.plus(row.discount), new Prisma.Decimal(0))
  const confirmedTotal = confirmedRows.reduce((sum, row) => sum.plus(row.total), new Prisma.Decimal(0))
  const voidedCount = sourceRows.length - confirmedRows.length
  const documentId = createTransactionReportDocumentId(issuedAt)
  const artifact = buildTransactionReportArtifact({
    documentId,
    issuedBy: req.kitchenUser!.orbitPersonId,
    issuedAt,
    periodFrom: period.from,
    periodToExclusive: period.toExclusive,
    filters,
    currency: KITCHEN_STATEMENT_CURRENCY,
    confirmedSubtotal: confirmedSubtotal.toFixed(2),
    confirmedDiscount: confirmedDiscount.toFixed(2),
    confirmedTotal: confirmedTotal.toFixed(2),
    voidedCount,
    rows
  }, statementSigningKey)
  const deduplicationKey = createTransactionReportDeduplicationKey(
    period.from,
    period.toExclusive,
    filters,
    artifact.rowsHash
  )

  const proof = await runStatementTransaction(async tx => {
    const stored = await tx.kitchenTransactionReportVerification.upsert({
      where: { deduplicationKey },
      create: {
        documentId,
        deduplicationKey,
        issuedBy: req.kitchenUser!.orbitPersonId,
        issuedAt,
        periodFrom: period.from,
        periodTo: period.toExclusive,
        statusFilter: filters.status,
        paymentModeFilter: filters.paymentMode,
        currency: KITCHEN_STATEMENT_CURRENCY,
        transactionCount: rows.length,
        confirmedSubtotal,
        confirmedDiscount,
        confirmedTotal,
        voidedCount,
        rowsHash: artifact.rowsHash,
        canonicalPayload: artifact.canonicalPayload,
        payloadHash: artifact.payloadHash,
        signature: artifact.signature,
        keyId: statementSigningKey.keyId,
        version: artifact.payload.version
      },
      update: {}
    })
    if (stored.documentId === documentId) {
      await tx.auditLog.create({
        data: {
          actorId: req.kitchenUser!.orbitPersonId,
          actorRole: req.kitchenUser!.role,
          action: 'TRANSACTION_REGISTER_ISSUED',
          entityType: 'KitchenTransactionReportVerification',
          entityId: stored.id,
          newValue: {
            documentId,
            periodFrom: period.from.toISOString(),
            periodToExclusive: period.toExclusive.toISOString(),
            filters,
            transactionCount: rows.length,
            payloadHash: artifact.payloadHash
          },
          ipAddress: req.ip
        }
      })
    }
    return stored
  })
  const verification = verifyStoredTransactionReport(proof, proof.signature, statementVerificationKeys)
  if (!verification.valid) {
    throw statementHttpError(409, 'The stored transaction-register proof could not be verified', 'TRANSACTION_REGISTER_PROOF_INVALID')
  }
  const payload = verification.payload
  res.status(proof.documentId === documentId ? 201 : 200).json({
    report: {
      ...payload,
      signature: proof.signature,
      rows
    }
  })
}))

app.get('/api/reports/transactions/verify/:documentId', statementVerificationLimiter, asyncRoute(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  const documentId = z.string().regex(/^KCS-KIT-REG-\d{8}-[A-F0-9]{24}$/).parse(routeParam(req, 'documentId'))
  const signature = z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(req.query.signature)
  const proof = await prisma.kitchenTransactionReportVerification.findUnique({ where: { documentId } })
  if (!proof) return res.status(404).json({ valid: false, status: 'NOT_FOUND', documentId })
  const verification = verifyStoredTransactionReport(proof, signature, statementVerificationKeys)
  if (!verification.valid) return res.json({ valid: false, status: verification.status, documentId })
  const payload = verification.payload
  res.json({
    valid: true,
    status: verification.status,
    document: {
      documentId: payload.documentId,
      issuer: payload.issuer,
      application: payload.application,
      issuedAt: payload.issuedAt,
      periodFrom: payload.periodFrom,
      periodToExclusive: payload.periodToExclusive,
      filters: payload.filters,
      currency: payload.currency,
      transactionCount: payload.transactionCount,
      confirmedTotal: payload.confirmedTotal,
      voidedCount: payload.voidedCount,
      payloadHash: payload.payloadHash,
      keyId: payload.keyId,
      version: payload.version
    }
  })
}))

app.get('/api/periods', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (req, res) => {
  const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true'
  const periods = await prisma.accountingPeriod.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  })
  res.json({ periods })
}))

app.put('/api/periods/:year/:month', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const year = z.coerce.number().int().min(2020).max(2100).parse(req.params.year)
  const month = z.coerce.number().int().min(1).max(12).parse(req.params.month)
  const input = z.object({
    status: z.enum(['OPEN', 'REVIEW', 'CLOSED']),
    reason: z.string().trim().min(5).max(500)
  }).strict().parse(req.body)
  const old = await prisma.accountingPeriod.findUnique({ where: { year_month: { year, month } } })
  if (old?.archivedAt) return res.status(409).json({ message: 'Restore this archived period before modifying it' })
  if (old?.status === 'CLOSED' && input.status !== 'CLOSED') {
    return res.status(409).json({ message: 'A closed period cannot be reopened through the standard workflow' })
  }
  const actor = req.kitchenUser!.orbitPersonId
  const now = new Date()
  const period = await prisma.accountingPeriod.upsert({
    where: { year_month: { year, month } },
    create: {
      year,
      month,
      status: input.status,
      reviewedBy: input.status === 'REVIEW' ? actor : undefined,
      reviewedAt: input.status === 'REVIEW' ? now : undefined,
      closedBy: input.status === 'CLOSED' ? actor : undefined,
      closedAt: input.status === 'CLOSED' ? now : undefined
    },
    update: {
      status: input.status,
      reviewedBy: input.status === 'REVIEW' ? actor : input.status === 'OPEN' ? null : undefined,
      reviewedAt: input.status === 'REVIEW' ? now : input.status === 'OPEN' ? null : undefined,
      closedBy: input.status === 'CLOSED' ? actor : undefined,
      closedAt: input.status === 'CLOSED' ? now : undefined
    }
  })
  await audit(
    req,
    input.status === 'CLOSED' ? 'MONTH_CLOSED' : old ? 'MONTH_STATUS_CHANGED' : 'ACCOUNTING_PERIOD_CREATED',
    'AccountingPeriod',
    period.id,
    old,
    period,
    input.reason
  )
  res.json({ period })
}))

app.delete('/api/periods/:id', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const id = z.string().trim().min(1).max(100).parse(routeParam(req, 'id'))
  const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).strict().parse(req.body)
  const old = await prisma.accountingPeriod.findUnique({ where: { id } })
  if (!old) return res.status(404).json({ message: 'Accounting period not found' })
  if (old.archivedAt) return res.json({ period: old, alreadyArchived: true })
  const period = await prisma.accountingPeriod.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archivedBy: req.kitchenUser!.orbitPersonId,
      archiveReason: reason
    }
  })
  await audit(req, 'ACCOUNTING_PERIOD_ARCHIVED', 'AccountingPeriod', id, old, period, reason)
  res.json({ period })
}))

app.post('/api/periods/:id/restore', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const id = z.string().trim().min(1).max(100).parse(routeParam(req, 'id'))
  const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).strict().parse(req.body)
  const old = await prisma.accountingPeriod.findUnique({ where: { id } })
  if (!old) return res.status(404).json({ message: 'Accounting period not found' })
  if (!old.archivedAt) return res.json({ period: old, alreadyActive: true })
  const period = await prisma.accountingPeriod.update({
    where: { id },
    data: { archivedAt: null, archivedBy: null, archiveReason: null }
  })
  await audit(req, 'ACCOUNTING_PERIOD_RESTORED', 'AccountingPeriod', id, old, period, reason)
  res.json({ period })
}))

app.post('/api/notifications/retry', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const result = await processNotificationOutbox(100)
  await audit(req, 'NOTIFICATION_RETRY', 'NotificationOutbox', 'batch', undefined, result)
  res.json(result)
}))

app.get('/api/manager-settings', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (_req, res) => {
  const settings = await prisma.kitchenManagerSettings.upsert({ where: { id: 'primary' }, create: { id: 'primary' }, update: {} })
  res.json({ settings })
}))

app.put('/api/manager-settings', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const access = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId: req.kitchenUser!.orbitPersonId } })
  if (!canManageOwnKitchenCredentials({
    userId: req.kitchenUser!.userId,
    orbitPersonId: req.kitchenUser!.orbitPersonId,
    explicitKitchenAdmin: Boolean(access?.isActive && access.role === 'KITCHEN_ADMIN'),
  })) return res.status(403).json({ message: 'Only the explicitly assigned Kitchen manager may configure report delivery.' })
  const input = z.object({
    reportEmail: z.string().trim().email().max(254),
    dailyReportEnabled: z.boolean(),
    dailyReportHour: z.coerce.number().int().min(0).max(23),
  }).parse(req.body)
  const previous = await prisma.kitchenManagerSettings.findUnique({ where: { id: 'primary' } })
  const settings = await prisma.kitchenManagerSettings.upsert({
    where: { id: 'primary' },
    create: { id: 'primary', ...input, managerOrbitPersonId: req.kitchenUser!.orbitPersonId, updatedBy: req.kitchenUser!.orbitPersonId },
    update: { ...input, managerOrbitPersonId: req.kitchenUser!.orbitPersonId, updatedBy: req.kitchenUser!.orbitPersonId },
  })
  await audit(req, 'KITCHEN_MANAGER_SETTINGS_UPDATED', 'KitchenManagerSettings', settings.id, previous, settings)
  res.json({ settings })
}))

app.get('/api/cashier-account', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (_req, res) => {
  const account = await prisma.kitchenCashierAccount.findUnique({
    where: { id: 'primary' },
    select: { id: true, fullName: true, email: true, isActive: true, lastLoginAt: true, updatedAt: true }
  })
  res.json({ account })
}))

app.put('/api/cashier-account', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180).transform(value => value.toLowerCase()),
    password: z.string().min(14).max(128),
    isActive: z.boolean().default(true),
  }).parse(req.body)
  const previous = await prisma.kitchenCashierAccount.findUnique({ where: { id: 'primary' } })
  const account = await prisma.kitchenCashierAccount.upsert({
    where: { id: 'primary' },
    create: { id: 'primary', fullName: input.fullName, email: input.email, passwordHash: hashLocalPassword(input.password), isActive: input.isActive, updatedBy: req.kitchenUser!.orbitPersonId },
    update: { fullName: input.fullName, email: input.email, passwordHash: hashLocalPassword(input.password), isActive: input.isActive, updatedBy: req.kitchenUser!.orbitPersonId },
    select: { id: true, fullName: true, email: true, isActive: true, lastLoginAt: true, updatedAt: true }
  })
  await audit(req, previous ? 'KITCHEN_CASHIER_CREDENTIALS_RESET' : 'KITCHEN_CASHIER_ACCOUNT_CREATED', 'KitchenCashierAccount', account.id, previous ? { email: previous.email, isActive: previous.isActive } : undefined, { email: account.email, isActive: account.isActive })
  res.json({ account })
}))

app.get('/api/manager-inbox', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req, res) => {
  const query = String(req.query.q || '').trim()
  const kind = z.enum(['DAILY_REPORT', 'COMPLAINT', 'SYSTEM']).optional().parse(req.query.kind || undefined)
  const items = await prisma.kitchenManagerInbox.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(query ? { OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { message: { contains: query, mode: 'insensitive' } },
        { referenceId: { contains: query, mode: 'insensitive' } },
      ] } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 500,
    select: { id: true, kind: true, title: true, message: true, referenceType: true, referenceId: true, reportDate: true, attachmentName: true, emailedAt: true, readAt: true, createdAt: true },
  })
  res.json({ items })
}))

app.get('/api/manager-inbox/:id/attachment', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req, res) => {
  const item = await prisma.kitchenManagerInbox.findUnique({ where: { id: routeParam(req, 'id') } })
  if (!item?.attachmentBase64 || !item.attachmentName) return res.status(404).json({ message: 'Attachment not found' })
  res.setHeader('content-type', 'application/pdf')
  res.setHeader('content-disposition', `attachment; filename="${item.attachmentName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
  res.send(Buffer.from(item.attachmentBase64, 'base64'))
}))

app.post('/api/manager-inbox/:id/read', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req, res) => {
  const item = await prisma.kitchenManagerInbox.update({ where: { id: routeParam(req, 'id') }, data: { readAt: new Date() } })
  res.json({ item })
}))

app.post('/api/reports/daily/send', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const access = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId: req.kitchenUser!.orbitPersonId } })
  if (!canManageOwnKitchenCredentials({
    userId: req.kitchenUser!.userId,
    orbitPersonId: req.kitchenUser!.orbitPersonId,
    explicitKitchenAdmin: Boolean(access?.isActive && access.role === 'KITCHEN_ADMIN'),
  })) return res.status(403).json({ message: 'Only the explicitly assigned Kitchen manager may send the official daily report.' })
  const result = await queueDailyKitchenReport(prisma, true)
  await audit(req, 'KITCHEN_DAILY_REPORT_QUEUED', 'KitchenManagerInbox', result.inboxId || 'none', undefined, result)
  res.json(result)
}))

app.get('/api/audit', authenticate, allow('KITCHEN_ADMIN', 'AUDITOR'), asyncRoute(async (req, res) => {
  const q = String(req.query.q || '')
  const logs = await prisma.auditLog.findMany({
    where: q ? { OR: [{ actorId: { contains: q, mode: 'insensitive' } }, { action: { contains: q, mode: 'insensitive' } }, { entityId: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 1000
  })
  res.json({ logs })
}))

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', fields: error.flatten().fieldErrors })
  if (error?.code === 'P2025') return res.status(404).json({ message: 'Record not found' })
  const status = Number(error?.statusCode || 500)
  if (status >= 500) console.error(error)
  res.status(status).json({
    message: status >= 500 ? 'KCS Kitchen could not complete this request' : error.message,
    ...(status < 500 && typeof error?.code === 'string' ? { code: error.code } : {})
  })
})

export { app }
