import { LessonTemplate } from "../types/lesson";

const objective = (text: string) => [{ id: crypto.randomUUID(), value: text }];

export const templates: LessonTemplate[] = [
  ["elementary", "Elementary", "General Studies", "Grade 3", "Foundational inquiry"],
  ["middle", "Middle School", "Integrated Studies", "Grade 7", "Concept development"],
  ["high", "High School", "Advanced Studies", "Grade 10", "College-preparatory learning"],
  ["mathematics", "Mathematics", "Mathematics", "Grade 8", "Numeracy and problem solving"],
  ["computer-science", "Computer Science", "Computer Science", "Grade 9", "Computational thinking"],
  ["science", "Science", "Science", "Grade 6", "Scientific inquiry"],
  ["physics", "Physics", "Physics", "Grade 11", "Forces, energy, and systems"],
  ["chemistry", "Chemistry", "Chemistry", "Grade 10", "Matter and reactions"],
  ["biology", "Biology", "Biology", "Grade 10", "Living systems"],
  ["english", "English", "English Language Arts", "Grade 8", "Reading, writing, and communication"],
  ["french", "French", "French", "Grade 7", "Language acquisition"],
  ["geography", "Geography", "Geography", "Grade 9", "Human and physical geography"],
  ["history", "History", "History", "Grade 9", "Historical thinking"],
  ["music", "Music", "Music", "Grade 5", "Performance and appreciation"],
  ["art", "Art", "Visual Art", "Grade 5", "Creative expression"],
  ["pe", "PE", "Physical Education", "Grade 6", "Movement and wellness"]
].map(([id, name, subject, gradeClass, learningArea]) => ({
  id,
  name,
  subject,
  gradeClass,
  learningArea,
  tags: [String(name).toLowerCase().replace(/\s+/g, "-")],
  prefill: {
    subject,
    gradeClass,
    learningArea,
    topic: `${subject} professional lesson`,
    learningObjectives: objective(`Develop mastery in ${String(learningArea).toLowerCase()} through guided, collaborative, and independent practice.`),
    learningOutcomes: objective(`Learners demonstrate understanding of key ${String(subject).toLowerCase()} concepts using accurate vocabulary and evidence.`),
    successCriteria: objective("I can explain the concept, practice it correctly, and reflect on my next step."),
    materialsResources: objective("Interactive board, student notebooks, differentiated task cards, assessment checklist"),
    crossCurricularConnections: subject === "Computer Science" ? "Mathematics, digital citizenship, design thinking" : "Literacy, critical thinking, collaboration",
    tags: [String(name).toLowerCase().replace(/\s+/g, "-")]
  }
}));
