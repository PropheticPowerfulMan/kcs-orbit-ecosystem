import { forwardRef } from "react";
import { createFlexibleWeeklyPlan, schoolDisplayName, schoolImage } from "../data/defaults";
import { getActivityDurations } from "../services/durationValidationService";
import { getPrintDensity, isLikelyOversizedForOnePage } from "../services/printDensityService";
import { LessonPlan, WeeklyPlanDay } from "../types/lesson";

type RowKey = "lesson" | "objectives" | "introduction" | "presentationGuidedPractice" | "exitTicketAssessment" | "homework";

const planRows: [RowKey, string][] = [
  ["lesson", "Lesson"],
  ["objectives", "Objectives"],
  ["introduction", "Introduction"],
  ["presentationGuidedPractice", "Presentation / Guided Practice"],
  ["exitTicketAssessment", "Exit Ticket / Assessment"],
  ["homework", "Homework"]
];

export const LessonPrint = forwardRef<HTMLDivElement, { lesson: LessonPlan }>(({ lesson }, ref) => {
  const weeklyPlan = normalizeWeeklyPlan(lesson);
  const planLabel = lesson.planType === "daily" ? "Daily Lesson Plan" : "Weekly Lesson Plan";
  const generatedAt = formatGeneratedAt(new Date());
  const density = getPrintDensity({ ...lesson, weeklyPlan });
  const oversized = isLikelyOversizedForOnePage({ ...lesson, weeklyPlan });
  const extremelyOversized = isExtremelyOversized({ ...lesson, weeklyPlan });

  return (
    <div ref={ref} className="lesson-print-document bg-transparent text-black">
      <PrintPage lesson={lesson} pageTitle={planLabel} generatedAt={generatedAt} density={density} oversized={oversized} hasOverflowPage={extremelyOversized}>
        <LessonTable rows={planRows} weeklyPlan={weeklyPlan} isDaily={lesson.planType === "daily"} />
        <Signatures lesson={lesson} />
      </PrintPage>
      {extremelyOversized && <OverflowPage lesson={{ ...lesson, weeklyPlan }} generatedAt={generatedAt} density={density} />}
    </div>
  );
});

LessonPrint.displayName = "LessonPrint";

const PrintPage = ({
  lesson,
  pageTitle,
  generatedAt,
  density,
  oversized,
  hasOverflowPage,
  children
}: {
  lesson: LessonPlan;
  pageTitle: string;
  generatedAt: string;
  density: string;
  oversized: boolean;
  hasOverflowPage: boolean;
  children: React.ReactNode;
}) => (
  <section className={`print-page print-density-${density} mx-auto flex flex-col bg-white p-[5mm] font-serif text-black shadow-fluent`}>
    <Watermark status={lesson.status} />
    <header className="print-header relative z-10 rounded-sm border border-slate-300">
      <div className="grid grid-cols-[48px_1fr_86px] items-center gap-2 border-b-2 border-slate-800 bg-slate-50 px-2 py-1 text-slate-950">
        <span className="grid h-[44px] w-[44px] place-items-center rounded-sm border border-slate-300 bg-white p-1">
          <img src={schoolImage} alt="KCS logo" className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 text-center">
          <p className="break-words text-[8.2px] font-black uppercase leading-tight tracking-wide text-slate-800">{safeText(lesson.schoolName, schoolDisplayName)}</p>
          <h1 className="break-words text-[12.4px] font-black uppercase leading-tight tracking-wide text-slate-950">{safeText(lesson.topic, lesson.planType === "daily" ? "Daily Lesson Plan" : "Weekly Lesson Plan")}</h1>
          <p className="break-words text-[7.8px] font-black uppercase leading-tight tracking-wide text-slate-700">{pageTitle}</p>
        </div>
        <div className="flex h-[44px] flex-col justify-center rounded-sm border border-slate-300 bg-white px-1.5 py-1 text-right font-black text-slate-900">
          <div
            className={`flex w-full flex-col items-end ${
              lesson.planType === "daily" ? "-translate-y-[2px] gap-[2.5px] text-[6.4px] leading-[1.1]" : "gap-[2px] text-[6.6px] leading-[1.08]"
            }`}
          >
            <p>Page 1/{hasOverflowPage ? "2" : "1"}</p>
            <p>{lesson.planType === "daily" ? safeText(lesson.date, "Daily") : formatWeek(lesson.week)}</p>
            {lesson.planType === "weekly" && <p className="text-[6.5px] leading-[1.05]">{formatWeekRange(lesson)}</p>}
            <p>{safeText(lesson.schoolYear, "2026-2027")}</p>
          </div>
        </div>
      </div>
      <HeaderDetails lesson={lesson} />
    </header>
    <main className="relative z-10 mt-1.5 flex min-h-0 flex-1 flex-col">{children}</main>
    <footer className="relative z-10 mt-1 flex justify-between border-t border-slate-200 pt-1 text-[7.2px] font-semibold uppercase tracking-wide text-slate-500">
      <span>KCS Lesson Planner</span>
      <span>Generated on {generatedAt}</span>
      <span>{safeText(lesson.status, "draft")} | Modified {formatGeneratedAt(new Date(lesson.updatedAt || Date.now()))}</span>
    </footer>
  </section>
);

const OverflowPage = ({ lesson, generatedAt, density }: { lesson: LessonPlan; generatedAt: string; density: string }) => (
  <section className={`print-page print-density-${density} mx-auto mt-3 flex flex-col bg-white p-[6mm] font-serif text-black shadow-fluent`}>
    <header className="relative z-10 border-b-2 border-slate-800 pb-2 text-slate-950">
      <p className="text-[8px] font-black uppercase text-slate-700">{safeText(lesson.schoolName, schoolDisplayName)}</p>
      <h2 className="text-[13px] font-black uppercase leading-tight">{safeText(lesson.topic, "Lesson Plan")} - Continuation</h2>
      <p className="text-[7px] font-bold text-slate-600">Page 2/2 | Generated on {generatedAt}</p>
    </header>
    <main className="mt-3 grid flex-1 grid-cols-2 gap-2 overflow-hidden text-[7.1px] leading-tight text-slate-950">
      {lesson.weeklyPlan.flatMap((day) => [
        ["Lesson", day.lesson],
        ["Objectives", day.objectives],
        ["Introduction", day.introduction],
        ["Presentation", day.presentation],
        ["Guided Practice", day.guidedPractice],
        ["Exit Ticket", day.exitTicket],
        ["Assessment", day.assessment],
        ["Homework", day.homework]
      ].map(([label, value]) => (
        <div key={`${day.day}-${label}`} className="break-words rounded-sm border border-slate-300 bg-slate-50 p-1">
          <p className="font-black uppercase text-slate-700">{lesson.planType === "daily" ? label : `${day.day} - ${label}`}</p>
          <p className="whitespace-pre-line">{safeText(value, "-")}</p>
        </div>
      )))}
    </main>
  </section>
);

const LessonTable = ({ rows, weeklyPlan, isDaily }: { rows: [RowKey, string][]; weeklyPlan: WeeklyPlanDay[]; isDaily: boolean }) => (
  <div className="lesson-table-shell min-h-0 flex-1">
    <table className="lesson-table h-full min-h-0 w-full table-fixed border-collapse border border-slate-400 text-[7.9px] leading-[1.12]">
      <thead>
        <tr>
          <th className="w-[12%] border border-slate-400 bg-slate-100 px-1 py-1 text-center font-black uppercase leading-none text-slate-800">Section</th>
          {weeklyPlan.map((day) => (
            <th key={day.day} className="day-header border border-slate-400 bg-cyan-50 px-1 py-1 text-center font-black uppercase leading-none text-slate-950">
              {isDaily ? "Daily Lesson" : day.day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, label]) => (
          <tr key={key} className="align-top">
            <th className="row-label border border-slate-400 bg-slate-50 px-1 py-1 text-center font-black uppercase leading-tight text-slate-700">{label}</th>
            {weeklyPlan.map((day, index) => (
              <td key={`${day.day}-${key}`} className="border border-slate-400 p-1 align-top">
                <div className="whitespace-pre-line break-words">
                  <DurationBadge rowKey={key} day={day} index={index} />
                  {formatPlanCell(day, key)}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const HeaderDetails = ({ lesson }: { lesson: LessonPlan }) => (
  <table className="print-meta-table w-full table-fixed border-collapse text-[7.2px] leading-none text-slate-950">
    <tbody>
      <tr>
        <Detail label="Teacher" value={lesson.teachers} />
        <Detail label="Subject" value={lesson.subject} />
        <Detail label="Grade" value={lesson.gradeClass} />
        <Detail label="Duration" value={lesson.duration} />
      </tr>
      <tr>
        <Detail label="Unit" value={lesson.chapter} colSpan={2} />
        <Detail label={lesson.planType === "daily" ? "Plan" : "Week"} value={lesson.planType === "daily" ? "Daily" : formatWeek(lesson.week)} />
        <Detail label="ID / Status" value={`${safeText(lesson.lessonNumber, lesson.id)} / ${safeText(lesson.status, "draft")}`} />
      </tr>
    </tbody>
  </table>
);

const Detail = ({ label, value, colSpan = 1 }: { label: string; value?: string; colSpan?: number }) => (
  <td className="border border-slate-500 p-0 align-middle" colSpan={colSpan}>
    <div className="grid h-[4.8mm] grid-cols-[15mm_minmax(0,1fr)]">
      <span className="meta-cell meta-label border-r border-slate-500 bg-slate-200 font-black uppercase text-slate-950"><span>{label}</span></span>
      <span className="meta-cell meta-value break-words bg-white font-black text-slate-950"><span>{safeText(value, "-")}</span></span>
    </div>
  </td>
);

const Signatures = ({ lesson }: { lesson: LessonPlan }) => (
  <div className="signature-block relative mt-1.5 grid grid-cols-[1fr_1fr_21mm] items-end gap-5 text-[7.4px] font-bold uppercase tracking-wide text-slate-700">
    <div className="pt-4">
      <div className="border-t border-slate-500 pt-1">Teacher Signature / Date</div>
    </div>
    <div className="pt-4">
      <div className="border-t border-slate-500 pt-1">Principal Signature / Date</div>
    </div>
    <QrCodeBox lesson={lesson} />
  </div>
);

const QrCodeBox = ({ lesson }: { lesson: LessonPlan }) => {
  const payload = buildQrPayload(lesson);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(payload)}`;

  return (
    <div className="justify-self-end text-center">
      <img src={qrUrl} alt="Lesson plan QR code" className="h-[18mm] w-[18mm] bg-white" crossOrigin="anonymous" />
      <p className="mt-0.5 text-[5.2px] leading-none text-slate-600">Scan to open the digital Lesson Plan</p>
    </div>
  );
};

const formatPlanCell = (day: WeeklyPlanDay, rowKey: RowKey) => {
  if (rowKey === "presentationGuidedPractice") return safeText(`Presentation:\n${day.presentation}\n\nGuided Practice:\n${day.guidedPractice}`);
  if (rowKey === "exitTicketAssessment") return safeText(`Exit Ticket:\n${day.exitTicket}\n\nAssessment:\n${day.assessment}`);
  return safeText(day[rowKey]);
};

const isExtremelyOversized = (lesson: LessonPlan) => {
  const planText = lesson.weeklyPlan
    .flatMap((day) => [day.lesson, day.objectives, day.introduction, day.presentation, day.guidedPractice, day.exitTicket, day.assessment, day.homework])
    .join(" ");
  return planText.length > 7600;
};

const DurationBadge = ({ rowKey, day, index }: { rowKey: RowKey; day: WeeklyPlanDay; index: number }) => {
  if (!["introduction", "presentationGuidedPractice", "exitTicketAssessment"].includes(rowKey)) return null;
  const durations = getActivityDurations(day, index);
  const value =
    rowKey === "introduction"
      ? durations.introduction
      : rowKey === "presentationGuidedPractice"
        ? durations.presentation + durations.guidedPractice
        : durations.exitTicket;
  return (
    <span className="duration-badge mb-0.5 mr-1 inline-block rounded-full border border-slate-300 bg-slate-100 font-black text-slate-700">
      <span className="duration-badge-text">{value} min</span>
    </span>
  );
};

const Watermark = ({ status }: { status: LessonPlan["status"] }) => {
  const label = status === "approved" || status === "final-approved" ? "Approved" : status === "submitted" ? "Submitted" : status === "under-review" ? "Under Review" : status === "draft" ? "Draft" : "";
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <img src={schoolImage} alt="" className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.04]" />
      {label && (
        <div className="absolute left-1/2 top-1/2 mt-[43mm] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] text-[34px] font-black uppercase tracking-[0.22em] text-slate-900 opacity-[0.03]">
          {label}
        </div>
      )}
    </div>
  );
};

const buildQrPayload = (lesson: LessonPlan) => {
  const schedule = lesson.planType === "daily" ? safeText(lesson.date, "Daily") : formatWeekRange(lesson);
  return [
    `KCS Lesson Plan`,
    `No: ${safeText(lesson.lessonNumber, lesson.id)}`,
    `Type: ${lesson.planType === "daily" ? "Daily" : "Weekly"}`,
    `Teacher: ${safeText(lesson.teachers, "Teacher")}`,
    `Subject: ${safeText(lesson.subject, "Subject")}`,
    `Class: ${safeText(lesson.gradeClass, "Class")}`,
    `Schedule: ${schedule}`
  ].join("\n");
};

const normalizeWeeklyPlan = (lesson: LessonPlan) => {
  const weeklyPlan = lesson.weeklyPlan;
  const base = createFlexibleWeeklyPlan(lesson.subject, lesson.gradeClass, lesson.chapter);

  const normalized = base.map((day, index) => ({
    ...day,
    ...(weeklyPlan?.[index] || {}),
    day: weeklyPlan?.[index]?.day || day.day,
    lesson: weeklyPlan?.[index]?.lesson ?? day.lesson,
    objectives: weeklyPlan?.[index]?.objectives ?? day.objectives,
    introduction: weeklyPlan?.[index]?.introduction ?? day.introduction ?? "",
    presentation: weeklyPlan?.[index]?.presentation ?? day.presentation,
    guidedPractice: weeklyPlan?.[index]?.guidedPractice ?? day.guidedPractice,
    exitTicket: weeklyPlan?.[index]?.exitTicket ?? day.exitTicket,
    assessment: weeklyPlan?.[index]?.assessment ?? day.assessment,
    homework: weeklyPlan?.[index]?.homework ?? day.homework
  }));

  return lesson.planType === "daily"
    ? [{ ...normalized[0], day: "Monday" as const, lesson: normalized[0].lesson || lesson.chapter || lesson.topic || "Daily Lesson" }]
    : normalized;
};

const safeText = (value?: unknown, fallback = " ") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const formatWeek = (week?: string) => {
  const value = safeText(week, "");
  return value.toLowerCase().startsWith("week") ? value : `Week ${safeText(week, "1")}`;
};

const formatWeekRange = (lesson: LessonPlan) =>
  `${formatWeek(lesson.week)} from ${formatDateLabel(lesson.weekStartDate)} to ${formatDateLabel(lesson.weekEndDate)}`;

const formatDateLabel = (value?: string) => {
  if (!value) return "...";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "...";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
};

const formatGeneratedAt = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
