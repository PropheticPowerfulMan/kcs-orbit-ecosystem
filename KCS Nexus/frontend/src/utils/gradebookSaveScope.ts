import type {GradebookSnapshot} from './gradebookRecovery';
/** Save the open quarter without rewriting historical/future snapshots during recovery. */
export function preserveReadOnlyGradebook(server: Partial<GradebookSnapshot> | undefined, draft: GradebookSnapshot, locked: (term: string) => boolean): GradebookSnapshot {
 const old=server||{},isLocked=(task:{term?:string})=>locked(task.term||'Semester 1 · Quarter 1');
 const closedIds=new Set([...(old.assignments||[]),...draft.assignments].filter(isLocked).map(t=>t.id));
 const isClosedCell=(key:string)=>[...closedIds].some(id=>key.startsWith(id+':'));
 const cells=(oldCells:Record<string,string>={},next:Record<string,string>={})=>({...Object.fromEntries(Object.entries(next).filter(([k])=>!isClosedCell(k))),...Object.fromEntries(Object.entries(oldCells).filter(([k])=>isClosedCell(k)))});
 return {...draft,assignments:[...(old.assignments||[]).filter(isLocked),...draft.assignments.filter(t=>!isLocked(t))],scores:cells(old.scores,draft.scores),comments:cells(old.comments,draft.comments),archivedAssignments:[...(old.archivedAssignments||[]).filter(a=>isLocked(a.assignment)),...(draft.archivedAssignments||[]).filter(a=>!isLocked(a.assignment))]};
}
