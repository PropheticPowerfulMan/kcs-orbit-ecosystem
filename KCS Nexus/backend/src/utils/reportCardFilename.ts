export function reportCardFilename(input: {grade:string;term:string;studentName:string}) {
 const parts=input.term.split(' · '),year=/^\d{4}-\d{4}$/.test(parts[0])?parts.shift()!:'',period=parts.join(' ').replace(/Trimester/gi,'Quarter')
 const clean=(value:string)=>value.normalize('NFC').replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g,'-').replace(/\s+/g,' ').trim()
 return ['RC',clean(input.grade),clean(period),year,clean(input.studentName)].filter(Boolean).join(' - ').slice(0,200)+'.pdf'
}
