const bands=[
 {key:'excellent',minimum:90,color:'#23866b',letter:'A',label:['Excellent','Excellent']},
 {key:'strong',minimum:80,color:'#228b94',letter:'B',label:['Très bon','Strong']},
 {key:'passing',minimum:70,color:'#66912f',letter:'C',label:['Seuil de réussite atteint','Passing benchmark reached']},
 {key:'follow',minimum:60,color:'#b37a19',letter:'D',label:['À renforcer','Follow-up needed']},
 {key:'support',minimum:0,color:'#bd5967',letter:'F',label:['Accompagnement requis','Support needed']},
]as const
/** Presentation only: missing/invalid values never become a failing zero. */
export const academicPerformance=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?bands.find(b=>value>=b.minimum)!:null
