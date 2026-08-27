import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { schoolBranding } from "../config/branding";
import { useI18n } from "../i18n";
import { api, resolveApiUrl } from "../services/api";
import {
  buildReceiptSecurity,
  parseReceiptVerificationToken,
  type ReceiptVerificationRecord,
  validateReceiptVerificationRecord
} from "../utils/receiptVerification";

type VerificationApiResponse = {
  source: "database";
  payment: {
    id: string;
    transactionNumber: string;
    parentFullName: string;
    paymentSubjectName: string;
    studentNames: string[];
    reason: string;
    amount: number;
    amountInWords: string;
    method: string;
    status: string;
    date: string;
    createdAt: string;
    schoolName: string;
    receiptNumber: string | null;
    tuitionAllocationSummary?: {
      mode: string;
      message: string;
      totalReceived: number;
      allocatedTotal: number;
      missingAmount: number;
      advanceBalance: number;
      perChild: Array<{
        studentName: string;
        allocated: number;
        remaining: number;
        lines: Array<{ label: string; dueBucket: string; outstandingBefore: number; allocated: number; outstandingAfter: number }>;
      }>;
    } | null;
    downloads: {
      pdfPath: string;
      pngPath: string;
      pdfUrl: string;
      pngUrl: string;
    } | null;
  };
};

function roundMoney(n: number): number {
  const rounded = Math.round((Number(n || 0) + Number.EPSILON) * 100000) / 100000;
  const nearestInteger = Math.round(rounded);
  return Math.abs(rounded - nearestInteger) <= 0.00001 ? nearestInteger : rounded;
}

function formatMoney(n: number): string {
  const rounded = roundMoney(n);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}

function formatMoneyString(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? formatMoney(amount) : value;
}

function compareReceiptWithApi(receipt: ReceiptVerificationRecord, apiPayment: VerificationApiResponse["payment"]) {
  const mismatches: string[] = [];
  if (receipt.transaction.transactionNumber !== apiPayment.transactionNumber) mismatches.push("Transaction");
  if (receipt.transaction.amount !== apiPayment.amount.toFixed(5)) mismatches.push("Montant");
  if (receipt.transaction.reason.trim() !== apiPayment.reason.trim()) mismatches.push("Motif");
  if (receipt.transaction.methodCode !== apiPayment.method) mismatches.push("Méthode");
  if (receipt.transaction.statusCode !== apiPayment.status) mismatches.push("Statut");
  if (receipt.parties.parentFullName.trim() !== apiPayment.parentFullName.trim()) mismatches.push("Parent");
  if (receipt.parties.paymentSubjectName.trim() !== apiPayment.paymentSubjectName.trim()) mismatches.push("Paiement pour");

  const scannedStudents = receipt.parties.studentNames.join(" | ").trim();
  const apiStudents = apiPayment.studentNames.join(" | ").trim();
  if (scannedStudents !== apiStudents) mismatches.push("Élèves");

  return { matched: mismatches.length === 0, mismatches };
}

function DetailGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="mt-5 grid gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:grid-cols-[170px_1fr] sm:items-start">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
          <span className="text-sm font-semibold text-white">{value}</span>
        </div>
      ))}
    </div>
  );
}

function AllocationSummaryBlock({ summary }: { summary: NonNullable<VerificationApiResponse["payment"]["tuitionAllocationSummary"]> }) {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">{L("Répartition des frais scolaires", "Tuition fee allocation")}</p>
      <h2 className="mt-2 font-display text-xl font-bold text-white">
        {L("Répartition", "Allocation")} {summary.mode === "AUTO" ? L("automatique exécutée par le système", "automatically performed by the system") : L("manuelle exécutée par le financier", "manually performed by finance staff")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-emerald-50/90">{summary.message}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {summary.perChild.map((child) => (
          <div key={child.studentName} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-white">{child.studentName}</p>
            <p className="mt-2 text-sm text-emerald-100">{L("Appliqué :", "Applied:")} $ {formatMoney(child.allocated)}</p>
            <p className="text-sm text-amber-100">{L("Reste :", "Remaining:")} $ {formatMoney(child.remaining)}</p>
            <div className="mt-2 space-y-1 text-xs text-ink-dim">
              {child.lines.map((line) => (
                <p key={`${child.studentName}-${line.label}-${line.allocated}`}>
                  {line.label} : {L("avant", "before")} $ {formatMoney(line.outstandingBefore)}, {L("appliqué", "applied")} $ {formatMoney(line.allocated)}, {L("reste", "remaining")} $ {formatMoney(line.outstandingAfter)} ({line.dueBucket})
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReceiptVerificationPage() {
  const { lang } = useI18n();
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const methodLabel = (value: string) => ({
    CASH: L("Espèces", "Cash"), AIRTEL_MONEY: "Airtel Money", MPESA: "M-Pesa", ORANGE_MONEY: "Orange Money", BANK_TRANSFER: L("Virement bancaire", "Bank transfer")
  } as Record<string, string>)[value] ?? value;
  const statusLabel = (value: string) => ({
    COMPLETED: L("Terminé", "Completed"), PENDING: L("En attente", "Pending"), FAILED: L("Échoué", "Failed"), CANCELLED: L("Annulé", "Cancelled")
  } as Record<string, string>)[value] ?? value;
  const mismatchLabel = (value: string) => ({
    Montant: L("Montant", "Amount"), Motif: L("Motif", "Reason"), "Méthode": L("Méthode", "Method"), "Statut": L("Statut", "Status"), "Paiement pour": L("Paiement pour", "Payment for"), "Élèves": L("Élèves", "Students")
  } as Record<string, string>)[value] ?? value;
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get("d");
  const txParam = params.get("tx");
  const codeParam = params.get("c");
  const [apiResult, setApiResult] = useState<VerificationApiResponse | null>(null);
  const [apiState, setApiState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");

  const receipt = useMemo(() => parseReceiptVerificationToken(token), [token]);
  const validation = useMemo(() => (receipt ? validateReceiptVerificationRecord(receipt) : null), [receipt]);
  const transactionNumber = receipt?.transaction.transactionNumber || txParam || "";
  const apiComparison = useMemo(
    () => (receipt && apiResult ? compareReceiptWithApi(receipt, apiResult.payment) : null),
    [receipt, apiResult]
  );

  useEffect(() => {
    if (!transactionNumber) {
      setApiResult(null);
      setApiState("idle");
      return;
    }

    let active = true;
    setApiState("loading");

    api<VerificationApiResponse>(`/api/payments/verify/${encodeURIComponent(transactionNumber)}`)
      .then((data) => {
        if (!active) return;
        setApiResult(data);
        setApiState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setApiResult(null);
        setApiState(error instanceof Error && /introuvable|not found|404/i.test(error.message) ? "missing" : "error");
      });

    return () => {
      active = false;
    };
  }, [transactionNumber]);

  const apiSecurity = useMemo(() => {
    if (!apiResult) return null;
    return buildReceiptSecurity({
      transactionNumber: apiResult.payment.transactionNumber,
      date: apiResult.payment.date,
      parentFullName: apiResult.payment.parentFullName,
      paymentSubjectName: apiResult.payment.paymentSubjectName,
      studentNames: apiResult.payment.studentNames,
      reason: apiResult.payment.reason,
      amount: apiResult.payment.amount,
      amountWords: apiResult.payment.amountInWords,
      method: apiResult.payment.method as "CASH" | "AIRTEL_MONEY" | "MPESA" | "ORANGE_MONEY" | "BANK_TRANSFER",
      status: apiResult.payment.status as "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED"
    });
  }, [apiResult]);

  const shortQrCodeMatches = Boolean(codeParam && apiSecurity && codeParam === apiSecurity.verificationCode);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="glass overflow-hidden rounded-[28px] border border-brand-400/20 shadow-2xl">
          <div className="border-b border-white/10 bg-white/5 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img src={schoolBranding.logoSrc} alt={schoolBranding.schoolName} className="h-16 w-16 rounded-2xl border border-brand-200/20 bg-white object-contain p-2" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-300">{L("Vérification EduPay", "EduPay verification")}</p>
                  <h1 className="mt-2 font-display text-3xl font-bold text-white">{L("Reçu de transaction", "Transaction receipt")}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-ink-dim">
                    {L("Cette page confirme le code QR, vérifie la transaction dans EduPay et signale toute différence avec la base de données.", "This page validates the QR code, checks the transaction in EduPay and reports any discrepancy with the database.")}
                  </p>
                </div>
              </div>
              <a href="#/login" className="btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold">
                {L("Ouvrir EduPay", "Open EduPay")}
              </a>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {!receipt || !validation ? (
              <div className="space-y-6">
                <div className={`rounded-3xl border p-6 ${txParam ? "border-sky-400/20 bg-sky-500/10 text-sky-100" : "border-red-400/20 bg-red-500/10 text-red-100"}`}>
                  <p className="text-xs font-black uppercase tracking-[0.22em]">{txParam ? L("Transaction QR", "QR transaction") : L("QR invalide", "Invalid QR code")}</p>
                  <h2 className="mt-3 font-display text-2xl font-bold text-white">
                    {txParam ? L("Vérification directe dans EduPay", "Direct verification in EduPay") : L("Aucune donnée de reçu exploitable", "No usable receipt data")}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-current/90">
                    {txParam
                      ? L(`Le code QR a ouvert la vérification de la transaction ${txParam}. EduPay recherche maintenant ce paiement dans la base de données.`, `The QR code opened verification for transaction ${txParam}. EduPay is now looking up this payment in the database.`)
                      : L("Le lien scanné ne contient pas de référence EduPay valide.", "The scanned link does not contain a valid EduPay reference.")}
                  </p>
                </div>

                {apiState === "loading" && <p className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-ink-dim">{L("Vérification en cours dans le service EduPay...", "Verifying the transaction against EduPay...")}</p>}
                {apiState === "missing" && <p className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">{L("Aucune transaction ne correspond à ce numéro dans la base de données.", "No transaction matching this number was found in the database.")}</p>}
                {apiState === "error" && <p className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-100">{L("La vérification dans la base de données est indisponible pour le moment.", "Database verification is currently unavailable.")}</p>}
                {apiState === "ready" && apiResult && (
                  <div className="space-y-6">
                    <div className={`rounded-3xl border p-5 ${shortQrCodeMatches ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-sky-400/30 bg-sky-500/10 text-sky-100"}`}>
                      <p className="text-xs font-black uppercase tracking-[0.22em]">{L("Transaction retrouvée", "Transaction found")}</p>
                      <h2 className="mt-3 font-display text-2xl font-bold text-white">
                        {shortQrCodeMatches ? L("Le code QR correspond à la transaction EduPay", "The QR code matches the EduPay transaction") : L("La transaction existe dans EduPay", "The transaction exists in EduPay")}
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-current/90">
                        {L("Le scan renvoie vers la fiche publique et confirme la transaction", "The scan opens the public record and confirms transaction")} {apiResult.payment.transactionNumber}.
                      </p>
                    </div>
                    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-300">{L("Détails de la transaction", "Transaction details")}</p>
                      <DetailGrid rows={[
                        ["Transaction", apiResult.payment.transactionNumber],
                        ["Date", apiResult.payment.date],
                        ["Parent", apiResult.payment.parentFullName],
                        ["Paiement pour", apiResult.payment.paymentSubjectName],
                        ["Élèves", apiResult.payment.studentNames.join(" / ") || "N/A"],
                        ["Motif", apiResult.payment.reason],
                        ["Montant", `$ ${formatMoney(apiResult.payment.amount)}`],
                        ["Méthode", methodLabel(apiResult.payment.method)],
                        ["Statut", statusLabel(apiResult.payment.status)],
                        ["Code QR", codeParam || "N/A"]
                      ]} />
                    </section>
                    {apiResult.payment.tuitionAllocationSummary && (
                      <AllocationSummaryBlock summary={apiResult.payment.tuitionAllocationSummary} />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`rounded-3xl border p-5 ${validation.valid ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-amber-400/30 bg-amber-500/10 text-amber-100"}`}>
                  <p className="text-xs font-black uppercase tracking-[0.22em]">
                    {validation.valid ? L("Reçu cohérent", "Consistent receipt") : L("Vérification partielle", "Partial verification")}
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-bold text-white">
                    {validation.valid ? L("Les codes du reçu correspondent aux données scannées", "The receipt codes match the scanned data") : L("Les données du reçu ne correspondent pas entièrement aux codes", "The receipt data does not fully match the codes")}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-current/90">
                    {validation.valid
                      ? L("La transaction, le montant, le statut et les identifiants de sécurité du reçu sont cohérents.", "The transaction, amount, status and receipt security identifiers are consistent.")
                      : L("Les informations visibles ont été lues, mais au moins un code de sécurité ne correspond plus.", "The visible information was read, but at least one security code no longer matches.")}
                  </p>
                </div>

                <div className={`rounded-3xl border p-5 ${apiState === "ready" && apiComparison?.matched ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-ink"}`}>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-300">{L("Recoupement avec la base de données", "Database cross-check")}</p>
                  {apiState === "loading" && <p className="mt-3 text-sm text-ink-dim">{L("Vérification en cours dans le service EduPay...", "Verifying the transaction against EduPay...")}</p>}
                  {apiState === "missing" && <p className="mt-3 text-sm text-amber-100">{L("Aucune transaction ne correspond à ce numéro dans la base de données.", "No transaction matching this number was found in the database.")}</p>}
                  {apiState === "error" && <p className="mt-3 text-sm text-red-200">{L("La vérification dans la base de données est indisponible pour le moment.", "Database verification is currently unavailable.")}</p>}
                  {apiState === "ready" && apiResult && apiComparison && (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm leading-6 text-current/90">
                        {apiComparison.matched
                          ? L("Les données scannées correspondent aux données récupérées dans la base pour cette transaction.", "The scanned data matches the database record for this transaction.")
                          : `${L("Des écarts ont été détectés entre le code QR et la base :", "Discrepancies were detected between the QR code and the database:")} ${apiComparison.mismatches.map(mismatchLabel).join(", ")}.`}
                      </p>
                      {apiResult.payment.downloads ? (
                        <div className="flex flex-wrap gap-3 pt-2">
                          <a href={resolveApiUrl(apiResult.payment.downloads.pdfPath)} target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold">
                            {L("Télécharger PDF", "Download PDF")}
                          </a>
                          <a href={resolveApiUrl(apiResult.payment.downloads.pngPath)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-brand-300/40 bg-brand-500/10 px-5 py-3 text-sm font-semibold text-brand-100 transition hover:border-brand-200 hover:bg-brand-500/20">
                            {L("Télécharger PNG", "Download PNG")}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                  <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-300">{L("Détails de la transaction", "Transaction details")}</p>
                    <DetailGrid rows={[
                      ["Transaction", receipt.transaction.transactionNumber],
                      ["Date", receipt.transaction.date],
                      ["Parent", receipt.parties.parentFullName],
                      ["Paiement pour", receipt.parties.paymentSubjectName],
                      ["Élèves", receipt.parties.studentNames.join(" / ") || "N/A"],
                      ["Motif", receipt.transaction.reason],
                      ["Montant", `$ ${formatMoneyString(receipt.transaction.amount)}`],
                      ["Montant en lettres", receipt.transaction.amountWords],
                      ["Méthode", methodLabel(receipt.transaction.methodCode)],
                      ["Statut", statusLabel(receipt.transaction.statusCode)]
                    ]} />
                  </section>

                  <aside className="space-y-6">
                    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-300">{L("Émetteur", "Issuer")}</p>
                      <div className="mt-4 space-y-2 text-sm text-ink-dim">
                        <p className="font-semibold text-white">{receipt.issuer.schoolName}</p>
                        <p>{receipt.issuer.appName}</p>
                        <p>{receipt.issuer.tagline}</p>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-300">{L("Codes de sécurité", "Security codes")}</p>
                      <DetailGrid rows={[
                        ["Vérification", receipt.security.verificationCode],
                        ["Sceau", receipt.security.sealCode],
                        ["Hash", receipt.security.hash]
                      ]} />
                    </section>
                  </aside>
                </div>
                {apiResult?.payment.tuitionAllocationSummary && (
                  <AllocationSummaryBlock summary={apiResult.payment.tuitionAllocationSummary} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
