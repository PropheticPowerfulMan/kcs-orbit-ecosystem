import { useEffect, useState } from "react";
import { academicCalendarAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

type Access = {
  activeAcademicYear: string | null;
  activeEntryTerm?: string | null;
  closedPeriods: Array<{
    academicYear: string;
    term: string;
    closedAt?: string;
  }>;
  calendars?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    periods?: Array<{
      type: string;
      sequence: number;
      startDate: string;
      endDate: string;
    }>;
  }>;
};
let cached: Access | null = null;
let owner = "";
let expires = 0;
let pending: Promise<Access> | null = null;
export function isAcademicPeriodReadOnly(
  access: Access | null,
  year: string,
  term: string,
) {
  if (!access) return false;
  const normalized = term.replace(/Trimester/gi, "Quarter");
  const quarter = /Quarter (\d)/.exec(normalized);
  const semester = quarter
    ? Number(quarter[1]) <= 2
      ? "Semester 1"
      : "Semester 2"
    : normalized;
  return access.closedPeriods.some(
    (period) =>
      period.academicYear === year &&
      ["Annual final", normalized, semester].includes(
        period.term.replace(/Trimester/gi, "Quarter"),
      ),
  );
}
export function useAcademicPeriodAccess(
  year?: string,
  term?: string,
  date?: string,
) {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const [access, setAccess] = useState<Access | null>(() =>
    owner === userId ? cached : null,
  );
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (owner !== userId) {
        cached = null;
        expires = 0;
        pending = null;
        owner = userId;
      }
      try {
        if (Date.now() >= expires) {
          pending ??= academicCalendarAPI
            .periodAccess()
            .then((response) => response.data.data as Access);
          const request = pending;
          try {
            cached = await request;
            expires = Date.now() + 15_000;
          } finally {
            if (pending === request) pending = null;
          }
        }
        if (active) setAccess(cached);
      } catch {
        /* Server write guards remain authoritative during a connection failure. */
      } finally {
        if (active) setLoading(false);
      }
    };
    const refresh = () => {
      expires = 0;
      void load();
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("kcs-academic-period-closed", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("kcs-academic-period-closed", refresh);
    };
  }, [userId]);
  let selectedYear = year || "",
    selectedTerm = term || "";
  if (date) {
    const calendar = access?.calendars?.find(
      (item) =>
        date >= item.startDate.slice(0, 10) &&
        date <= item.endDate.slice(0, 10),
    );
    const quarter = calendar?.periods?.find(
      (period) =>
        period.type === "QUARTER" &&
        date >= period.startDate.slice(0, 10) &&
        date <= period.endDate.slice(0, 10),
    );
    const start =
      Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0);
    selectedYear = calendar?.name || start + "-" + (start + 1);
    selectedTerm = quarter
      ? "Semester " +
        (quarter.sequence <= 2 ? 1 : 2) +
        " · Quarter " +
        quarter.sequence
      : "Annual final";
  }
  return {
    access,
    loading,
    readOnly: isAcademicPeriodReadOnly(access, selectedYear, selectedTerm),
  };
}

export function isFutureGradebookPeriod(access: Access | null, year: string, term: string) {
  if (!access || access.activeAcademicYear !== year) return false;
  const active = /Quarter (\d)/.exec(access.activeEntryTerm || '');
  const selected = /Quarter (\d)/.exec(term.replace(/Trimester/gi, 'Quarter'));
  return Boolean(active && selected && Number(selected[1]) > Number(active[1]));
}
