import { ACADEMIC_REPORT_PERIODS, academicPeriodLabel } from '@/constants/academicPeriods'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Search, Send } from "lucide-react";
import { SCHOOL_LEVELS, normalizeSchoolLevel } from "@/constants/schoolLevels";
import { useUIStore } from "@/store/uiStore";
import type { DeliveryCard } from "./ReportCardDeliveryDialog";

type Props = {
  cards: DeliveryCard[];
  year: string;
  term: string;
  selected: Record<string, string[]>;
  onSelect: Dispatch<SetStateAction<Record<string, string[]>>>;
  onReview: () => void;
  busy: boolean;
};
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const fullName = (user: {
  lastName: string;
  middleName?: string | null;
  firstName: string;
}) =>
  [user.lastName, user.middleName, user.firstName].filter(Boolean).join(" ");
const approved = (card: DeliveryCard) =>
  ["APPROVED", "POSTED_TO_PORTAL", "EMAILED"].includes(card.publicationStatus);
const field =
  "w-full min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:!text-white";
export default function ReportCardDeliveryToolbar({
  cards,
  year,
  term,
  selected,
  onSelect,
  onReview,
  busy,
}: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const [grades, setGrades] = useState<string[]>([]);
  const [section, setSection] = useState("ALL");
  const [period, setPeriod] = useState(term);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  useEffect(() => setPeriod(term), [term]);
  useEffect(() => setLimit(30), [year, grades, section, period, query]);
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
    approved(row.card) && Boolean(row.parent.email?.trim());
  const periods = [
    ...new Set([
      ...ACADEMIC_REPORT_PERIODS,
      ...cards
        .filter((card) => card.term.startsWith(year + " · "))
        .map((card) => card.term.split(" · ").slice(1).join(" · ")),
    ]),
  ];
  const sections = [
    ...new Set(
      cards
        .filter(
          (card) =>
            !grades.length ||
            grades.includes(normalizeSchoolLevel(card.student.grade) ?? ""),
        )
        .map((card) => card.student.section?.trim())
        .filter(Boolean) as string[],
    ),
  ].sort();
  const visible = useMemo(() => {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    return rows
      .filter(({ card, parent }) => {
        if (!card.term.startsWith(year + " · ")) return false;
        if (
          period !== "ALL" &&
          card.term
            .split(" · ")
            .slice(1)
            .join(" · ")
            .replace(/Trimester/gi, "Quarter") !==
            period.replace(/Trimester/gi, "Quarter")
        )
          return false;
        if (
          grades.length &&
          !grades.includes(normalizeSchoolLevel(card.student.grade) ?? "")
        )
          return false;
        if (
          section !== "ALL" &&
          (card.student.section?.trim() || "NONE") !== section
        )
          return false;
        return tokens.every((token) =>
          normalize(
            [
              fullName(parent),
              fullName(card.student.user),
              parent.email,
              parent.phone,
              card.student.studentNumber,
              card.student.grade,
              card.student.section,
            ].join(" "),
          ).includes(token),
        );
      })
      .sort(
        (a, b) =>
          fullName(a.card.student.user).localeCompare(
            fullName(b.card.student.user),
            language,
            { sensitivity: "base" },
          ) || fullName(a.parent).localeCompare(fullName(b.parent), language),
      );
  }, [rows, year, period, grades, section, query, language]);
  const chosen = rows.filter(
    (row) => eligible(row) && selected[row.card.id]?.includes(row.parent.id),
  );
  const chosenCards = new Set(chosen.map((row) => row.card.id)).size;
  const chosenParents = new Set(chosen.map((row) => row.parent.id)).size;
  const toggle = (cardId: string, parentId: string) =>
    onSelect((current) => {
      const ids = new Set(current[cardId] ?? []);
      ids.has(parentId) ? ids.delete(parentId) : ids.add(parentId);
      return { ...current, [cardId]: [...ids] };
    });
  const selectMatches = () =>
    onSelect((current) => {
      const next = { ...current };
      for (const { card, parent } of visible.filter(eligible))
        next[card.id] = [...new Set([...(next[card.id] ?? []), parent.id])];
      return next;
    });
  return (
    <section
      data-testid="report-delivery-toolbar"
      aria-labelledby="delivery-toolbar-title"
      className="space-y-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50/80 p-4 dark:border-emerald-600 dark:bg-kcs-blue-900 sm:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:!text-emerald-200">
            {tr(
              "Distribution officielle · E-mail + PDF",
              "Official delivery · Email + PDF",
            )}
          </p>
          <h3
            id="delivery-toolbar-title"
            className="text-lg font-black text-kcs-blue-950 dark:!text-white"
          >
            {tr("Cibler les parents destinataires", "Target parent recipients")}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:!text-slate-200">
            {tr(
              "1. Filtrez les familles. 2. Cochez les destinataires. 3. Vérifiez et confirmez l’envoi.",
              "1. Filter families. 2. Select recipients. 3. Review and confirm delivery.",
            )}
          </p>
        </div>
        <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-kcs-blue-950 dark:bg-kcs-blue-950 dark:!text-white">
          {year} · {tr("Mail et PDF", "Email and PDF")} {language.toUpperCase()}
        </span>
      </header>
      <fieldset
        disabled={busy}
        className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <details className="relative min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-2.5 dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
          <summary className="cursor-pointer text-sm font-bold text-kcs-blue-950 dark:!text-white">
            {tr("Classes des enfants", "Children’s grades")} ·{" "}
            {grades.length || tr("Toutes", "All")}
          </summary>
          <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
            {SCHOOL_LEVELS.map((grade) => (
              <label
                key={grade}
                className="flex items-center gap-2 text-xs text-kcs-blue-950 dark:!text-white"
              >
                <input
                  type="checkbox"
                  checked={grades.includes(grade)}
                  onChange={() => {
                    setGrades((current) =>
                      current.includes(grade)
                        ? current.filter((item) => item !== grade)
                        : [...current, grade],
                    );
                    setSection("ALL");
                  }}
                />
                {grade}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setGrades([]);
              setSection("ALL");
            }}
            className="mt-2 text-xs font-bold text-sky-700 dark:!text-cyan-200"
          >
            {tr("Toutes les classes", "All grades")}
          </button>
        </details>
        <label className="grid content-start gap-1 text-xs font-bold text-kcs-blue-950 dark:!text-white">
          {tr("Section", "Section")}
          <select
            className={field}
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="ALL">
              {tr("Toutes les sections", "All sections")}
            </option>
            <option value="NONE">{tr("Sans section", "No section")}</option>
            {sections.map((value) => (
              <option key={value} value={value}>{academicPeriodLabel(value, language)}</option>
            ))}
          </select>
        </label>
        <label className="grid content-start gap-1 text-xs font-bold text-kcs-blue-950 dark:!text-white">
          {tr("Période", "Period")}
          <select
            className={field}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="ALL">
              {tr("Toutes les périodes", "All periods")}
            </option>
            {periods.map((value) => (
              <option key={value} value={value}>{academicPeriodLabel(value, language)}</option>
            ))}
          </select>
        </label>
        <label className="grid content-start gap-1 text-xs font-bold text-kcs-blue-950 dark:!text-white">
          {tr("Recherche parent / enfant", "Parent / child search")}
          <span className="relative">
            <Search
              size={15}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className={field + " pl-9"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr(
                "Nom, e-mail, téléphone, matricule…",
                "Name, email, phone, student ID…",
              )}
            />
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="button"
            onClick={selectMatches}
            disabled={!visible.some(eligible)}
            className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {tr(
              "Sélectionner les parents de ces résultats",
              "Select parents in these results",
            )}{" "}
            ({visible.filter(eligible).length})
          </button>
          <button
            type="button"
            onClick={() => onSelect({})}
            className="rounded-xl border border-sky-300 px-3 py-2 text-xs font-bold text-kcs-blue-900 dark:border-sky-700 dark:!text-white"
          >
            {tr("Vider toute la sélection", "Clear entire selection")}
          </button>
          <span className="text-xs text-slate-700 dark:!text-slate-200">
            {visible.length}{" "}
            {tr(
              "lien(s) parent/bulletin trouvé(s)",
              "parent/report-card link(s) found",
            )}
          </span>
        </div>
      </fieldset>
      <div className="max-h-72 overflow-auto rounded-xl border border-sky-200 bg-white dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
        {visible.slice(0, limit).map(({ card, parent }) => (
          <label
            key={card.id + ":" + parent.id}
            className="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 border-b border-sky-100 p-3 last:border-0 dark:border-kcs-blue-800"
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={busy || !eligible({ card, parent })}
              checked={Boolean(selected[card.id]?.includes(parent.id))}
              onChange={() => toggle(card.id, parent.id)}
            />
            <span className="grid min-w-0 gap-1 text-xs sm:grid-cols-2">
              <span>
                <b className="text-kcs-blue-950 dark:!text-white">
                  {fullName(card.student.user)}
                </b>
                <span className="block text-slate-600 dark:!text-slate-300">
                  {[card.student.grade, card.student.section]
                    .filter(Boolean)
                    .join(" ")}{" "}
                  · {academicPeriodLabel(card.term, language)}
                </span>
              </span>
              <span className="break-words text-kcs-blue-950 dark:!text-white">
                <b>{fullName(parent)}</b>
                <span className="block text-slate-600 dark:!text-slate-300">
                  {parent.email || tr("E-mail manquant", "Missing email")}
                </span>
                {!approved(card) && (
                  <span className="block font-bold text-amber-800 dark:!text-amber-200">
                    {tr(
                      "À approuver avant l’envoi",
                      "Approval required before sending",
                    )}
                  </span>
                )}
              </span>
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="p-4 text-sm text-slate-600 dark:!text-slate-200">
            {tr(
              "Aucun destinataire ne correspond à ces filtres.",
              "No recipient matches these filters.",
            )}
          </p>
        )}
        {visible.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((current) => current + 30)}
            className="w-full p-3 text-sm font-bold text-sky-700 dark:!text-cyan-200"
          >
            {tr("Afficher les résultats suivants", "Show more results")}
          </button>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-emerald-950 dark:!text-emerald-100">
          {chosenCards} {tr("bulletin(s)", "report card(s)")} · {chosenParents}{" "}
          {tr("parent(s)", "parent(s)")} · {chosen.length}{" "}
          {tr("pièce(s) jointe(s) sélectionnée(s)", "selected attachment(s)")}
          <small className="mt-1 block font-normal">
            {tr(
              "La sélection est conservée quand vous changez les filtres. Seuls les bulletins approuvés sont envoyables.",
              "Selection is retained when filters change. Only approved report cards can be sent.",
            )}
          </small>
        </p>
        <button
          type="button"
          disabled={busy || !chosen.length}
          onClick={onReview}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <Send size={17} />
          {tr(
            "Vérifier les destinataires et envoyer",
            "Review recipients and send",
          )}
        </button>
      </footer>
    </section>
  );
}
