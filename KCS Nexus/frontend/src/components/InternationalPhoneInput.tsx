import { useEffect, useMemo, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

type InternationalPhoneInputProps = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

const flag = (country: string) => country.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
const names = new Intl.DisplayNames(["fr"], { type: "region" });
const aliases: Partial<Record<CountryCode, string>> = { CD: "RDC RD Congo DRC Congo-Kinshasa", CG: "Congo-Brazzaville", US: "USA United States Amérique", GB: "UK United Kingdom Royaume-Uni", AE: "UAE Émirats", KR: "Corée du Sud", KP: "Corée du Nord" };
const countries = getCountries().map((country) => ({ country, name: names.of(country) || country, callingCode: getCountryCallingCode(country), aliases: aliases[country] })).sort((a, b) => a.name.localeCompare(b.name, "fr"));

export default function InternationalPhoneInput({ value = "", onChange, className = "", disabled, required, "aria-label": ariaLabel = "Numéro de téléphone international" }: InternationalPhoneInputProps) {
  const parsed = useMemo(() => parsePhoneNumberFromString(value), [value]);
  const [country, setCountry] = useState<CountryCode>(parsed?.country || "CD");
  const [national, setNational] = useState(parsed?.nationalNumber || value.replace(/^\+?243/, "").replace(/\D/g, "").replace(/^0+/, ""));

  useEffect(() => {
    const next = parsePhoneNumberFromString(value);
    if (next?.country) { setCountry(next.country); setNational(next.nationalNumber); }
    else if (!value) { setNational(""); }
  }, [value]);

  const emit = (nextCountry: CountryCode, raw: string) => {
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
    setNational(digits);
    onChange(digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : "");
  };

  return <div className={`international-phone-input ${className}`.trim()} style={{ display: "grid", gridTemplateColumns: "clamp(7.75rem, 36%, 10rem) minmax(0, 1fr)", overflow: "hidden", border: "1px solid rgba(148,163,184,.35)", borderRadius: ".75rem", background: "#ffffff" }}>
    <select title="Choisissez un pays — tapez USA, RDC, UK ou un code pays pour rechercher" aria-label="Pays, drapeau et indicatif" disabled={disabled} value={country} onChange={(event) => { const next = event.target.value as CountryCode; setCountry(next); emit(next, national); }} style={{ minWidth: 0, border: 0, borderRight: "1px solid rgba(148,163,184,.3)", padding: ".75rem", background: "#ffffff", color: "#0f172a", colorScheme: "light", outline: "none", fontFamily: "system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
      {countries.map((item) => <option key={item.country} value={item.country} style={{ background: "#ffffff", color: "#0f172a" }}>{flag(item.country)} {item.name} · {item.country}{item.aliases ? " · " + item.aliases : ""} (+{item.callingCode})</option>)}
    </select>
    <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}><span aria-hidden="true" style={{ paddingLeft: ".75rem", opacity: .7 }}>+{getCountryCallingCode(country)}</span><input type="tel" inputMode="tel" autoComplete="tel-national" aria-label={ariaLabel} disabled={disabled} required={required} value={national} onChange={(event) => emit(country, event.target.value)} placeholder="Numéro national" style={{ width: "100%", minWidth: 0, border: 0, padding: ".75rem .75rem .75rem .4rem", background: "transparent", color: "#0f172a", outline: "none" }} /></div>
  </div>;
}