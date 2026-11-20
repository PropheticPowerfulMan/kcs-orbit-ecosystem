import QRCode from 'qrcode'
import { getAssetUrl } from './assets'
import { showOfficialDocument } from './officialDocumentPreview'

export type AdminInstitutionalRow = { section: string; metric: string; value: string | number; detail: string; action: string }
export type AdminInstitutionalReport = {
  title: string; period: string; category: string; cadence: string; language: 'fr' | 'en';
  author: string; rows: AdminInstitutionalRow[]; filename?: string;
}
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Descriptive counts only: indicator values and their academic calculations are never changed. */
export function institutionalReportSummary(rows: AdminInstitutionalRow[]) {
  const groups = new Map<string, number>()
  for (const row of rows) groups.set(row.section, (groups.get(row.section) ?? 0) + 1)
  return { indicators: rows.length, sections: groups.size, actions: rows.filter(row => row.action.trim()).length,
    groups: [...groups].map(([section, count]) => ({ section, count })) }
}

export async function buildAdminInstitutionalReport(report: AdminInstitutionalReport) {
  const fr = report.language === 'fr', tr = (a: string, b: string) => fr ? a : b, stats = institutionalReportSummary(report.rows)
  const canonical = JSON.stringify(report), issued = new Date()
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)))).map(v => v.toString(16).padStart(2, '0')).join('')
  const reference = 'KCS-ADM-' + issued.toISOString().slice(0,10).replace(/-/g,'') + '-' + fingerprint.slice(0,12).toUpperCase()
  const qr = await QRCode.toString(JSON.stringify({issuer:'KCS Nexus AI',type:'ADMIN_REPORT',reference,snapshotSha256:fingerprint,school:'https://kinshasachristianschool.org'}),{type:'svg',errorCorrectionLevel:'M',margin:4,width:140})
  const logo = new URL(getAssetUrl('images/kcs.jpg'), location.origin).href
  const max = Math.max(1,...stats.groups.map(group=>group.count)), graphHeight = Math.max(80,stats.groups.length*36+16)
  const graph = stats.groups.length ? '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(tr('Nombre d’indicateurs par volet','Indicator count by section'))+'" viewBox="0 0 580 '+graphHeight+'">'+stats.groups.map((group,index)=>{
    const y=index*36+12
    return '<g><title>'+esc(group.section)+' · '+group.count+'</title><text x="0" y="'+(y+15)+'" fill="#31556b" font-size="12">'+esc(group.section.length>27?group.section.slice(0,24)+'…':group.section)+'</text><rect x="190" y="'+y+'" width="326" height="22" rx="5" fill="#e3edf2"/><rect x="190" y="'+y+'" width="'+(326*group.count/max).toFixed(2)+'" height="22" rx="5" fill="#24768a"/><text x="536" y="'+(y+16)+'" fill="#173d54" font-weight="700" font-size="13">'+group.count+'</text></g>'
  }).join('')+'</svg>' : '<p class="empty">'+tr('Aucun indicateur disponible.','No indicator available.')+'</p>'
  const body = report.rows.length ? report.rows.map(row=>'<tr><td>'+esc(row.section)+'</td><td><b>'+esc(row.metric)+'</b></td><td class="value">'+esc(row.value)+'</td><td>'+esc(row.detail)+'</td><td>'+esc(row.action)+'</td></tr>').join('') : '<tr><td colspan="5" class="empty">'+tr('Aucun indicateur disponible pour cette sélection.','No indicators available for this selection.')+'</td></tr>'
  const style = [
    '@page{size:A4 landscape;margin:12mm 14mm 17mm;@bottom-left{content:"KCS · '+reference+'";font:7px Arial;color:#587082}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:7px Arial;color:#587082}}',
    '*{box-sizing:border-box}body{margin:0;background:#e7eff4;color:#173d54;font:10px/1.55 "Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.paper{position:relative;isolation:isolate;width:269mm;margin:16px auto;background:#fff;padding:9mm 11mm;box-shadow:0 18px 55px #0e203322}',
    '.watermark{position:fixed;left:50%;top:50%;width:105mm;height:105mm;transform:translate(-50%,-50%);object-fit:contain;opacity:.035;z-index:-1;pointer-events:none}',
    '.masthead{display:flex;align-items:center;gap:17px;border-top:5px solid #173d54;border-bottom:2px solid #c5a35d;padding:13px 0}.logo{width:23mm;height:23mm;object-fit:contain;flex-shrink:0}',
    '.kicker{font-size:8px;letter-spacing:.17em;text-transform:uppercase;font-weight:800;color:#527283}.brand{font-size:18px;font-weight:800;letter-spacing:.05em}.masthead h1{font-size:17px;line-height:1.3;margin:5px 0}',
    '.confidential{margin-left:auto;flex-shrink:0;padding:8px 10px;border:1px solid #baa069;color:#79612d;border-radius:5px;text-align:center;font-size:8px;font-weight:800}',
    '.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:13px 0}.meta>div{padding:9px 11px;background:#f0f5f8;border:1px solid #d1dfe7;border-radius:6px;overflow-wrap:anywhere}.meta small,.metric small{display:block;color:#577082;font-size:8px}.meta b{display:block;margin-top:3px;font-size:10px}',
    '.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:13px 0}.metric{border:1px solid #b8cdd9;border-left:4px solid #24768a;padding:10px 12px;border-radius:6px;break-inside:avoid}.metric b{display:block;font-size:24px;color:#173f56;line-height:1.3;margin-top:3px;font-variant-numeric:tabular-nums}',
    '.overview{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;margin:15px 0}.chart,.reading{border:1px solid #d2e0e7;border-radius:7px;padding:12px;break-inside:avoid}.chart svg{display:block;width:100%;height:auto}.chart h2,.reading h2{font-size:11px;margin:0 0 8px;color:#174b64}.reading p{margin:5px 0;line-height:1.6;color:#4a677a}',
    '.method{font-size:9px;line-height:1.6;color:#506c7e;border-left:3px solid #c5a35d;padding:9px 12px;background:#f7f5ef;break-inside:avoid}',
    'table{width:100%;table-layout:fixed;border-collapse:collapse;margin:14px 0;font-size:9px}thead{display:table-header-group}th{background:#183d54;color:white;text-align:left;padding:9px 8px;font-size:8px;text-transform:uppercase;letter-spacing:.04em}th:nth-child(1){width:12%}th:nth-child(2){width:18%}th:nth-child(3){width:10%}th:nth-child(4){width:30%}th:nth-child(5){width:30%}',
    'td{padding:9px 8px;vertical-align:top;border-bottom:1px solid #d6e1e8;overflow-wrap:anywhere;white-space:pre-line}tbody tr:nth-child(even){background:#f1f6f9}tr{break-inside:avoid}.value{font-size:12px;font-weight:800;color:#174b64;font-variant-numeric:tabular-nums}.empty{padding:16px;color:#587082}',
    '.identity{display:flex;align-items:center;gap:13px;border:1px solid #bed0db;border-radius:7px;padding:10px;margin-top:17px;break-inside:avoid}.identity svg{width:27mm;height:27mm;flex-shrink:0;background:#fff}.identity b{font-size:10px}.identity p{font-size:8px;margin:3px 0;color:#526b7c}.hash{font:8px/1.6 monospace;overflow-wrap:anywhere;color:#526b7c}',
    '.signature{display:flex;justify-content:flex-end;margin:20px 0 15px;break-inside:avoid}.signature>div{width:65mm;padding-top:7px;border-top:1px solid #43677c;text-align:center;font-size:9px}',
    'footer{display:flex;justify-content:space-between;gap:15px;border-top:2px solid #c5a35d;padding-top:8px;font-size:8px;color:#526b7c;break-inside:avoid}',
    '@media print{body{background:#fff}.paper{width:auto;margin:0;padding:0;box-shadow:none}}@media screen and (max-width:1000px){.paper{width:100%;padding:15px}.masthead{flex-wrap:wrap}.meta{grid-template-columns:repeat(2,minmax(0,1fr))}.overview{grid-template-columns:1fr}}'
  ].join('\n')
  const html = '<!doctype html><html lang="'+report.language+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(report.title)+'</title><style>'+style+'</style></head><body><main class="paper" data-official-document><img class="watermark" src="'+esc(logo)+'" alt=""><header class="masthead"><img class="logo" src="'+esc(logo)+'" alt="KCS"><div><div class="kicker">KCS Orbit Ecosystem · '+tr('Superadministration','Super Administration')+'</div><div class="brand">KINSHASA CHRISTIAN SCHOOL</div><h1>'+esc(report.title)+'</h1></div><div class="confidential">'+tr('CONFIDENTIEL<br>USAGE ADMINISTRATIF','CONFIDENTIAL<br>ADMINISTRATIVE USE')+'</div></header>'
    +'<section class="meta">'+[[tr('Type de rapport','Report type'),report.category],[tr('Fréquence','Frequency'),report.cadence],[tr('Période du rapport','Reporting window'),report.period],[tr('Préparé par','Prepared by'),report.author]].map(([label,value])=>'<div><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b></div>').join('')+'</section>'
    +'<section class="metrics">'+[[tr('Indicateurs','Indicators'),stats.indicators],[tr('Volets couverts','Sections covered'),stats.sections],[tr('Recommandations présentées','Recommendations listed'),stats.actions]].map(([label,value])=>'<div class="metric"><small>'+esc(label)+'</small><b>'+value+'</b></div>').join('')+'</section>'
    +'<section class="overview"><div class="chart"><h2>'+tr('Répartition des indicateurs par volet','Indicators by section')+'</h2>'+graph+'</div><div class="reading"><h2>'+tr('Lecture du document','Reading this report')+'</h2><p>'+tr('Le tableau ci-dessous reprend chaque indicateur, sa valeur, son détail et l’action recommandée.','The table below retains every indicator, its value, detail and recommended action.')+'</p><p>'+tr('Le graphique compte les indicateurs par volet. Il ne compare pas des notes, des pourcentages et des effectifs de natures différentes.','The chart counts indicators by section. It does not compare grades, percentages and headcounts with different units.')+'</p></div></section>'
    +'<p class="method">'+tr('Méthode : instantané des indicateurs affichés au moment de la génération. Les valeurs et recommandations sont conservées ; une valeur absente reste signalée comme telle. La période ci-dessus est la fenêtre de rapport sélectionnée.','Method: snapshot of the displayed indicators at generation time. Values and recommendations are retained; unavailable values remain explicitly unavailable. The dates above identify the selected reporting window.')+'</p>'
    +'<table><thead><tr>'+[tr('Volet','Section'),tr('Indicateur','Indicator'),tr('Valeur','Value'),tr('Détail','Detail'),tr('Action recommandée','Recommended action')].map(v=>'<th>'+v+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table>'
    +'<section class="identity">'+qr+'<div><b>'+reference+'</b><p>'+tr('QR de référence : identifie ce document et son empreinte de données. Il ne constitue pas une signature électronique ni une validation en ligne.','Reference QR: identifies this document and its data fingerprint. It is not an electronic signature or online verification.')+'</p><div class="hash">'+tr('Empreinte SHA-256','Snapshot SHA-256')+': '+fingerprint+'</div></div></section>'
    +'<div class="signature"><div>'+esc(report.author)+'<br>'+tr('Superadministration · visa / signature','Super Administration · review / signature')+'</div></div>'
    +'<footer><span>KINSHASA CHRISTIAN SCHOOL · KCS Nexus AI<br>Avenue de la République n° 1 · Macampagne, Ngaliema · Kinshasa · Réf. 80 jours<br>+243 895 326 011 · +243 994 645 735<br>kinshasachristianschool@gmail.com · www.kinshasachristianschool.org</span><span>'+reference+'<br>'+tr('Généré le','Generated')+' '+esc(issued.toLocaleString(fr?'fr-CD':'en-GB',{timeZone:'Africa/Kinshasa'}))+' · Africa/Kinshasa</span></footer></main></body></html>'
  return {html,filename:report.filename||reference,fingerprint,reference}
}

export async function printAdminInstitutionalReport(report: AdminInstitutionalReport) {
  const win = window.open('', '_blank', 'width=1250,height=900')
  if (!win) return false
  win.document.body.textContent = report.language === 'fr' ? 'Préparation du rapport…' : 'Preparing the report…'
  try {
    const document = await buildAdminInstitutionalReport(report)
    await showOfficialDocument(win,document.html,{filename:document.filename,language:report.language})
    return true
  } catch {
    if (!win.closed) win.document.body.textContent = report.language === 'fr' ? 'Le rapport n’a pas pu être préparé. Vérifiez la connexion puis réessayez.' : 'The report could not be prepared. Check the connection and retry.'
    return false
  }
}
