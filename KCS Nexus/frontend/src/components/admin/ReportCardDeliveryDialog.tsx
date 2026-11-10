import { ACADEMIC_REPORT_PERIODS, academicPeriodLabel } from '@/constants/academicPeriods'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Search, Send, X } from "lucide-react";
import { SCHOOL_LEVELS, normalizeSchoolLevel } from "@/constants/schoolLevels";
import { useUIStore } from "@/store/uiStore";

type Parent = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};
export type DeliveryCard = {
  id: string;
  term: string;
  publicationStatus: string;
  student: {
    studentNumber: string;
    grade?: string | null;
    section?: string | null;
    user: { firstName: string; middleName?: string | null; lastName: string };
    parentLinks?: Array<{ parentId: string; parent: Parent }>;
  };
};
type Selection = Record<string, string[]>;
type Props = {
  cards: DeliveryCard[];
  initialReview?: boolean;
  initialYear: string;
  initialTerm: string;
  initialGrade: string;
  selected: Selection;
  onSelect: Dispatch<SetStateAction<Selection>>;
  busy: boolean;
  progress?: string;
  onClose: () => void;
  onDeliver: (approvePending?: boolean) => void;
};
const field =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white";
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const name = (user: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}) =>
  [user.lastName, user.middleName, user.firstName].filter(Boolean).join(" ");
const approved = (card: DeliveryCard) =>
  ["APPROVED", "POSTED_TO_PORTAL", "EMAILED"].includes(card.publicationStatus);

export default function ReportCardDeliveryDialog({
  cards,
  initialYear,
  initialTerm,
  initialGrade,
  initialReview = false,
  selected,
  onSelect,
  busy,
  progress,
  onClose,
  onDeliver,
}: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const [grade, setGrade] = useState(initialGrade);
  const [section, setSection] = useState("ALL");
  const [year, setYear] = useState(initialYear);
  const [term, setTerm] = useState(initialTerm);
  const [query, setQuery] = useState("");
  const [review, setReview] = useState(initialReview);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  useEffect(() => setApprovalConfirmed(false), [selected]);
  const rows = useMemo(
    () =>
      cards.flatMap((card) =>
        (card.student.parentLinks ?? []).map(({ parent }) => ({
          card,
          parent,
        })),
      ),
    [cards],
  );
  const eligible = (row: (typeof rows)[number]) =>
    Boolean(row.parent.email?.trim());
  useEffect(() => {
    onSelect((current) =>
      Object.fromEntries(
        Object.entries(current).map(([cardId, ids]) => [
          cardId,
          ids.filter((parentId) =>
            rows.some(
              (row) =>
                row.card.id === cardId &&
                row.parent.id === parentId &&
                eligible(row),
            ),
          ),
        ]),
      ),
    );
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const visibleRows = useMemo(() => {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    return rows.filter(({ card, parent }) => {
      if (!card.term.startsWith(year + " · ")) return false;
      if (
        term !== "ALL" &&
        card.term
          .split(" · ")
          .slice(1)
          .join(" · ")
          .replace(/Trimester/gi, "Quarter") !==
          term.replace(/Trimester/gi, "Quarter")
      )
        return false;
      if (grade !== "ALL" && normalizeSchoolLevel(card.student.grade) !== grade)
        return false;
      if (
        section !== "ALL" &&
        String(card.student.section || "").trim() !== section
      )
        return false;
      const text = normalize(
        [
          name(parent),
          parent.email,
          parent.phone,
          name(card.student.user),
          card.student.studentNumber,
          card.student.grade,
          card.student.section,
        ].join(" "),
      );
      return tokens.every((token) => text.includes(token));
    });
  }, [rows, year, term, grade, section, query]);
  const selectedRows = rows.filter(
    (row) => eligible(row) && selected[row.card.id]?.includes(row.parent.id),
  );
  const pendingApprovalCount = new Set(selectedRows.filter(row => !approved(row.card)).map(row => row.card.id)).size;
  const selectedCardCount = new Set(selectedRows.map((row) => row.card.id))
    .size;
  const years = [
    ...new Set([
      initialYear,
      ...cards.map((card) => card.term.split(" · ")[0]),
    ]),
  ]
    .sort()
    .reverse();
  const terms = [
    ...new Set(
      cards
        .filter((card) => card.term.startsWith(year + " · "))
        .map((card) => card.term.split(" · ").slice(1).join(" · ")),
    ),
  ];
  const sections = [
    ...new Set(
      cards
        .filter(
          (card) =>
            grade === "ALL" ||
            normalizeSchoolLevel(card.student.grade) === grade,
        )
        .map((card) => card.student.section?.trim())
        .filter(Boolean) as string[],
    ),
  ].sort();
  const toggle = (cardId: string, parentId: string) =>
    onSelect((current) => {
      const ids = new Set(current[cardId] ?? []);
      ids.has(parentId) ? ids.delete(parentId) : ids.add(parentId);
      return { ...current, [cardId]: [...ids] };
    });
  const selectVisible = () =>
    onSelect((current) => {
      const next = { ...current };
      for (const row of visibleRows.filter(eligible))
        next[row.card.id] = [
          ...new Set([...(next[row.card.id] ?? []), row.parent.id]),
        ];
      return next;
    });
  const displayRows = review ? selectedRows : visibleRows;
  return createPortal(
    <div
      className="fixed inset-0 z-[10020] grid place-items-center bg-kcs-blue-950/80 p-2 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-delivery-title"
    >
      <section className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-sky-200 bg-white text-kcs-blue-950 shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-sky-100 p-4 dark:border-kcs-blue-800 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              {tr(
                "Distribution officielle des bulletins",
                "Official report-card delivery",
              )}
            </p>
            <h2 id="report-delivery-title" className="mt-1 text-xl font-black">
              {review
                ? tr(
                    "Vérifiez les destinataires exacts",
                    "Review exact recipients",
                  )
                : tr(
                    "Choisir les parents et leurs enfants",
                    "Choose parents and their children",
                  )}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {tr(
                "Chaque parent reçoit uniquement le PDF de son enfant, par e-mail et dans son portail.",
                "Each parent receives only their own child’s PDF by email and in their portal.",
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label={tr("Fermer", "Close")}
            className="rounded-xl border border-sky-200 p-2 dark:border-kcs-blue-700"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {progress && (
            <p
              role="status"
              className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white"
            >
              {progress}
            </p>
          )}
          {!review && (
            <fieldset
              disabled={busy}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="grid gap-1 text-xs font-bold">
                {tr("Année scolaire", "Academic year")}
                <select
                  className={field}
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    setTerm("ALL");
                  }}
                >
                  {years.map((value) => (
                    <option key={value} value={value}>{academicPeriodLabel(value, language)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                {tr("Période du bulletin", "Report-card period")}
                <select
                  className={field}
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                >
                  <option value="ALL">
                    {tr("Toutes les périodes", "All periods")}
                  </option>
                  {[...new Set([...ACADEMIC_REPORT_PERIODS, initialTerm, ...terms])].map((value) => (
                    <option key={value} value={value}>{academicPeriodLabel(value, language)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                {tr("Classe de l’enfant", "Child’s grade")}
                <select
                  className={field}
                  value={grade}
                  onChange={(event) => {
                    setGrade(event.target.value);
                    setSection("ALL");
                  }}
                >
                  <option value="ALL">
                    {tr("Toutes les classes", "All grades")}
                  </option>
                  {SCHOOL_LEVELS.map((value) => (
                    <option key={value} value={value}>{academicPeriodLabel(value, language)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                {tr("Section", "Section")}
                <select
                  className={field}
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                >
                  <option value="ALL">
                    {tr("Toutes les sections", "All sections")}
                  </option>
                  {sections.map((value) => (
                    <option key={value} value={value}>{academicPeriodLabel(value, language)}</option>
                  ))}
                </select>
              </label>
              <label className="relative sm:col-span-2 lg:col-span-4">
                <Search
                  size={17}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <input
                  className={field + " pl-10"}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={tr(
                    "Nom du parent ou de l’enfant, matricule, e-mail, téléphone…",
                    "Parent or learner name, student ID, email, phone…",
                  )}
                  aria-label={tr(
                    "Recherche des destinataires",
                    "Recipient search",
                  )}
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={selectVisible}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
                >
                  {tr(
                    "Sélectionner les parents de ces résultats",
                    "Select parents in these results",
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect({})}
                  className="rounded-xl border border-sky-200 px-4 py-2 text-xs font-bold dark:border-kcs-blue-700"
                >
                  {tr("Vider toute la sélection", "Clear entire selection")}
                </button>
              </div>
            </fieldset>
          )}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            {selectedCardCount} {tr("bulletin(s)", "report card(s)")} ·{" "}
            {selectedRows.length}{" "}
            {tr("livraison(s) sélectionnée(s)", "selected delivery item(s)")} ·{" "}
            {tr("Langue du mail et du PDF", "Email and PDF language")}{" "}
            {language.toUpperCase()}
          </div>
          <div className="overflow-x-auto rounded-xl border border-sky-100 dark:border-kcs-blue-800">
            <table className="w-full min-w-[690px] text-left text-xs">
              <thead className="bg-sky-50 dark:bg-kcs-blue-900">
                <tr>
                  <th className="p-3">{tr("Choix", "Select")}</th>
                  <th>
                    {tr("Élève / classe / période", "Learner / grade / period")}
                  </th>
                  <th>{tr("Parent destinataire", "Parent recipient")}</th>
                  <th>{tr("E-mail de destination", "Destination email")}</th>
                  <th>{tr("État", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.card.id + row.parent.id}
                    className="border-t border-sky-100 dark:border-kcs-blue-800"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        disabled={busy || !eligible(row)}
                        checked={Boolean(
                          selected[row.card.id]?.includes(row.parent.id),
                        )}
                        onChange={() => toggle(row.card.id, row.parent.id)}
                        aria-label={
                          tr(
                            "Envoyer le bulletin de ",
                            "Send report card for ",
                          ) +
                          name(row.card.student.user) +
                          tr(" à ", " to ") +
                          name(row.parent)
                        }
                      />
                    </td>
                    <td className="max-w-64 p-3">
                      <b className="block">{name(row.card.student.user)}</b>
                      <span className="block text-slate-500 dark:text-slate-300">
                        {row.card.student.studentNumber} ·{" "}
                        {[row.card.student.grade, row.card.student.section]
                          .filter(Boolean)
                          .join(" ")}
                        <br />
                        {academicPeriodLabel(row.card.term, language)}
                      </span>
                    </td>
                    <td className="p-3 font-bold">{name(row.parent)}</td>
                    <td className="p-3">
                      {row.parent.email ||
                        tr("E-mail manquant", "Email missing")}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          eligible(row)
                            ? "font-bold text-emerald-700 dark:text-emerald-300"
                            : "font-bold text-amber-700 dark:text-amber-300"
                        }
                      >
                        {!approved(row.card)
                          ? tr(
                              "À approuver avant envoi",
                              "Approve before sending",
                            )
                          : row.parent.email
                            ? tr("Prêt", "Ready")
                            : tr(
                                "Ajouter une adresse e-mail",
                                "Add an email address",
                              )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!displayRows.length && (
              <p className="p-5 text-sm text-slate-500 dark:text-slate-300">
                {tr(
                  "Aucun parent lié ne correspond à ces filtres.",
                  "No linked parent matches these filters.",
                )}
              </p>
            )}
          </div>
        </div>
        {review && pendingApprovalCount > 0 && <label className="mx-4 mb-3 flex shrink-0 items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950 dark:bg-amber-200"><input type="checkbox" checked={approvalConfirmed} disabled={busy} onChange={event => setApprovalConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0"/><span>{tr(`J’ai vérifié les ${pendingApprovalCount} bulletin(s) encore non approuvé(s). Je confirme leur approbation avant l’envoi aux parents sélectionnés.`, `I have reviewed the ${pendingApprovalCount} report card(s) awaiting approval. I confirm their approval before delivery to the selected parents.`)}</span></label>}
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-sky-100 p-4 dark:border-kcs-blue-800">
          <button
            type="button"
            disabled={busy}
            onClick={() => (review ? setReview(false) : onClose())}
            className="rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-bold dark:border-kcs-blue-700"
          >
            {review
              ? tr("Modifier la sélection", "Edit selection")
              : tr("Annuler", "Cancel")}
          </button>
          <button
            type="button"
            disabled={busy || !selectedRows.length || (review && pendingApprovalCount > 0 && !approvalConfirmed)}
            onClick={() => (review ? onDeliver(approvalConfirmed) : setReview(true))}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={17} className="animate-spin" />
            ) : review ? (
              <Send size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}{" "}
            {review
              ? pendingApprovalCount > 0 ? tr("Approuver et envoyer", "Approve and send") : tr("Confirmer l’envoi", "Confirm delivery")
              : tr("Prévisualiser les destinataires", "Preview recipients")}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
