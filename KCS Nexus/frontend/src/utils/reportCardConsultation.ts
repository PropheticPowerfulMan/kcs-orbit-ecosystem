type Card={term:string;subjects?:Array<{percentage?:number|null}>}
export const hasReportCardResults=(card:Card)=>Boolean(card.subjects?.some(subject=>typeof subject.percentage==='number'&&Number.isFinite(subject.percentage)))
export function consultationPeriod(cards:Card[],year:string,preferred:string){
 const normalized=(term:string)=>term.replace(/Trimester/gi,'Quarter')
 const periods=[...new Set(cards.filter(card=>card.term.startsWith(year+' · ')&&hasReportCardResults(card)).map(card=>normalized(card.term.slice((year+' · ').length))))]
 if(periods.includes(normalized(preferred)))return normalized(preferred)
 const rank=(term:string)=>{const q=/Quarter ([1-4])$/.exec(term);if(q)return Number(q[1]);const semester=/^Semester ([12])$/.exec(term);return semester?Number(semester[1])*2+.5:term==='Annual final'?5:0}
 return periods.filter(term=>rank(term)>0).sort((a,b)=>rank(b)-rank(a))[0]??null
}
