import {certificateNarrative} from './certificateNarrative.js';
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Signature = { name: string; image?: string | null };
export type OfficialCertificateInput = {
  studentId: string;
  studentNumber: string;
  studentName: string;
  dateOfBirth?:string|Date|null;
  placeOfBirth?:string|null;
  grade: string;
  academicYear: string;
  documentType: "completion" | "attendance";
  language: "fr" | "en";
  includeAuthentication: boolean;
  principal?: Signature | null;
  headOfSchool?: Signature | null;
  seal?: string | null;
};
export async function officialCertificatePdf(input: OfficialCertificateInput) {
  const tr = (fr: string, en: string) => (input.language === "fr" ? fr : en);
  const issued = new Date();
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({ ...input, issued: issued.toISOString().slice(0, 10) }),
    )
    .digest("hex")
    .toUpperCase();
  const prefix = input.documentType === "completion" ? "CERT" : "ATT";
  const documentId = `KCS-${prefix}-${issued.toISOString().slice(0, 10).replace(/-/g, "")}-${fingerprint.slice(0, 16)}`;
  const verificationUrl = `https://kinshasachristianschool.org/verify/certificate?document=${encodeURIComponent(documentId)}&fingerprint=${fingerprint}`;
  const qr = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: "H",
    width: 1024,
    margin: 4,
  });
  const emblem = await readFile(
    join(process.cwd(), "assets", "kcs-watermark.jpg"),
  );
  const title =
    input.documentType === "completion"
      ? tr(
          "CERTIFICAT OFFICIEL DE RÉUSSITE",
          "OFFICIAL CERTIFICATE OF COMPLETION",
        )
      : tr("ATTESTATION DE FRÉQUENTATION", "CERTIFICATE OF ATTENDANCE");
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    info: { Title: title, Author: "Kinshasa Christian School" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = doc.page.width,
    height = doc.page.height;
  doc.rect(0, 0, width, height).fill("#FFFFFF");
  doc
    .lineWidth(2)
    .strokeColor("#183D54")
    .rect(22, 22, width - 44, height - 44)
    .stroke();
  doc
    .lineWidth(1)
    .strokeColor("#C5A35D")
    .rect(32, 32, width - 64, height - 64)
    .stroke();
  doc
    .save()
    .opacity(0.065)
    .image(emblem, width / 2 - 165, height / 2 - 165, { fit: [330, 330] })
    .restore();
  doc.image(emblem, width / 2 - 41, 43, { fit: [82, 82] });
  doc
    .fillColor("#A8780E")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`KINSHASA CHRISTIAN SCHOOL · ${input.academicYear}`, 60, 137, {
      width: width - 120,
      align: "center",
    });
  doc
    .fillColor("#173D54")
    .fontSize(23)
    .text(title, 45, 159, { width: width - 90, align: "center" });
  doc
    .strokeColor("#C5A35D")
    .lineWidth(2)
    .moveTo(190, 194)
    .lineTo(width - 190, 194)
    .stroke();
  const narrative=certificateNarrative({...input,signatoryName:input.principal?.name,issuedAt:issued});
  const paragraphs=[narrative.intro,narrative.identity,narrative.statement,narrative.purpose,narrative.issued].filter(Boolean);
  let bodyFont=11; const nameFont=input.studentName.length>48?17:20;
  const nameHeight=doc.font('Helvetica-Bold').fontSize(nameFont).heightOfString(input.studentName,{width:width-150});
  const requiredHeight=()=>paragraphs.reduce((sum,text)=>sum+doc.font('Helvetica').fontSize(bodyFont).heightOfString(text,{width:width-150,lineGap:3})+8,0)+nameHeight+10;
  while(bodyFont>9.25&&requiredHeight()>200)bodyFont-=.25;
  let y=208;
  const paragraph=(text:string,bold=false)=>{doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bodyFont).fillColor('#354F68');const h=doc.heightOfString(text,{width:width-150,lineGap:3});doc.text(text,75,y,{width:width-150,lineGap:3,align:'left'});y+=h+8};
  paragraph(narrative.intro);
  doc.font('Helvetica-Bold').fontSize(nameFont).fillColor('#173D54').text(input.studentName,75,y,{width:width-150,align:'center'});y=doc.y+10;
  for(const text of paragraphs.slice(1))paragraph(text);
  const image = (
    value: string | null | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!value?.startsWith("data:image/")) return;
    try {
      doc.image(Buffer.from(value.split(",")[1], "base64"), x, y, {
        fit: [w, h],
        align: "center",
      });
    } catch {
      /* Older unsupported image formats remain optional. */
    }
  };
  const signature = (
    entry: Signature | null | undefined,
    x: number,
    label: string,
  ) => {
    if (input.includeAuthentication) image(entry?.image, x + 18, 434, 144, 32);
    doc
      .strokeColor("#42627D")
      .lineWidth(0.7)
      .moveTo(x, 474)
      .lineTo(x + 180, 474)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#173D54")
      .text(entry?.name || "", x, 480, {
        width: 180,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#52677D")
      .text(label, x, 493, { width: 180, align: "center" });
  };
  signature(
    input.principal,
    85,
    tr(
      "Préfet des études / Signature autorisée",
      "Principal / Authorized signature",
    ),
  );
  signature(
    input.headOfSchool,
    width - 265,
    tr(
      "Direction de l’école / Signature officielle",
      "Head of School / Official signature",
    ),
  );
  if (input.includeAuthentication) image(input.seal, width - 115, 493, 56, 56);
  doc.image(qr, width / 2 - 34, 421, { width: 68, height: 68 });
  doc
    .fontSize(7)
    .fillColor("#52677D")
    .text(
      tr("Vérification numérique KCS", "KCS digital verification"),
      width / 2 - 80,
      491,
      { width: 160, align: "center" },
    );
  doc
    .fontSize(6)
    .text(
      documentId + "\nSHA-256 · " + fingerprint.slice(0, 32),
      width / 2 - 130,
      509,
      { width: 260, align: "center" },
    );
  doc
    .fontSize(7)
    .text(
      tr(
        "Macampagne, Ngaliema · Kinshasa · République démocratique du Congo · www.kinshasachristianschool.org",
        "Macampagne, Ngaliema · Kinshasa · Democratic Republic of Congo · www.kinshasachristianschool.org",
      ),
      65,
      544,
      { width: width - 130, align: "center" },
    );
  doc.end();
  return { buffer: await completed, documentId, fingerprint };
}
