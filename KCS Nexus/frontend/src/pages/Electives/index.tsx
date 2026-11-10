import "./electives.css";
import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import PortalSidebar from "@/components/layout/PortalSidebar";
import { electivesAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
type O = {
  id: string;
  code: string;
  name: string;
  description: string;
  eligibleGrades: string[];
  capacity: number;
  status: string;
  teacher?: any;
  _count?: any;
};
type C = {
  eligibleGrades: string[];
  choiceWindowOpen?: boolean;
  id: string;
  title: string;
  academicYear: string;
  semester: number;
  status: string;
  offerings: O[];
  _count: any;
};
const grades = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const field =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white";
const tn = (t: any, fallback = "Unassigned") =>
  t
    ? [t.lastName, t.middleName, t.firstName].filter(Boolean).join(" ")
    : fallback;
export default function ElectivesPage() {
  const { user } = useAuthStore(),
    language = useUIStore((state) => state.language),
    tr = (fr: string, en: string) => (language === "fr" ? fr : en),
    managerRole = user?.role === "admin" && user.id !== "configured-superadmin",
    teacherRole =
      user?.role === "teacher" ||
      Boolean(user?.accessRoles?.includes("teacher")),
    student = user?.role === "student";
  const [data, setData] = useState<any>({ cycles: [] }),
    [teachers, setTeachers] = useState<any[]>([]),
    [selected, setSelected] = useState(""),
    [choices, setChoices] = useState<string[]>(Array(6).fill("")),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<any>(null);
  const admin = data.permissions?.canManage ?? managerRole,
    teacher = data.permissions?.canPropose ?? teacherRole;
  const [search, setSearch] = useState(""),
    [gradeFilter, setGradeFilter] = useState("ALL");
  const [cf, setCf] = useState({
    title: "Sélection des cours électifs",
    academicYear: "2026-2027",
    semester: 1,
    eligibleGrades: grades,
    opensAt: "",
    closesAt: "",
  });
  const [of, setOf] = useState({
    code: "",
    name: "",
    description: "",
    eligibleGrades: grades,
    capacity: 24,
    teacherUserId: "",
  });
  const load = async () => {
    setBusy(true);
    try {
      const r = await electivesAPI.list(),
        d = r.data.data || { cycles: [] };
      setData(d);
      if (!selected && d.cycles?.[0]) setSelected(d.cycles[0].id);
    } catch (e: any) {
      setMessage(
        e?.response?.data?.message ||
          tr(
            "Impossible de charger les cours électifs.",
            "Unable to load elective selection.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
    if (admin)
      electivesAPI
        .teachers()
        .then((r) => setTeachers(r.data.data || []))
        .catch(() =>
          setMessage(
            tr(
              "La liste des enseignants ne peut pas être chargée.",
              "The teacher directory could not be loaded.",
            ),
          ),
        );
  }, []);
  const cycles: C[] = data.cycles || [],
    cycle = cycles.find((c) => c.id === selected) || cycles[0];
  const statusLabel = (value: string) =>
    (
      ({
        DRAFT: tr("Brouillon", "Draft"),
        OPEN: tr("Choix ouverts", "Choices open"),
        CLOSED: tr("Choix clôturés", "Choices closed"),
        ALLOCATED: tr("Attributions calculées", "Allocated"),
        PUBLISHED: tr("Publié", "Published"),
        PROPOSED: tr("À approuver", "Awaiting approval"),
        APPROVED: tr("Approuvé", "Approved"),
        REJECTED: tr("Refusé", "Rejected"),
      }) as Record<string, string>
    )[value] || value;
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visibleOfferings = (cycle?.offerings || []).filter(
    (o) =>
      (gradeFilter === "ALL" || o.eligibleGrades.includes(gradeFilter)) &&
      normalize(search)
        .trim()
        .split(/\s+/)
        .every((token) =>
          normalize(
            [o.name, o.code, o.description, tn(o.teacher)].join(" "),
          ).includes(token),
        ),
  );
  useEffect(() => {
    setSearch("");
    setGradeFilter("ALL");
  }, [cycle?.id]);
  const approved =
    cycle?.offerings.filter(
      (o) =>
        o.status === "APPROVED" &&
        (!data.grade || o.eligibleGrades.includes(data.grade)),
    ) || [];
  useEffect(() => {
    if (!student || !cycle) return;
    const current = (data.choices || [])
      .filter((item: any) => item.cycleId === cycle.id)
      .sort((a: any, b: any) => a.rank - b.rank)
      .map((item: any) => item.offeringId);
    setChoices([...current, ...Array(6).fill("")].slice(0, 6));
  }, [student, cycle?.id, data.choices]);
  const feedback = (value: string) =>
    (
      ({
        "Elective cycle created": tr(
          "Campagne créée. Préparez son catalogue.",
          "Cycle created. Prepare its catalogue.",
        ),
        "Elective cycle status updated": tr(
          "Le statut de la campagne est enregistré.",
          "Cycle status saved.",
        ),
        "Proposal submitted for approval": tr(
          "Votre proposition est transmise au Principal.",
          "Your proposal was sent to the Principal.",
        ),
        "Elective added": tr(
          "Le cours a été ajouté au catalogue.",
          "The course was added to the catalogue.",
        ),
        "Elective updated": tr(
          "Le cours électif est mis à jour.",
          "The elective course was updated.",
        ),
        "Elective removed": tr(
          "Le cours électif est supprimé.",
          "The elective course was removed.",
        ),
        "Allocation completed": tr(
          "Attributions calculées. Vérifiez le rapport avant publication.",
          "Allocations calculated. Review the report before publication.",
        ),
        "Final elective lists published": tr(
          "Les listes finales sont publiées pour les élèves et enseignants.",
          "Final lists are published to learners and teachers.",
        ),
        "Six ranked elective choices submitted": tr(
          "Vos six préférences sont enregistrées sur le serveur.",
          "Your six preferences were saved on the server.",
        ),
      }) as Record<string, string>
    )[value] || value;
  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fn();
      setMessage(feedback(r.data.message));
      await load();
      return r;
    } catch (e: any) {
      setMessage(
        e?.response?.data?.message ||
          tr("Opération impossible", "Operation failed"),
      );
    } finally {
      setBusy(false);
    }
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (cycle)
      void act(() =>
        electivesAPI.addOffering(cycle.id, {
          ...of,
          teacherUserId: of.teacherUserId || null,
        }),
      );
  };
  const toggle = (g: string, current: string[], set: (v: string[]) => void) =>
    set(current.includes(g) ? current.filter((x) => x !== g) : [...current, g]);
  return (
    <div className="portal-shell elective-workspace flex">
      <PortalSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20 dark:bg-kcs-blue-950 lg:p-8 lg:pt-8">
        <div className="w-full max-w-none space-y-6">
          <header className="elective-hero">
            <div className="elective-hero-row">
              <div>
                <span className="elective-eyebrow">
                  <BookOpenCheck size={17} />
                  KCS NEXUS · {tr("PARCOURS ÉLECTIFS", "ELECTIVE PATHWAYS")}
                </span>
                <h1>
                  {tr(
                    "Des cours qui ouvrent de nouvelles perspectives",
                    "Discover your next learning pathway",
                  )}
                </h1>
                <p>
                  {admin
                    ? tr(
                        "Préparez le catalogue, approuvez les propositions, puis ouvrez et publiez les attributions.",
                        "Prepare the catalogue, approve proposals, then open choices and publish allocations.",
                      )
                    : teacher
                      ? tr(
                          "Proposez vos cours, suivez leur approbation et retrouvez vos élèves après publication.",
                          "Propose courses, follow approval and find your learners after publication.",
                        )
                      : tr(
                          "Explorez les cours et classez six préférences différentes pour votre semestre.",
                          "Explore courses and rank six distinct preferences for your semester.",
                        )}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void load()}
                className="elective-refresh"
                aria-label={tr("Actualiser", "Refresh")}
              >
                {busy ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <RefreshCw size={18} />
                )}
              </button>
            </div>
            <ol className="elective-steps">
              {[
                tr("Préparer", "Prepare"),
                tr("Choisir", "Choose"),
                tr("Attribuer", "Allocate"),
                tr("Publier", "Publish"),
              ].map((label, index) => (
                <li
                  key={label}
                  aria-current={
                    cycle &&
                    index ===
                      (cycle.status === "PUBLISHED"
                        ? 3
                        : ["CLOSED", "ALLOCATED"].includes(cycle.status)
                          ? 2
                          : cycle.status === "OPEN"
                            ? 1
                            : 0)
                      ? "step"
                      : undefined
                  }
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          </header>
          {message && (
            <p role="status" className="elective-notice">
              {message}
            </p>
          )}
          {!busy && !cycle && !admin && (
            <section className="rounded-3xl border border-sky-100 bg-white p-8 text-center shadow dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white">
              <BookOpenCheck
                className="mx-auto text-kcs-blue-600 dark:text-sky-300"
                size={36}
              />
              <h2 className="mt-3 text-xl font-black">
                {tr(
                  "Aucune campagne élective active",
                  "No active elective cycle",
                )}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                {tr(
                  "Le Principal publiera ici la prochaine période de sélection.",
                  "The Principal will publish the next selection window here.",
                )}
              </p>
            </section>
          )}
          {admin && (
            <details className="elective-disclosure">
              <summary>
                <Plus size={18} />
                {tr("Nouvelle campagne semestrielle", "New semester cycle")}
              </summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(() =>
                    electivesAPI.createCycle({
                      ...cf,
                      opensAt: cf.opensAt
                        ? new Date(cf.opensAt).toISOString()
                        : null,
                      closesAt: cf.closesAt
                        ? new Date(cf.closesAt).toISOString()
                        : null,
                    }),
                  );
                }}
                className="grid gap-3 rounded-3xl bg-white p-5 shadow dark:bg-kcs-blue-900 sm:grid-cols-2 lg:grid-cols-4"
              >
                <h2 className="col-span-full text-xl font-black dark:text-white">
                  {tr("1. Créer le semestre", "1. Create the semester")}
                </h2>
                <label className="elective-label">
                  {tr("Titre de la campagne", "Cycle title")}
                  <input
                    required
                    minLength={3}
                    maxLength={140}
                    className={field}
                    value={cf.title}
                    onChange={(e) => setCf({ ...cf, title: e.target.value })}
                  />
                </label>
                <label className="elective-label">
                  {tr("Année scolaire", "Academic year")}
                  <input
                    required
                    pattern="\d{4}-\d{4}"
                    className={field}
                    value={cf.academicYear}
                    onChange={(e) =>
                      setCf({ ...cf, academicYear: e.target.value })
                    }
                  />
                </label>
                <label className="elective-label">
                  {tr("Semestre", "Semester")}
                  <select
                    className={field}
                    value={cf.semester}
                    onChange={(e) =>
                      setCf({ ...cf, semester: Number(e.target.value) })
                    }
                  >
                    <option value={1}>{tr("Semestre 1", "Semester 1")}</option>
                    <option value={2}>{tr("Semestre 2", "Semester 2")}</option>
                  </select>
                </label>
                <button
                  disabled={busy}
                  className="rounded-xl bg-kcs-blue-700 font-bold text-white"
                >
                  <Plus className="inline" size={16} /> {tr("Créer", "Create")}
                </button>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {tr("Ouverture des choix", "Choice opening")}
                  <input
                    type="datetime-local"
                    className={field + " mt-1"}
                    value={cf.opensAt}
                    onChange={(e) => setCf({ ...cf, opensAt: e.target.value })}
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {tr("Clôture des choix", "Choice deadline")}
                  <input
                    type="datetime-local"
                    className={field + " mt-1"}
                    value={cf.closesAt}
                    onChange={(e) => setCf({ ...cf, closesAt: e.target.value })}
                  />
                </label>
                <div className="col-span-full flex flex-wrap gap-2">
                  {grades.map((g) => (
                    <label
                      key={g}
                      className="rounded-full border px-3 py-2 text-sm dark:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={cf.eligibleGrades.includes(g)}
                        onChange={() =>
                          toggle(g, cf.eligibleGrades, (v) =>
                            setCf({ ...cf, eligibleGrades: v }),
                          )
                        }
                      />{" "}
                      {g}
                    </label>
                  ))}
                </div>
              </form>
            </details>
          )}
          {cycle && (
            <>
              <section className="rounded-3xl bg-white p-5 shadow dark:bg-kcs-blue-900 dark:text-white">
                <label className="elective-label elective-cycle-picker">
                  {tr(
                    "Campagne et semestre à consulter",
                    "Cycle and semester to view",
                  )}
                  <select
                    className={field}
                    value={cycle.id}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setReport(null);
                    }}
                  >
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} · {c.academicYear} ·{" "}
                        {tr("Semestre", "Semester")} {c.semester}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-3 font-bold">
                  {tr("Statut", "Status")} : {statusLabel(cycle.status)} ·{" "}
                  {cycle.offerings.length} {tr("cours", "courses")}
                </p>
                {admin && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={
                        busy ||
                        !["DRAFT", "CLOSED", "ALLOCATED"].includes(cycle.status)
                      }
                      onClick={() =>
                        void act(() => electivesAPI.setStatus(cycle.id, "OPEN"))
                      }
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-white disabled:opacity-40"
                    >
                      {cycle.status === "DRAFT"
                        ? tr("Ouvrir les choix", "Open choices")
                        : tr("Rouvrir les choix", "Reopen choices")}
                    </button>
                    <button
                      disabled={busy || cycle.status !== "OPEN"}
                      onClick={() =>
                        void act(() =>
                          electivesAPI.setStatus(cycle.id, "CLOSED"),
                        )
                      }
                      className="rounded-xl bg-amber-600 px-4 py-2 text-white disabled:opacity-40"
                    >
                      {tr("Clôturer", "Close")}
                    </button>
                    <button
                      disabled={
                        busy || !["CLOSED", "ALLOCATED"].includes(cycle.status)
                      }
                      onClick={() =>
                        void act(() => electivesAPI.allocate(cycle.id))
                      }
                      className="rounded-xl bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
                    >
                      {tr("Calculer les attributions", "Run allocations")}
                    </button>
                    <button
                      disabled={busy || cycle.status !== "ALLOCATED"}
                      onClick={() =>
                        void act(() => electivesAPI.publish(cycle.id))
                      }
                      className="rounded-xl bg-kcs-blue-950 px-4 py-2 text-white disabled:opacity-40"
                    >
                      {tr("Publier", "Publish")}
                    </button>
                    <button
                      onClick={() => {
                        setBusy(true);
                        electivesAPI
                          .report(cycle.id)
                          .then((r) => setReport(r.data.data))
                          .catch((e: any) =>
                            setMessage(
                              e?.response?.data?.message ||
                                tr(
                                  "Le rapport ne peut pas être chargé.",
                                  "The report could not be loaded.",
                                ),
                            ),
                          )
                          .finally(() => setBusy(false));
                      }}
                      className="rounded-xl border px-4 py-2"
                    >
                      <ClipboardList className="inline" size={16} />{" "}
                      {tr("Rapport final", "Final report")}
                    </button>
                  </div>
                )}
              </section>
              {(admin || teacher) && cycle.status === "DRAFT" && (
                <details className="elective-disclosure">
                  <summary>
                    <Plus size={18} />
                    {teacher
                      ? tr("Proposer un cours", "Propose a course")
                      : tr(
                          "Ajouter un cours au catalogue",
                          "Add a catalogue course",
                        )}
                  </summary>
                  <form
                    onSubmit={add}
                    className="grid gap-3 rounded-3xl bg-white p-5 shadow dark:bg-kcs-blue-900 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <h2 className="col-span-full text-xl font-black dark:text-white">
                      {teacher
                        ? tr("Proposer un cours", "Propose a course")
                        : tr(
                            "2. Construire le catalogue avec les enseignants",
                            "2. Build the catalog with teachers",
                          )}
                    </h2>
                    <input
                      required
                      className={field}
                      aria-label={tr("Code du cours", "Course code")}
                      placeholder={tr("Code du cours", "Course code")}
                      value={of.code}
                      onChange={(e) => setOf({ ...of, code: e.target.value })}
                    />
                    <input
                      required
                      className={field}
                      placeholder={tr("Nom du cours", "Course name")}
                      value={of.name}
                      onChange={(e) => setOf({ ...of, name: e.target.value })}
                    />
                    {admin && (
                      <select
                        className={field}
                        value={of.teacherUserId}
                        onChange={(e) =>
                          setOf({ ...of, teacherUserId: e.target.value })
                        }
                      >
                        <option value="">
                          {tr("Enseignant à attribuer", "Teacher to assign")}
                        </option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {tn(t)}
                          </option>
                        ))}
                      </select>
                    )}
                    <textarea
                      required
                      minLength={10}
                      className={
                        field + " min-h-24 sm:col-span-2 lg:col-span-3"
                      }
                      placeholder={tr(
                        "Description, objectifs et prérequis",
                        "Description, objectives and prerequisites",
                      )}
                      value={of.description}
                      onChange={(e) =>
                        setOf({ ...of, description: e.target.value })
                      }
                    />
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      {grades.map((g) => (
                        <label
                          key={g}
                          className="rounded-full border px-3 py-2 text-sm dark:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={of.eligibleGrades.includes(g)}
                            onChange={() =>
                              toggle(g, of.eligibleGrades, (v) =>
                                setOf({ ...of, eligibleGrades: v }),
                              )
                            }
                          />{" "}
                          {g}
                        </label>
                      ))}
                    </div>
                    <label className="elective-label">
                      {tr(
                        "Capacité maximale · 1 à 24 élèves",
                        "Maximum capacity · 1 to 24 learners",
                      )}
                      <input
                        aria-label={tr("Capacité maximale", "Maximum capacity")}
                        type="number"
                        min={1}
                        max={24}
                        className={field}
                        value={of.capacity}
                        onChange={(e) =>
                          setOf({ ...of, capacity: Number(e.target.value) })
                        }
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="rounded-xl bg-kcs-gold-500 p-3 font-black text-kcs-blue-950"
                    >
                      <Send className="inline" size={16} />{" "}
                      {teacher
                        ? tr("Soumettre", "Submit")
                        : tr("Ajouter", "Add")}
                    </button>
                  </form>
                </details>
              )}
              <section className="rounded-3xl bg-white p-5 shadow dark:bg-kcs-blue-900 dark:text-white">
                <div className="elective-catalog-title">
                  <div>
                    <h2 className="text-xl font-black">
                      {tr("Catalogue officiel", "Official catalogue")}
                    </h2>
                    <p className="elective-description">
                      {tr(
                        "Six préférences distinctes par élève · 24 places maximum par cours.",
                        "Six distinct preferences per learner · maximum 24 seats per course.",
                      )}
                    </p>
                  </div>
                  <span className="elective-count">
                    {cycle.offerings.length} {tr("cours", "courses")}
                  </span>
                </div>
                <div className="elective-search">
                  <label>
                    <span>{tr("Rechercher un cours", "Search courses")}</span>
                    <input
                      className={field}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={tr(
                        "Nom, code, enseignant ou objectif…",
                        "Name, code, teacher or objective…",
                      )}
                    />
                  </label>
                  <label>
                    <span>{tr("Classe concernée", "Eligible grade")}</span>
                    <select
                      className={field}
                      value={gradeFilter}
                      onChange={(event) => setGradeFilter(event.target.value)}
                    >
                      <option value="ALL">
                        {tr("Toutes les classes", "All grades")}
                      </option>
                      {cycle.eligibleGrades?.map((grade) => (
                        <option key={grade}>{grade}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!visibleOfferings.length && (
                  <div className="elective-empty">
                    <BookOpenCheck size={32} />
                    <h3>
                      {cycle.offerings.length
                        ? tr(
                            "Aucun cours ne correspond à cette recherche",
                            "No courses match this search",
                          )
                        : tr(
                            "Le catalogue est en préparation",
                            "The catalogue is being prepared",
                          )}
                    </h3>
                    <p>
                      {teacher
                        ? tr(
                            "Ouvrez « Proposer un cours ». Le Principal doit approuver les propositions avant la sélection des élèves.",
                            "Open “Propose a course”. The Principal approves proposals before learner selection.",
                          )
                        : admin
                          ? tr(
                              "Ajoutez ou approuvez au moins six cours pour chaque classe, attribuez leurs enseignants et vérifiez les capacités avant d’ouvrir les choix.",
                              "Add or approve at least six courses for each grade, assign teachers and check capacity before opening choices.",
                            )
                          : tr(
                              "Le Principal prépare les cours disponibles pour votre classe.",
                              "The Principal prepares the courses available for your grade.",
                            )}
                    </p>
                  </div>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleOfferings.map((o) => (
                    <article key={o.id} className="rounded-2xl border p-4">
                      <div className="flex justify-between gap-2">
                        <h3 className="font-black">
                          {o.code} · {o.name}
                        </h3>
                        <span className="text-xs">max {o.capacity}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                        {o.description}
                      </p>
                      <p className="mt-2 text-xs">
                        {o.eligibleGrades.join(" · ")} ·{" "}
                        {tn(o.teacher, tr("À attribuer", "Unassigned"))}
                        <span
                          className="elective-status"
                          data-status={o.status}
                        >
                          {statusLabel(o.status)}
                        </span>
                      </p>
                      {admin && (
                        <div className="mt-4 space-y-2 border-t pt-3">
                          <label className="block text-xs font-bold">
                            {tr("Enseignant responsable", "Assigned teacher")}
                            <select
                              className={field + " mt-1"}
                              value={o.teacher?.id || ""}
                              disabled={busy || cycle.status !== "DRAFT"}
                              onChange={(e) =>
                                void act(() =>
                                  electivesAPI.updateOffering(o.id, {
                                    teacherUserId: e.target.value || null,
                                  }),
                                )
                              }
                            >
                              <option value="">
                                {tr("À attribuer", "Unassigned")}
                              </option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {tn(t)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {o.status !== "APPROVED" && (
                              <button
                                disabled={busy || cycle.status !== "DRAFT"}
                                onClick={() =>
                                  void act(() =>
                                    electivesAPI.updateOffering(o.id, {
                                      status: "APPROVED",
                                    }),
                                  )
                                }
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                              >
                                {tr("Approuver", "Approve")}
                              </button>
                            )}
                            {o.status !== "REJECTED" && (
                              <button
                                disabled={busy || cycle.status !== "DRAFT"}
                                onClick={() =>
                                  void act(() =>
                                    electivesAPI.updateOffering(o.id, {
                                      status: "REJECTED",
                                    }),
                                  )
                                }
                                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"
                              >
                                {tr("Rejeter", "Reject")}
                              </button>
                            )}
                            <button
                              disabled={busy || cycle.status !== "DRAFT"}
                              onClick={() =>
                                confirm(
                                  tr(
                                    "Supprimer ce cours ?",
                                    "Delete this course?",
                                  ),
                                ) &&
                                void act(() =>
                                  electivesAPI.removeOffering(o.id),
                                )
                              }
                              className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
                            >
                              {tr("Supprimer", "Delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              {student && data.eligible && (
                <section className="rounded-3xl bg-white p-5 shadow dark:bg-kcs-blue-900 dark:text-white">
                  <h2 className="text-xl font-black">
                    {tr("Mes six choix classés", "My six ranked choices")}
                  </h2>
                  {cycle.status === "OPEN" &&
                  cycle.choiceWindowOpen !== false ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {choices.map((v, i) => (
                        <label key={i} className="text-sm font-bold">
                          {tr("Préférence", "Preference")} #{i + 1}
                          <select
                            className={field + " mt-1"}
                            value={v}
                            onChange={(e) =>
                              setChoices(
                                choices.map((x, n) =>
                                  n === i ? e.target.value : x,
                                ),
                              )
                            }
                          >
                            <option value="">{tr("Choisir", "Choose")}</option>
                            {approved
                              .filter(
                                (o) => !choices.includes(o.id) || o.id === v,
                              )
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.code} · {o.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                      <button
                        disabled={
                          busy || new Set(choices.filter(Boolean)).size !== 6
                        }
                        onClick={() =>
                          void act(() =>
                            electivesAPI.submitChoices(cycle.id, choices),
                          )
                        }
                        className="rounded-xl bg-kcs-blue-700 p-3 font-bold text-white disabled:opacity-40 md:col-span-2"
                      >
                        <CheckCircle2 className="inline" />{" "}
                        {tr("Enregistrer mes six choix", "Save my six choices")}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-slate-100 p-4 text-slate-700">
                      {tr(
                        "La période de choix n’est pas ouverte.",
                        "The selection window is not open.",
                      )}
                    </p>
                  )}
                  {data.allocations?.filter((a: any) => a.cycleId === cycle.id)
                    .length > 0 && (
                    <div className="mt-5">
                      <h3 className="font-black">
                        {tr("Liste finale publiée", "Published final list")}
                      </h3>
                      {data.allocations
                        .filter((a: any) => a.cycleId === cycle.id)
                        .map((a: any) => (
                          <p key={a.id} className="mt-2 rounded-xl border p-3">
                            {a.offering.code} · {a.offering.name} · préférence #
                            {a.preferenceRank}
                          </p>
                        ))}
                    </div>
                  )}
                </section>
              )}
              {teacher && cycle && (
                <section className="elective-roster">
                  <h2>{tr("Mes élèves attribués", "My allocated learners")}</h2>
                  <p>
                    {tr(
                      "Les listes apparaissent après publication par le Principal, pour les cours dont vous êtes responsable.",
                      "Lists appear after publication by the Principal for courses assigned to you.",
                    )}
                  </p>
                  <div className="elective-roster-grid">
                    {(data.teacherAssignments || [])
                      .filter((item: any) => item.cycleId === cycle.id)
                      .map((item: any) => (
                        <article key={item.id}>
                          <strong>{tn(item.student?.user, "")}</strong>
                          <span>
                            {item.student?.studentNumber} ·{" "}
                            {item.student?.grade} {item.student?.section || ""}
                          </span>
                          <b>{item.offering.name}</b>
                        </article>
                      ))}
                  </div>
                  {!(data.teacherAssignments || []).some(
                    (item: any) => item.cycleId === cycle.id,
                  ) && (
                    <div className="elective-empty">
                      {tr(
                        "Aucune liste publiée pour vos cours dans cette campagne.",
                        "No published learner list is available for your courses in this cycle.",
                      )}
                    </div>
                  )}
                </section>
              )}
              {report && admin && (
                <section className="rounded-3xl bg-white p-5 shadow dark:bg-kcs-blue-900 dark:text-white">
                  <h2 className="text-xl font-black">
                    {tr("Rapport final", "Final report")}
                  </h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    {Object.entries(report.summary).map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-xl bg-slate-100 p-4 text-center text-slate-900"
                      >
                        <b className="block text-2xl">{String(v)}</b>
                        {(
                          {
                            eligible: tr(
                              "Élèves éligibles",
                              "Eligible learners",
                            ),
                            participants: tr("Participants", "Participants"),
                            missing: tr("Choix manquants", "Missing choices"),
                            allocations: tr("Attributions", "Allocations"),
                            complete: tr("Complets", "Complete"),
                            incomplete: tr("À compléter", "Incomplete"),
                            fallbacks: tr("Compléments", "Fallbacks"),
                          } as Record<string, string>
                        )[k] || k}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead>
                        <tr>
                          <th>{tr("Cours", "Course")}</th>
                          <th>{tr("Enseignant", "Teacher")}</th>
                          <th>{tr("Demandes", "Requests")}</th>
                          <th>{tr("Attribués", "Allocated")}</th>
                          <th>{tr("Capacité", "Capacity")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.offerings.map((o: any) => (
                          <tr key={o.id} className="border-t">
                            <td className="p-2">
                              {o.code} · {o.name}
                            </td>
                            <td>
                              {tn(o.teacher, tr("À attribuer", "Unassigned"))}
                            </td>
                            <td>{o._count.choices}</td>
                            <td>{o._count.allocations}</td>
                            <td>{o.capacity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    <div>
                      <h3 className="font-black">
                        {tr("Attributions détaillées", "Detailed allocations")}
                      </h3>
                      <div className="mt-3 max-h-96 space-y-2 overflow-auto">
                        {report.allocations.map((a: any) => (
                          <article
                            key={a.id}
                            className="rounded-xl border p-3 text-sm"
                          >
                            <b>
                              {[
                                a.student.user.lastName,
                                a.student.user.middleName,
                                a.student.user.firstName,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </b>
                            <p>
                              {a.student.studentNumber} · {a.student.grade}{" "}
                              {a.student.section || ""}
                            </p>
                            <p className="text-kcs-blue-700 dark:text-kcs-blue-200">
                              {a.offering.code} · {a.offering.name} ·{" "}
                              {tr("préférence", "preference")} #
                              {a.preferenceRank}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-black">
                        {tr(
                          "Élèves sans choix soumis",
                          "Students without submitted choices",
                        )}
                      </h3>
                      <div className="mt-3 max-h-96 space-y-2 overflow-auto">
                        {report.missingStudents?.map((s: any) => (
                          <article
                            key={s.id}
                            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900"
                          >
                            <b>
                              {[
                                s.user.lastName,
                                s.user.middleName,
                                s.user.firstName,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </b>
                            <p>
                              {s.studentNumber} · {s.grade} {s.section || ""}
                            </p>
                          </article>
                        ))}
                        {!report.missingStudents?.length && (
                          <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                            {tr(
                              "Tous les élèves éligibles ont soumis leurs choix.",
                              "All eligible students submitted their choices.",
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
