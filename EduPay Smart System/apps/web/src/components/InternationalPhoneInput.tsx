import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

type Props = { value?: string; onChange: (value: string) => void; className?: string; disabled?: boolean; required?: boolean; "aria-label"?: string };
const names = new Intl.DisplayNames(["fr"], { type: "region" });
const countries = getCountries().map((country) => ({ country, name: names.of(country) || country, callingCode: getCountryCallingCode(country) })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
const flagUrl = (country: string) => `https://flagcdn.com/24x18/${country.toLowerCase()}.png`;

export default function InternationalPhoneInput({ value = "", onChange, className = "", disabled, required, "aria-label": ariaLabel = "Numero de telephone international" }: Props) {
  const parsed = useMemo(() => parsePhoneNumberFromString(value), [value]);
  const [country, setCountry] = useState<CountryCode>(parsed?.country || "CD");
  const [national, setNational] = useState(parsed?.nationalNumber || value.replace(/^\+?243/, "").replace(/\D/g, "").replace(/^0+/, ""));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const next = parsePhoneNumberFromString(value); if (next?.country) { setCountry(next.country); setNational(next.nationalNumber); } else if (!value) setNational(""); }, [value]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const emit = (nextCountry: CountryCode, raw: string) => { const digits = raw.replace(/\D/g, "").replace(/^0+/, ""); setNational(digits); onChange(digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : ""); };
  const selected = countries.find((item) => item.country === country)!;
  const filtered = countries.filter((item) => `${item.name} ${item.country} +${item.callingCode}`.toLowerCase().includes(query.toLowerCase()));
  return <div ref={root} className={`international-phone-input ${className}`.trim()} style={{ position: "relative", display: "grid", gridTemplateColumns: "9rem minmax(0, 1fr)", border: "1px solid rgba(148,163,184,.45)", borderRadius: ".75rem", background: "#fff", color: "#0f172a" }}>
    <button type="button" disabled={disabled} aria-label="Choisir le pays et indicatif" aria-expanded={open} onClick={() => setOpen((current) => !current)} style={{ display: "flex", alignItems: "center", gap: ".5rem", minWidth: 0, border: 0, borderRight: "1px solid rgba(148,163,184,.35)", padding: ".72rem", background: "transparent", color: "inherit", fontWeight: 700 }}><img src={flagUrl(country)} alt="" width="24" height="18" style={{ flex: "0 0 auto", borderRadius: "2px" }}/><span>{country}</span><span style={{ color: "#0369a1" }}>+{selected.callingCode}</span><span aria-hidden="true" style={{ marginLeft: "auto" }}>▾</span></button>
    <input type="tel" inputMode="tel" autoComplete="tel-national" aria-label={ariaLabel} disabled={disabled} required={required} value={national} onChange={(event) => emit(country, event.target.value)} placeholder="Numero national" style={{ width: "100%", minWidth: 0, border: 0, borderRadius: ".75rem", padding: ".75rem", background: "transparent", color: "inherit", outline: "none" }}/>
    {open && <div style={{ position: "absolute", zIndex: 100, top: "calc(100% + .4rem)", left: 0, width: "min(24rem, 92vw)", overflow: "hidden", border: "1px solid #cbd5e1", borderRadius: ".75rem", background: "#fff", color: "#0f172a", boxShadow: "0 18px 45px rgba(15,23,42,.24)" }}><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher pays ou indicatif" style={{ boxSizing: "border-box", width: "100%", border: 0, borderBottom: "1px solid #e2e8f0", padding: ".75rem", background: "#fff", color: "#0f172a", outline: "none" }}/><div style={{ maxHeight: "16rem", overflowY: "auto" }}>{filtered.map((item) => <button type="button" key={item.country} onClick={() => { setCountry(item.country); emit(item.country, national); setOpen(false); setQuery(""); }} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", alignItems: "center", gap: ".65rem", width: "100%", border: 0, padding: ".65rem .75rem", background: item.country === country ? "#e0f2fe" : "#fff", color: "#0f172a", textAlign: "left" }}><img src={flagUrl(item.country)} alt="" width="24" height="18" style={{ borderRadius: "2px" }}/><span>{item.name} ({item.country})</span><strong>+{item.callingCode}</strong></button>)}</div></div>}
  </div>;
}