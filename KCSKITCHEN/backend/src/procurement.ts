import { Router, type NextFunction, type Request, type Response } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './db.js'
import { allow, authenticate, type AuthRequest } from './auth.js'

const router = Router()
const asyncRoute = (handler: (req: any, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void handler(req, res, next).catch(next)

async function audit(req: AuthRequest, action: string, entityId: string, oldValue?: unknown, newValue?: unknown) {
  if (!req.kitchenUser) return
  await prisma.auditLog.create({ data: {
    actorId: req.kitchenUser.orbitPersonId, actorRole: req.kitchenUser.role, action,
    entityType: 'KitchenPurchase', entityId,
    oldValue: oldValue as Prisma.InputJsonValue | undefined,
    newValue: newValue as Prisma.InputJsonValue | undefined,
    ipAddress: req.ip
  } })
}

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  taxId: z.string().trim().max(80).optional().nullable()
})

router.get('/suppliers', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  res.json({ suppliers: await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }) })
}))

router.post('/suppliers', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const supplier = await prisma.supplier.create({ data: supplierSchema.parse(req.body) })
  await audit(req, 'SUPPLIER_CREATED', supplier.id, undefined, supplier)
  res.status(201).json({ supplier })
}))

const purchaseSchema = z.object({
  supplierId: z.string().min(1),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  currency: z.enum(['CDF', 'USD']).default('CDF'),
  paidAmount: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.enum(['CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY']).default('CASH'),
  paymentReference: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(800).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().optional().nullable(),
    description: z.string().trim().min(2).max(180),
    quantity: z.coerce.number().positive().max(100000),
    unit: z.enum(['UNIT', 'BOTTLE', 'CAN', 'KG', 'LITER', 'PORTION', 'OTHER']).default('UNIT'),
    unitCost: z.coerce.number().nonnegative()
  })).min(1).max(100)
})

router.get('/purchases', authenticate, allow('KITCHEN_ADMIN', 'FINANCE', 'AUDITOR'), asyncRoute(async (_req, res) => {
  const [purchases, debt] = await Promise.all([
    prisma.kitchenPurchase.findMany({
      include: { supplier: true, items: { include: { product: { select: { name: true } } } }, payments: { orderBy: { paidAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }, take: 500
    }),
    prisma.kitchenPurchase.aggregate({ where: { status: { in: ['RECEIVED', 'PARTIALLY_PAID'] } }, _sum: { balance: true } })
  ])
  res.json({ purchases, outstandingSupplierDebt: debt._sum.balance || 0 })
}))

router.post('/purchases', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const input = purchaseSchema.parse(req.body)
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, isActive: true } })
  if (!supplier) return res.status(404).json({ message: 'Active supplier not found' })
  const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  if (input.paidAmount > total) return res.status(409).json({ message: 'Payment cannot exceed invoice total' })
  const productIds = [...new Set(input.items.map(item => item.productId).filter((id): id is string => Boolean(id)))]
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } } }) : []
  if (products.length !== productIds.length) return res.status(400).json({ message: 'One or more linked products do not exist' })
  const productMap = new Map(products.map(product => [product.id, product]))

  const purchase = await prisma.$transaction(async tx => {
    const now = new Date()
    const counter = await tx.kitchenCounter.upsert({
      where: { name: 'PURCHASE-' + now.getUTCFullYear() },
      create: { name: 'PURCHASE-' + now.getUTCFullYear(), value: 1 },
      update: { value: { increment: 1 } }
    })
    const purchaseNumber = 'KCS-KIT-PO-' + now.getUTCFullYear() + '-' + String(counter.value).padStart(5, '0')
    const balance = total - input.paidAmount
    const status = balance === 0 ? 'PAID' : input.paidAmount > 0 ? 'PARTIALLY_PAID' : 'RECEIVED'
    const created = await tx.kitchenPurchase.create({
      data: {
        purchaseNumber, supplierId: supplier.id, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate,
        dueDate: input.dueDate, currency: input.currency, total: new Prisma.Decimal(total),
        paidAmount: new Prisma.Decimal(input.paidAmount), balance: new Prisma.Decimal(balance), status,
        notes: input.notes, createdBy: req.kitchenUser!.orbitPersonId,
        items: { create: input.items.map(item => ({
          productId: item.productId || null, description: item.description, quantity: new Prisma.Decimal(item.quantity),
          unit: item.unit, unitCost: new Prisma.Decimal(item.unitCost), total: new Prisma.Decimal(item.quantity * item.unitCost)
        })) },
        payments: input.paidAmount > 0 ? { create: {
          amount: new Prisma.Decimal(input.paidAmount), currency: input.currency, method: input.paymentMethod,
          reference: input.paymentReference, notes: 'Initial supplier payment', paidBy: req.kitchenUser!.orbitPersonId
        } } : undefined
      },
      include: { supplier: true, items: true, payments: true }
    })
    for (const item of input.items) {
      if (!item.productId) continue
      const product = productMap.get(item.productId)
      if (!product?.trackInventory) continue
      await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: item.quantity } } })
      await tx.stockMovement.create({ data: {
        productId: product.id, type: 'STOCK_IN', quantity: new Prisma.Decimal(item.quantity),
        reason: purchaseNumber + ' · ' + supplier.name, actor: req.kitchenUser!.orbitPersonId
      } })
    }
    return created
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  await audit(req, 'PURCHASE_RECEIVED', purchase.id, undefined, purchase)
  res.status(201).json({ purchase })
}))

router.post('/purchases/:id/payments', authenticate, allow('KITCHEN_ADMIN', 'FINANCE'), asyncRoute(async (req: AuthRequest, res) => {
  const input = z.object({
    amount: z.coerce.number().positive(),
    method: z.enum(['CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY']),
    reference: z.string().trim().max(160).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable()
  }).parse(req.body)
  const purchase = await prisma.kitchenPurchase.findUnique({ where: { id: String(req.params.id || '') } })
  if (!purchase || purchase.status === 'VOIDED') return res.status(404).json({ message: 'Open supplier invoice not found' })
  if (input.amount > Number(purchase.balance)) return res.status(409).json({ message: 'Payment exceeds supplier balance' })
  const result = await prisma.$transaction(async tx => {
    const payment = await tx.supplierPayment.create({ data: {
      purchaseId: purchase.id, amount: new Prisma.Decimal(input.amount), currency: purchase.currency,
      method: input.method, reference: input.reference, notes: input.notes, paidBy: req.kitchenUser!.orbitPersonId
    } })
    const paidAmount = Number(purchase.paidAmount) + input.amount
    const balance = Number(purchase.total) - paidAmount
    const updated = await tx.kitchenPurchase.update({ where: { id: purchase.id }, data: {
      paidAmount: new Prisma.Decimal(paidAmount), balance: new Prisma.Decimal(balance),
      status: balance === 0 ? 'PAID' : 'PARTIALLY_PAID'
    } })
    return { payment, purchase: updated }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  await audit(req, 'SUPPLIER_PAYMENT_RECORDED', purchase.id, purchase, result.purchase)
  res.status(201).json(result)
}))

export { router as procurementRouter }
