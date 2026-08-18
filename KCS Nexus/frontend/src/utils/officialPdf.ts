import { getAssetUrl } from '@/utils/assets'

type OfficialPdfOptions = {
  title: string
  subtitle?: string
  metadata?: Array<[string, string | number]>
  columns?: string[]
  rows?: Array<Array<string | number | null | undefined>>
  narrative?: string
  orientation?: 'portrait' | 'landscape'
}

const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] ?? character))

/** Opens a print-ready document. Browsers expose “Save as PDF” in the native print dialog. */
export const printOfficialPdf = ({ title, subtitle = 'KCS Nexus AI — Official school document', metadata = [], columns = [], rows = [], narrative, orientation = 'portrait' }: OfficialPdfOptions) => {
  const output = window.open('', '_blank', 'width=1180,height=860')
  if (!output) return false
  const logo = new URL(getAssetUrl('images/kcs-logo.png'), window.location.origin).href
  const header = columns.length ? `<table><thead><tr>${columns.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">No record available.</td></tr>`}</tbody></table>` : ''
  output.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 ${orientation};margin:13mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#10234f;font-size:11px}.watermark{position:fixed;inset:22% 18%;width:64%;height:56%;object-fit:contain;opacity:.045;z-index:-1}.header{display:flex;align-items:center;gap:15px;border-bottom:4px solid #d8a928;padding-bottom:12px}.logo{width:76px;height:76px;object-fit:contain}.school{font-size:21px;font-weight:800;letter-spacing:.4px;margin:0}.subtitle{margin:5px 0 0;color:#167aaa;font-weight:700}.seal{margin-left:auto;border:2px solid #a61b1b;color:#a61b1b;padding:7px 10px;font-weight:800;transform:rotate(-2deg)}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.meta div{border:1px solid #dce3ee;border-radius:8px;padding:8px;background:#f8fafc}.meta small{display:block;color:#65738b;text-transform:uppercase;font-size:8px}.narrative{margin:14px 0;padding:11px;border-left:4px solid #167aaa;background:#f3f7fb;line-height:1.5}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:10px}th{background:#10234f;color:#fff;padding:8px;text-align:left}td{border:1px solid #dce3ee;padding:7px;vertical-align:top;line-height:1.35}tbody tr:nth-child(even){background:#f7f9fc}.signature{margin:32px 0 12px auto;width:255px;border-top:1px solid #10234f;padding-top:6px;text-align:center;font-size:9px}.footer{display:flex;justify-content:space-between;border-top:1px solid #bcc7d8;padding-top:8px;font-size:8px;color:#65738b}</style></head><body><img class="watermark" src="${logo}" alt=""><header class="header"><img class="logo" src="${logo}" alt="KCS logo"><div><p class="school">KINSHASA CHRISTIAN SCHOOL</p><p class="subtitle">${escapeHtml(title)}</p><small>${escapeHtml(subtitle)}</small></div><div class="seal">OFFICIAL</div></header>${metadata.length ? `<section class="meta">${metadata.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`).join('')}</section>` : ''}${narrative ? `<p class="narrative">${escapeHtml(narrative)}</p>` : ''}${header}<div class="signature">Authorized teacher / administrative signature</div><footer class="footer"><span>Generated ${escapeHtml(new Date().toLocaleString())}</span><span>KCS Nexus AI · Controlled school record</span></footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`)
  output.document.close()
  return true
}
