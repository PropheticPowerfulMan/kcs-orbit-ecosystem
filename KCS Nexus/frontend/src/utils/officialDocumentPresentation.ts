/* A finishing layer only: no content, dimensions, pagination or signed identities are changed. */
const academicFinish = '<style data-kcs-academic-finish>' + [
  ':root{--academic-ink:#173d54;--academic-gold:#c5a35d;--academic-line:#bed0db}',
  'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
  '.top-line{background:linear-gradient(90deg,#183d54 0 72%,#c5a35d 72% 86%,#27859b 86%)}',
  '.masthead,.head,.header{border-bottom-color:#c5a35d}',
  '.document-title h1,.school-name,.school,.head h1{color:#173d54}',
  '.identity{background:linear-gradient(120deg,#edf4f7,#f7f8f5);border-color:#bed0db}',
  '.meta>div,.summary>.card,.metrics>.metric,.attendance>.stat{border-color:#c5d6df;background-color:#f3f7f9}',
  '.auth,.authenticity,.document-identity{border-color:#bed0db;border-top-color:#c5a35d;background-color:#f2f6f8}',
  '.sheet table thead th,body>table thead th{background-color:#183d54;color:#fff}',
  'table tbody tr:nth-child(even){background-color:#f2f6f8}',
  'table td{border-color:#d5e1e8;font-variant-numeric:tabular-nums}',
  '.average b,.metric b,.card b,.indicator b{font-variant-numeric:tabular-nums}',
  'footer,.footer{border-top-color:#c5a35d}',
  '.qr img,.auth img,.authenticity img,.document-identity img{image-rendering:auto;background-color:#fff}',
  '@media screen{.sheet{box-shadow:0 18px 55px #0e203333;border-color:#b7cad6}}',
].join('\n') + '</style>'

/** Reapplying the finish is harmless: previews, downloads and mailed PDFs use the same presentation. */
export function enhanceOfficialDocument(html: string): string {
  return html.includes('<style data-kcs-academic-finish>') ? html : html.replace(/<\/head>/i, academicFinish + '</head>')
}
