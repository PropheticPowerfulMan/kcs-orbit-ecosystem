import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  CheckSquare,
  FileBadge2,
  FilterX,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Save,
} from "lucide-react";
import { academicRecordsAPI, authAPI } from "@/services/api";
import { normalizeSchoolLevel, SCHOOL_LEVELS } from "@/constants/schoolLevels";
import { useUIStore } from "@/store/uiStore";
import {
  printOfficialCertificate,
  type CertificateStudent,
} from "@/utils/officialCertificatePrint";
import { printAttendanceCertificates } from "@/utils/officialAttendanceCertificatePrint";

const eligibleGrades = ["K4", "Grade 4", "Grade 8"];
const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-sky-200 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white";
const fullName = (student: CertificateStudent) =>
  [student.user?.lastName, student.user?.middleName, student.user?.firstName]
    .filter(Boolean)
    .join(" ");

export default function CertificateControlCenter() {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const [students, setStudents] = useState<CertificateStudent[]>([]);
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [grade, setGrade] = useState("ALL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [printingId, setPrintingId] = useState("");
  const [notice, setNotice] = useState("");
  const [documentType, setDocumentType] = useState<"completion" | "attendance">(
    "completion",
  );
  const [documentLanguage, setDocumentLanguage] = useState<"fr" | "en">(
    language === "fr" ? "fr" : "en",
  );
  const [authenticated, setAuthenticated] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assets, setAssets] = useState({
    signatureImage: "",
    officialSealImage: "",
  });
  const [assetsBusy, setAssetsBusy] = useState(false);
  const signatureInput = useRef<HTMLInputElement>(null);
  const sealInput = useRef<HTMLInputElement>(null);
  const readImage = (
    file: File | undefined,
    kind: "signatureImage" | "officialSealImage",
  ) => {
    if (!file) return;
    if (!["image/png", "image/webp"].includes(file.type))
      return setNotice(
        tr("Choisissez une image PNG ou WebP.", "Choose a PNG or WebP image."),
      );
    const limit = kind === "signatureImage" ? 600 * 1024 : 1000 * 1024;
    if (file.size > limit)
      return setNotice(
        tr(
          `Le fichier doit peser moins de ${Math.round(limit / 1024)} Ko.`,
          `The file must be smaller than ${Math.round(limit / 1024)} KB.`,
        ),
      );
    const reader = new FileReader();
    reader.onload = () =>
      setAssets((current) => ({
        ...current,
        [kind]: String(reader.result || ""),
      }));
    reader.readAsDataURL(file);
  };
  const loadAssets = async () => {
    try {
      const { data } = await authAPI.documentAssets();
      setAssets({
        signatureImage: data?.data?.signatureImage ?? "",
        officialSealImage: data?.data?.officialSealImage ?? "",
      });
    } catch {
      /* certificate generation remains available */
    }
  };
  const saveAssets = async () => {
    setAssetsBusy(true);
    try {
      await authAPI.updateDocumentAssets(assets);
      setNotice(
        tr(
          "Signature et sceau officiels enregistrés et reliés aux certificats.",
          "Official signature and seal saved and linked to certificates.",
        ),
      );
    } catch (error: any) {
      setNotice(
        error?.response?.data?.message ??
          tr(
            "Enregistrement des éléments officiels impossible.",
            "Unable to save official assets.",
          ),
      );
    } finally {
      setAssetsBusy(false);
    }
  };
  const load = async () => {
    setBusy(true);
    try {
      const response = await academicRecordsAPI.studentRegistry();
      setStudents(response.data.data ?? []);
      setNotice("");
    } catch (error: any) {
      setNotice(
        error?.response?.data?.message ??
          tr(
            "Le registre des élèves est indisponible.",
            "The learner registry is unavailable.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
    void loadAssets();
  }, []);
  const visible = useMemo(() => {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return students
      .filter((student) => {
        const normalizedGrade = normalizeSchoolLevel(student.grade) ?? "";
        if (
          documentType === "completion" &&
          !eligibleGrades.includes(normalizedGrade)
        )
          return false;
        if (grade !== "ALL" && normalizedGrade !== grade) return false;
        const haystack = [
          fullName(student),
          student.studentNumber,
          normalizedGrade,
          student.section,
        ]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .sort(
        (a, b) =>
          eligibleGrades.indexOf(normalizeSchoolLevel(a.grade) ?? "") -
            eligibleGrades.indexOf(normalizeSchoolLevel(b.grade) ?? "") ||
          fullName(a).localeCompare(fullName(b), "fr", { sensitivity: "base" }),
      );
  }, [documentType, grade, query, students]);
  const selectedStudents = useMemo(
    () =>
      students
        .filter((student) => selected.has(student.id))
        .sort((a, b) =>
          fullName(a).localeCompare(fullName(b), "fr", { sensitivity: "base" }),
        ),
    [selected, students],
  );
  const print = async (student: CertificateStudent) => {
    setPrintingId(student.id);
    try {
      documentType === "attendance"
        ? await printAttendanceCertificates(
            [student],
            academicYear,
            documentLanguage,
            authenticated,
            setNotice,
          )
        : await printOfficialCertificate(
            student,
            academicYear,
            setNotice,
            documentLanguage,
            authenticated,
          );
    } finally {
      window.setTimeout(() => setPrintingId(""), 700);
    }
  };
  const printSelected = async () => {
    if (!selectedStudents.length)
      return setNotice(
        tr("Sélectionnez au moins un élève.", "Select at least one learner."),
      );
    setPrintingId("batch");
    try {
      await printAttendanceCertificates(
        selectedStudents,
        academicYear,
        documentLanguage,
        authenticated,
        setNotice,
      );
    } finally {
      setTimeout(() => setPrintingId(""), 700);
    }
  };
  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-5 shadow-sm dark:border-amber-800 dark:from-kcs-blue-900 dark:via-kcs-blue-950 dark:to-kcs-blue-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-amber-700 dark:text-amber-300">
              <ShieldCheck size={17} />
              {tr(
                "Documents officiels vérifiables",
                "Verifiable official documents",
              )}
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-kcs-blue-950 dark:text-white">
              {tr("Centre des certificats KCS", "KCS Certificate Center")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              {tr(
                "Émettez exclusivement les certificats de fin de cycle pour K4, Grade 4 et Grade 8. Chaque document comporte un numéro unique, un filigrane et un QR de vérification en direct.",
                "Issue completion certificates exclusively for K4, Grade 4 and Grade 8. Every document carries a unique number, watermark and live verification QR code.",
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-black text-kcs-blue-800 shadow-sm transition hover:border-kcs-blue-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcs-gold-400 disabled:cursor-wait disabled:opacity-60 dark:border-kcs-gold-300 dark:bg-kcs-gold-400 dark:text-kcs-blue-950 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:bg-kcs-gold-300"
          >
            <RefreshCw size={17} className={busy ? "animate-spin" : ""} />
            {tr("Actualiser", "Refresh")}
          </button>
        </div>
      </header>
      {notice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-200 dark:text-amber-950">
          {notice}
        </p>
      ) : null}
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-kcs-blue-950 dark:text-white">
              {tr(
                "Signature et sceau réellement apposés",
                "Signature and seal actually applied",
              )}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {tr(
                "Importez les fichiers officiels PNG/WebP. Ils seront enregistrés, audités et incorporés aux certificats lorsque l’authentification est activée.",
                "Upload official PNG/WebP files. They are saved, audited and embedded in certificates when authentication is enabled.",
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={assetsBusy}
            onClick={() => void saveAssets()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {assetsBusy ? (
              <Loader2 className="animate-spin" size={17} />
            ) : (
              <Save size={17} />
            )}{" "}
            {tr("Enregistrer les éléments officiels", "Save official assets")}
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-dashed border-sky-300 bg-white p-3 dark:border-kcs-blue-600 dark:bg-kcs-blue-950">
            <p className="text-xs font-black uppercase text-kcs-blue-700 dark:text-sky-200">
              {tr(
                "Signature officielle Super Administration",
                "Super Administration official signature",
              )}
            </p>
            <div className="my-3 flex h-24 items-center justify-center rounded-lg bg-slate-50 dark:bg-kcs-blue-900">
              {assets.signatureImage ? (
                <img
                  src={assets.signatureImage}
                  alt={tr("Aperçu signature", "Signature preview")}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <span className="text-xs font-bold text-slate-400">
                  {tr("Aucune signature importée", "No signature uploaded")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => signatureInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-sky-300 px-3 py-2 text-sm font-bold text-kcs-blue-800 dark:text-white"
            >
              <Upload size={16} />
              {tr("Importer / remplacer", "Upload / replace")}
            </button>
            <input
              ref={signatureInput}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(event) =>
                readImage(event.target.files?.[0], "signatureImage")
              }
            />
          </article>
          <article className="rounded-xl border border-dashed border-amber-300 bg-white p-3 dark:border-amber-700 dark:bg-kcs-blue-950">
            <p className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
              {tr("Sceau numérique officiel KCS", "Official KCS digital seal")}
            </p>
            <div className="my-3 flex h-24 items-center justify-center rounded-lg bg-slate-50 dark:bg-kcs-blue-900">
              {assets.officialSealImage ? (
                <img
                  src={assets.officialSealImage}
                  alt={tr("Aperçu sceau", "Seal preview")}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <span className="text-xs font-bold text-slate-400">
                  {tr("Aucun sceau importé", "No seal uploaded")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => sealInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-bold text-amber-800 dark:text-amber-200"
            >
              <Upload size={16} />
              {tr("Importer / remplacer", "Upload / replace")}
            </button>
            <input
              ref={sealInput}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(event) =>
                readImage(event.target.files?.[0], "officialSealImage")
              }
            />
          </article>
        </div>
      </section>
      <section className="rounded-2xl border border-sky-200 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:p-5">
        <div className="mb-4 grid gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 md:grid-cols-4">
          <label className="text-xs font-bold dark:text-white">
            {tr("Type de document", "Document type")}
            <select
              className={inputClass + " mt-1"}
              value={documentType}
              onChange={(e) => {
                setDocumentType(e.target.value as any);
                setSelected(new Set());
                setGrade("ALL");
              }}
            >
              <option value="completion">
                {tr("Certificat de réussite", "Completion certificate")}
              </option>
              <option value="attendance">
                {tr(
                  "Attestation de fréquentation",
                  "Certificate of attendance",
                )}
              </option>
            </select>
          </label>
          <label className="text-xs font-bold dark:text-white">
            {tr("Langue du document", "Document language")}
            <select
              className={inputClass + " mt-1"}
              value={documentLanguage}
              onChange={(e) =>
                setDocumentLanguage(e.target.value as "fr" | "en")
              }
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-sky-200 px-3 py-2.5 text-sm font-bold dark:border-kcs-blue-600 dark:text-white">
            <input
              type="checkbox"
              checked={authenticated}
              onChange={(e) => setAuthenticated(e.target.checked)}
            />
            {tr(
              "Inclure signatures et sceau numériques",
              "Include digital signatures and seal",
            )}
          </label>
          {documentType === "attendance" ? (
            <button
              type="button"
              disabled={printingId === "batch" || !selectedStudents.length}
              onClick={() => void printSelected()}
              className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileBadge2 size={17} />
              {printingId === "batch"
                ? tr("Préparation…", "Preparing…")
                : tr(
                    `Générer ${selectedStudents.length} attestation(s)`,
                    `Generate ${selectedStudents.length} certificate(s)`,
                  )}
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-[12rem_12rem_minmax(16rem,1fr)_auto]">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {tr("Année scolaire", "Academic year")}
            <input
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              className={inputClass + " mt-1"}
            />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {tr("Classe", "Grade")}
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              className={inputClass + " mt-1"}
            >
              <option value="ALL">
                {tr("Toutes les classes", "All grades")}
              </option>
              {(documentType === "completion"
                ? eligibleGrades
                : SCHOOL_LEVELS
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="relative self-end">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={inputClass + " pl-10"}
              placeholder={tr(
                "Nom, matricule, classe ou section…",
                "Name, student ID, grade or section…",
              )}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setGrade("ALL");
              setQuery("");
            }}
            className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-sky-200 px-3 py-2.5 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-white"
          >
            <FilterX size={17} />
            {tr("Réinitialiser", "Reset")}
          </button>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-300">
          {visible.length}{" "}
          {documentType === "attendance"
            ? tr("élève(s) disponible(s)", "available learner(s)")
            : tr("élève(s) admissible(s)", "eligible learner(s)")}{" "}
          · 45 {tr("jours par quarter", "days per quarter")} · 180{" "}
          {tr("jours ouvrables par année", "instructional days per year")}
        </p>
        {documentType === "attendance" ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set(visible.map((x) => x.id)))}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold dark:text-white"
            >
              <CheckSquare size={15} />
              {tr("Tout sélectionner", "Select all")}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg border px-3 py-2 text-xs font-bold dark:text-white"
            >
              {tr("Effacer la sélection", "Clear selection")}
            </button>
          </div>
        ) : null}
        {documentType === "attendance" ? (
          <section className="mt-3 rounded-2xl border-2 border-kcs-blue-200 bg-kcs-blue-50 p-3 dark:border-kcs-gold-400/60 dark:bg-kcs-blue-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-gold-300">
                  {tr(
                    "Élèves retenus pour le document",
                    "Learners selected for the document",
                  )}
                </p>
                <p className="text-sm font-bold text-kcs-blue-950 dark:text-white">
                  {selectedStudents.length
                    ? tr(
                        `${selectedStudents.length} élève(s) seront imprimé(s).`,
                        `${selectedStudents.length} learner(s) will be printed.`,
                      )
                    : tr(
                        "Aucun élève sélectionné. Cochez les cartes ci-dessous.",
                        "No learner selected. Check the cards below.",
                      )}
                </p>
              </div>
              <span className="rounded-full bg-kcs-blue-700 px-3 py-1 text-sm font-black text-white">
                {selectedStudents.length}
              </span>
            </div>
            {selectedStudents.length ? (
              <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-auto">
                {selectedStudents.map((student) => (
                  <button
                    type="button"
                    key={student.id}
                    onClick={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        next.delete(student.id);
                        return next;
                      })
                    }
                    className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-left text-xs font-bold text-kcs-blue-900 shadow-sm dark:border-kcs-blue-600 dark:bg-kcs-blue-950 dark:text-white"
                    title={tr("Cliquer pour retirer", "Click to remove")}
                  >
                    {fullName(student)} ·{" "}
                    {[normalizeSchoolLevel(student.grade), student.section]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    ×
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((student) => (
            <article
              key={student.id}
              className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900"
            >
              <div className="flex items-center gap-3">
                {documentType === "attendance" ? (
                  <input
                    aria-label={tr("Sélectionner", "Select")}
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        e.target.checked
                          ? next.add(student.id)
                          : next.delete(student.id);
                        return next;
                      })
                    }
                  />
                ) : null}
                <span className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-300 dark:text-kcs-blue-950">
                  <Award size={22} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-black text-kcs-blue-950 dark:text-white">
                    {fullName(student)}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                    {student.studentNumber} ·{" "}
                    {[normalizeSchoolLevel(student.grade), student.section]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(printingId)}
                onClick={() => void print(student)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-kcs-blue-800 disabled:opacity-50"
              >
                {printingId === student.id ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Printer size={17} />
                )}{" "}
                {printingId === student.id
                  ? tr("Préparation…", "Preparing…")
                  : documentType === "attendance"
                    ? tr("Générer l’attestation", "Generate certificate")
                    : tr(
                        "Générer le certificat officiel",
                        "Generate official certificate",
                      )}
              </button>
            </article>
          ))}
        </div>
        {!busy && !visible.length ? (
          <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-sky-100">
            {tr(
              "Aucun élève admissible ne correspond à cette recherche.",
              "No eligible learner matches this search.",
            )}
          </p>
        ) : null}
      </section>
    </section>
  );
}
