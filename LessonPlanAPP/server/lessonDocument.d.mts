export const assessmentTypes:string[];
export const assessmentLabels:Record<string,[string,string]>;
export function migrateAssessmentDay<T extends Record<string,any>>(day:T):T & {assessment:string;assessmentTypes:string[];homework:string};
export function lessonDocumentContent(lesson:any):Record<string,any>;
export function canonicalLessonJSON(lesson:any):string;
export function documentSettings(value?:Record<string,any>,fallback?:Record<string,any>):{orientation:'landscape'|'portrait';fontSize:number;layout:'grid'|'details';language:'en'|'fr'};
