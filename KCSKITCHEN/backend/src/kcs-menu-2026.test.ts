import assert from 'node:assert/strict'
import test from 'node:test'
import { officialMenuDefinitionForDay } from './kcs-menu-2026.js'

test('chicken and fries are distinct products on every KCS business-day menu', () => {
  for (const day of [1, 2, 3, 4, 5]) {
    const definition = officialMenuDefinitionForDay(day)
    assert.ok(definition, `business day ${day} must have an official menu`)
    const names = definition.items.map(item => item.name)
    assert.equal(names.filter(name => name === 'Chicken / Poulet').length, 1)
    assert.equal(names.filter(name => name === 'Fries / Frites').length, 1)
    assert.equal(names.some(name => name.includes('Chicken & Fries')), false)
  }
})
