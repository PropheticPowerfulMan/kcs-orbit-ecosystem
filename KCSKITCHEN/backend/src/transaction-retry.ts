const retryableTransactionCodes = new Set(['P2034', 'P2002'])
const retryableSqlStates = new Set(['40001', '40P01'])

export async function runWithTransactionRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; delay?: (attempt: number) => Promise<void> } = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 4)
  const delay = options.delay ?? (attempt => new Promise(resolve => setTimeout(resolve, 35 * (2 ** attempt))))
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      const retryable = retryableTransactionCodes.has(String(error?.code))
        || (error?.code === 'P2010' && retryableSqlStates.has(String(error?.meta?.code)))
      if (!retryable || attempt === maxAttempts - 1) throw error
      await delay(attempt)
    }
  }
  throw lastError
}
