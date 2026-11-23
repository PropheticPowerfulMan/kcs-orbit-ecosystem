import {normalizeClassParts} from './className.js'

export const earlyYearsStages = ['NOT_OBSERVED', 'EXPLORING', 'WITH_SUPPORT', 'INDEPENDENT'] as const
export const earlyYearsDomains = [
  {id:'approaches',en:'Play & approaches to learning',fr:'Jeu et démarches d’apprentissage',examples:{K3:'Explore materials and join a short play routine.',K4:'Stay engaged, make choices and try another approach.',K5:'Plan an activity, persist and reflect on a strategy.'}},
  {id:'social',en:'Social & emotional development',fr:'Développement social et émotionnel',examples:{K3:'Name a feeling and play alongside another child.',K4:'Take turns and ask for help with a disagreement.',K5:'Collaborate, describe feelings and practise self-regulation.'}},
  {id:'language',en:'Language & communication',fr:'Langage et communication',examples:{K3:'Use words, gestures or a home language to communicate.',K4:'Join a conversation and describe a familiar experience.',K5:'Explain an idea, listen and ask a relevant question.'}},
  {id:'literacy',en:'Early literacy',fr:'Éveil à la lecture et à l’écriture',examples:{K3:'Enjoy a story, explore books and make meaningful marks.',K4:'Retell part of a story and notice sounds or letters.',K5:'Connect sounds and letters and express meaning through emergent writing.'}},
  {id:'mathematics',en:'Mathematical thinking',fr:'Pensée mathématique',examples:{K3:'Sort, compare and count during play.',K4:'Describe patterns, quantities and shapes with materials.',K5:'Represent quantities and explain a practical problem-solving strategy.'}},
  {id:'science',en:'Scientific thinking',fr:'Démarche scientifique',examples:{K3:'Notice and explore changes with the senses.',K4:'Ask a question, predict and describe an observation.',K5:'Investigate, compare evidence and explain what changed.'}},
  {id:'physical',en:'Movement, health & independence',fr:'Motricité, santé et autonomie',examples:{K3:'Practise movement, handling tools and supported self-care.',K4:'Coordinate movements and follow familiar care routines.',K5:'Use tools with control and manage everyday routines with growing independence.'}},
] as const

export function earlyYearsAssignment(profile: {status?:string;homeroomGrade?:string|null;homeroomSection?:string|null}|null|undefined) {
  if (!profile || !['HOMEROOM_TEACHER','ASSISTANT_TEACHER'].includes(profile.status||'')) return null
  const value=normalizeClassParts(profile.homeroomGrade||'',profile.homeroomSection||'')
  return /^K[345]$/i.test(value.grade) ? {...value,grade:value.grade.toUpperCase(),role:profile.status==='HOMEROOM_TEACHER'?'MAIN':'ASSISTANT'} : null
}

export function observationDateAllowed(date:string,start:string,end:string,today:string) {
  const d=new Date(date+'T12:00:00Z')
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date&&date>=start.slice(0,10)&&date<=end.slice(0,10)&&date<=today
}

export function developmentalSnapshot(observations: Array<{domain:string;date:string;stage:string;updatedAt?:string}>) {
  const ordered=[...observations].sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||'').localeCompare(a.updatedAt||''))
  return earlyYearsDomains.map(domain=>({domain:domain.id,latest:ordered.find(o=>o.domain===domain.id)||null}))
}
