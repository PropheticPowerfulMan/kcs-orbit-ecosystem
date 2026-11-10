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
    .strokeColor("#0D5D99")
    .rect(22, 22, width - 44, height - 44)
    .stroke();
  doc
    .lineWidth(1)
    .strokeColor("#D6A62A")
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
    .fillColor("#053665")
    .fontSize(23)
    .text(title, 45, 159, { width: width - 90, align: "center" });
  doc
    .strokeColor("#D6A62A")
    .lineWidth(2)
    .moveTo(190, 194)
    .lineTo(width - 190, 194)
    .stroke();
  doc
    .fillColor("#354F68")
    .font("Helvetica")
    .fontSize(12)
    .text(
      tr(
        "La Direction de Kinshasa Christian School certifie que",
        "Kinshasa Christian School hereby certifies that",
      ),
      65,
      211,
      { width: width - 130, align: "center" },
    );
  doc
    .fillColor("#073B70")
    .font("Helvetica-Bold")
    .fontSize(input.studentName.length > 48 ? 21 : 27)
    .text(input.studentName, 65, 240, { width: width - 130, align: "center" });
  const statement =
    input.documentType === "completion"
      ? tr(
          `a satisfait aux exigences du niveau ${input.grade} et a achevé cette étape du parcours scolaire.`,
          `has fulfilled the requirements of ${input.grade} and successfully completed this stage of the school program.`,
        )
      : tr(
          `est régulièrement inscrit(e) en ${input.grade} et fréquente notre établissement pendant l’année scolaire indiquée.`,
          `is duly enrolled in ${input.grade} and attends our institution during the academic year stated above.`,
        );
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#354F68")
    .text(statement, 105, 287, {
      width: width - 210,
      align: "center",
      lineGap: 4,
    });
  doc
    .fontSize(9)
    .text(
      `${tr("Matricule", "Student ID")} · ${input.studentNumber}     ${tr("Émis le", "Issued")} · ${issued.toLocaleDateString(input.language === "fr" ? "fr-FR" : "en-GB", { timeZone: "Africa/Kinshasa" })}`,
      60,
      341,
      { width: width - 120, align: "center" },
    );
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
    if (input.includeAuthentication) image(entry?.image, x + 18, 402, 144, 38);
    doc
      .strokeColor("#42627D")
      .lineWidth(0.7)
      .moveTo(x, 455)
      .lineTo(x + 180, 455)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#173D60")
      .text(input.includeAuthentication ? entry?.name || "" : "", x, 461, {
        width: 180,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#52677D")
      .text(label, x, 475, { width: 180, align: "center" });
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
  doc.image(qr, width / 2 - 40, 386, { width: 80, height: 80 });
  doc
    .fontSize(7)
    .fillColor("#52677D")
    .text(
      tr("Vérification numérique KCS", "KCS digital verification"),
      width / 2 - 80,
      470,
      { width: 160, align: "center" },
    );
  doc
    .fontSize(6)
    .text(
      documentId + "\nSHA-256 · " + fingerprint.slice(0, 32),
      width / 2 - 130,
      492,
      { width: 260, align: "center" },
    );
  doc
    .fontSize(7)
    .text(
      tr(
        "Macampagne, Ngaliema · Kinshasa · République démocratique du Congo",
        "Macampagne, Ngaliema · Kinshasa · Democratic Republic of Congo",
      ),
      65,
      544,
      { width: width - 130, align: "center" },
    );
  doc.end();
  return { buffer: await completed, documentId, fingerprint };
}
