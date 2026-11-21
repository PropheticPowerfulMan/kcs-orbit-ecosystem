export function gradebookPanelKey(panel:string,compact:boolean){return 'kcs:nexus:gradebook:'+(compact?'mobile:':'')+panel}
export function initialGradebookPanel(panel:string,compact:boolean,read:(key:string)=>string|null){
 try{const value=read(gradebookPanelKey(panel,compact));return value===null?!compact:value!=='closed'}catch{return !compact}
}
