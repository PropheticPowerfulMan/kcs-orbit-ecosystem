import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
export default function MutationFeedback() {
  const { lang } = useI18n(); const L = (fr: string, en: string) => lang === "fr" ? fr : en; const [message, setMessage] = useState("");
  useEffect(() => { const show = (event: Event) => setMessage((event as CustomEvent<{ message?: string }>).detail?.message || L("Modification enregistrée avec succès.", "Changes saved successfully.")); window.addEventListener("ecosystem:mutation-success", show); return () => window.removeEventListener("ecosystem:mutation-success", show); }, [lang]);
  if (!message) return null;
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><section className="w-full max-w-md rounded-2xl border border-emerald-300/50 bg-slate-900 p-6 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-300/20 text-2xl text-emerald-300">✓</div><h2 className="mt-4 text-xl font-bold text-white">{L("Opération réussie", "Operation successful")}</h2><p className="mt-3 text-sm text-slate-200">{message}</p><button type="button" onClick={() => setMessage("")} className="mt-6 w-full rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950">{L("Compris", "Got it")}</button></section></div>;
}
