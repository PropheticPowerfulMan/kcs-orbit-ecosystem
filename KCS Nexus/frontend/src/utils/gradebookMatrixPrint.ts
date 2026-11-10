export type MatrixAssessment = {
  id: string; title: string; date: string; category: string; maxPoints: number; term: string;
}
export type MatrixRow = {
  name: string; className: string; average: number | null; letter: string;
  scores?: Record<string, string>;
}
export function gradebookMatrixPages(assessments: MatrixAssessment[], rows: MatrixRow[]) {
  const columns = [...assessments].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const pages: Array<{ assessments: MatrixAssessment[]; rows: MatrixRow[]; firstRow: number; firstColumn: number }> = [];
  for (let column = 0; column < Math.max(1, columns.length); column += 6) {
    for (let row = 0; row < Math.max(1, rows.length); row += 16) {
      pages.push({ assessments: columns.slice(column, column + 6), rows: rows.slice(row, row + 16), firstRow: row, firstColumn: column });
    }
  }
  return pages;
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export const gradebookMatrixStyles = `
.matrix-sheet{height:190mm;min-height:190mm;padding:6mm 8mm;break-after:page;overflow:hidden}
.matrix-sheet:last-of-type{break-after:auto}.matrix-content{height:100%;display:flex;flex-direction:column}
.matrix-sheet .head{min-height:18mm;gap:5mm}.matrix-sheet .head img{width:16mm;height:16mm}
.matrix-sheet .head h1{font-size:17px}.matrix-sheet .head p{font-size:8px;max-width:215mm;overflow-wrap:anywhere}
.matrix-ribbon{display:flex;justify-content:space-between;gap:3mm;background:#e5f5f4;border-left:4px solid #087f81;color:#075c68;padding:2mm 3mm;margin-top:2mm;font-size:8px}
.matrix-stats{display:flex;justify-content:space-between;gap:3mm;margin:2mm 0;font-size:8px;color:#36556d}
.matrix-table{table-layout:fixed;margin-top:1mm;font-size:8px}.matrix-table th{padding:2mm 1.5mm;height:17mm;font-size:8px;text-transform:none;overflow-wrap:anywhere;text-align:center;vertical-align:top}
.matrix-table th:first-child{width:53mm;text-align:left}.matrix-table th:last-child{width:22mm;background:#075c68}
.matrix-table th small{display:block;margin-top:1mm;font-size:7px;font-weight:400}.matrix-table td{padding:1mm 1.5mm;height:6mm;text-align:center;overflow-wrap:anywhere}
.matrix-table td:first-child{text-align:left}.matrix-table .learner{font-weight:600}.matrix-table .learner small{display:block;font-weight:400;font-size:7px;color:#48637b}
.matrix-table .final{background:#e5f5f4;color:#075c68;font-weight:800}.matrix-table .column-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.matrix-sheet .auth{margin-top:auto;padding-top:2mm;grid-template-columns:19mm 1fr;gap:3mm;min-height:20mm}.matrix-sheet .auth img{width:18mm;height:18mm}.matrix-sheet .auth p{font-size:6px;line-height:1.35}
@media print{.matrix-sheet{width:277mm;margin:0}}
`;
export function renderGradebookMatrix(input: {
  courseName: string; academicYear: string; term: string; assessments: MatrixAssessment[];
  rows: MatrixRow[]; categories: Array<{ name: string; weight: number }>;
  classAverage: number; median: number; successRate: number;
  origin: string; documentId: string; fingerprint: string; qr: string; verificationUrl: string; issuedAt: string; french: boolean;
}) {
  const tr = (fr: string, en: string) => input.french ? fr : en;
  const pages = gradebookMatrixPages(input.assessments, input.rows);
  const dateLabel = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Intl.DateTimeFormat(input.french ? 'fr-FR' : 'en-GB', { timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z')) : date;
  return pages.map((page, index) => `<main class="sheet matrix-sheet"><div class="watermark"><img src="${escapeHtml(input.origin)}/images/kcs.jpg" alt=""></div><div class="content matrix-content">
    <header class="head"><img src="${escapeHtml(input.origin)}/images/kcs.jpg" alt="KCS"><div><h1>${tr('REGISTRE DÉTAILLÉ DES ÉVALUATIONS', 'DETAILED ASSESSMENT REGISTER')}</h1><p>${escapeHtml(input.courseName)} · ${escapeHtml(input.academicYear)} · ${escapeHtml(input.term)}</p><p>${escapeHtml(input.documentId)} · ${tr('Page', 'Page')} ${index + 1} / ${pages.length}</p></div></header>
    <div class="matrix-ribbon"><b>${tr('Toutes les colonnes · moyenne finale pondérée', 'Every assessment column · weighted final average')}</b><span>${tr('Travaux', 'Assessments')} ${page.assessments.length ? page.firstColumn + 1 : 0}–${page.firstColumn + page.assessments.length} / ${input.assessments.length} · ${tr('Élèves', 'Learners')} ${page.rows.length ? page.firstRow + 1 : 0}–${page.firstRow + page.rows.length} / ${input.rows.length}</span></div>
    <div class="matrix-stats"><span>${tr('Moyenne de classe', 'Class average')} <b>${input.classAverage.toFixed(2)}%</b></span><span>${tr('Médiane', 'Median')} <b>${input.median.toFixed(2)}%</b></span><span>${tr('Réussite ≥ 70 %', 'Pass rate ≥ 70%')} <b>${input.successRate.toFixed(1)}%</b></span></div>
    <table class="matrix-table"><thead><tr><th>${tr('Élève / classe', 'Learner / class')}</th>${page.assessments.map(task => `<th><span class="column-title">${escapeHtml(task.title)}</span><small>${escapeHtml(dateLabel(task.date))} · ${escapeHtml(task.category)}</small><small>${escapeHtml(task.term)} · / ${escapeHtml(task.maxPoints)}</small></th>`).join('')}<th>${tr('Moyenne finale', 'Final average')}<small>${tr('Pondérée · tous les travaux de la période', 'Weighted · all work in this period')}</small></th></tr></thead>
    <tbody>${page.rows.map(row => `<tr><td class="learner">${escapeHtml(row.name)}<small>${escapeHtml(row.className)}</small></td>${page.assessments.map(task => `<td>${escapeHtml(row.scores?.[task.id]?.trim() || '—')}</td>`).join('')}<td class="final">${row.average == null ? '—' : row.average.toFixed(2) + '%'}<br><small>${escapeHtml(row.letter)}</small></td></tr>`).join('') || `<tr><td colspan="${page.assessments.length + 2}">${tr('Aucun élève inscrit à ce cours.', 'No learners enrolled in this course.')}</td></tr>`}</tbody></table>
    <section class="auth"><img src="${escapeHtml(input.qr)}" alt="QR"><div><p><b>${tr('Authentification numérique KCS · registre détaillé', 'KCS digital authentication · detailed register')}</b> · ${tr('Page', 'Page')} ${index + 1} / ${pages.length}</p><p>${tr('Pondérations', 'Weights')} · ${input.categories.map(category => escapeHtml(category.name) + ' ' + category.weight + '%').join(' · ')}</p><p>${tr('— indique une note non saisie. La moyenne est celle du Gradebook, calculée sur toute la période, pas sur cette seule page.', '— indicates an unentered score. The average matches the Gradebook for the entire period, across all pages.')}</p><p>SHA-256 ${escapeHtml(input.fingerprint)}</p><p>${escapeHtml(input.verificationUrl)}</p><p>UTC ${escapeHtml(input.issuedAt)}</p></div></section>
  </div></main>`).join('');
}
