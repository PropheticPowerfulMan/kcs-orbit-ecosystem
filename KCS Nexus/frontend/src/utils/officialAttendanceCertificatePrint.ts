import QRCode from "qrcode";
import { academicRecordsAPI } from "@/services/api";
import type { CertificateStudent } from "./officialCertificatePrint";

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c,
  );
const asset = (v: string) => new URL(v, window.location.origin).href;

export async function printAttendanceCertificates(
  students: CertificateStudent[],
  academicYear: string,
  language: "fr" | "en",
  authenticated: boolean,
  onError: (value: string) => void,
) {
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const popup = window.open("", "_blank", "width=1200,height=850");
  if (!popup)
    return onError(
      tr("Autorisez les fenêtres contextuelles.", "Allow pop-ups."),
    );
  popup.document.write(
    `<p style="padding:30px;font:600 16px system-ui;color:#053665">${tr("Préparation sécurisée des attestations…", "Securely preparing certificates…")}</p>`,
  );
  popup.document.close();
  let signatures: any = {};
  if (authenticated)
    try {
      signatures =
        (await academicRecordsAPI.officialSignatures()).data?.data ?? {};
    } catch {
      /* optional */
    }
  const issued = new Date();
  const pages: string[] = [];
  for (const student of students) {
    const name = [
      student.user?.lastName,
      student.user?.middleName,
      student.user?.firstName,
    ]
      .filter(Boolean)
      .join(" ");
    const canonical = JSON.stringify({
      type: "ATTENDANCE",
      studentId: student.id,
      studentNumber: student.studentNumber,
      name,
      academicYear,
      issued: issued.toISOString().slice(0, 10),
    });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    const fingerprint = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const documentId = `KCS-ATT-${issued.toISOString().slice(0, 10).replace(/-/g, "")}-${fingerprint.slice(0, 16)}`;
    await academicRecordsAPI.registerCertificateVerification({
      documentId,
      fingerprint,
      studentId: student.id,
      academicYear,
    });
    const verify = `${location.origin}/verify/certificate?document=${encodeURIComponent(documentId)}&fingerprint=${encodeURIComponent(fingerprint)}`;
    const qr = await QRCode.toDataURL(verify, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 280,
    });
    const signature = (entry: any, label: string) =>
      `<div class="sig">${authenticated && entry?.image ? `<img src="${esc(entry.image)}">` : ""}<b>${authenticated ? esc(entry?.name || "") : ""}</b><span>${esc(label)}</span></div>`;
    const seal =
      authenticated && signatures.officialSealImage
        ? `<img class="digital-seal" src="${esc(signatures.officialSealImage)}" alt="Official KCS seal">`
        : "";
    pages.push(
      `<main class="sheet"><div class="frame"></div><img class="watermark" src="${asset("/images/kcs.jpg?v=attendance-certificate")}"><div class="doc">${esc(documentId)}<br>SHA-256 · ${fingerprint.slice(0, 32)}</div><div class="content">${seal}<img class="logo" src="${asset("/images/kcs-logo.png")}"><p class="eyebrow">KINSHASA CHRISTIAN SCHOOL · ${esc(academicYear)}</p><h1>${tr("ATTESTATION DE FRÉQUENTATION", "CERTIFICATE OF ATTENDANCE")}</h1><div class="rule"></div><p class="lead">${tr("La Direction de Kinshasa Christian School atteste officiellement que", "Kinshasa Christian School officially certifies that")}</p><div class="name">${esc(name)}</div><p class="statement">${tr("matricule", "student ID")} <b>${esc(student.studentNumber)}</b>, ${tr("régulièrement inscrit(e) en", "duly enrolled in")} <b>${esc([student.grade, student.section].filter(Boolean).join(" "))}</b>, ${tr("fréquente notre établissement au titre de l’année scolaire indiquée.", "is attending our institution during the academic year stated above.")}</p><p class="issued">${tr("Fait à Kinshasa, le", "Issued in Kinshasa on")} ${issued.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB")}</p><div class="bottom">${signature(signatures.principal ?? signatures.superAdministrator, tr("Préfet des études", "Principal"))}<div class="qr"><img src="${qr}"><small>${tr("Vérification numérique KCS", "KCS digital verification")}<br>QR ISO/IEC 18004 · ECC H</small></div>${signature(signatures.headOfSchool, tr("Direction de l’école", "Head of School"))}</div></div></main>`,
    );
  }
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>KCS Attendance Certificates</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;background:#e8f1f8;color:#082b4d;font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact}.sheet{position:relative;isolation:isolate;width:281mm;height:194mm;margin:10px auto;overflow:hidden;background:#fff;page-break-after:always;box-shadow:0 18px 55px #062b4d25}.frame{position:absolute;inset:8mm;border:2px solid #0d5d99}.frame:after{content:"";position:absolute;inset:3mm;border:1px solid #d6a62a}.watermark{position:absolute;left:50%;top:50%;width:125mm;height:125mm;transform:translate(-50%,-50%);object-fit:contain;opacity:.065;filter:grayscale(1)}.content{position:relative;z-index:1;height:100%;padding:14mm 18mm;text-align:center}.logo{width:62mm;max-height:23mm;object-fit:contain}.digital-seal{position:absolute;left:18mm;bottom:18mm;width:27mm;height:27mm;object-fit:contain}.eyebrow{color:#b07e0a;font-size:10px;font-weight:900;letter-spacing:.2em}h1{margin:7px 0;color:#053665;font:700 29px Georgia}.rule{width:62%;height:2px;margin:9px auto 16px;background:linear-gradient(90deg,transparent,#d6a62a,#0d5d99,#d6a62a,transparent)}.lead,.statement{font:15px/1.6 Georgia;max-width:220mm;margin:0 auto}.name{display:inline-block;margin:12px 0 8px;padding:0 20px 5px;border-bottom:2px solid #d6a62a;color:#073b70;font:700 30px Georgia}.issued{margin-top:13px;font-size:10px}.bottom{position:absolute;left:20mm;right:20mm;bottom:13mm;display:grid;grid-template-columns:1fr 32mm 1fr;gap:18px;align-items:end}.sig{display:grid;min-height:20mm;align-content:end;justify-items:center;border-bottom:1px solid #42627d;font-size:8px}.sig img{max-width:44mm;height:12mm;object-fit:contain}.sig span{margin-bottom:-14px;padding-top:3px}.qr img{width:25mm;height:25mm}.qr small{display:block;font-size:6px}.doc{position:absolute;right:18mm;top:14mm;z-index:2;color:#688098;font-size:7px;text-align:right}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}</style></head><body>${pages.join("")}<script>addEventListener('load',()=>Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))).then(()=>setTimeout(()=>print(),250)))<\/script></body></html>`;
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  popup.location.replace(url);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
