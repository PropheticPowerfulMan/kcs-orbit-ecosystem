import {PrismaClient} from '@prisma/client'
import {env} from '../config/env.js'
const url=new URL(env.DATABASE_URL)
url.searchParams.set('connection_limit',process.env.JURY_DATABASE_POOL_LIMIT||'5')
export const prisma=new PrismaClient({datasources:{db:{url:url.href}},log:[{emit:'event',level:'error'},{emit:'event',level:'warn'}]})
prisma.$on('error',()=>console.error('JURY_DATABASE_OPERATION_FAILED'))
prisma.$on('warn',()=>console.warn('JURY_DATABASE_WARNING'))
