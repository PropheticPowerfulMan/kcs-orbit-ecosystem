import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
export default defineConfig({base:process.env.VITE_BASE_PATH||'/jury/',plugins:[react(),{name:'jury-private-pwa',writeBundle(){const root=resolve('dist'),assets=readdirSync(resolve(root,'assets')).filter(n=>!n.endsWith('.map')).map(n=>'assets/'+n),version=process.env.JURY_BUILD_ID||Date.now().toString();writeFileSync(resolve(root,'sw.js'),readFileSync(resolve('public/sw.js'),'utf8').replace('__JURY_VERSION__',version).replace('/*__JURY_ASSETS__*/',JSON.stringify(['./','index.html','jury-logo.svg','kcs-emblem.jpg','icons/jury-192.png','icons/jury-512.png','icons/jury-maskable-512.png','manifest.webmanifest',...assets])) )}}],build:{sourcemap:false},server:{proxy:{'/jury/api':{target:'http://localhost:5000',rewrite:p=>p.replace('/jury/api','/api/jury')}}}})
