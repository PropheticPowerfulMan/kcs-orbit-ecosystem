export function principalAttendanceStats(input:Array<{label?:unknown;attendance?:unknown;evidence?:unknown}>){
 const rows=input.flatMap(row=>{if(row.evidence!==undefined&&(!Number.isFinite(Number(row.evidence))||Number(row.evidence)<=0))return[];const value=row.attendance;if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return[];const rate=Number(value);return Number.isFinite(rate)&&rate>=0&&rate<=100&&String(row.label||'').trim()?[{label:String(row.label),rate}]:[]})
 const sorted=rows.map(row=>row.rate).sort((a,b)=>a-b),n=sorted.length,mean=n?sorted.reduce((a,b)=>a+b,0)/n:null
 const median=n?(sorted[Math.floor((n-1)/2)]+sorted[Math.ceil((n-1)/2)])/2:null
 const deviation=mean===null?null:Math.sqrt(sorted.reduce((sum,value)=>sum+(value-mean)**2,0)/n)
 const bounds=[0,60,70,80,90,101],bins=bounds.slice(0,-1).map((low,index)=>({label:index===0?'<60%':index===4?'90–100%':low+'–<'+bounds[index+1]+'%',count:sorted.filter(rate=>rate>=low&&rate<bounds[index+1]).length}))
 return{rows,n,excluded:input.length-n,mean,median,deviation,min:n?sorted[0]:null,max:n?sorted[n-1]:null,bins}
}
