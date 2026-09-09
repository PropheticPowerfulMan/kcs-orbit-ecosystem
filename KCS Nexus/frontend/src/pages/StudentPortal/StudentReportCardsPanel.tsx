import { FileCheck2, Download } from 'lucide-react'

type ReportCard = {
  id: string
  term: string
  average: number
  conduct?: string | null
  teacherComment?: string | null
  attendanceSummary?: unknown
  pdfUrl?: string | null
  portalPostedAt?: string | null
  publicationStatus: string
}

const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'

export default function StudentReportCardsPanel({ reportCards }: { reportCards: ReportCard[] }) {
  return <section className={card}>
    <div className="flex items-center gap-3"><span className="rounded-xl bg-kcs-blue-50 p-3 text-kcs-blue-700 dark:bg-kcs-blue-950"><FileCheck2 size={22}/></span><div><h2 className="font-bold dark:text-white">Official report cards</h2><p className="mt-1 text-sm text-gray-500">Only report cards posted to your verified student portal appear here.</p></div></div>
    {reportCards.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">No official report card has been posted yet.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{reportCards.map((report) => <article key={report.id} className="rounded-2xl border border-gray-100 p-4 dark:border-kcs-blue-800"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">{report.term}</p><p className="mt-1 text-3xl font-bold text-kcs-blue-900 dark:text-white">{report.average.toFixed(1)}%</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">POSTED</span></div>{report.conduct && <p className="mt-3 text-sm"><strong>Conduct:</strong> {report.conduct}</p>}{report.teacherComment && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{report.teacherComment}</p>}{report.portalPostedAt && <p className="mt-3 text-xs text-gray-400">Posted {new Date(report.portalPostedAt).toLocaleString()}</p>}{report.pdfUrl && <a href={report.pdfUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-kcs-blue-600"><Download size={16}/>Download official report card</a>}</article>)}</div>}
  </section>
}
