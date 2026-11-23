import {test} from 'node:test';import assert from 'node:assert/strict';
import {beginNexusWrite,finishNexusWrite,getPendingNexusWrites} from './applicationUpdateSafety';
test('two writes keep the update guard active until both have completed',()=>{const a=beginNexusWrite(),b=beginNexusWrite();assert.equal(getPendingNexusWrites(),2);finishNexusWrite(a);assert.equal(getPendingNexusWrites(),1);finishNexusWrite(b);assert.equal(getPendingNexusWrites(),0)});
test('a logical retry is counted once and repeated completion is harmless',()=>{const id=beginNexusWrite();assert.equal(beginNexusWrite(id),id);assert.equal(getPendingNexusWrites(),1);finishNexusWrite(id);finishNexusWrite(id);assert.equal(getPendingNexusWrites(),0)});
