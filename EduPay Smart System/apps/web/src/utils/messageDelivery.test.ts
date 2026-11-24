import {describe,it,expect} from 'vitest';
import {hasMessageDelivery} from './messageDelivery';
describe('delivery evidence',()=>{
 it('counts successful provider delivery separately from simulations, pending and failures',()=>{
  expect(hasMessageDelivery('DASHBOARD:OPEN | EMAIL:SENT | SMS:SIMULATED','EMAIL')).toBe(true);
  expect(hasMessageDelivery('DASHBOARD:OPEN | EMAIL:SENT | SMS:SIMULATED','SMS')).toBe(false);
  for(const state of ['SIMULATED','PENDING','FAILED','SKIPPED','SENT_ERROR'])expect(hasMessageDelivery(`EMAIL:${state}`,'EMAIL')).toBe(false);
 });
 it('accepts supported separators without matching partial tokens',()=>{
  expect(hasMessageDelivery('DASHBOARD:OPEN; EMAIL:SENT,SMS:SKIPPED','EMAIL')).toBe(true);
  expect(hasMessageDelivery('OTHEREMAIL:SENT','EMAIL')).toBe(false);
 });
});
