import {useEffect} from 'react'
import {registerPwa} from '@/registerPwa'
/** Scoped runtime emitted by Vite owns the mandatory update dialog. */
export function ApplicationUpdateNotice(){useEffect(()=>{void registerPwa()},[]);return null}
