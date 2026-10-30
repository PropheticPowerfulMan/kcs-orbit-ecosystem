import QRCode from "qrcode";
import { academicRecordsAPI } from "@/services/api";

export type CertificateStudent = {
  id: string;
  studentNumber?: string;
  grade?: string;
  section?: string;
  officialAvatar?: string | null;
  user?: {
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    avatar?: string | null;
  };
};

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ??
      character,
  );
const asset = (value?: string | null) =>
  value
    ? /^(data:|blob:|https?:)/i.test(value)
      ? value
      : new URL(value, window.location.origin).href
    : "";

export async function printOfficialCertificate(
  student: CertificateStudent,
  academicYear: string,
  onBlocked: (message: string) => void,
  selectedLanguage?: "fr" | "en",
  authenticated = true,
) {
  const language =
    selectedLanguage ??
    (document.documentElement.lang.toLowerCase().startsWith("fr")
      ? "fr"
      : "en");
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const printWindow = window.open("", "_blank", "width=1200,height=850");
  if (!printWindow)
    return onBlocked(
      tr(
        "Autorisez les fenêtres contextuelles pour générer le certificat.",
        "Allow pop-ups to generate the certificate.",
      ),
    );
  printWindow.document.write(
    `<p style="font:600 16px system-ui;color:#053665;padding:30px">${tr("Préparation sécurisée du certificat officiel…", "Securely preparing the official certificate…")}</p>`,
  );
  printWindow.document.close();
  const issuedAt = new Date();
  const name = [
    student.user?.lastName,
    student.user?.middleName,
    student.user?.firstName,
  ]
    .filter(Boolean)
    .join(" ");
  const canonical = JSON.stringify({
    studentId: student.id,
    studentNumber: student.studentNumber,
    name,
    grade: student.grade,
    academicYear,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const documentId = `KCS-CERT-${issuedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${fingerprint.slice(0, 16)}`;
  try {
    await academicRecordsAPI.registerCertificateVerification({
      documentId,
      fingerprint,
      studentId: student.id,
      academicYear,
    });
  } catch {
    printWindow.close();
    return onBlocked(
      tr(
        "Le registre d’authenticité est indisponible. Le certificat n’a pas été émis.",
        "The authenticity registry is unavailable. The certificate was not issued.",
      ),
    );
  }
  const verificationUrl = `${window.location.origin}/verify/certificate?document=${encodeURIComponent(documentId)}&fingerprint=${encodeURIComponent(fingerprint)}`;
  const qr = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 320,
    color: { dark: "#052F5F", light: "#FFFFFF" },
  });
  let signatures: {
    principal?: { image?: string | null; name?: string } | null;
    headOfSchool?: { image?: string | null; name?: string } | null;
    superAdministrator?: { image?: string | null; name?: string } | null;
    officialSealImage?: string | null;
  } = {};
  if (authenticated)
    try {
      signatures =
        (await academicRecordsAPI.officialSignatures(student.id)).data?.data ??
        {};
    } catch {
      /* Signature absence does not block certificate generation. */
    }
  const signature = (
    entry: { image?: string | null; name?: string } | null | undefined,
    label: string,
  ) =>
    `<div class="signature">${entry?.image ? `<img src="${escapeHtml(entry.image)}" alt="">` : ""}<b>${escapeHtml(entry?.name || "")}</b><span>${escapeHtml(label)}</span></div>`;
  const logo = asset("/images/kcs-logo.png");
  const watermark = asset("/images/kcs.jpg?v=certificate-watermark");
  const grade = [student.grade, student.section].filter(Boolean).join(" ");
  const completion =
    String(student.grade).toUpperCase() === "K4"
      ? tr("du cycle K4", "of the K4 program")
      : tr(`du niveau ${student.grade}`, `of ${student.grade}`);
  const principalSignature =
    signatures.principal ?? signatures.superAdministrator;
  const digitalSeal =
    authenticated && signatures.officialSealImage
      ? `<img class="digital-seal" src="${escapeHtml(signatures.officialSealImage)}" alt="Official KCS seal">`
      : "";
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(documentId)}</title><style>
  @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;background:#e8f1f8;color:#082b4d;font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{position:relative;isolation:isolate;width:281mm;height:194mm;margin:12px auto;overflow:hidden;background:#fff;border:1px solid #b7cfe1;box-shadow:0 20px 60px #062b4d25}.frame{position:absolute;inset:8mm;border:2px solid #0d5d99}.frame:after{content:"";position:absolute;inset:3mm;border:1px solid #d6a62a}.watermark{position:absolute;z-index:0;left:50%;top:51%;width:128mm;height:128mm;transform:translate(-50%,-50%);object-fit:contain;opacity:.075;filter:grayscale(1)}.content{position:relative;z-index:1;height:100%;padding:14mm 18mm 11mm;text-align:center}.logo{width:62mm;max-height:23mm;object-fit:contain}.digital-seal{position:absolute;left:19mm;bottom:20mm;width:27mm;height:27mm;object-fit:contain}.eyebrow{margin:7px 0 0;color:#bd8a12;font-size:10px;font-weight:900;letter-spacing:.24em;text-transform:uppercase}h1{margin:5px 0 0;color:#053665;font-family:Georgia,serif;font-size:31px;letter-spacing:.04em;text-transform:uppercase}.rule{width:60%;height:2px;margin:8px auto 12px;background:linear-gradient(90deg,transparent,#d6a62a 20%,#0d5d99 50%,#d6a62a 80%,transparent)}.lead{margin:0;font-family:Georgia,serif;font-size:14px}.name{display:inline-block;margin:8px 0 6px;padding:0 18px 4px;border-bottom:2px solid #d6a62a;color:#073b70;font-family:Georgia,serif;font-size:29px;font-weight:700}.statement{max-width:210mm;margin:0 auto;color:#354f68;font-family:Georgia,serif;font-size:14px;line-height:1.55}.statement b{color:#073b70}.meta{display:flex;justify-content:center;gap:12px;margin:10px auto 0}.badge{min-width:44mm;padding:6px 12px;border:1px solid #c7d9e7;border-radius:999px;background:#f3f8fb;font-size:9px}.bottom{position:absolute;right:18mm;bottom:12mm;left:18mm;display:grid;grid-template-columns:1fr 30mm 1fr;align-items:end;gap:16px}.signature{display:grid;min-height:20mm;align-content:end;justify-items:center;border-bottom:1px solid #42627d;color:#567086;font-size:8px}.signature img{max-width:45mm;height:13mm;object-fit:contain}.signature b{color:#173d60}.signature span{margin-bottom:-14px;padding-top:3px}.qr img{width:25mm;height:25mm}.qr p{margin:2px 0 0;font-size:6px;word-break:break-all}.doc{position:absolute;right:18mm;top:16mm;color:#688098;font-size:7px;text-align:right}.seal{position:absolute;left:18mm;bottom:14mm;color:#6d8296;font-size:7px;text-align:left}@media print{body{background:#fff}.sheet{margin:0;border:0;box-shadow:none}}
  </style></head><body><main class="sheet"><div class="frame"></div><img class="watermark" src="${escapeHtml(watermark)}" alt=""><div class="content">${digitalSeal}<div class="doc">${escapeHtml(documentId)}<br>SHA-256 · ${escapeHtml(fingerprint.slice(0, 32))}</div><img class="logo" src="${escapeHtml(logo)}" alt="Kinshasa Christian School"><p class="eyebrow">Kinshasa Christian School · ${escapeHtml(academicYear)}</p><h1>${tr("Certificat officiel de réussite", "Official Certificate of Completion")}</h1><div class="rule"></div><p class="lead">${tr("La direction de Kinshasa Christian School certifie que", "Kinshasa Christian School hereby certifies that")}</p><div class="name">${escapeHtml(name)}</div><p class="statement">${tr("a satisfait aux exigences académiques et de présence", "has fulfilled the academic and attendance requirements")} <b>${escapeHtml(completion)}</b> ${tr("et est reconnu(e) comme ayant achevé avec succès cette étape du parcours scolaire.", "and is recognized as having successfully completed this stage of the school program.")}</p><div class="meta"><span class="badge">${tr("Matricule", "Student ID")} · <b>${escapeHtml(student.studentNumber)}</b></span><span class="badge">${tr("Classe", "Class")} · <b>${escapeHtml(grade)}</b></span><span class="badge">${tr("Émis le", "Issued")} · <b>${escapeHtml(issuedAt.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB"))}</b></span></div><div class="bottom">${signature(principalSignature, tr("Préfet des études / Signature autorisée", "Principal / Authorized signature"))}<div class="qr"><img src="${escapeHtml(qr)}" alt="QR verification"><p>${tr("Vérification KCS Nexus", "KCS Nexus verification")}</p></div>${signature(signatures.headOfSchool, tr("Direction de l'école / Signature officielle", "Head of School / Official signature"))}</div><div class="seal">Macampagne, Ngaliema · Kinshasa<br>${tr("République démocratique du Congo", "Democratic Republic of Congo")}</div></div></main><script>addEventListener('load',function(){Promise.all(Array.from(document.images).map(function(i){return i.complete?Promise.resolve():new Promise(function(r){i.onload=r;i.onerror=r})})).then(function(){setTimeout(function(){focus();print()},250)})});<\/script></body></html>`;
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  printWindow.location.replace(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
