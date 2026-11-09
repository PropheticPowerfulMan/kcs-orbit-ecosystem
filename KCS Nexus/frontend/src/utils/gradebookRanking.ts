export function rankGradebookRows<T extends { name: string; average: number | null }>(rows: T[]) {
  const ordered = rows.filter((row) => row.average !== null && Number.isFinite(row.average))
    .sort((left, right) => Number(right.average!.toFixed(2)) - Number(left.average!.toFixed(2))
      || left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
  let previousPercentage: number | undefined
  let rank = 0
  return ordered.map((row, index) => {
    const percentage = Number(row.average!.toFixed(2))
    if (percentage !== previousPercentage) rank = index + 1
    previousPercentage = percentage
    return { ...row, rank }
  })
}
