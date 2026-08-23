import { useEffect, useMemo, useState } from 'react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

const flag = (country) => country.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
const names = new Intl.DisplayNames(['fr'], { type: 'region' });
const countries = getCountries().map((country) => ({ country, name: names.of(country) || country, callingCode: getCountryCallingCode(country) })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export default function InternationalPhoneInput({ value = '', onChange, className = '', disabled, required, 'aria-label': ariaLabel = 'Numéro de téléphone international' }) {
  const parsed = useMemo(() => parsePhoneNumberFromString(value), [value]);
  const [country, setCountry] = useState(parsed?.country || 'CD');
  const [national, setNational] = useState(parsed?.nationalNumber || value.replace(/^\+?243/, '').replace(/\D/g, '').replace(/^0+/, ''));
  useEffect(() => { const next = parsePhoneNumberFromString(value); if (next?.country) { setCountry(next.country); setNational(next.nationalNumber); } else if (!value) setNational(''); }, [value]);
  const emit = (nextCountry, raw) => { const digits = raw.replace(/\D/g, '').replace(/^0+/, ''); setNational(digits); onChange(digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : ''); };
  return <div className={`international-phone-input ${className}`.trim()} style={{ display: 'grid', gridTemplateColumns: 'minmax(9.5rem, 42%) 1fr', overflow: 'hidden', border: '1px solid rgba(148,163,184,.35)', borderRadius: '.75rem', background: 'rgba(15,23,42,.55)' }}>
    <select aria-label="Pays et indicatif" disabled={disabled} value={country} onChange={(event) => { const next = event.target.value; setCountry(next); emit(next, national); }} style={{ minWidth: 0, border: 0, borderRight: '1px solid rgba(148,163,184,.3)', padding: '.75rem', background: 'transparent', color: 'inherit', outline: 'none' }}>{countries.map((item) => <option key={item.country} value={item.country} style={{ color: '#0f172a' }}>{flag(item.country)} {item.name} (+{item.callingCode})</option>)}</select>
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}><span aria-hidden="true" style={{ paddingLeft: '.75rem', opacity: .7 }}>+{getCountryCallingCode(country)}</span><input type="tel" inputMode="tel" autoComplete="tel-national" aria-label={ariaLabel} disabled={disabled} required={required} value={national} onChange={(event) => emit(country, event.target.value)} placeholder="Numéro national" style={{ width: '100%', minWidth: 0, border: 0, padding: '.75rem .75rem .75rem .4rem', background: 'transparent', color: 'inherit', outline: 'none' }} /></div>
  </div>;
}