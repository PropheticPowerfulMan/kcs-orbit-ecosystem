import { Prisma, PrismaClient } from '@prisma/client'

type MenuLine = { name: string; price: number; category: 'FOOD' | 'SNACK' | 'DESSERT' }
type OfficialProductRef = { id: string }

const monday: MenuLine[] = [
  { name: 'Chicken & Fries / Cuisse & Frites', price: 10000, category: 'FOOD' },
  { name: 'Samoussas', price: 2500, category: 'SNACK' },
  { name: 'Macaronis', price: 5000, category: 'FOOD' },
  { name: 'Crêpes / Crepes', price: 2000, category: 'DESSERT' },
  { name: 'Sandwich', price: 3500, category: 'SNACK' },
  { name: 'Waffles / Gaufres', price: 1000, category: 'DESSERT' }
]
const tuesday: MenuLine[] = [
  { name: 'Shawarma Meat / Chawarma Viande', price: 10000, category: 'FOOD' },
  { name: 'Chicken Meatballs / Boulettes de Poulet', price: 5000, category: 'FOOD' },
  { name: 'Beef Skewers / Brochettes de viande', price: 2500, category: 'FOOD' },
  { name: 'French Toast / Pain Perdu', price: 1500, category: 'DESSERT' },
  { name: 'Plantain / Banane Plantain', price: 5000, category: 'FOOD' },
  { name: 'Flavored Rice / Riz assaisonné', price: 5000, category: 'FOOD' }
]
const menus: Record<number, { title: string; items: MenuLine[] }> = {
  1: { title: 'Monday / Lundi', items: monday },
  2: { title: 'Tuesday / Mardi', items: tuesday },
  3: { title: 'Wednesday / Mercredi', items: monday },
  4: { title: 'Thursday / Jeudi', items: tuesday.map(line => line.name.includes('French Toast') ? { ...line, price: 1000 } : line) },
  5: { title: 'Friday / Vendredi', items: monday }
}
const officialProducts = [...monday, ...tuesday].filter((line, index, all) =>
  all.findIndex(candidate => candidate.name === line.name) === index
)

async function ensureOfficialProducts(prisma: PrismaClient) {
  const products = new Map<string, OfficialProductRef>()
  for (const line of officialProducts) {
    let product = await prisma.product.findFirst({
      where: { name: line.name, archivedAt: null },
      orderBy: { createdAt: 'asc' }
    })
    product = product
      ? await prisma.product.update({
          where: { id: product.id },
          data: {
            currentPrice: new Prisma.Decimal(line.price),
            currency: 'CDF',
            category: line.category,
            isAvailable: true,
            discountEligible: true
          }
        })
      : await prisma.product.create({
          data: {
            name: line.name,
            currentPrice: new Prisma.Decimal(line.price),
            currency: 'CDF',
            category: line.category,
            isAvailable: true,
            discountEligible: true
          }
        })
    products.set(line.name, { id: product.id })
  }
  return products
}

async function attachAvailableDrinks(prisma: PrismaClient, menuId: string, startOrder: number) {
  const [drinks, existingItems] = await Promise.all([
    prisma.product.findMany({ where: { category: 'DRINK', archivedAt: null, isAvailable: true }, orderBy: [{ name: 'asc' }, { createdAt: 'asc' }] }),
    prisma.dailyMenuItem.findMany({ where: { menuId }, select: { productId: true } })
  ])
  const existingIds = new Set(existingItems.map(item => item.productId))
  const missing = drinks.filter(drink => !existingIds.has(drink.id))
  if (missing.length) await prisma.dailyMenuItem.createMany({
    data: missing.map((drink, index) => ({ menuId, productId: drink.id, unitPrice: drink.currentPrice, currency: drink.currency, displayOrder: startOrder + index })),
    skipDuplicates: true
  })
  return prisma.dailyMenu.findUniqueOrThrow({ where: { id: menuId }, include: { items: { where: { isAvailable: true }, include: { product: true }, orderBy: { displayOrder: 'asc' } } } })
}
export async function ensureOfficialMenu(
  prisma: PrismaClient,
  key: string,
  preparedProducts?: Map<string, OfficialProductRef>
) {
  const date = new Date(`${key}T00:00:00.000Z`)
  const definition = menus[date.getUTCDay()]
  if (!definition) return null
  const existing = await prisma.dailyMenu.findUnique({
    where: { menuDate: date },
    include: {
      items: {
        where: { isAvailable: true },
        include: { product: true },
        orderBy: { displayOrder: 'asc' }
      }
    }
  })
  if (existing) return attachAvailableDrinks(prisma, existing.id, existing.items.length)
  const products = preparedProducts ?? await ensureOfficialProducts(prisma)
  const menu = await prisma.$transaction(async tx => {
    const menu = await tx.dailyMenu.create({
      data: {
        menuDate: date,
        title: definition.title,
        description: 'Official KCS Kitchen weekday menu 2026',
        status: 'PUBLISHED',
        createdBy: 'SYSTEM_KCS_MENU_2026',
        publishedAt: new Date()
      }
    })
    await tx.dailyMenuItem.createMany({
      data: definition.items.map((line, index) => ({
        menuId: menu.id,
        productId: products.get(line.name)!.id,
        unitPrice: new Prisma.Decimal(line.price),
        currency: 'CDF',
        displayOrder: index
      }))
    })
    return menu
  })
  return attachAvailableDrinks(prisma, menu.id, definition.items.length)
}

const kinshasaDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Kinshasa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return [part('year'), part('month'), part('day')].join('-')
}

export async function ensureOfficialMenuSchedule(
  prisma: PrismaClient,
  start = new Date(),
  businessDays = 15
) {
  const products = await ensureOfficialProducts(prisma)
  const cursor = new Date(`${kinshasaDateKey(start)}T00:00:00.000Z`)
  let created = 0
  let inspected = 0
  while (created < businessDays && inspected < 45) {
    const day = cursor.getUTCDay()
    if (day >= 1 && day <= 5) {
      await ensureOfficialMenu(prisma, cursor.toISOString().slice(0, 10), products)
      created += 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    inspected += 1
  }
}
