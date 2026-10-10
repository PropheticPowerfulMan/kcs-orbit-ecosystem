import { Prisma, PrismaClient } from '@prisma/client'

type MenuLine = { name: string; price: number; category: 'FOOD' | 'SNACK' | 'DESSERT' }
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

export async function ensureOfficialMenu(prisma: PrismaClient, key: string) {
  const date = new Date(`${key}T00:00:00.000Z`)
  const definition = menus[date.getUTCDay()]
  if (!definition) return null
  const existing = await prisma.dailyMenu.findUnique({ where: { menuDate: date }, include: { items: { where: { isAvailable: true }, include: { product: true }, orderBy: { displayOrder: 'asc' } } } })
  if (existing) return existing
  return prisma.$transaction(async tx => {
    const products = []
    for (const line of definition.items) {
      let product = await tx.product.findFirst({ where: { name: line.name, archivedAt: null }, orderBy: { createdAt: 'asc' } })
      product = product
        ? await tx.product.update({ where: { id: product.id }, data: { currentPrice: new Prisma.Decimal(line.price), currency: 'CDF', category: line.category, isAvailable: true, discountEligible: true } })
        : await tx.product.create({ data: { name: line.name, currentPrice: new Prisma.Decimal(line.price), currency: 'CDF', category: line.category, isAvailable: true, discountEligible: true } })
      products.push(product)
    }
    const menu = await tx.dailyMenu.create({ data: { menuDate: date, title: definition.title, description: 'Official KCS Kitchen weekday menu 2026', status: 'PUBLISHED', createdBy: 'SYSTEM_KCS_MENU_2026', publishedAt: new Date() } })
    await tx.dailyMenuItem.createMany({ data: products.map((product, index) => ({ menuId: menu.id, productId: product.id, unitPrice: product.currentPrice, currency: 'CDF', displayOrder: index })) })
    return tx.dailyMenu.findUniqueOrThrow({ where: { id: menu.id }, include: { items: { where: { isAvailable: true }, include: { product: true }, orderBy: { displayOrder: 'asc' } } } })
  })
}
