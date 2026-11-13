import QRCode from "qrcode";
import { academicRecordsAPI } from "@/services/api";
import { rankGradebookRows } from "./gradebookRanking";
import {
  reportStatistics,
  reportResultForCourse,
  type ReportStatisticsStudent,
} from "./reportCardStatistics";

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export async function printReportCardAnalytics(
  input: {
    students: ReportStatisticsStudent[];
    academicYear: string;
    term: string;
    scope: string;
    courseId: string;
    courseName: string;
    limit: number;
    language: "fr" | "en";
  },
  onError: (message: string) => void,
) {
  const tr = (fr: string, en: string) => (input.language === "fr" ? fr : en);
  const printWindow = window.open("", "_blank", "width=1200,height=950");
  if (!printWindow)
    return onError(
      tr(
        "Autorisez les fenêtres contextuelles pour imprimer.",
        "Allow pop-up windows to print.",
      ),
    );
  printWindow.document.write(
    '<html><body style="font:16px system-ui;padding:2rem;color:#073b70">' +
      tr(
        "Préparation de l’analyse statistique…",
        "Preparing statistical analysis…",
      ) +
      "</body></html>",
  );
  printWindow.document.close();
  try {
    const students = input.students.map((student) => ({
      ...student,
      average: reportResultForCourse(student, input.courseId),
    }));
    const ranked = rankGradebookRows(students);
    const selected = ranked.slice(0, input.limit);
    const stats = reportStatistics(students.map((student) => student.average));
    const numeric = (value: number | null) =>
      value === null ? "-" : value.toFixed(2);
    const courseIds = [
      ...new Set(
        input.students.flatMap((student) =>
          student.subjects.map((subject) => subject.courseId),
        ),
      ),
    ];
    const subjects = courseIds.map((courseId) => ({
      name: input.students
        .flatMap((student) => student.subjects)
        .find((subject) => subject.courseId === courseId)!.name,
      stats: reportStatistics(
        input.students.map(
          (student) =>
            student.subjects.find((subject) => subject.courseId === courseId)
              ?.percentage,
        ),
      ),
    }));
    const generatedAt = new Date();
    const source = JSON.stringify({
      ...input,
      generatedAt: generatedAt.toISOString(),
    });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(source),
    );
    const fingerprint = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const documentId =
      "KCS-RA-" +
      generatedAt.toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      fingerprint.slice(0, 16);
    await academicRecordsAPI.registerReportCardAnalytics({
      documentId,
      fingerprint,
      academicYear: input.academicYear,
      term: input.term,
      studentIds: input.students.map((student) => student.id),
      rankedCount: selected.length,
    });
    const url =
      window.location.origin +
      "/verify/report-card-analytics?document=" +
      documentId +
      "&fingerprint=" +
      fingerprint;
    const qr = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      width: 420,
      margin: 1,
    });
    const largest = Math.max(
      1,
      ...stats.distribution.map((bucket) => bucket.count),
    );
    const histogram = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 190" aria-label="${tr("Distribution des résultats", "Score distribution")}">${[0, 0.5, 1].map((tick) => `<line x1="30" x2="580" y1="${145 - tick * 115}" y2="${145 - tick * 115}" stroke="#d5e4ee"/><text x="25" y="${148 - tick * 115}" text-anchor="end" font-size="10" fill="#56718a">${largest * tick}</text>`).join("")}${stats.distribution
      .map((bucket, index) => {
        const height = (bucket.count * 115) / largest,
          x = 50 + index * 90;
        return `<rect x="${x}" y="${145 - height}" width="55" height="${height}" rx="4" fill="${index < 3 ? "#dc704f" : "#159d94"}"/><text x="${x + 27.5}" y="${137 - height}" text-anchor="middle" font-size="12" font-weight="bold" fill="#073b70">${bucket.count}</text><text x="${x + 27.5}" y="166" text-anchor="middle" font-size="11" fill="#365b79">${esc(bucket.label)}</text>`;
      })
      .join(
        "",
      )}<text x="580" y="185" text-anchor="end" font-size="10" fill="#56718a">${tr("Résultat (%)", "Result (%)")}</text></svg>`;
    const x = (value: number | null) => 30 + (value ?? 0) * 5.4;
    const boxplot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 110" aria-label="${tr("Boîte à moustaches", "Box-and-whisker plot")}">${[0, 25, 50, 75, 100].map((tick) => `<line x1="${x(tick)}" x2="${x(tick)}" y1="15" y2="80" stroke="#d5e4ee"/><text x="${x(tick)}" y="100" text-anchor="middle" font-size="11" fill="#365b79">${tick}%</text>`).join("")}<line x1="${x(stats.min)}" x2="${x(stats.max)}" y1="45" y2="45" stroke="#0d5d99" stroke-width="3"/><rect x="${x(stats.q1)}" y="25" width="${Math.max(2, x(stats.q3) - x(stats.q1))}" height="40" fill="#d4f2ed" stroke="#159d94" stroke-width="2"/>${[stats.min, stats.median, stats.max].map((value) => `<line x1="${x(value)}" x2="${x(value)}" y1="20" y2="70" stroke="#073b70" stroke-width="3"/>`).join("")}<line x1="${x(70)}" x2="${x(70)}" y1="10" y2="80" stroke="#c79516" stroke-dasharray="4 3" stroke-width="2"/></svg>`;
    const top = ranked
      .slice(0, 3)
      .map(
        (student) =>
          `<article><span>${student.rank}. ${esc(student.name)}</span><b>${numeric(student.average)}%</b></article>`,
      )
      .join("");
    const rows = selected
      .map(
        (student) =>
          `<tr><td><b>${student.rank}</b></td><td>${esc(student.name)}</td><td>${esc(student.className)}</td><td class="number"><b>${numeric(student.average)}%</b></td></tr>`,
      )
      .join("");
    const courseRows = subjects
      .map(
        (subject) =>
          `<tr><td><b>${esc(subject.name)}</b><div class="bar"><span style="width:${subject.stats.mean ?? 0}%"></span></div></td><td>${subject.stats.count}</td><td>${numeric(subject.stats.mean)}%</td><td>${numeric(subject.stats.median)}%</td><td>${numeric(subject.stats.deviation)}</td><td>${numeric(subject.stats.passRate)}%</td></tr>`,
      )
      .join("");
    const logo = new URL("/images/kcs.jpg", window.location.origin).href;
    const html = `<!doctype html><html lang="${input.language}"><head><meta charset="utf-8"><title>${esc(documentId)}</title><style>
    @page{size:A4;margin:10mm;@bottom-right{content:counter(page) " / " counter(pages);font:8px Arial;color:#56718a}@bottom-left{content:"KCS Nexus AI | Academic Records";font:8px Arial;color:#56718a}}*{box-sizing:border-box}body{margin:0;color:#133958;font-family:Arial,sans-serif;background:#edf4f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{position:relative;isolation:isolate;max-width:210mm;margin:12px auto;padding:10mm;background:white}.watermark{position:fixed;z-index:-1;left:50%;top:50%;width:140mm;height:140mm;object-fit:contain;transform:translate(-50%,-50%);opacity:.055}header{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:3px solid #cea124;padding-bottom:12px}header img{width:21mm;height:21mm;object-fit:contain}header div{text-align:right}h1{margin:4px 0;font-size:19px;color:#073b70}header p{margin:3px 0;font-size:9px;color:#60788b}.scope{margin:12px 0;padding:11px;border:1px solid #cadfea;border-radius:9px;background:#eef7fc;font-size:11px;line-height:1.5}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.metric{padding:9px;border:1px solid #cee0ec;border-radius:8px;background:#f7fafc}.metric small{display:block;font-size:8px;color:#5b758d;text-transform:uppercase}.metric b{display:block;margin-top:4px;font-size:19px;color:#087d75}.podium{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.podium article{display:flex;flex-direction:column;justify-content:space-between;gap:5px;border:1px solid #d8c284;border-radius:8px;padding:9px;background:#fff9e7;font-size:10px}.podium b{color:#8d6a0a;font-size:15px}h2{break-after:avoid;margin:16px 0 7px;font-size:12px;color:#073b70;text-transform:uppercase}svg{display:block;width:100%;height:auto}.chart{padding:9px;border:1px solid #d4e3eb;border-radius:9px;break-inside:avoid}.chart small{display:block;margin:5px 0;color:#60788b;font-size:9px;line-height:1.5}.interpretation{margin-top:9px;padding:10px;border-left:4px solid #159d94;background:#f0f8f6;font-size:9px;line-height:1.6;break-inside:avoid}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#0d5d99;color:white;text-align:left;font-size:8px;padding:7px}td{padding:7px;border-bottom:1px solid #d5e3ec}tbody tr:nth-child(even){background:#f2f7fb}tr{break-inside:avoid}thead{display:table-header-group}.number{text-align:right}.bar{height:4px;width:100%;margin-top:4px;background:#e3edf2;border-radius:4px}.bar span{display:block;height:100%;border-radius:4px;background:#159d94}.methods{margin-top:12px;font-size:8px;line-height:1.5;color:#61798b}.auth{display:flex;align-items:center;gap:12px;margin-top:15px;border-top:2px solid #159d94;padding-top:9px;break-inside:avoid}.auth img{width:24mm;height:24mm}.auth div{font-size:7px;line-height:1.6;overflow-wrap:anywhere}footer{margin-top:12px;padding-top:8px;border-top:1px solid #c8dce7;color:#60788b;font-size:8px;line-height:1.6;break-inside:avoid}@media print{body{background:white}.sheet{max-width:none;margin:0;padding:0}}
    </style></head><body><main class="sheet"><img class="watermark" src="${esc(logo)}" alt=""><header><img src="${esc(logo)}" alt="KCS"><div><p>KINSHASA CHRISTIAN SCHOOL</p><h1>${tr("ANALYSE STATISTIQUE DES BULLETINS", "REPORT-CARD STATISTICAL ANALYSIS")}</h1><p>${esc(documentId)}</p></div></header>
    <section class="scope"><b>${esc(input.academicYear)} · ${esc(input.term)}</b><br>${esc(input.scope)} · ${esc(input.courseName)}<br>${tr("Émis le", "Issued")} ${esc(generatedAt.toLocaleString(input.language === "fr" ? "fr-FR" : "en-GB"))}</section>
    <section class="metrics">${[
      [
        tr("Résultats disponibles", "Available results"),
        stats.count + " / " + students.length,
      ],
      [tr("Moyenne", "Mean"), numeric(stats.mean) + "%"],
      [tr("Médiane", "Median"), numeric(stats.median) + "%"],
      [
        tr("Écart-type population", "Population std. deviation"),
        numeric(stats.deviation) + " pp",
      ],
      [tr("Réussite ≥ 70 %", "Pass rate ≥ 70%"), numeric(stats.passRate) + "%"],
      [
        tr("Étendue min-max", "Minimum-maximum"),
        numeric(stats.min) + "-" + numeric(stats.max) + "%",
      ],
    ]
      .map(
        ([label, value]) =>
          `<div class="metric"><small>${label}</small><b>${value}</b></div>`,
      )
      .join("")}</section>
    <h2>${tr("Les trois premiers", "Top three learners")}</h2><section class="podium">${top}</section><h2>${tr("Distribution et dispersion", "Distribution and spread")}</h2><section class="chart">${histogram}${boxplot}<small>Q1 ${numeric(stats.q1)}% · ${tr("Médiane", "Median")} ${numeric(stats.median)}% · Q3 ${numeric(stats.q3)}% · ${tr("Trait doré : seuil de réussite 70 %.", "Gold line marks the 70% pass threshold.")}</small></section>
    <section class="interpretation">${tr("Sur", "Of")} ${stats.count} ${tr("résultats disponibles,", "available results,")} ${stats.passed} ${tr("atteignent le seuil de réussite.", "meet the pass threshold.")} ${stats.missing} ${tr("résultat(s) manquant(s) sont exclus des calculs.", "missing result(s) are excluded from calculations.")} ${tr("La médiane partage les résultats en deux groupes égaux. L’écart-type mesure la dispersion autour de la moyenne, en points de pourcentage.", "The median splits the results into two equal groups. Standard deviation measures spread around the mean in percentage points.")}</section>
    <h2>${tr("Comparaison par cours", "Course-by-course comparison")}</h2><table><thead><tr><th>${tr("Cours", "Course")}</th><th>N</th><th>${tr("Moyenne", "Mean")}</th><th>${tr("Médiane", "Median")}</th><th>σ (pp)</th><th>≥70%</th></tr></thead><tbody>${courseRows}</tbody></table>
    <h2>${tr("Classement des", "Ranking of the top")} ${selected.length} ${tr("premiers élèves", "learners")}</h2><table><thead><tr><th>${tr("Rang", "Rank")}</th><th>${tr("Élève", "Learner")}</th><th>${tr("Classe", "Class")}</th><th class="number">${tr("Résultat", "Result")}</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="methods">${tr("Méthode : moyenne arithmétique, écart-type population (division par N), quartiles par interpolation linéaire. Les moyennes générales proviennent des bulletins et conservent la pondération des crédits. Les ex æquo partagent le même rang. Les statistiques portent sur tout le périmètre choisi, tandis que le tableau affiche les N premiers.", "Method: arithmetic mean, population standard deviation (division by N), and linearly interpolated quartiles. Overall averages come from report cards and retain credit weighting. Ties share the same rank. Statistics describe the entire selected cohort; the table lists the top N learners.")}</p>
    <section class="auth"><img src="${qr}" alt="QR verification"><div><b>${tr("Authentification numérique KCS", "KCS digital authentication")}</b><br>${esc(documentId)}<br>SHA-256 ${fingerprint}<br>UTC ${esc(generatedAt.toISOString())} · QR ISO/IEC 18004 · ECC H</div></section>
    <footer><b>Kinshasa Christian School</b><br>Avenue de la République n° 1 · Macampagne, Ngaliema · Kinshasa, RDC · Réf. 80 jours<br>+243 895 326 011 · +243 994 645 735 · kinshasachristianschool@gmail.com · www.kinshasachristianschool.org</footer></main><script>addEventListener('load',()=>Promise.all(Array.from(document.images).map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve}))).then(()=>setTimeout(()=>window.print(),250)));<\/script></body></html>`;
    const blob = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    printWindow.location.replace(blob);
    window.setTimeout(() => URL.revokeObjectURL(blob), 60_000);
  } catch (error: any) {
    printWindow.close();
    onError(
      error?.response?.data?.message ||
        error?.message ||
        tr(
          "Le document ne peut pas être authentifié pour le moment.",
          "The document cannot be authenticated right now.",
        ),
    );
  }
}
