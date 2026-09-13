import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Camera, MessageCircle, Mic, Paperclip, Plus, RefreshCw, Search, Send, ShieldCheck, Users, Video, X } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { forumAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import AudioRecorder from '@/components/shared/AudioRecorder'
import ForumMedia from '@/components/shared/ForumMedia'

const fullName = (person: any) => [person?.lastName, person?.middleName, person?.firstName].filter(Boolean).join(' ') || 'KCS'
const categories = ['Academics','Transport','Safety','Communication','Events']

export default function ParentForumPage() {
  const user = useAuthStore((state) => state.user)
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [posts, setPosts] = useState<any[]>([])
  const [draft, setDraft] = useState({ title: '', category: 'Academics', content: '' })
  const [comments, setComments] = useState<Record<string,string>>({})
  const [attachment, setAttachment] = useState<any>(null)
  const [commentAttachments, setCommentAttachments] = useState<Record<string,any>>({})
  const [recordingFor, setRecordingFor] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    let lastError: any
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await forumAPI.getPosts()
        setPosts(Array.isArray(response.data?.data) ? response.data.data : [])
        setLoading(false)
        return
      } catch (reason: any) {
        lastError = reason
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)))
      }
    }
    setError(lastError?.response?.data?.message ?? lastError?.message ?? tr('Impossible de charger le forum. Réessayez avec Actualiser.','Unable to load the forum. Try Refresh.'))
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const visible = useMemo(() => posts.filter((post) => {
    const text = [post.title,post.content,post.category,fullName(post.author)].join(' ').toLowerCase()
    return (category === 'ALL' || post.category === category) && (!query.trim() || text.includes(query.trim().toLowerCase()))
  }), [posts,query,category])

  const createPost = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.title.trim().length < 4 || (draft.content.trim().length < 8 && !attachment)) return
    setBusy('create'); setError('')
    try { await forumAPI.createPost({ ...draft, ...(attachment ? { attachmentType: attachment.type, attachmentData: attachment.data, attachmentName: attachment.name } : {}) }); setDraft({ title:'',category:'Academics',content:'' }); setAttachment(null); await load() }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Publication impossible.','Unable to publish.')) }
    finally { setBusy('') }
  }

  const addComment = async (postId: string) => {
    const content = comments[postId]?.trim() ?? ''
    const media = commentAttachments[postId]
    if (!content && !media) return
    setBusy(postId); setError('')
    try { await forumAPI.addComment(postId,{content,...(media?{attachmentType:media.type,attachmentData:media.data,attachmentName:media.name}:{})}); setComments((current) => ({...current,[postId]:''})); setCommentAttachments((current)=>({...current,[postId]:null})); setRecordingFor(''); await load() }
    catch (reason: any) { setError(reason?.response?.data?.message ?? tr('Réponse impossible.','Unable to reply.')) }
    finally { setBusy('') }
  }

  const readMedia = (file: File | undefined, done: (media:any)=>void) => {
    if (!file) return
    if (file.size > 8_000_000) { setError(tr('Le fichier doit faire 8 Mo maximum.','The file must be 8 MB or less.')); return }
    const family=file.type.split('/')[0]; const type=['image','video','audio'].includes(family)?family:'document'
    const reader=new FileReader(); reader.onload=()=>done({type,data:String(reader.result),name:file.name}); reader.readAsDataURL(file)
  }

  return <div className="portal-shell flex min-h-screen bg-slate-50 dark:bg-kcs-blue-950">
    <PortalSidebar/>
    <main className="min-w-0 flex-1 p-4 pt-24 sm:p-6 sm:pt-24 lg:p-8">
      <div className="w-full max-w-none space-y-5">
        <header className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase text-cyan-700 dark:text-cyan-300">{user?.role === 'admin' ? tr('Vue de modération Superadmin','Superadmin moderation view') : tr('Espace familial vérifié','Verified family space')}</p><h1 className="mt-1 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Forum des parents','Parent Forum')}</h1><p className="text-sm text-gray-500 dark:text-gray-300">{tr('Toutes les discussions ci-dessous proviennent de la base Nexus.','Every discussion below comes from the Nexus database.')}</p></div>
          <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white"><RefreshCw size={16} className={loading?'animate-spin':''}/>{tr('Actualiser','Refresh')}</button>
        </header>

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-4">
            <form onSubmit={createPost} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900">
              <h2 className="flex items-center gap-2 font-bold text-kcs-blue-950 dark:text-white"><Plus size={18}/>{tr('Nouvelle discussion','New discussion')}</h2>
              <input className="input-kcs mt-4" value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder={tr('Titre de la discussion','Discussion title')}/>
              <select className="input-kcs mt-3" value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}>{categories.map((item)=><option key={item}>{item}</option>)}</select>
              <textarea className="input-kcs mt-3 min-h-32" value={draft.content} onChange={(e)=>setDraft({...draft,content:e.target.value})} placeholder={tr('Question, idée ou préoccupation','Question, idea or concern')}/>
              <div className="mt-3 grid grid-cols-3 gap-2">{[['image',Camera,tr('Photo','Photo')],['video',Video,tr('Vidéo','Video')],['audio',Mic,tr('Audio','Audio')]].map(([kind,Icon,label]:any)=><label key={kind} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-xl bg-cyan-50 text-xs font-bold text-cyan-800 dark:bg-kcs-blue-950 dark:text-cyan-200"><Icon size={15}/>{label}<input type="file" accept={`${kind}/*`} capture={kind==='video'?'environment':undefined} className="hidden" onChange={(e)=>readMedia(e.target.files?.[0],setAttachment)}/></label>)}</div>
              {attachment&&<div className="mt-2 flex items-center justify-between rounded-xl bg-slate-100 p-3 text-sm dark:bg-kcs-blue-950 dark:text-white"><span className="truncate">{attachment.name}</span><button type="button" onClick={()=>setAttachment(null)}><X size={16}/></button></div>}
              <div className="mt-3"><AudioRecorder language={language} onRecorded={(file)=>readMedia(file,setAttachment)}/></div>
              <button disabled={busy==='create'} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-50"><Send size={16}/>{tr('Publier','Publish')}</button>
            </form>
            <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900"><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input className="input-kcs pl-10" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={tr('Titre, auteur, contenu…','Title, author, content…')}/></div><select className="input-kcs mt-3" value={category} onChange={(e)=>setCategory(e.target.value)}><option value="ALL">{tr('Toutes les catégories','All categories')}</option>{categories.map((item)=><option key={item}>{item}</option>)}</select><p className="mt-3 text-xs text-gray-500 dark:text-gray-300">{visible.length} / {posts.length} {tr('discussion(s)','discussion(s)')}</p></div>
          </aside>

          <section className="space-y-4">
            {error && <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
            {!loading && !visible.length && <div className="rounded-2xl bg-white p-8 text-center dark:bg-kcs-blue-900"><Users className="mx-auto text-cyan-600"/><p className="mt-3 font-bold text-kcs-blue-950 dark:text-white">{tr('Aucune discussion réelle ne correspond.','No verified discussion matches.')}</p></div>}
            {visible.map((post)=><article key={post.id} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-kcs-blue-900">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{post.category}</p><h2 className="text-lg font-bold text-kcs-blue-950 dark:text-white">{post.title}</h2><p className="text-xs text-gray-400">{fullName(post.author)} · {new Date(post.createdAt).toLocaleString(language==='fr'?'fr-FR':'en-US')}</p></div><span className={post.priority==='urgent'?'rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700':'rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700'}>{post.priority}</span></div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">{post.content}</p>
              <ForumMedia type={post.attachmentType} name={post.attachmentName} hasAttachment={post.hasAttachment} load={()=>forumAPI.getPostAttachment(post.id)} language={language}/>
              <div className="mt-4 flex gap-4 text-xs text-gray-500 dark:text-gray-300"><span className="flex items-center gap-1"><MessageCircle size={14}/>{post.comments?.length??0}</span><span className="flex items-center gap-1"><ShieldCheck size={14}/>{post.sentiment}</span></div>
              <div className="mt-4 space-y-2">{post.comments?.map((comment:any)=><div key={comment.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-kcs-blue-950"><b className="text-kcs-blue-950 dark:text-white">{fullName(comment.author)}: </b><span className="text-gray-700 dark:text-gray-200">{comment.content}</span><ForumMedia compact type={comment.attachmentType} name={comment.attachmentName} hasAttachment={comment.hasAttachment} load={()=>forumAPI.getCommentAttachment(comment.id)} language={language}/></div>)}</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input-kcs" value={comments[post.id]??''} onChange={(e)=>setComments({...comments,[post.id]:e.target.value})} placeholder={tr('Répondre à cette discussion','Reply to this discussion')}/><label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 dark:text-white"><Paperclip size={17}/><input type="file" accept="image/*,audio/*,video/*,.pdf,.txt" className="hidden" onChange={(e)=>readMedia(e.target.files?.[0],media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></label><label title={tr('Filmer maintenant','Record video now')} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 dark:text-white"><Video size={17}/><input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>readMedia(e.target.files?.[0],media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></label><button type="button" onClick={()=>setRecordingFor(recordingFor===post.id?'':post.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 dark:text-white"><Mic size={17}/></button><button disabled={busy===post.id} onClick={()=>void addComment(post.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kcs-blue-700 px-5 py-3 text-white disabled:opacity-50"><Send size={16}/></button></div>
              {commentAttachments[post.id]&&<div className="mt-2 flex items-center justify-between rounded-xl bg-cyan-50 p-3 text-sm dark:bg-kcs-blue-950 dark:text-white"><span className="truncate">{commentAttachments[post.id].name}</span><button type="button" onClick={()=>setCommentAttachments(current=>({...current,[post.id]:null}))}><X size={16}/></button></div>}
              {recordingFor===post.id&&<div className="mt-2"><AudioRecorder language={language} onRecorded={(file)=>readMedia(file,media=>setCommentAttachments(current=>({...current,[post.id]:media})))}/></div>}
            </article>)}
          </section>
        </div>
      </div>
    </main>
  </div>
}
