export interface CurriculumItem {
  id: string;
  academicYear: string;
  term: string;
  grade: string;
  subject: string;
  unit: string;
  topic: string;
  subtopic: string;
  competencies: string[];
  learningObjectives: string[];
  learningOutcomes: string[];
  references: string[];
  skills: string[];
  curriculumStandards: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumFilters {
  query: string;
  academicYear: string;
  term: string;
  grade: string;
  subject: string;
}

export type CurriculumInput = Omit<CurriculumItem, "id" | "createdAt" | "updatedAt">;
