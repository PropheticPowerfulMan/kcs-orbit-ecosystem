export type SiteValue = {kind:string;original:string;value:string}
export const visualFields = (fields:Record<string,SiteValue>={}) => Object.fromEntries(Object.entries(fields).filter(([,field])=>field.kind==='image'||field.kind==='background'))
export function publishedFields(state:any,language:string,lastLanguage='en') {
  const alternate=lastLanguage==='en'?'fr':'en'
  const visuals=state.visuals ?? {...visualFields(state.published?.[alternate]),...visualFields(state.published?.[lastLanguage])}
  return {...(state.published?.[language]||{}),...visuals}
}

export function editorFields(state:any,language:string,lastLanguage='en') {
  const draft=state.draft?.[language]||{},result={...draft,...visualFields(publishedFields(state,language,lastLanguage))}
  for(const [key,field] of Object.entries(visualFields(draft))) {
    if(JSON.stringify(field)!==JSON.stringify(state.published?.[language]?.[key]))result[key]=field
  }
  return result
}
