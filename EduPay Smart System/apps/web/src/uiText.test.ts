import {describe,it,expect,vi,afterEach} from 'vitest';
import {uiText,uiStatus,uiCopy,persistUiLanguage,getUiLanguage,uiLocale} from './uiText';
afterEach(()=>vi.unstubAllGlobals());
describe('interface language contract',()=>{
 it('all added labels have both nonempty languages',()=>{for(const entry of Object.values(uiCopy)){expect(entry.fr.trim()).not.toBe('');expect(entry.en.trim()).not.toBe('')}});
 it('translates labels and canonical statuses without changing source values',()=>{expect(uiText('Deduction salaire','en')).toBe('Payroll deduction');expect(uiText('Non defini','fr')).toBe('Non défini');expect(uiStatus('NEEDS_MORE_INFO','fr')).toBe('Informations requises');expect(uiStatus('APPROVED','en')).toBe('Approved')});
 it('leaves personal names, numeric amounts and unknown content unchanged',()=>{for(const value of ['NKOTE FANNY','1234.50','Parent wrote this message','My report 2026-2027'])expect(uiText(value,'en')).toBe(value)});
 it('works when browser storage is unavailable',()=>{vi.stubGlobal('localStorage',{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});persistUiLanguage('en');expect(getUiLanguage()).toBe('en');expect(uiLocale()).toBe('en-US');persistUiLanguage('fr');expect(getUiLanguage()).toBe('fr')});
});
