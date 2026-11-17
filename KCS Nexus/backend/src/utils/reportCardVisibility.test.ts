import test from 'node:test'
import assert from 'node:assert/strict'
import { reportCardVisibility } from './reportCardVisibility.js'
test('saved exclusions for deleted courses cannot block the current report card', () => {
 assert.deepEqual(reportCardVisibility(['math','spelling-new'], ['spelling-old'], ['spelling-old']), { hiddenCourseIds: [], visibleCourseIds: ['math','spelling-new'] })
})
test('keeps valid exclusions, rejects new foreign IDs and keeps a visible subject', () => {
 assert.deepEqual(reportCardVisibility(['math','spelling'], ['spelling','spelling']), { hiddenCourseIds: ['spelling'], visibleCourseIds: ['math'] })
 assert.throws(() => reportCardVisibility(['math'], ['foreign']), /does not belong/)
 assert.throws(() => reportCardVisibility(['math'], ['math']), /At least one/)
})
