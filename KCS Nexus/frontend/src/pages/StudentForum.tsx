import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Brain, MessageCircle, Plus, Send, ShieldCheck, Users } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { useAuthStore } from '@/store/authStore'

type StudentForumPost = {
  id: string
  title: string
  category: string
  content: string
  sentiment: string
  priority: string
  author: string
  comments: { id: string; author: string; content: string }[]
}

const initialPosts: StudentForumPost[] = [
  {
    id: '1',
    title: 'Math study group before exams',
    category: 'Academics',
    content: 'Can Grade 10 and Grade 11 students organize a supervised math study group twice a week before finals?',
    sentiment: 'neutral',
    priority: 'normal',
    author: 'Elise K.',
    comments: [{ id: 'c1', author: 'David K.', content: 'This would help for algebra too.' }],
  },
  {
    id: '2',
    title: 'Students feeling pressure before AP tests',
    category: 'Wellbeing',
    content: 'Some students are feeling stressed and worried about AP preparation. Could counseling share study planning tips?',
    sentiment: 'concerned',
    priority: 'elevated',
    author: 'Naomi M.',
    comments: [],
  },
]

const StudentForumPage = () => {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState(initialPosts)
  const [draft, setDraft] = useState({ title: '', category: 'Academics', content: '' })
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  const report = useMemo(() => {
    const urgent = posts.filter((post) => post.priority === 'urgent').length
    const concerned = posts.filter((post) => post.sentiment.includes('concern')).length
    return {
      sentiment: urgent ? 'high concern' : concerned ? 'student support needed' : 'stable',
      summary: `${posts.length} student threads, ${concerned} concern signals, ${urgent} urgent threads.`,
    }
  }, [posts])

  const createPost = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.title || !draft.content) return
    const lower = `${draft.title} ${draft.content}`.toLowerCase()
    const urgent = ['urgent', 'unsafe', 'danger', 'harassment', 'bullying', 'self-harm'].some((word) => lower.includes(word))
    const concerned = ['stress', 'worried', 'pressure', 'problem', 'confused', 'excluded'].some((word) => lower.includes(word))

    setPosts((current) => [{
      id: crypto.randomUUID(),
      ...draft,
      sentiment: urgent ? 'high-concern' : concerned ? 'concerned' : 'neutral',
      priority: urgent ? 'urgent' : concerned ? 'elevated' : 'normal',
      author: `${user?.firstName ?? 'Student'} ${user?.lastName?.[0] ?? ''}.`.trim(),
      comments: [],
    }, ...current])
    setDraft({ title: '', category: 'Academics', content: '' })
  }

  const addComment = (postId: string) => {
    const content = commentDrafts[postId]
    if (!content) return
    setPosts((current) => current.map((post) => post.id === postId
      ? { ...post, comments: [...post.comments, { id: crypto.randomUUID(), author: user?.firstName ?? 'Student', content }] }
      : post))
    setCommentDrafts((current) => ({ ...current, [postId]: '' }))
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      <main>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Student Forum</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">A moderated student voice space with AI monitoring for wellbeing, learning support, and leadership decisions.</p>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[0.85fr_1.35fr]">
          <div className="space-y-6">
            <form onSubmit={createPost} className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
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

          <section className="space-y-4">
            {posts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"
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
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
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
