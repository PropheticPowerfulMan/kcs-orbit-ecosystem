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
import { calculateDiscount } from './discount.js'
import { loadDirectory, resolvePerson } from './directory.js'
import { compareClassNames, normalizeClassName } from './class-name.js'
import { processNotificationOutbox } from './notifications.js'
import { procurementRouter } from './procurement.js'
import { getUsdCdfRate } from './exchange-rate.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(cors({ origin: env.FRONTEND_URL, credentials: false }))
app.use(express.json({ limit: '250kb' }))
app.use(morgan('combined'))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }))

const asyncRoute = (handler: (req: any, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void handler(req, res, next).catch(next)

function routeParam(req: Request, name: string) { return String(req.params[name] || '') }

function personTypeFrom(kind: string): PersonType {
  if (kind === 'STUDENT') return 'STUDENT'
  if (kind === 'TEACHER') return 'TEACHER'
  if (kind === 'STAFF') return 'STAFF'
  return 'OTHER'
}

function defaultRole(nexusRole: string, personType: PersonType): KitchenRole {
  if (nexusRole.toLowerCase() === 'admin') return 'KITCHEN_ADMIN'
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
    password: z.string().min(1).max(200)
  }).parse(req.body)

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
  if (access && !access.isActive) return res.status(403).json({ message: 'KCS Kitchen access is disabled' })

  const identity: KitchenIdentity = {
    userId: String(nexusUser.id),
    orbitPersonId,
    fullName: person?.fullName || [nexusUser.lastName, nexusUser.firstName].filter(Boolean).join(' ') || 'KCS Administrator',
    email: person?.email || nexusUser.email || null,
    personType: access?.personType || type,
    role: access?.role || defaultRole(String(nexusUser.role), type),
    hasOfficialPhoto: Boolean(person?.photoData)
  }
  res.json({ token: signSession(identity), user: identity })
}))

app.get('/api/me', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const balance = await balanceFor(req.kitchenUser!.orbitPersonId)
  res.json({ user: req.kitchenUser, balance })
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
    creditLimit: z.coerce.number().positive().optional().nullable()
  }).parse(req.body)
  const access = await prisma.kitchenAccess.upsert({
    where: { orbitPersonId: person.id },
    create: { orbitPersonId: person.id, personType: personTypeFrom(person.kind), createdBy: req.kitchenUser!.orbitPersonId, ...data },
    update: data
  })
  await audit(req, 'ACCESS_UPDATED', 'KitchenAccess', access.id, undefined, access)
  res.json({ access })
}))

const kitchenDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const menuDate = (value: string) => new Date(`${value}T00:00:00.000Z`)

app.get('/api/daily-menus/today', authenticate, asyncRoute(async (_req, res) => {
  const key = kitchenDateKey()
  const menu = await prisma.dailyMenu.findUnique({ where: { menuDate: menuDate(key) }, include: { items: { where: { isAvailable: true }, include: { product: true }, orderBy: { displayOrder: 'asc' } } } })
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
const dailyMenuSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional().nullable(), productIds: z.array(z.string().min(1)).min(1).max(80), publish: z.boolean().default(false) })
const auditJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

app.post('/api/daily-menus', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const input = dailyMenuSchema.parse(req.body)
  const ids = [...new Set(input.productIds)]
  const products = await prisma.product.findMany({ where: { id: { in: ids }, archivedAt: null, isAvailable: true } })
  if (products.length !== ids.length) return res.status(409).json({ message: 'Every menu item must be an active, available catalog product' })
  const date = menuDate(input.date)
  const existing = await prisma.dailyMenu.findUnique({ where: { menuDate: date }, select: { id: true } })
  if (existing) return res.status(409).json({ message: 'A menu already exists for this service date. Open it with Edit to preserve its complete audit history.' })
  const menu = await prisma.$transaction(async tx => {
    const saved = await tx.dailyMenu.create({ data: { menuDate: date, title: input.title, description: input.description, createdBy: req.kitchenUser!.orbitPersonId, status: input.publish ? 'PUBLISHED' : 'DRAFT', publishedAt: input.publish ? new Date() : null } })
    await tx.dailyMenuItem.createMany({ data: ids.map((id, index) => { const product = products.find(item => item.id === id)!; return { menuId: saved.id, productId: id, unitPrice: product.currentPrice, currency: product.currency, displayOrder: index } }) })
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
  const productIds = [...new Set(input.productIds)]
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, archivedAt: null, isAvailable: true } })
  if (products.length !== productIds.length) return res.status(409).json({ message: 'Every menu item must be an active, available catalog product' })
  const menu = await prisma.$transaction(async tx => {
    await tx.dailyMenu.update({ where: { id }, data: { menuDate: date, title: input.title, description: input.description, status: input.publish ? 'PUBLISHED' : 'DRAFT', publishedAt: input.publish ? new Date() : null, closedAt: null } })
    await tx.dailyMenuItem.deleteMany({ where: { menuId: id } })
    await tx.dailyMenuItem.createMany({ data: productIds.map((productId, index) => { const product = products.find(item => item.id === productId)!; return { menuId: id, productId, unitPrice: product.currentPrice, currency: product.currency, displayOrder: index } }) })
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

app.post('/api/transactions', authenticate, allow('KITCHEN_ADMIN', 'CASHIER', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const input = saleSchema.parse(req.body)
  const person = await resolvePerson(input.orbitPersonId)
  if (!person) return res.status(404).json({ message: 'Active Orbit identity not found' })

  const now = new Date()
  const period = await prisma.accountingPeriod.findUnique({ where: { year_month: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 } } })
  if (period?.status === 'CLOSED') return res.status(409).json({ message: 'This accounting period is closed' })

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
    return {
      product,
      quantity: item.quantity,
      unitPriceCdf,
      subtotal: unitPriceCdf * item.quantity
    }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)

  const personAccess = await prisma.kitchenAccess.findUnique({ where: { orbitPersonId: person.id } })
  const purchaseRole = personAccess?.role || (person.kind === 'TEACHER' ? 'TEACHER' : person.kind === 'STUDENT' ? 'STUDENT' : 'STAFF')
  const rules = await prisma.discountRule.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ eligibleRole: null }, { eligibleRole: purchaseRole }] },
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }
      ]
    },
    orderBy: { priority: 'asc' }
  })
  const discountResult = calculateDiscount(subtotal, rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    type: rule.type,
    thresholdAmount: rule.thresholdAmount == null ? null : Number(rule.thresholdAmount),
    fixedAmount: rule.fixedAmount == null ? null : Number(rule.fixedAmount),
    targetAmount: rule.targetAmount == null ? null : Number(rule.targetAmount),
    percentage: rule.percentage == null ? null : Number(rule.percentage),
    requiresApproval: rule.requiresApproval
  })))

  if (input.paymentMode === 'CREDIT') {
    if (!personAccess?.creditEnabled) return res.status(403).json({ message: 'Credit is not enabled for this person' })
    const currentBalance = await balanceFor(person.id)
    if (personAccess.creditLimit != null && currentBalance + discountResult.finalAmount > Number(personAccess.creditLimit)) {
      return res.status(409).json({ message: 'Credit limit would be exceeded', currentBalance, creditLimit: personAccess.creditLimit })
    }
  }

  const transaction = await prisma.$transaction(async tx => {
    const counterName = 'TRANSACTION-' + now.getUTCFullYear()
    const counter = await tx.kitchenCounter.upsert({
      where: { name: counterName },
      create: { name: counterName, value: 1 },
      update: { value: { increment: 1 } }
    })
    const transactionNumber = 'KITCHEN-' + now.getUTCFullYear() + '-' + String(counter.value).padStart(6, '0')
    const total = discountResult.finalAmount
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
      discount: new Prisma.Decimal(discountResult.discount),
      total: new Prisma.Decimal(total),
      paymentMode: input.paymentMode,
      paymentStatus: isCredit ? 'CREDIT' : 'PAID',
      creditAmount: new Prisma.Decimal(isCredit ? total : 0),
      notes: input.notes,
      confirmationType: input.confirmationType,
      confirmedByPersonAt: input.confirmationType === 'NONE' ? null : now,
      items: { create: lines.map(line => ({
        productId: line.product.id,
        productNameSnapshot: line.product.name,
        quantity: new Prisma.Decimal(line.quantity),
        unitPriceAtPurchase: new Prisma.Decimal(line.unitPriceCdf),
        subtotal: new Prisma.Decimal(line.subtotal)
      })) },
      discounts: discountResult.rule ? { create: {
        discountRuleId: discountResult.rule.id,
        originalAmount: new Prisma.Decimal(subtotal),
        discountAmount: new Prisma.Decimal(discountResult.discount),
        finalAmount: new Prisma.Decimal(total),
        reason: discountResult.rule.name,
        appliedAutomatically: true
      } } : undefined,
      ledgerEntries: { create: [
        { orbitPersonId: person.id, type: 'PURCHASE', amount: new Prisma.Decimal(subtotal), description: 'Consumption ' + transactionNumber, performedBy: req.kitchenUser!.orbitPersonId },
        ...(discountResult.discount > 0 ? [{ orbitPersonId: person.id, type: 'DISCOUNT' as const, amount: new Prisma.Decimal(-discountResult.discount), description: 'Discount ' + transactionNumber, performedBy: req.kitchenUser!.orbitPersonId }] : []),
        ...(!isCredit ? [{ orbitPersonId: person.id, type: 'PAYMENT' as const, amount: new Prisma.Decimal(-total), description: 'Immediate payment ' + transactionNumber, performedBy: req.kitchenUser!.orbitPersonId }] : [])
      ] }
    }, include: { items: true, discounts: true } })

    for (const line of lines) {
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

    await tx.notificationOutbox.create({ data: {
      orbitPersonId: person.id,
      eventType: 'KITCHEN_TRANSACTION_CREATED',
      channels: ['IN_APP', 'EMAIL'],
      payload: { transactionNumber, total, currency: 'CDF', paymentMode: input.paymentMode }
    } })
    return created
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  await audit(req, 'TRANSACTION_CREATED', 'KitchenTransaction', transaction.id, undefined, transaction)
  res.status(201).json({ transaction, balance: await balanceFor(person.id) })
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
  res.json({ transactions })
}))

app.get('/api/transactions/:id', authenticate, asyncRoute(async (req: AuthRequest, res) => {
  const transaction = await prisma.kitchenTransaction.findUnique({ where: { id: routeParam(req, 'id') }, include: { items: true, discounts: true, disputes: true, ledgerEntries: true } })
  if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
  const personal = ['TEACHER', 'STAFF', 'STUDENT'].includes(req.kitchenUser!.role)
  if (personal && transaction.orbitPersonId !== req.kitchenUser!.orbitPersonId) return res.status(403).json({ message: 'Forbidden' })
  res.json({ transaction, balance: await balanceFor(transaction.orbitPersonId) })
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

  const [today, credit, outstanding, payments, discounts, disputes, lowStock, unavailable, cashiers, popular] = await Promise.all([
    prisma.kitchenTransaction.aggregate({ where: { status: 'CONFIRMED', createdAt: { gte: start } }, _sum: { total: true }, _count: true }),
    prisma.kitchenTransaction.aggregate({ where: { status: 'CONFIRMED', paymentMode: 'CREDIT', createdAt: { gte: start } }, _sum: { total: true } }),
    prisma.kitchenLedgerEntry.aggregate({ _sum: { amount: true } }),
    prisma.kitchenPayment.aggregate({ where: { createdAt: { gte: start } }, _sum: { amount: true } }),
    prisma.discountApplication.aggregate({ where: { createdAt: { gte: start } }, _sum: { discountAmount: true } }),
    prisma.kitchenDispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.product.findMany({ where: { trackInventory: true }, select: { stockQuantity: true, reorderLevel: true } }).then(rows => rows.filter(row => Number(row.stockQuantity) <= Number(row.reorderLevel)).length),
    prisma.product.count({ where: { isAvailable: false } }),
    prisma.kitchenAccess.count({ where: { role: 'CASHIER', isActive: true } }),
    prisma.kitchenTransactionItem.groupBy({ by: ['productId', 'productNameSnapshot'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 })
  ])
  res.json({ mode: 'operations', today, credit, outstanding: outstanding._sum.amount || 0, payments, discounts, disputes, lowStock, unavailable, cashiers, popular })
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
  const header = ['Transaction', 'Date', 'Person', 'Cashier', 'Subtotal', 'Discount', 'Total', 'Mode', 'Status']
  const csv = [header, ...rows.map(row => [row.transactionNumber, row.createdAt.toISOString(), row.personNameSnapshot, row.cashierNameSnapshot, row.subtotal, row.discount, row.total, row.paymentMode, row.status])]
    .map(row => row.map(csvCell).join(',')).join('\r\n')
  res.setHeader('content-type', 'text/csv; charset=utf-8')
  res.setHeader('content-disposition', 'attachment; filename="kcs-kitchen-transactions.csv"')
  res.send('\ufeff' + csv)
}))

app.get('/api/periods', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  res.json({ periods: await prisma.accountingPeriod.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }) })
}))

app.put('/api/periods/:year/:month', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const year = z.coerce.number().int().min(2020).max(2100).parse(req.params.year)
  const month = z.coerce.number().int().min(1).max(12).parse(req.params.month)
  const status = z.enum(['OPEN', 'REVIEW', 'CLOSED']).parse(req.body.status)
  const old = await prisma.accountingPeriod.findUnique({ where: { year_month: { year, month } } })
  if (old?.status === 'CLOSED' && status !== 'CLOSED') return res.status(409).json({ message: 'A closed period cannot be reopened through the standard workflow' })
  const period = await prisma.accountingPeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status, reviewedBy: status === 'REVIEW' ? req.kitchenUser!.orbitPersonId : undefined, reviewedAt: status === 'REVIEW' ? new Date() : undefined, closedBy: status === 'CLOSED' ? req.kitchenUser!.orbitPersonId : undefined, closedAt: status === 'CLOSED' ? new Date() : undefined },
    update: { status, reviewedBy: status === 'REVIEW' ? req.kitchenUser!.orbitPersonId : undefined, reviewedAt: status === 'REVIEW' ? new Date() : undefined, closedBy: status === 'CLOSED' ? req.kitchenUser!.orbitPersonId : undefined, closedAt: status === 'CLOSED' ? new Date() : undefined }
  })
  await audit(req, status === 'CLOSED' ? 'MONTH_CLOSED' : 'MONTH_STATUS_CHANGED', 'AccountingPeriod', period.id, old, period)
  res.json({ period })
}))

app.post('/api/notifications/retry', authenticate, allow('KITCHEN_ADMIN'), asyncRoute(async (req: AuthRequest, res) => {
  const result = await processNotificationOutbox(100)
  await audit(req, 'NOTIFICATION_RETRY', 'NotificationOutbox', 'batch', undefined, result)
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
  res.status(status).json({ message: status >= 500 ? 'KCS Kitchen could not complete this request' : error.message })
})

export { app }
