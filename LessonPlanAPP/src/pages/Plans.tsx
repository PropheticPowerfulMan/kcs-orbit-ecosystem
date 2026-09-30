import { Archive, CheckCircle2, Copy, Download, Edit3, FileJson, MessageSquareWarning, RefreshCcw, Send, ShieldCheck, Trash2, Upload, XCircle } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";
import { createBlankLesson } from "../data/defaults";
import { filterLessons, lessonRepository } from "../services/lessonRepository";
import { applyLessonVisibility, canDeleteLesson, canEditLesson, canFinalApproveLesson, canReviewLesson } from "../services/permissions";
import { LessonFilters, LessonPlan, LessonStatus } from "../types/lesson";

const lessonStatuses: LessonStatus[] = ["draft", "submitted", "under-review", "revision-requested", "approved", "final-approved", "rejected", "archived", "published"];
const defaultSubjectOptions = ["Mathematics", "English", "English (Writing and Grammar)", "Science", "French", "Computer Science", "History", "Geography", "Physics", "Chemistry", "Biology", "Art", "Music", "Physical Education"];
const defaultGradeOptions = ["K3", "K4", "K5", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];

const initialFilters: LessonFilters = {
  query: "",
  teacher: "",
  subject: "",
  grade: "",
  date: "",
  dateFrom: "",
  dateTo: "",
  topic: "",
  week: "",
  month: "",
  year: "",
  term: "",
  tags: "",
  status: "all"
};

export const Plans = () => {
  const { currentUser, can } = useAuth();
  const [lessons, setLessons] = useState(() => applyLessonVisibility(currentUser, lessonRepository.list()));
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<LessonFilters>({ ...initialFilters, query: searchParams.get("q") || "" });
  const navigate = useNavigate();
  const { notify } = useToast();
  const filtered = useMemo(() => filterLessons(lessons, filters), [lessons, filters]);
  const teacherOptions = useMemo(() => unique(lessons.map((lesson) => lesson.teachers).filter(Boolean)), [lessons]);
  const subjectOptions = useMemo(() => unique([...defaultSubjectOptions, ...lessons.map((lesson) => lesson.subject).filter(Boolean)]), [lessons]);
  const gradeOptions = useMemo(() => unique([...defaultGradeOptions, ...lessons.map((lesson) => lesson.gradeClass).filter(Boolean)]), [lessons]);
  const yearOptions = useMemo(() => unique(lessons.map((lesson) => lesson.date?.slice(0, 4)).filter(Boolean)), [lessons]);
  const selectableLessons = useMemo(() => filtered.filter((lesson) => canDeleteLesson(currentUser, lesson)), [currentUser, filtered]);
  const selectedLessons = useMemo(() => filtered.filter((lesson) => selectedIds.includes(lesson.id)), [filtered, selectedIds]);
  const allSelectableSelected = selectableLessons.length > 0 && selectableLessons.every((lesson) => selectedIds.includes(lesson.id));

  const patch = (key: keyof LessonFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const refresh = () => {
    const source = showDeleted ? lessonRepository.listAll() : lessonRepository.list();
    setLessons(applyLessonVisibility(currentUser, source));
  };

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filtered.some((lesson) => lesson.id === id)));
  }, [filtered]);

  useEffect(() => {
    refresh();
    if (!currentUser) return;
    let cancelled = false;
    lessonRepository.syncFromCloud()
      .then((synced) => {
        if (!cancelled) setLessons(applyLessonVisibility(currentUser, showDeleted ? synced : synced.filter((lesson) => !lesson.deletedAt)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentUser, showDeleted]);

  const duplicate = (lesson: LessonPlan) => {
    if (!currentUser) return;
    lessonRepository.duplicate(lesson, currentUser, createBlankLesson(`LP-${new Date().getFullYear()}-${lessons.length + 1}`).lessonNumber);
    refresh();
    notify("Lesson plan duplicated");
  };

  const setStatus = (lesson: LessonPlan, status: LessonStatus, description?: string) => {
    lessonRepository.changeStatus(lesson.id, status, currentUser, description);
    refresh();
    notify(`Status updated to ${statusLabel(status)}`);
  };

  const workflow = (lesson: LessonPlan, action: Parameters<typeof lessonRepository.workflowAction>[1], status: LessonStatus, message: string, needsComment = false) => {
    const comment = needsComment ? prompt(message) || "" : prompt(message) || "";
    if (needsComment && !comment.trim()) {
      notify("A reviewer comment is required");
      return;
    }
    lessonRepository.workflowAction(lesson.id, action, status, currentUser, comment);
    refresh();
    notify(`Workflow updated: ${statusLabel(status)}`);
  };

  const softDelete = (lesson: LessonPlan) => {
    if (!confirm("Move this lesson plan to deleted items?")) return;
    lessonRepository.softDelete(lesson.id, currentUser);
    refresh();
    notify("Lesson plan moved to deleted items");
  };

  const restore = (lesson: LessonPlan) => {
    lessonRepository.restore(lesson.id, currentUser);
    refresh();
    notify("Lesson plan restored");
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds((current) => current.filter((id) => !selectableLessons.some((lesson) => lesson.id === id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...selectableLessons.map((lesson) => lesson.id)])));
  };

  const deleteSelected = () => {
    const targets = selectedLessons.filter((lesson) => !lesson.deletedAt && canDeleteLesson(currentUser, lesson));
    if (!targets.length) return;
    if (!confirm(`Move ${targets.length} selected lesson plan${targets.length > 1 ? "s" : ""} to deleted items?`)) return;
    targets.forEach((lesson) => lessonRepository.softDelete(lesson.id, currentUser));
    setSelectedIds((current) => current.filter((id) => !targets.some((lesson) => lesson.id === id)));
    refresh();
    notify(`${targets.length} lesson plan${targets.length > 1 ? "s" : ""} moved to deleted items`);
  };

  const restoreSelected = () => {
    const targets = selectedLessons.filter((lesson) => lesson.deletedAt && canDeleteLesson(currentUser, lesson));
    if (!targets.length) return;
    targets.forEach((lesson) => lessonRepository.restore(lesson.id, currentUser));
    setSelectedIds((current) => current.filter((id) => !targets.some((lesson) => lesson.id === id)));
    refresh();
    notify(`${targets.length} lesson plan${targets.length > 1 ? "s" : ""} restored`);
  };

  const downloadBackup = () => {
    const blob = new Blob([lessonRepository.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kcs-lesson-planner-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      lessonRepository.import(JSON.parse(text) as LessonPlan[]);
      refresh();
      notify("JSON backup imported");
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">Lesson Plans</h1>
          <p className="text-sm text-muted-foreground">Search, filter, review, archive, restore, duplicate, and back up your local library.</p>
        </div>
        {can("backup:manage") && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadBackup}>
              <Download size={17} /> Export JSON
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-cyan-300/25 bg-white/[0.06] px-4 text-sm font-bold text-foreground hover:bg-cyan-500/15">
              <Upload size={17} /> Import JSON
              <input type="file" accept="application/json" className="hidden" onChange={importBackup} />
            </label>
          </div>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Field label="Keywords"><Input value={filters.query} onChange={(e) => patch("query", e.target.value)} placeholder="topic, objective..." /></Field>
          <Field label="Teacher"><Input list="teacher-filter-options" value={filters.teacher} onChange={(e) => patch("teacher", e.target.value)} placeholder="Optional teacher" /></Field>
          <Field label="Subject"><Input list="subject-filter-options" value={filters.subject} onChange={(e) => patch("subject", e.target.value)} placeholder="Optional subject" /></Field>
          <Field label="Grade"><Input list="grade-filter-options" value={filters.grade} onChange={(e) => patch("grade", e.target.value)} placeholder="Optional grade" /></Field>
          <Field label="Exact Date"><Input type="date" value={filters.date} onChange={(e) => patch("date", e.target.value)} /></Field>
          <Field label="From Date"><Input type="date" value={filters.dateFrom} onChange={(e) => patch("dateFrom", e.target.value)} /></Field>
          <Field label="To Date"><Input type="date" value={filters.dateTo} onChange={(e) => patch("dateTo", e.target.value)} /></Field>
          <Field label="Term"><Input value={filters.term} onChange={(e) => patch("term", e.target.value)} /></Field>
          <Field label="Week">
            <Select value={filters.week} onChange={(e) => patch("week", e.target.value)}>
              <option value="">Any week</option>
              {Array.from({ length: 40 }, (_, index) => String(index + 1)).map((week) => <option key={week} value={week}>Week {week}</option>)}
            </Select>
          </Field>
          <Field label="Month">
            <Select value={filters.month} onChange={(e) => patch("month", e.target.value)}>
              <option value="">Any month</option>
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => <option key={month} value={month}>{month.padStart(2, "0")}</option>)}
            </Select>
          </Field>
          <Field label="Year">
            <Select value={filters.year} onChange={(e) => patch("year", e.target.value)}>
              <option value="">Any year</option>
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </Select>
          </Field>
          <Field label="Topic"><Input value={filters.topic} onChange={(e) => patch("topic", e.target.value)} /></Field>
          <Field label="Tags"><Input value={filters.tags} onChange={(e) => patch("tags", e.target.value)} placeholder="comma tags" /></Field>
          <Field label="Status">
            <Select value={filters.status} onChange={(e) => patch("status", e.target.value)}>
              <option value="all">All</option>
              {lessonStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-bold text-muted-foreground">
            <input type="checkbox" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />
            Show deleted
          </label>
        </div>
        <datalist id="teacher-filter-options">
          {teacherOptions.map((teacher) => <option key={teacher} value={teacher} />)}
        </datalist>
        <datalist id="subject-filter-options">
          {subjectOptions.map((subject) => <option key={subject} value={subject} />)}
        </datalist>
        <datalist id="grade-filter-options">
          {gradeOptions.map((grade) => <option key={grade} value={grade} />)}
        </datalist>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <label className="flex items-center gap-2 text-sm font-bold text-foreground">
          <input type="checkbox" checked={allSelectableSelected} onChange={toggleSelectAll} disabled={!selectableLessons.length} />
          Select all visible deletable plans
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">{selectedLessons.length} selected</span>
          <Button variant="danger" onClick={deleteSelected} disabled={!selectedLessons.some((lesson) => !lesson.deletedAt && canDeleteLesson(currentUser, lesson))}>
            <Trash2 size={16} /> Delete Selected
          </Button>
          {showDeleted && (
            <Button variant="outline" onClick={restoreSelected} disabled={!selectedLessons.some((lesson) => lesson.deletedAt && canDeleteLesson(currentUser, lesson))}>
              <RefreshCcw size={16} /> Restore Selected
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.map((lesson) => (
          <Card key={lesson.id} className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                {canDeleteLesson(currentUser, lesson) && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-cyan-300"
                    checked={selectedIds.includes(lesson.id)}
                    onChange={(event) => toggleSelected(lesson.id, event.target.checked)}
                    aria-label={`Select ${lesson.topic || lesson.lessonNumber}`}
                  />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-white">{lesson.topic || "Untitled Lesson"}</p>
                  <p className="text-sm text-muted-foreground">{lesson.lessonNumber} - {lesson.subject || "Subject"} - {lesson.gradeClass || "Grade"} - {lesson.date}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={lesson.status} />
                {lesson.deletedAt && <span className="rounded-full border border-red-400/35 bg-red-500/15 px-2 py-1 text-xs font-bold text-red-100">Deleted</span>}
                {lesson.tags.map((tag) => <span key={tag} className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100">{tag}</span>)}
              </div>
              {lesson.status !== "draft" && (
                <p className="mt-2 text-xs font-semibold text-foreground">
                  Submitted by {getSubmitterName(lesson)}{lesson.ownerName && getSubmitterName(lesson) !== lesson.ownerName ? ` for ${lesson.ownerName}` : ""}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Last update: {new Date(lesson.updatedAt).toLocaleString()} - {lesson.activityLogs?.[0]?.description || "No activity yet"}</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
              {!lesson.deletedAt && <Button variant="outline" onClick={() => navigate(`/editor/${lesson.id}`)}><Edit3 size={16} /> {canEditLesson(currentUser, lesson) ? "Edit" : "Open"}</Button>}
              {!lesson.deletedAt && can("lesson:create") && <Button variant="outline" onClick={() => duplicate(lesson)}><Copy size={16} /> Duplicate</Button>}
              {!lesson.deletedAt && canEditLesson(currentUser, lesson) && ["draft", "revision-requested", "rejected"].includes(lesson.status) && <Button variant="outline" onClick={() => workflow(lesson, "submitted", "submitted", "Optional submission note for the reviewer:")}><Send size={16} /> Submit</Button>}
              {!lesson.deletedAt && canReviewLesson(currentUser, lesson) && lesson.status === "submitted" && <Button variant="outline" onClick={() => workflow(lesson, "review-started", "under-review", "Optional review start comment:")}><RefreshCcw size={16} /> Review</Button>}
              {!lesson.deletedAt && canReviewLesson(currentUser, lesson) && ["submitted", "under-review"].includes(lesson.status) && <Button variant="outline" onClick={() => workflow(lesson, "hod-approved", "approved", "Write the approval comment for the teacher:", true)}><CheckCircle2 size={16} /> HOD Approve</Button>}
              {!lesson.deletedAt && canReviewLesson(currentUser, lesson) && ["submitted", "under-review"].includes(lesson.status) && <Button variant="outline" onClick={() => workflow(lesson, "revision-requested", "revision-requested", "Explain corrections required for the teacher:", true)}><MessageSquareWarning size={16} /> Request Revision</Button>}
              {!lesson.deletedAt && canReviewLesson(currentUser, lesson) && ["submitted", "under-review"].includes(lesson.status) && <Button variant="danger" onClick={() => workflow(lesson, "rejected", "rejected", "Explain why this lesson plan is rejected:", true)}><XCircle size={16} /> Reject</Button>}
              {!lesson.deletedAt && canFinalApproveLesson(currentUser, lesson) && lesson.status === "approved" && <Button variant="outline" onClick={() => workflow(lesson, "final-approved", "final-approved", "Write the final approval comment for the teacher:", true)}><ShieldCheck size={16} /> Final Approve</Button>}
              {!lesson.deletedAt && can("lesson:update:any") && ["approved", "final-approved"].includes(lesson.status) && <Button variant="outline" onClick={() => setStatus(lesson, "published", "Lesson plan published")}><CheckCircle2 size={16} /> Publish</Button>}
              {!lesson.deletedAt && canEditLesson(currentUser, lesson) && <Button variant="outline" onClick={() => setStatus(lesson, lesson.status === "archived" ? "draft" : "archived", lesson.status === "archived" ? "Lesson plan unarchived" : "Lesson plan archived")}><Archive size={16} /> {lesson.status === "archived" ? "Unarchive" : "Archive"}</Button>}
              {lesson.deletedAt && canDeleteLesson(currentUser, lesson) && <Button variant="outline" onClick={() => restore(lesson)}><RefreshCcw size={16} /> Restore</Button>}
              {!lesson.deletedAt && canDeleteLesson(currentUser, lesson) && <Button variant="danger" onClick={() => softDelete(lesson)}><Trash2 size={16} /> Delete</Button>}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground"><FileJson className="mx-auto mb-2" /> No plans match the current filters.</Card>}
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    {children}
  </div>
);

const statusLabel = (status: LessonStatus) => ({
  draft: "Draft",
  submitted: "Submitted",
  "under-review": "Under Review",
  "revision-requested": "Revision Requested",
  approved: "Approved",
  "final-approved": "Final Approved",
  rejected: "Rejected",
  archived: "Archived",
  published: "Published"
})[status];

const StatusBadge = ({ status }: { status: LessonStatus }) => {
  const styles: Record<LessonStatus, string> = {
    draft: "border-slate-950/45 bg-slate-950 !text-white dark:border-slate-400/30 dark:bg-slate-500/15 dark:!text-slate-100",
    submitted: "border-sky-800/45 bg-sky-700 !text-white dark:border-sky-300/35 dark:bg-sky-500/15 dark:!text-sky-100",
    "under-review": "border-amber-800/45 bg-amber-600 !text-white dark:border-amber-300/35 dark:bg-amber-500/15 dark:!text-amber-100",
    "revision-requested": "border-orange-800/45 bg-orange-700 !text-white dark:border-orange-300/35 dark:bg-orange-500/15 dark:!text-orange-100",
    approved: "border-emerald-800/45 bg-emerald-700 !text-white dark:border-emerald-300/35 dark:bg-emerald-500/15 dark:!text-emerald-100",
    "final-approved": "border-lime-800/45 bg-lime-700 !text-white dark:border-lime-300/35 dark:bg-lime-500/15 dark:!text-lime-100",
    rejected: "border-red-800/45 bg-red-700 !text-white dark:border-red-300/35 dark:bg-red-500/15 dark:!text-red-100",
    archived: "border-zinc-800/45 bg-zinc-700 !text-white dark:border-zinc-300/35 dark:bg-zinc-500/15 dark:!text-zinc-100",
    published: "border-cyan-800/45 bg-cyan-700 !text-white dark:border-cyan-300/35 dark:bg-cyan-500/15 dark:!text-cyan-100"
  };

  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${styles[status]}`}>{statusLabel(status)}</span>;
};

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const getSubmitterName = (lesson: LessonPlan) =>
  lesson.workflowHistory?.find((event) => event.action === "submitted")?.userName ||
  lesson.activityLogs?.find((log) => log.action === "submitted")?.userName ||
  lesson.ownerName ||
  lesson.teachers ||
  "Unknown user";
