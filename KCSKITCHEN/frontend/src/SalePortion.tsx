import type { Product } from './types'
import { DisplayMoney, useCurrencyDisplay } from './ExchangeRate'

export type PurchaseAmount = { amount: string; currency: 'CDF' | 'USD' }
export type PurchaseAmounts = Record<string, PurchaseAmount>

export function cartLineTotal(product: Product, quantity: number, amount: PurchaseAmount | undefined, rate?: number) {
  const value = amount ? Number(amount.amount || 0) : Number(product.currentPrice) * quantity
  const currency = amount?.currency ?? product.currency
  return Math.round(value * (currency === 'USD' ? (rate || 0) : 1) * 100) / 100
}

export function cartRequestItems(products: Product[], cart: Record<string, number>, amounts: PurchaseAmounts) {
  return products.flatMap<{ productId: string; quantity?: number; amount?: number; amountCurrency?: 'CDF' | 'USD' }>(product => {
    const chosen = amounts[product.id]
    if (chosen) return Number(chosen.amount) > 0 ? [{ productId: product.id, amount: Number(chosen.amount), amountCurrency: chosen.currency }] : []
    return cart[product.id] > 0 ? [{ productId: product.id, quantity: cart[product.id] }] : []
  })
}

export default function SalePortion({ product, value, onChange, fr, disabled = false }: { product: Product; value?: PurchaseAmount; onChange: (value?: PurchaseAmount) => void; fr: boolean; disabled?: boolean }) {
  const { rate, displayCurrency } = useCurrencyDisplay()
  const amountCdf = value ? Number(value.amount || 0) * (value.currency === 'USD' ? (rate?.rate || 0) : 1) : 0
  const unitCdf = Number(product.currentPrice) * (product.currency === 'USD' ? (rate?.rate || 0) : 1)
  const portion = unitCdf > 0 ? amountCdf / unitCdf : 0
  return <div className="sale-portion">
    <label>{fr ? 'Mode de vente' : 'Selling mode'}<select aria-label={(fr ? 'Mode de vente — ' : 'Selling mode — ') + product.name} disabled={disabled} value={value ? 'amount' : 'quantity'} onChange={event => onChange(event.target.value === 'amount' ? { amount: '', currency: displayCurrency } : undefined)}><option value="quantity">{fr ? 'Par quantité' : 'By quantity'}</option><option value="amount">{fr ? 'Pour un montant choisi' : 'For a chosen amount'}</option></select></label>
    {value && <><div className="sale-portion-inputs"><label>{fr ? 'Montant souhaité avant réduction' : 'Requested amount before discount'}<input aria-label={(fr ? 'Montant — ' : 'Amount — ') + product.name} inputMode="decimal" type="number" min="0.01" step="0.01" value={value.amount} onChange={event => onChange({ ...value, amount: event.target.value })} /></label><label>{fr ? 'Devise' : 'Currency'}<select value={value.currency} onChange={event => onChange({ ...value, currency: event.target.value as 'CDF' | 'USD' })}><option value="CDF">CDF</option><option value="USD" disabled={!rate}>USD</option></select></label></div><small>{fr ? 'Portion correspondante' : 'Corresponding portion'} ≈ {portion.toLocaleString(fr ? 'fr-FR' : 'en-US', { maximumFractionDigits: 3 })} × {fr ? 'l’unité du menu' : 'one menu unit'}. {fr ? 'Le montant choisi sera facturé exactement, puis la réduction éventuelle sera appliquée.' : 'The exact chosen amount is charged before any applicable discount.'}</small><b><DisplayMoney value={amountCdf} currency="CDF" /></b></>}
  </div>
}
