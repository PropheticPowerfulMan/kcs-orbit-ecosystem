import { describe, expect, it } from 'vitest'
import { calculateSchoolSubsidy } from './staff-subsidy.js'

describe('KCS staff and teacher subsidy', () => {
  it.each([[0, 0], [4999, 0], [5000, 2000], [9999, 2000], [10000, 4000], [19999, 4000], [20000, 8000], [50000, 8000]])('uses the official bracket for %s CDF', (subtotal, expected) => {
    expect(calculateSchoolSubsidy(subtotal, 'TEACHER')).toBe(expected)
    expect(calculateSchoolSubsidy(subtotal, 'STAFF')).toBe(expected)
  })
  it('never subsidizes students or other roles', () => expect(calculateSchoolSubsidy(20000, 'STUDENT')).toBe(0))
})
