export interface SubjectStrategy {
  presentationMethods: string[];
  practiceMethods: string[];
  evidence: string;
}

const strategies: Record<string, SubjectStrategy> = {
  physics: {
    presentationMethods: ["demonstration", "graph interpretation", "motion diagram", "guided calculation"],
    practiceMethods: ["guided calculation", "practical demonstration", "graph interpretation"],
    evidence: "accurate diagrams, calculations, and scientific explanations"
  },
  mathematics: {
    presentationMethods: ["worked example", "problem modelling", "proof outline", "board practice"],
    practiceMethods: ["scaffolded problem set", "pair problem-solving", "error analysis"],
    evidence: "correct methods, notation, and reasoning"
  },
  biology: {
    presentationMethods: ["diagram analysis", "classification", "observation", "process mapping"],
    practiceMethods: ["labelled diagram", "concept sorting", "guided observation"],
    evidence: "accurate labels, classifications, and process explanations"
  },
  history: {
    presentationMethods: ["timeline analysis", "source interpretation", "comparison", "case study"],
    practiceMethods: ["source questioning", "timeline construction", "paired comparison"],
    evidence: "accurate chronology, evidence use, and interpretation"
  },
  english: {
    presentationMethods: ["text analysis", "vocabulary modelling", "reading discussion", "writing demonstration"],
    practiceMethods: ["peer correction", "guided paragraph writing", "think-pair-share"],
    evidence: "clear expression, accurate vocabulary, and text-supported answers"
  },
  "computer science": {
    presentationMethods: ["algorithm demonstration", "coding walkthrough", "debugging", "practical task"],
    practiceMethods: ["guided coding", "debugging challenge", "algorithm tracing"],
    evidence: "working logic, readable steps, and corrected errors"
  }
};

export const getSubjectStrategy = (subject = ""): SubjectStrategy => {
  const key = subject.trim().toLowerCase();
  const found = Object.entries(strategies).find(([name]) => key.includes(name));
  return found?.[1] || {
    presentationMethods: ["direct instruction", "worked example", "guided questioning", "real-life application"],
    practiceMethods: ["teacher-supported examples", "pair work", "worksheet", "board practice"],
    evidence: "accurate responses, clear explanations, and corrected classwork"
  };
};
