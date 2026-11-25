import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal.clone({ precision: 40 });
export class ScoringError extends Error {
    constructor(public code: string, message: string) { super(message); }
}
export type Criterion = {
    id: string;
    name?: string;
    maximum: string | number;
    weight: string | number;
    parentId?: string | null;
    mandatory: boolean;
    applicability: string;
    commentRule?: string;
    commentThreshold?: string | number;
    minimumJudges?: number;
};
export type Mark = {
    criterionId: string;
    kind: 'SCORED' | 'UNSCORED' | 'NOT_APPLICABLE';
    points?: string | number | null;
    comment?: string;
};
export type EvaluationResult = {
    complete: boolean;
    total: string | null;
    partialTotal: string | null;
    percentage: string | null;
    missing: string[];
    criterionPercentages: Record<string, string>;
    effectiveWeights: Record<string, string>;
};
export type ConsolidationMethod = 'MEAN' | 'WEIGHTED_MEAN' | 'MEDIAN' | 'TRIMMED_MEAN' | 'PRESIDENT';
export type ScoringRules = {
    method: ConsolidationMethod;
    minimumJudges: number;
    trimCount: number;
    roundDigits: number;
    rounding: 'HALF_UP' | 'HALF_EVEN' | 'FLOOR' | 'CEIL';
    discrepancyThreshold: number;
    aggregation: 'WHOLE_RUBRIC' | 'CRITERION_PANEL';
};
export const defaultScoringRules: ScoringRules = { method: 'MEAN', minimumJudges: 2, trimCount: 1, roundDigits: 2, rounding: 'HALF_UP', discrepancyThreshold: 20, aggregation: 'WHOLE_RUBRIC' };
function dec(value: unknown, code = 'INVALID_NUMBER') { if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '')
    throw new ScoringError(code, 'A finite numeric value is required.'); try {
    const n = new Decimal(String(value));
    if (!n.isFinite())
        throw Error();
    return n;
}
catch {
    throw new ScoringError(code, 'A finite numeric value is required.');
} }
function positive(value: unknown) { const n = dec(value); if (!n.gt(0))
    throw new ScoringError('POSITIVE_VALUE_REQUIRED', 'Maximum points and weights must be positive.'); return n; }
function out(n: Prisma.Decimal) { return n.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toString(); }
function rounded(n: Prisma.Decimal, rules: ScoringRules) { const modes = { HALF_UP: Decimal.ROUND_HALF_UP, HALF_EVEN: Decimal.ROUND_HALF_EVEN, FLOOR: Decimal.ROUND_FLOOR, CEIL: Decimal.ROUND_CEIL }; if (!Number.isInteger(rules.roundDigits) || rules.roundDigits < 0 || rules.roundDigits > 4 || !(rules.rounding in modes))
    throw new ScoringError('ROUNDING_POLICY_INVALID', 'Choose zero to four decimals and a supported rounding rule.'); return n.toDecimalPlaces(rules.roundDigits, modes[rules.rounding]); }
export function normalizeScore(earned: string | number, maximum: string | number, target: string | number) { const n = dec(earned), m = positive(maximum), t = positive(target); if (n.lt(0) || n.gt(m))
    throw new ScoringError('SCORE_OUT_OF_RANGE', 'The score must be between zero and its maximum.'); return out(n.div(m).mul(t)); }
export function validateRubric(criteria: Criterion[]) {
    if (!criteria.length)
        throw new ScoringError('RUBRIC_EMPTY', 'Add at least one assessment criterion.');
    const map = new Map(criteria.map(c => [c.id, c]));
    if (map.size !== criteria.length)
        throw new ScoringError('DUPLICATE_CRITERION', 'Criterion identifiers must be unique.');
    for (const c of criteria) {
        positive(c.maximum);
        positive(c.weight);
        if (!['GROUP', 'INDIVIDUAL', 'BOTH'].includes(c.applicability))
            throw new ScoringError('CRITERION_SCOPE_INVALID', 'Choose a supported criterion scope.');
        let p = c.parentId;
        const seen = new Set([c.id]);
        while (p) {
            if (seen.has(p) || !map.has(p))
                throw new ScoringError('CRITERION_TREE_INVALID', 'Criterion sections cannot contain cycles or foreign parents.');
            seen.add(p);
            p = map.get(p)!.parentId;
        }
    }
}
export function evaluate(criteria: Criterion[], marks: Mark[], targetMaximum: string | number, scope: 'GROUP' | 'INDIVIDUAL', assignedIds?: string[]): EvaluationResult {
    validateRubric(criteria);
    const target = positive(targetMaximum), children = new Map<string | null, Criterion[]>();
    for (const c of criteria) {
        const key = c.parentId || null;
        children.set(key, [...(children.get(key) || []), c]);
    }
    const byId = new Map(criteria.map(c => [c.id, c])), submitted = new Map<string, Mark>();
    for (const mark of marks) {
        if (submitted.has(mark.criterionId) || !byId.has(mark.criterionId))
            throw new ScoringError('FOREIGN_OR_DUPLICATE_SCORE', 'A criterion is duplicated or outside this rubric version.');
        submitted.set(mark.criterionId, mark);
    }
    const assigned = assignedIds?.length ? new Set(assignedIds) : null;
    const leaves = criteria.filter(c => !children.has(c.id) && (c.applicability === 'BOTH' || c.applicability === scope) && (!assigned || assigned.has(c.id)));
    if (assigned && [...assigned].some(id => !byId.has(id)))
        throw new ScoringError('ASSIGNMENT_CRITERIA_INVALID', 'An assigned criterion does not belong to this rubric.');
    const eligible = new Set(leaves.map(c => c.id));
    for (const id of submitted.keys())
        if (!eligible.has(id))
            throw new ScoringError('CRITERION_NOT_ASSIGNED', 'This judge cannot score this criterion.');
    const missing: string[] = [], percentages: Record<string, string> = {}, rawPercentages = new Map<string, Prisma.Decimal>(), active = new Set<string>();
    for (const c of leaves) {
        const m = submitted.get(c.id);
        if (!m || m.kind === 'UNSCORED') {
            missing.push(c.id);
            continue;
        }
        if (m.kind === 'NOT_APPLICABLE') {
            if (c.mandatory)
                throw new ScoringError('MANDATORY_CRITERION_NOT_APPLICABLE', 'A required criterion cannot be marked not applicable.');
            continue;
        }
        if (m.kind !== 'SCORED')
            throw new ScoringError('SCORE_KIND_INVALID', 'Choose a valid score state.');
        const points = dec(m.points), maximum = positive(c.maximum);
        if (points.lt(0) || points.gt(maximum))
            throw new ScoringError('SCORE_OUT_OF_RANGE', 'A criterion score exceeds its allowed range.');
        const pct = points.div(maximum).mul(100), required = c.commentRule === 'ALWAYS' || c.commentRule === 'BELOW_THRESHOLD' && pct.lt(dec(c.commentThreshold ?? 50));
        if (required && (m.comment || '').trim().length < 3)
            missing.push(c.id + ':comment');
        percentages[c.id] = out(pct);
        rawPercentages.set(c.id, pct);
        active.add(c.id);
    }
    const hasActive = (c: Criterion): boolean => children.has(c.id) ? children.get(c.id)!.some(hasActive) : active.has(c.id);
    const weights: Record<string, string> = {}, rawWeights = new Map<string, Prisma.Decimal>();
    function walk(key: string | null, parentWeight: Prisma.Decimal) { const items = (children.get(key) || []).filter(hasActive), sum = items.reduce((n, c) => n.add(positive(c.weight)), new Decimal(0)); for (const c of items) {
        const weight = parentWeight.mul(positive(c.weight)).div(sum);
        if (children.has(c.id))
            walk(c.id, weight);
        else {
            weights[c.id] = out(weight);
            rawWeights.set(c.id, weight);
        }
    } }
    walk(null, new Decimal(1));
    const partial = active.size ? [...rawWeights].reduce((n, [id, w]) => n.add(rawPercentages.get(id)!.div(100).mul(w).mul(target)), new Decimal(0)) : null;
    const complete = missing.length === 0 && active.size > 0;
    return { complete, total: complete && partial ? out(partial) : null, partialTotal: partial ? out(partial) : null, percentage: complete && partial ? out(partial.div(target).mul(100)) : null, missing, criterionPercentages: percentages, effectiveWeights: weights };
}
export type JudgeScore = {
    memberId: string;
    score: string | number | null;
    weight: string | number;
    president?: boolean;
};
export function consolidate(input: JudgeScore[], targetMaximum: string | number, rules: ScoringRules) {
    const maximum = positive(targetMaximum), rows = input.filter(x => x.score !== null);
    if (new Set(input.map(x => x.memberId)).size !== input.length)
        throw new ScoringError('DUPLICATE_JUDGE', 'A judge may contribute only once to a candidate.');
    if (!Number.isInteger(rules.minimumJudges) || rules.minimumJudges < 1 || rows.length < rules.minimumJudges)
        throw new ScoringError('INSUFFICIENT_JUDGES', 'The required number of submitted evaluations has not been reached.');
    const values = rows.map(row => { const value = dec(row.score); positive(row.weight); if (value.lt(0) || value.gt(maximum))
        throw new ScoringError('SCORE_OUT_OF_RANGE', 'A consolidated score exceeds its allowed range.'); return { ...row, value }; }), sorted = [...values].sort((a, b) => a.value.comparedTo(b.value) || a.memberId.localeCompare(b.memberId));
    let result: Prisma.Decimal;
    const mean = (items: typeof values) => items.reduce((n, x) => n.add(x.value), new Decimal(0)).div(items.length);
    if (rules.method === 'MEAN')
        result = mean(values);
    else if (rules.method === 'WEIGHTED_MEAN') {
        const total = values.reduce((n, x) => n.add(positive(x.weight)), new Decimal(0));
        result = values.reduce((n, x) => n.add(x.value.mul(positive(x.weight))), new Decimal(0)).div(total);
    }
    else if (rules.method === 'MEDIAN') {
        const n = sorted.length;
        result = n % 2 ? sorted[Math.floor(n / 2)].value : sorted[n / 2 - 1].value.add(sorted[n / 2].value).div(2);
    }
    else if (rules.method === 'TRIMMED_MEAN') {
        if (sorted.length < 5 || !Number.isInteger(rules.trimCount) || rules.trimCount < 1 || 2 * rules.trimCount >= sorted.length)
            throw new ScoringError('TRIMMED_MEAN_NOT_ELIGIBLE', 'A trimmed mean requires at least five submitted judges and a valid trim count.');
        result = mean(sorted.slice(rules.trimCount, -rules.trimCount));
    }
    else if (rules.method === 'PRESIDENT') {
        const presidents = values.filter(v => v.president);
        if (presidents.length !== 1)
            throw new ScoringError('PRESIDENT_SCORE_REQUIRED', 'Exactly one submitted president score is required.');
        result = presidents[0].value;
    }
    else
        throw new ScoringError('SCORING_METHOD_INVALID', 'Choose a supported consolidation method.');
    const average = mean(values), range = sorted.at(-1)!.value.sub(sorted[0].value), deviation = values.reduce((n, x) => n.add(x.value.sub(average).pow(2)), new Decimal(0)).div(values.length).sqrt(), roundedValue = rounded(result, rules);
    return { score: roundedValue.toString(), unrounded: out(result), maximum: out(maximum), percentage: out(roundedValue.div(maximum).mul(100)), judgeCount: values.length, statistics: { mean: out(average), minimum: out(sorted[0].value), maximum: out(sorted.at(-1)!.value), standardDeviation: out(deviation), range: out(range) }, flags: range.div(maximum).mul(100).gt(rules.discrepancyThreshold) ? ['LARGE_JUDGE_DISCREPANCY'] : [] };
}
export function hybridScore(group: string | number | null, individual: string | number | null, groupWeight: string | number, individualWeight: string | number) { const g = dec(groupWeight), i = dec(individualWeight); if (g.lt(0) || i.lt(0) || !g.add(i).eq(100))
    throw new ScoringError('HYBRID_WEIGHTS_INVALID', 'Group and individual percentages must total 100%.'); if (g.gt(0) && group === null || i.gt(0) && individual === null)
    return null; return out((g.gt(0) ? dec(group).mul(g) : new Decimal(0)).add(i.gt(0) ? dec(individual).mul(i) : new Decimal(0)).div(100)); }
export function rankScores<T extends {
    score: string | null;
}>(rows: T[], ties: 'DENSE' | 'COMPETITION' = 'COMPETITION') {
    const sorted = rows.map((row, index) => ({ ...row, index })).filter(row => row.score !== null).sort((a, b) => dec(b.score).comparedTo(dec(a.score)) || a.index - b.index);
    let previous: string | null = null, rank = 0;
    const ranks = new Map<number, number>();
    sorted.forEach((row, index) => { if (previous === null || !dec(row.score).eq(dec(previous)))
        rank = ties === 'DENSE' ? rank + 1 : index + 1; previous = row.score; ranks.set(row.index, rank); });
    return rows.map((row, index) => ({ ...row, rank: ranks.get(index) ?? null }));
}
