import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { financeAPI } from '@/services/api'

type Snapshot = {
  source?: string
  synchronizedAt?: string
  portalUrl?: string
  academicYear?: { name?: string }
  profile?: Record<string, any>
  students?: Array<Record<string, any>>
  installments?: Array<Record<string, any>>
  paymentHistory?: Array<Record<string, any>>
}

const card = 'rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const money = (value?: number) => new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0))
const dateText = (value?: string | null) => value ? new Intl.DateTimeFormat('fr-CD', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const badge = (status?: string, overdue?: boolean) => overdue || ['OVERDUE', 'FAILED'].includes(String(status))
  ? 'bg-red-100 text-red-700'
  : ['PAID', 'COMPLETED'].includes(String(status)) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'

export default function ParentFinancePanel() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await financeAPI.getParentProfile()
      setData(response.data?.data ?? null)
    } catch (reason: any) {
      setData(null)
      setError(reason?.response?.data?.message ?? 'Les informations financières EduPay sont temporairement indisponibles.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  const installments = useMemo(
    () => [...(data?.installments ?? [])].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
    [data?.installments],
  )
  const portalUrl = data?.portalUrl ?? 'https://edupay.kinshasachristianschool.org/'

  if (loading) {
    return <div className={card}><RefreshCw className='mr-2 inline animate-spin' size={18}/>Synchronisation sécurisée avec EduPay…</div>
  }
  if (error || !data) {
    return <div className={card}>
      <AlertTriangle className='text-amber-500'/>
      <h2 className='mt-3 text-xl font-bold dark:text-white'>Compte financier à vérifier</h2>
      <p className='mt-2 text-sm text-gray-600 dark:text-gray-300'>{error}</p>
      <p className='mt-2 text-xs text-gray-500'>Nexus ne montre aucune donnée sans correspondance familiale unique et vérifiée.</p>
      <div className='mt-5 flex gap-3'>
        <button onClick={() => void load()} className='rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white'>Réessayer</button>
        <a href={portalUrl} target='_blank' rel='noreferrer' className='rounded-xl border px-4 py-2 text-sm font-semibold text-kcs-blue-700'>Ouvrir EduPay</a>
      </div>
    </div>
  }

  const profile = data.profile ?? {}
  return <div className='space-y-6'>
    <div className={card + ' bg-gradient-to-br from-white via-sky-50 to-blue-100 dark:from-kcs-blue-900 dark:to-kcs-blue-800'}>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <p className='flex items-center gap-2 text-xs font-bold uppercase text-kcs-blue-600 dark:text-sky-300'><ShieldCheck size={17}/>Source officielle : {data.source ?? 'EduPay'} · {data.academicYear?.name}</p>
          <h2 className='mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white'>Situation financière détaillée</h2>
          <p className='mt-2 text-sm text-gray-600 dark:text-gray-300'>Lecture seule synchronisée depuis EduPay · actualisé le {dateText(data.synchronizedAt)}</p>
        </div>
        <div className='flex gap-3'>
          <button onClick={() => void load()} className='rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-kcs-blue-700'><RefreshCw className='mr-1 inline' size={15}/>Actualiser</button>
          <a href={portalUrl} target='_blank' rel='noreferrer' className='rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white'>Accéder à EduPay <ExternalLink className='ml-1 inline' size={14}/></a>
        </div>
      </div>
    </div>
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {[
        ['Total attendu', profile.expectedNetRevenue],
        ['Total payé', profile.totalPaid],
        ['Solde restant', profile.totalDebt],
        ['Réductions', profile.totalReduction],
      ].map(([label, value]) => <div key={String(label)} className={card}>
        <p className='text-xs font-bold uppercase text-gray-400'>{label}</p>
        <p className='mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white'>{money(Number(value))}</p>
      </div>)}
    </div>

    <div className={card}>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <h2 className='font-bold dark:text-white'>Progression du plan</h2>
          <p className='text-sm text-gray-500'>{profile.activeTuitionPlan || 'Plan non défini'} · {profile.overdueInstallments ?? 0} échéance(s) en retard</p>
        </div>
        <strong className='text-2xl text-kcs-blue-700 dark:text-sky-300'>{Number(profile.completionRate ?? 0).toFixed(1)}%</strong>
      </div>
      <div className='mt-4 h-3 overflow-hidden rounded-full bg-sky-100 dark:bg-kcs-blue-950'>
        <div className='h-full bg-gradient-to-r from-kcs-blue-600 to-emerald-500' style={{ width: Math.min(100, Math.max(0, Number(profile.completionRate ?? 0))) + '%' }}/>
      </div>
      <div className='mt-3 flex flex-wrap gap-5 text-xs text-gray-500'>
        <span>Paiements en attente : <strong>{money(profile.pendingPaymentsTotal)}</strong></span>
        <span>Dette reportée : <strong>{money(profile.carriedOverDebt)}</strong></span>
        <span>Dernier paiement : <strong>{dateText(profile.lastPaymentAt)}</strong></span>
      </div>
    </div>

    <section>
      <h2 className='mb-4 text-xl font-bold dark:text-white'>Détail par enfant</h2>
      <div className='grid gap-4 lg:grid-cols-2'>
        {(data.students ?? []).map((student) => <div key={student.id} className={card}>
          <div className='flex justify-between gap-4'>
            <div><h3 className='font-bold dark:text-white'>{student.fullName}</h3><p className='text-sm text-gray-500'>{student.className || 'Classe non renseignée'} · {student.paymentOptionLabel || student.planName || 'Plan à définir'}</p></div>
            <strong className='text-kcs-blue-700 dark:text-sky-300'>{Number(student.completionRate ?? 0).toFixed(1)}%</strong>
          </div>
          <div className='mt-4 grid grid-cols-2 gap-3 text-sm'>
            {[['Attendu', student.expectedTotal], ['Payé', student.paid], ['Solde', student.balance], ['Réduction', student.reductionTotal]].map(([label, value]) => <div key={String(label)} className='rounded-xl bg-sky-50 p-3 dark:bg-kcs-blue-800/30'><span className='text-gray-500'>{label}</span><strong className='mt-1 block dark:text-white'>{money(Number(value))}</strong></div>)}
          </div>
        </div>)}
      </div>
    </section>
    <div className={card}>
      <h2 className='mb-4 text-xl font-bold dark:text-white'>Échéancier officiel</h2>
      {installments.length === 0 ? <p className='text-sm text-gray-500'>Aucune échéance générée.</p> : <div className='overflow-x-auto'>
        <table className='min-w-[700px] w-full text-sm'>
          <thead><tr className='border-b text-left text-xs uppercase text-gray-400'><th className='pb-3'>Élève / échéance</th><th>Date</th><th className='text-right'>À payer</th><th className='text-right'>Payé</th><th className='text-right'>Solde</th><th className='text-right'>Statut</th></tr></thead>
          <tbody>{installments.map((item) => <tr key={item.id} className='border-b border-sky-50 dark:border-kcs-blue-800'>
            <td className='py-3'><strong className='block dark:text-white'>{item.studentName || 'Famille'}</strong><span className='text-xs text-gray-500'>{item.label}</span></td>
            <td>{dateText(item.dueDate)}</td>
            <td className='text-right'>{money(item.amountDue)}</td>
            <td className='text-right'>{money(item.amountPaid)}</td>
            <td className='text-right font-bold'>{money(item.balance)}</td>
            <td className='text-right'><span className={'rounded-full px-2 py-1 text-xs font-bold ' + badge(item.status, item.isOverdue)}>{item.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
    <div className={card}>
      <h2 className='mb-4 text-xl font-bold dark:text-white'>Historique des paiements et reçus</h2>
      {(data.paymentHistory ?? []).length === 0 ? <p className='text-sm text-gray-500'>Aucun paiement enregistré.</p> : <div className='space-y-3'>
        {(data.paymentHistory ?? []).slice(0, 20).map((payment) => <div key={payment.id} className='flex flex-col justify-between gap-3 rounded-xl bg-sky-50 p-4 dark:bg-kcs-blue-800/30 sm:flex-row sm:items-center'>
          <div>
            <p className='font-bold dark:text-white'>{payment.transactionNumber || 'Transaction EduPay'}</p>
            <p className='text-xs text-gray-500'>{dateText(payment.createdAt)} · {payment.method || 'Méthode non renseignée'} · reçu {payment.receiptNumber || 'en attente'}</p>
            <p className='mt-1 text-xs text-gray-500'>{(payment.students ?? []).map((student: any) => student.fullName).join(', ') || payment.reason || 'Compte familial'}</p>
          </div>
          <div className='sm:text-right'>
            <strong className='block text-lg text-emerald-700 dark:text-emerald-300'>{money(payment.amount)}</strong>
            <span className={'text-xs font-bold ' + badge(payment.status)}>{payment.status}</span>
          </div>
        </div>)}
      </div>}
    </div>
  </div>
}
