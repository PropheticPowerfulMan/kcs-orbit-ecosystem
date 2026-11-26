// The 2026 test-data reset is retired. Startup must never erase a teacher's local work.
const resetVersionKey='powerful-lesson-planner:final-reset-version';
const finalResetVersion='2026-07-14-final-production-data-reset';
export const applyFinalProductionReset=()=>{if(typeof window==='undefined')return;if(!localStorage.getItem(resetVersionKey))localStorage.setItem(resetVersionKey,finalResetVersion)};
