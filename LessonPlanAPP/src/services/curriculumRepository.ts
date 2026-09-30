import { CurriculumFilters, CurriculumInput, CurriculumItem } from "../types/curriculum";
import { cloudAuthService } from "./cloudAuthService";
import { uid } from "../utils/id";

const key = "powerful-lesson-planner:curriculum";
const versionKey = "powerful-lesson-planner:curriculum-version";
const version = "2-final-empty";

const seedItems: CurriculumInput[] = [];

const now = () => new Date().toISOString();

const createItem = (input: CurriculumInput): CurriculumItem => {
  const timestamp = now();
  return { ...input, id: uid("curriculum"), createdAt: timestamp, updatedAt: timestamp };
};

const seed = () => {
  const items = seedItems.map(createItem);
  localStorage.setItem(key, JSON.stringify(items));
  localStorage.setItem(versionKey, version);
  return items;
};

const read = (): CurriculumItem[] => {
  try {
    if (localStorage.getItem(versionKey) !== version) return seed();
    const items = JSON.parse(localStorage.getItem(key) || "[]") as CurriculumItem[];
    return items.length ? items.map(normalizeItem) : seed();
  } catch {
    return seed();
  }
};

const write = (items: CurriculumItem[]) => localStorage.setItem(key, JSON.stringify(items.map(normalizeItem)));

const blankCurriculumInput = (): CurriculumInput => ({
  academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  term: "",
  grade: "",
  subject: "",
  unit: "",
  topic: "",
  subtopic: "",
  competencies: [],
  learningObjectives: [],
  learningOutcomes: [],
  references: [],
  skills: [],
  curriculumStandards: []
});

const normalizeItem = (item: Partial<CurriculumItem>): CurriculumItem => {
  const fallback = createItem(blankCurriculumInput());
  return {
    ...fallback,
    ...item,
    id: item.id || uid("curriculum"),
    competencies: toList(item.competencies),
    learningObjectives: toList(item.learningObjectives),
    learningOutcomes: toList(item.learningOutcomes),
    references: toList(item.references),
    skills: toList(item.skills),
    curriculumStandards: toList(item.curriculumStandards),
    createdAt: item.createdAt || now(),
    updatedAt: item.updatedAt || now()
  };
};

const toList = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const cloudHeaders = (extra: Record<string, string> = {}) => ({
  ...cloudAuthService.baseHeaders(cloudAuthService.getAccessToken()),
  ...extra
});

const toCloudRow = (item: CurriculumItem) => ({
  id: item.id,
  payload: item,
  academic_year: item.academicYear,
  term: item.term,
  grade: item.grade,
  subject: item.subject,
  created_at: item.createdAt,
  updated_at: item.updatedAt
});

const fromCloudRow = (row: Record<string, unknown>) => {
  const payload = row.payload && typeof row.payload === "object" ? row.payload as Partial<CurriculumItem> : {};
  return normalizeItem({
    ...payload,
    id: String(row.id || payload.id || ""),
    academicYear: String(row.academic_year || payload.academicYear || ""),
    term: String(row.term || payload.term || ""),
    grade: String(row.grade || payload.grade || ""),
    subject: String(row.subject || payload.subject || ""),
    createdAt: String(row.created_at || payload.createdAt || now()),
    updatedAt: String(row.updated_at || payload.updatedAt || now())
  });
};

const cloudRequest = async <T>(path: string, options: RequestInit = {}) => {
  const response = await fetch(cloudAuthService.restUrl(path), {
    ...options,
    headers: {
      ...cloudHeaders(),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.msg || data?.error_description || "Curriculum cloud request failed";
    throw new Error(message);
  }
  return data as T;
};

const mergeItems = (localItems: CurriculumItem[], cloudItems: CurriculumItem[]) => {
  const byId = new Map<string, CurriculumItem>();
  [...localItems, ...cloudItems].forEach((item) => {
    const current = byId.get(item.id);
    if (!current || new Date(item.updatedAt || 0).getTime() >= new Date(current.updatedAt || 0).getTime()) {
      byId.set(item.id, item);
    }
  });
  return [...byId.values()].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
};

const syncItemToCloud = (item: CurriculumItem) => {
  if (!cloudAuthService.enabled) return;
  cloudRequest("curriculum_items?on_conflict=id", {
    method: "POST",
    headers: cloudHeaders({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify(toCloudRow(item))
  }).catch((error) => console.warn("Curriculum cloud sync failed", error));
};

const syncItemsToCloud = (items: CurriculumItem[]) => items.forEach(syncItemToCloud);

export const curriculumRepository = {
  list: read,
  async syncFromCloud() {
    if (!cloudAuthService.enabled) return read();
    const rows = await cloudRequest<Record<string, unknown>[]>("curriculum_items?select=*&order=updated_at.desc");
    const cloudItems = rows.map(fromCloudRow);
    const merged = mergeItems(read(), cloudItems);
    write(merged);
    syncItemsToCloud(merged);
    return merged;
  },
  get(id: string) {
    return read().find((item) => item.id === id);
  },
  save(input: CurriculumItem | CurriculumInput) {
    const items = read();
    const timestamp = now();
    const item = "id" in input
      ? normalizeItem({ ...input, updatedAt: timestamp })
      : createItem(input);
    const next = items.some((current) => current.id === item.id)
      ? items.map((current) => (current.id === item.id ? item : current))
      : [item, ...items];
    write(next);
    syncItemToCloud(item);
    return item;
  },
  remove(id: string) {
    write(read().filter((item) => item.id !== id));
    if (cloudAuthService.enabled) {
      cloudRequest(`curriculum_items?id=eq.${id}`, { method: "DELETE" }).catch((error) => console.warn("Curriculum cloud delete failed", error));
    }
  },
  import(items: CurriculumItem[]) {
    const normalized = items.map(normalizeItem);
    write(normalized);
    syncItemsToCloud(normalized);
  },
  exportJson() {
    return JSON.stringify(read(), null, 2);
  }
};

export const filterCurriculum = (items: CurriculumItem[], filters: CurriculumFilters) => {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    const haystack = [
      item.academicYear,
      item.term,
      item.grade,
      item.subject,
      item.unit,
      item.topic,
      item.subtopic,
      item.competencies.join(" "),
      item.learningObjectives.join(" "),
      item.learningOutcomes.join(" "),
      item.references.join(" "),
      item.skills.join(" "),
      item.curriculumStandards.join(" ")
    ].join(" ").toLowerCase();

    return (
      (!query || haystack.includes(query)) &&
      (!filters.academicYear || item.academicYear === filters.academicYear) &&
      (!filters.term || item.term === filters.term) &&
      (!filters.grade || item.grade === filters.grade) &&
      (!filters.subject || item.subject === filters.subject)
    );
  });
};

export const findCurriculumSuggestions = (items: CurriculumItem[], grade = "", subject = "") =>
  items.filter((item) =>
    (!grade || item.grade.toLowerCase() === grade.toLowerCase()) &&
    (!subject || item.subject.toLowerCase() === subject.toLowerCase())
  );
