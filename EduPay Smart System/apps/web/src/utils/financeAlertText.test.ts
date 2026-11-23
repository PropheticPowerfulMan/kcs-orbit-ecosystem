import {describe,it,expect} from 'vitest';import {financeAlertText} from './financeAlertText';
describe('financial reminder presentation',()=>{
 it('separates the known audit marker without changing the message',()=>{const text='[TUITION_REMINDER:cmupq0verylongid:DATE:2026-10-01] Rappel n°1 : paiement attendu.';expect(financeAlertText(text)).toEqual({body:'Rappel n°1 : paiement attendu.',reference:'[TUITION_REMINDER:cmupq0verylongid:DATE:2026-10-01]'});expect(text).toContain('TUITION_REMINDER')});
 it('preserves ordinary parent content, brackets and malformed references',()=>{for(const value of ['[Important] Please contact the school.','[TUITION_REMINDER:custom] School message.','Échéance du paiement : 10 décembre.'])expect(financeAlertText(value)).toEqual({body:value,reference:null})});
 it('does not hide a marker-only alert',()=>{const text='[TUITION_REMINDER:parent:DATE:2026-10-01]';expect(financeAlertText(text).body).toBe(text)});
});
