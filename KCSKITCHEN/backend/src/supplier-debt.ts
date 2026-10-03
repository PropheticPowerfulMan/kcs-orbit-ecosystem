export type SupplierBalance = { currency: string; balance: unknown }

export type SupplierDebtSummary = {
  byCurrency: { CDF: number; USD: number }
  otherCurrencies: Record<string, number>
  convertedTotals: { CDF: number; USD: number } | null
  rateApplied: number | null
}

export function summarizeSupplierDebt(rows: SupplierBalance[], usdCdfRate: number | null): SupplierDebtSummary {
  const byCurrency = { CDF: 0, USD: 0 }
  const otherCurrencies: Record<string, number> = {}
  for (const row of rows) {
    const currency = String(row.currency || '').trim().toUpperCase()
    const balance = Number(row.balance || 0)
    if (!Number.isFinite(balance) || balance <= 0) continue
    if (currency === 'CDF' || currency === 'USD') byCurrency[currency] += balance
    else otherCurrencies[currency || 'UNKNOWN'] = (otherCurrencies[currency || 'UNKNOWN'] || 0) + balance
  }
  const validRate = Number.isFinite(usdCdfRate) && Number(usdCdfRate) > 0 ? Number(usdCdfRate) : null
  return {
    byCurrency,
    otherCurrencies,
    convertedTotals: validRate ? {
      CDF: byCurrency.CDF + byCurrency.USD * validRate,
      USD: byCurrency.USD + byCurrency.CDF / validRate
    } : null,
    rateApplied: validRate
  }
}
