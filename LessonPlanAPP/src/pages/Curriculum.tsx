import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Download, Edit3, FileJson, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";
import { createBlankLesson } from "../data/defaults";
import { curriculumRepository, filterCurriculum } from "../services/curriculumRepository";
import { CurriculumFilters, CurriculumInput, CurriculumItem } from "../types/curriculum";

const blankInput = (): CurriculumInput => ({
  academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  term: "1st Quarter",
  grade: "Grade 1",
  subject: "English",
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

const initialFilters: CurriculumFilters = {
  query: "",
  academicYear: "",
  term: "",
  grade: "",
  subject: ""
};

const defaultSubjects = ["Mathematics", "English", "English (Writing and Grammar)", "Science", "French", "Computer Science", "History", "Geography", "Physics", "Chemistry", "Biology", "Art", "Music", "Physical Education"];
const defaultGrades = ["K3", "K4", "K5", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];

export const Curriculum = () => {
  const { can } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState(() => curriculumRepository.list());
  const [filters, setFilters] = useState(initialFilters);
  const [editing, setEditing] = useState<CurriculumItem | CurriculumInput>(blankInput());
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = can("curriculum:manage");
  const filtered = useMemo(() => filterCurriculum(items, filters), [items, filters]);
  const academicYears = useMemo(() => unique(items.map((item) => item.academicYear)), [items]);
  const terms = useMemo(() => unique(items.map((item) => item.term)), [items]);
  const grades = useMemo(() => unique([...defaultGrades, ...items.map((item) => item.grade)]), [items]);
  const subjects = useMemo(() => unique([...defaultSubjects, ...items.map((item) => item.subject)]), [items]);

  const refresh = () => setItems(curriculumRepository.list());

  useEffect(() => {
    let cancelled = false;
    curriculumRepository.syncFromCloud()
      .then((synced) => {
        if (!cancelled) setItems(synced);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const patchFilter = (key: keyof CurriculumFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const patchEditing = <K extends keyof CurriculumInput>(key: K, value: CurriculumInput[K]) => setEditing((current) => ({ ...current, [key]: value }));

  const save = () => {
    if (!canManage) return;
    const item = curriculumRepository.save(editing);
    setEditing(item);
    setEditingId(item.id);
    refresh();
    notify("Curriculum item saved");
  };

  const startNew = () => {
    setEditing(blankInput());
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (!canManage || !confirm("Delete this curriculum item?")) return;
    curriculumRepository.remove(id);
    refresh();
    startNew();
    notify("Curriculum item deleted");
  };

  const download = () => {
    const blob = new Blob([curriculumRepository.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kcs-curriculum.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canManage) return;
    file.text().then((text) => {
      curriculumRepository.import(JSON.parse(text) as CurriculumItem[]);
      refresh();
      notify("Curriculum JSON imported");
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-cyan-200">Version 1.3</p>
          <h1 className="break-words text-2xl font-black text-white sm:text-3xl">Curriculum Manager</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">Academic Year - Term - Grade - Subject - Unit - Topic - Subtopic - Competencies - Objectives - Outcomes.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={download}><Download size={17} /> Export JSON</Button>
          {canManage && (
            <>
              <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-white/[0.06] px-4 text-sm font-bold text-foreground hover:bg-cyan-500/15 sm:w-auto">
                <Upload size={17} /> Import JSON
                <input type="file" accept="application/json" className="hidden" onChange={importJson} />
              </label>
              <Button className="w-full sm:w-auto" onClick={startNew}><Plus size={17} /> New Item</Button>
            </>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Search"><Input value={filters.query} onChange={(event) => patchFilter("query", event.target.value)} placeholder="unit, topic, standard..." /></Field>
          <Field label="Academic Year"><Select value={filters.academicYear} onChange={(event) => patchFilter("academicYear", event.target.value)}><option value="">Any year</option>{academicYears.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
          <Field label="Term"><Select value={filters.term} onChange={(event) => patchFilter("term", event.target.value)}><option value="">Any term</option>{terms.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
          <Field label="Grade"><Select value={filters.grade} onChange={(event) => patchFilter("grade", event.target.value)}><option value="">Any grade</option>{grades.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
          <Field label="Subject"><Select value={filters.subject} onChange={(event) => patchFilter("subject", event.target.value)}><option value="">Any subject</option>{subjects.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
        </div>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="grid gap-3">
          {filtered.map((item) => (
            <Card key={item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-cyan-200">{item.academicYear} - {item.term} - {item.grade}</p>
                <h2 className="break-words text-lg font-black text-white sm:text-xl">{item.subject}: {item.unit}</h2>
                <p className="break-words text-sm text-muted-foreground">{item.topic} - {item.subtopic}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.curriculumStandards.slice(0, 4).map((standard) => <Badge key={standard}>{standard}</Badge>)}
                  {item.skills.slice(0, 4).map((skill) => <Badge key={skill}>{skill}</Badge>)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-start lg:justify-end">
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => { setEditing(item); setEditingId(item.id); }}><Edit3 size={16} /> Open</Button>
                {canManage && <Button className="w-full sm:w-auto" variant="danger" onClick={() => remove(item.id)}><Trash2 size={16} /> Delete</Button>}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground"><FileJson className="mx-auto mb-2" /> No curriculum items match the filters.</Card>}
        </div>

        <Card className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-black text-white sm:text-xl">{editingId ? "Edit Curriculum Item" : "New Curriculum Item"}</h2>
              <p className="text-sm text-muted-foreground">{canManage ? "Manage the curriculum hierarchy used by lesson plans." : "Read-only curriculum view for lesson planning."}</p>
            </div>
            {editingId && <Button variant="ghost" onClick={startNew}><X size={16} /></Button>}
          </div>
          <fieldset disabled={!canManage} className="space-y-3 disabled:opacity-80">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Academic Year"><Input value={editing.academicYear} onChange={(event) => patchEditing("academicYear", event.target.value)} /></Field>
              <Field label="Term"><Input value={editing.term} onChange={(event) => patchEditing("term", event.target.value)} /></Field>
              <Field label="Grade"><Input list="curriculum-grade-options" value={editing.grade} onChange={(event) => patchEditing("grade", event.target.value)} /></Field>
              <Field label="Subject"><Input list="curriculum-subject-options" value={editing.subject} onChange={(event) => patchEditing("subject", event.target.value)} /></Field>
              <Field label="Unit"><Input value={editing.unit} onChange={(event) => patchEditing("unit", event.target.value)} /></Field>
              <Field label="Topic"><Input value={editing.topic} onChange={(event) => patchEditing("topic", event.target.value)} /></Field>
              <Field label="Subtopic"><Input value={editing.subtopic} onChange={(event) => patchEditing("subtopic", event.target.value)} /></Field>
            </div>
            <Field label="Competencies"><Textarea value={toText(editing.competencies)} onChange={(event) => patchEditing("competencies", fromText(event.target.value))} /></Field>
            <Field label="Learning Objectives"><Textarea value={toText(editing.learningObjectives)} onChange={(event) => patchEditing("learningObjectives", fromText(event.target.value))} /></Field>
            <Field label="Learning Outcomes"><Textarea value={toText(editing.learningOutcomes)} onChange={(event) => patchEditing("learningOutcomes", fromText(event.target.value))} /></Field>
            <Field label="References"><Textarea value={toText(editing.references)} onChange={(event) => patchEditing("references", fromText(event.target.value))} /></Field>
            <Field label="Skills"><Textarea value={toText(editing.skills)} onChange={(event) => patchEditing("skills", fromText(event.target.value))} /></Field>
            <Field label="Curriculum Standards"><Textarea value={toText(editing.curriculumStandards)} onChange={(event) => patchEditing("curriculumStandards", fromText(event.target.value))} /></Field>
            {canManage && <Button className="w-full" onClick={save}><Save size={17} /> Save Curriculum Item</Button>}
          </fieldset>
          <datalist id="curriculum-subject-options">{subjects.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="curriculum-grade-options">{grades.map((value) => <option key={value} value={value} />)}</datalist>
        </Card>
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

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="max-w-full break-words rounded-sm border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-100">{children}</span>
);

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
const toText = (items: string[]) => items.join("\n");
const fromText = (text: string) => text.split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean);
