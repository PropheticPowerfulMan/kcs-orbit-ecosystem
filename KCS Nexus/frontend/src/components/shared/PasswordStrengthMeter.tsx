import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { evaluatePassword } from '@/utils/passwordStrength'

export default function PasswordStrengthMeter({ password, identityValues = [] }: { password: string; identityValues?: Array<string | null | undefined> }) {
  const language = useUIStore((state) => state.language)
  if (!password) return null
  const result = evaluatePassword(password, identityValues)
  const tone = result.strong ? 'bg-emerald-500' : result.score >= 65 ? 'bg-amber-500' : 'bg-red-500'
  const label = result.strong
    ? (language === 'fr' ? 'Fort et conforme' : 'Strong and compliant')
    : (language === 'fr' ? 'Encore vulnérable' : 'Still vulnerable')
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/50">
    <div className="flex items-center justify-between gap-3 text-xs font-bold">
      <span className={result.strong ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
        {result.strong ? <CheckCircle2 className="mr-1 inline" size={15}/> : <ShieldAlert className="mr-1 inline" size={15}/>}
        {label}
      </span>
      <span className="text-slate-500 dark:text-slate-300">{result.score}%</span>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-kcs-blue-800"><div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${result.score}%` }}/></div>
    <div className="mt-3 grid gap-1 sm:grid-cols-2">
      {result.checks.map((check) => <span key={check.key} className={`flex items-center gap-1.5 text-[11px] ${check.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
        {check.passed ? <CheckCircle2 size={12}/> : <XCircle size={12}/>} {language === 'fr' ? check.fr : check.en}
      </span>)}
    </div>
    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-300">{language === 'fr' ? 'Conseil : utilisez une phrase de passe unique, longue et réservée à KCS. Aucun mot de passe ne peut être déclaré « inviolable », mais cette politique réduit fortement les risques.' : 'Tip: use a unique, long passphrase reserved for KCS. No password can be called unbreakable, but this policy greatly reduces risk.'}</p>
  </div>
}
