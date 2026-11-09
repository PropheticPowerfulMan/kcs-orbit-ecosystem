import { Prisma } from '@prisma/client'

type SalePortion = { quantity?: number; amount?: number; amountCurrency?: 'CDF' | 'USD' }

export function resolveSalePortion(input: SalePortion, priceCdf: number, usdCdfRate?: number) {
  const unitPrice = new Prisma.Decimal(priceCdf).toDecimalPlaces(2)
  if (!unitPrice.isFinite() || unitPrice.lte(0)) throw Object.assign(new Error('A positive menu price is required'), { statusCode: 409 })
  const amountBased = input.amount !== undefined
  if (amountBased === (input.quantity !== undefined)) throw Object.assign(new Error('Choose either quantity or purchase amount for each item'), { statusCode: 400 })
  if (amountBased && input.amountCurrency === 'USD' && (!usdCdfRate || usdCdfRate <= 0)) throw Object.assign(new Error('A reliable USD/CDF exchange rate is required'), { statusCode: 503 })
  const amount = amountBased ? new Prisma.Decimal(input.amount!) : null
  if (amount && (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2)) throw Object.assign(new Error('Enter a positive purchase amount with at most two decimal places'), { statusCode: 400 })
  const subtotal = amount ? amount.mul(input.amountCurrency === 'USD' ? usdCdfRate! : 1).toDecimalPlaces(2) : unitPrice.mul(input.quantity!).toDecimalPlaces(2)
  const quantity = amount ? subtotal.div(unitPrice).toDecimalPlaces(3) : new Prisma.Decimal(input.quantity!)
  if (!quantity.isFinite() || quantity.lte(0) || quantity.gt(1000) || quantity.decimalPlaces() > 3) throw Object.assign(new Error('The portion must be between 0.001 and 1000 units, with at most three decimal places'), { statusCode: 400 })
  return { quantity: quantity.toNumber(), unitPriceCdf: unitPrice.toNumber(), subtotal: subtotal.toNumber(), amountBased }
}
