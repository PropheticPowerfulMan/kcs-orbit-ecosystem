import {useUIStore} from '@/store/uiStore'
/** Display locale only. Persisted dates, enum values and academic calculations stay canonical. */
export const uiLocale=()=>useUIStore.getState().language==='fr'?'fr-CD':'en-GB'
