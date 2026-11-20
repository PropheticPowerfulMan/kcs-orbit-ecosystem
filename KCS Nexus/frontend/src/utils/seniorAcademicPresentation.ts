/** Presentation only: the signed identity, QR, results, dates and names remain byte-for-byte intact. */
export function seniorAcademicPresentation(html: string) {
  const style = `<style data-senior-document-presentation>
    .top-line{background:linear-gradient(90deg,#183d54 0 72%,#c5a35d 72% 86%,#27859b 86%)}
    .masthead{border-bottom-color:#c5a35d}.document-title h1,.school-name{color:#173d54}
    .identity{background:linear-gradient(120deg,#edf4f7,#f7f8f5);border-color:#bed0db}
    .authenticity,.document-identity{background:#f2f6f8;border-color:#bed0db}
    footer{border-top-color:#c5a35d}table thead th{background-color:#183d54;color:#fff}
    @media screen{.sheet{box-shadow:0 18px 55px #0e203333;border-color:#b7cad6}}
  </style>`
  return html.replace(/<\/head>/i, style + '</head>')
}
