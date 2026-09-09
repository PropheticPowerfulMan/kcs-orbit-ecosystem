import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Brain, Camera, Heart, MessageCircle, Mic, Plus, Send, ShieldCheck, Users, Video, X } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { useAuthStore } from '@/store/authStore'
import { studentForumAPI } from '@/services/api'

type StudentForumPost = {
  id: string
  title: string
  category: string
  content: string
  sentiment: string
  priority: string
  author: string
  comments: { id: string; author: string; content: string }[]
  attachmentType?: 'image' | 'video' | 'audio'
  attachmentData?: string
  attachmentName?: string
  likeCount: number
  likedByMe: boolean
}

const StudentForumPage = () => {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<StudentForumPost[]>([])
  const [draft, setDraft] = useState({ title: '', category: 'Academics', content: '' })
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [attachment, setAttachment] = useState<{ type: 'image' | 'video' | 'audio'; data: string; name: string } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    studentForumAPI.getPosts().then((response) => {
      const records = Array.isArray(response.data.data) ? response.data.data : []
      setPosts(records.map((post: any) => ({ ...post, likeCount: Number(post.likeCount ?? 0), likedByMe: Boolean(post.likedByMe), author: `${post.author.firstName} ${post.author.lastName?.[0] ?? ''}.`, comments: post.comments.map((comment: any) => ({ ...comment, author: `${comment.author.firstName} ${comment.author.lastName?.[0] ?? ''}.` })) })))
    }).catch(() => undefined)
  }, [])

  const report = useMemo(() => {
    const urgent = posts.filter((post) => post.priority === 'urgent').length
    const concerned = posts.filter((post) => post.sentiment.includes('concern')).length
    return {
      sentiment: urgent ? 'high concern' : concerned ? 'student support needed' : 'stable',
      summary: `${posts.length} student threads, ${concerned} concern signals, ${urgent} urgent threads.`,
    }
  }, [posts])

  const createPost = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.title || !draft.content) return
    const response = await studentForumAPI.createPost({ ...draft, ...(attachment ? { attachmentType: attachment.type, attachmentData: attachment.data, attachmentName: attachment.name } : {}) })
    const created = response.data.data
    setPosts((current) => [{ ...created, likeCount: 0, likedByMe: false, author: `${user?.firstName ?? 'Student'} ${user?.lastName?.[0] ?? ''}.`.trim(), comments: [] }, ...current])
    setDraft({ title: '', category: 'Academics', content: '' })
    setAttachment(null)
  }

  const addComment = async (postId: string) => {
    const content = commentDrafts[postId]
    if (!content) return
    const response = await studentForumAPI.addComment(postId, { content })
    setPosts((current) => current.map((post) => post.id === postId
      ? { ...post, comments: [...post.comments, { ...response.data.data, author: user?.firstName ?? 'Student' }] }
      : post))
    setCommentDrafts((current) => ({ ...current, [postId]: '' }))
  }

  const readMedia = (file: File | undefined, type: 'image' | 'video' | 'audio') => {
    if (!file) return
    if (!file.type.startsWith(type + '/')) { alert('Please select a valid ' + type + ' file.'); return }
    if (file.size > 8_000_000) { alert('Media must be 8 MB or less.'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachment({ type, data: String(reader.result), name: file.name })
    reader.readAsDataURL(file)
  }

  const toggleLike = async (postId: string) => {
    const response = await studentForumAPI.toggleLike(postId)
    const result = response.data.data
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, likedByMe: Boolean(result.liked), likeCount: Number(result.likeCount) } : post))
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-kcs-blue-950">
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Student Forum</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">A moderated student voice space with AI monitoring for wellbeing, learning support, and leadership decisions.</p>
        </div>

        <div className="grid min-w-0 gap-5 p-3 sm:p-6 xl:grid-cols-[0.85fr_1.35fr]">
          <div className="space-y-6">
            <form onSubmit={createPost} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center gap-3">
                <Plus className="text-kcs-blue-600" size={20} />
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Start a Student Discussion</h2>
              </div>
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Discussion title" className="input-kcs mb-3" />
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="input-kcs mb-3">
                <option>Academics</option>
                <option>Wellbeing</option>
                <option>Student Life</option>
                <option>Safety</option>
                <option>Clubs</option>
                <option>Events</option>
              </select>
              <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Share an idea, question, or concern" className="input-kcs min-h-32 resize-none" />
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => readMedia(event.target.files?.[0], 'image')} /><input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => readMedia(event.target.files?.[0], 'video')} /><input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(event) => readMedia(event.target.files?.[0], 'audio')} />
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-kcs-blue-700"><Camera size={16}/> Photo</button><button type="button" onClick={() => videoInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-kcs-blue-700"><Video size={16}/> Video</button><button type="button" onClick={() => audioInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-kcs-blue-700"><Mic size={16}/> Audio</button></div>
              {attachment && <div className="mt-3 flex items-center justify-between rounded-xl bg-kcs-blue-50 p-3 text-sm"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)}><X size={16}/></button></div>}
              <button className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2">
                <Send size={16} /> Publish
              </button>
            </form>

            <div className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40">
              <div className="mb-3 flex items-center gap-2 text-kcs-blue-800 dark:text-kcs-blue-200">
                <Brain size={18} />
                <h2 className="font-bold">AI Student Voice Monitor</h2>
              </div>
              <p className="text-sm text-kcs-blue-900 dark:text-kcs-blue-100">{report.summary}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Current pulse: {report.sentiment}</p>
            </div>
          </div>

          <section className="min-w-0 space-y-4">
            {posts.length === 0 && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-gray-300">No real student discussion has been published yet.</div>}
            {posts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{post.category}</p>
                    <h2 className="font-display text-lg font-bold text-kcs-blue-900 dark:text-white">{post.title}</h2>
                    <p className="text-xs text-gray-400">Started by {post.author}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${post.priority === 'urgent' ? 'bg-red-100 text-red-700' : post.priority === 'elevated' ? 'bg-kcs-gold-100 text-kcs-gold-700' : 'bg-green-100 text-green-700'}`}>
                    {post.priority}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{post.content}</p>
                {post.attachmentData && <div className="mt-4 overflow-hidden rounded-2xl bg-black/5">{post.attachmentType === 'image' ? <img src={post.attachmentData} alt={post.attachmentName ?? post.title} className="max-h-[520px] w-full object-contain"/> : post.attachmentType === 'video' ? <video src={post.attachmentData} controls className="max-h-[520px] w-full"/> : <audio src={post.attachmentData} controls className="w-full p-4"/>}</div>}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <button type="button" onClick={() => void toggleLike(post.id)} className={`flex items-center gap-1.5 ${post.likedByMe ? 'font-bold text-red-500' : ''}`}><Heart size={15} fill={post.likedByMe ? 'currentColor' : 'none'}/> {post.likeCount} {post.likeCount === 1 ? 'Like' : 'Likes'}</button>
                  <span className="flex items-center gap-1.5"><MessageCircle size={14} /> {post.comments.length} comments</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> AI: {post.sentiment}</span>
                  <span className="flex items-center gap-1.5"><Users size={14} /> Student visible</span>
                </div>
                <div className="mt-4 space-y-2">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30">
                      <span className="font-semibold text-kcs-blue-900 dark:text-white">{comment.author}: </span>
                      <span className="text-gray-600 dark:text-gray-300">{comment.content}</span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts({ ...commentDrafts, [post.id]: event.target.value })} placeholder="Reply to this discussion" className="input-kcs" />
                    <button onClick={() => addComment(post.id)} className="rounded-xl bg-kcs-blue-700 px-4 text-white hover:bg-kcs-blue-800">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        </div>
      </main>
    </div>
  )
}

export default StudentForumPage
