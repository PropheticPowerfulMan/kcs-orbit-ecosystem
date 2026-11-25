export function canonicalGradebookTerm(term: string): string { return term.replace(/\bTrimester\b/gi, 'Quarter'); }
