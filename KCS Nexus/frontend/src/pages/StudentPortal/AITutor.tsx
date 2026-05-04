import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Send, BookOpen, Loader2, Lightbulb, ClipboardList, 
  RefreshCw, ThumbsUp, Copy, ChevronDown
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { aiAPI } from '@/services/api'

const generateId = () => Math.random().toString(36).substring(2, 9)

const subjects = [
  { id: 'math', name: 'Mathematics', emoji: '📐' },
  { id: 'science', name: 'Science', emoji: '🔬' },
  { id: 'english', name: 'English', emoji: '📝' },
  { id: 'history', name: 'History', emoji: '🌍' },
  { id: 'french', name: 'French', emoji: '🇫🇷' },
  { id: 'bible', name: 'Bible & Ethics', emoji: '✝️' },
]

const quickPrompts = {
  math: [
    'Explain how to solve quadratic equations',
    'What is the derivative of x²?',
    'Help me understand integration',
    'Generate a practice problem on trigonometry',
  ],
  science: [
    'Explain photosynthesis step by step',
    'How does DNA replication work?',
    'What is Newton\'s second law?',
    'Generate a quiz on cell biology',
  ],
  english: [
    'Help me write a thesis statement',
    'Explain the themes in To Kill a Mockingbird',
    'How do I analyze literary devices?',
    'Review my essay introduction',
  ],
  history: [
    'Explain the causes of WWI',
    'What was the significance of the Berlin Conference?',
    'Describe the Civil Rights Movement',
    'Timeline of African independence movements',
  ],
  french: [
    'Conjugate the verb "avoir" in all tenses',
    'Explain French gender rules',
    'How do I use the subjunctive?',
    'Practice conversation in French',
  ],
  bible: [
    'Explain the Sermon on the Mount',
    'What are the fruits of the Spirit?',
    'How does Christianity view leadership?',
    'Key themes in the book of Proverbs',
  ],
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  subject?: string
}

const AITutorPage = () => {
  const { user } = useAuthStore()
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startSession = (subjectId: string) => {
    setSelectedSubject(subjectId)
    setSessionStarted(true)
    const subject = subjects.find((s) => s.id === subjectId)
    setMessages([
      {
        id: generateId(),
        role: 'assistant',
        content: `Welcome, ${user?.firstName}! I'm your AI Tutor for **${subject?.name}**. I'm here to help you understand concepts, solve problems, and prepare for exams.\n\nYou can:\n• Ask me to explain any concept\n• Request step-by-step problem solving\n• Ask for practice exercises\n• Get help preparing for tests\n\nWhat would you like to work on today?`,
        timestamp: new Date().toISOString(),
        subject: subjectId,
      },
    ])
  }

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const subject = subjects.find((s) => s.id === selectedSubject)
      const response = await aiAPI.tutor(
        subject?.name || 'General',
        text,
        user?.id
      )
      const aiContent = response.data?.data?.response ||
        'I apologize, I encountered an issue. Please try rephrasing your question.'

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: aiContent,
        timestamp: new Date().toISOString(),
        subject: selectedSubject || undefined,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      // Fallback for demo
      const fallbackContent = getFallbackTutorResponse(text, selectedSubject || '')
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: fallbackContent,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const getFallbackTutorResponse = (question: string, subject: string): string => {
    const q = question.toLowerCase()

    if (q.includes('quadratic') || (subject === 'math' && q.includes('equation'))) {
      return `**Solving Quadratic Equations** 📐\n\nA quadratic equation has the form: **ax² + bx + c = 0**\n\n**Method 1: Quadratic Formula**\nx = (-b ± √(b² - 4ac)) / 2a\n\n**Example:** Solve x² - 5x + 6 = 0\n• a = 1, b = -5, c = 6\n• x = (5 ± √(25 - 24)) / 2\n• x = (5 ± 1) / 2\n• **x = 3 or x = 2** ✅\n\n**Method 2: Factoring**\nx² - 5x + 6 = (x - 3)(x - 2) = 0\n\nWould you like me to give you a practice problem?`
    }

    if (q.includes('photosynthesis')) {
      return `**Photosynthesis Explained** 🔬\n\nPhotosynthesis is the process plants use to convert sunlight into food.\n\n**The Equation:**\n6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂\n\n**Two Stages:**\n1. **Light Reactions** (in Thylakoids)\n   • Capture light energy\n   • Split water molecules\n   • Produce ATP and NADPH\n\n2. **Calvin Cycle** (in Stroma)\n   • Uses ATP and NADPH\n   • Fixes CO₂ into glucose\n\n**Key factors that affect rate:**\n• Light intensity\n• CO₂ concentration\n• Temperature\n\nShall I generate some practice questions on this?`
    }

    return `Great question! Let me help you with that.\n\nThis is a topic in **${subjects.find(s => s.id === subject)?.name || 'your subject'}** that's important for your studies.\n\nHere's how I'd approach this:\n\n1. **First**, let's understand the core concept\n2. **Then**, we'll look at examples\n3. **Finally**, we'll practice together\n\nCould you give me a bit more detail about what specifically you're struggling with? That way I can give you the most targeted explanation. 💡`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main className="flex flex-col !overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-kcs-blue-950 border-b border-gray-100 dark:border-kcs-blue-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl kcs-gradient flex items-center justify-center">
                <Brain size={20} className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-kcs-blue-900 dark:text-white font-display">AI Tutor</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedSubject
                    ? `Session: ${subjects.find(s => s.id === selectedSubject)?.name}`
                    : 'Personalized AI-powered learning support'}
                </p>
              </div>
            </div>
            {sessionStarted && (
              <button
                onClick={() => { setSessionStarted(false); setSelectedSubject(null); setMessages([]) }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-kcs-blue-600 dark:text-gray-400 dark:hover:text-kcs-blue-300 transition-colors"
              >
                <RefreshCw size={16} /> New Session
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {!sessionStarted ? (
          /* Subject Selection */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">🧠</div>
                <h2 className="text-2xl font-bold font-display text-kcs-blue-900 dark:text-white mb-2">
                  Welcome to AI Tutor, {user?.firstName}!
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose a subject to start a personalized learning session.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {subjects.map((subject) => (
                  <motion.button
                    key={subject.id}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => startSession(subject.id)}
                    className="p-6 bg-white dark:bg-kcs-blue-900/50 rounded-2xl border-2 border-gray-100 dark:border-kcs-blue-800 hover:border-kcs-blue-400 dark:hover:border-kcs-blue-500 hover:shadow-kcs transition-all duration-300 text-center group"
                  >
                    <div className="text-4xl mb-3">{subject.emoji}</div>
                    <p className="font-semibold text-kcs-blue-900 dark:text-white group-hover:text-kcs-blue-700 dark:group-hover:text-kcs-blue-300 transition-colors">
                      {subject.name}
                    </p>
                  </motion.button>
                ))}
              </div>

              <div className="mt-8 p-5 rounded-2xl bg-kcs-blue-50 dark:bg-kcs-blue-900/30 border border-kcs-blue-100 dark:border-kcs-blue-800">
                <h3 className="font-semibold text-kcs-blue-900 dark:text-white mb-2 flex items-center gap-2">
                  <Lightbulb size={18} className="text-kcs-gold-500" /> What can AI Tutor do?
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    '✅ Explain complex concepts step-by-step',
                    '✅ Generate personalized practice problems',
                    '✅ Review and improve your essays',
                    '✅ Prepare targeted quiz questions',
                    '✅ Provide study strategies',
                    '✅ Answer questions in English or French',
                  ].map((item) => (
                    <p key={item} className="text-sm text-gray-600 dark:text-gray-300">{item}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Interface */
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'kcs-gradient text-white' : 'bg-kcs-blue-100 dark:bg-kcs-blue-800'
                  }`}>
                    {msg.role === 'user'
                      ? <span className="text-sm font-bold">{user?.firstName?.[0]}</span>
                      : <Brain size={18} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
                    }
                  </div>
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'kcs-gradient text-white rounded-tr-sm'
                        : 'bg-white dark:bg-kcs-blue-900/50 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-kcs-blue-800 rounded-tl-sm'
                    }`}
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {msg.content}
                    </div>
                    {msg.role === 'assistant' && (
                      <div className="flex gap-2 px-1">
                        <button
                          onClick={() => copyMessage(msg.content)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Copy"
                        >
                          <Copy size={13} />
                        </button>
                        <button className="text-gray-400 hover:text-green-500 transition-colors" title="Helpful">
                          <ThumbsUp size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-kcs-blue-100 dark:bg-kcs-blue-800 flex items-center justify-center flex-shrink-0">
                    <Brain size={18} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
                  </div>
                  <div className="bg-white dark:bg-kcs-blue-900/50 border border-gray-100 dark:border-kcs-blue-800 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-kcs-blue-600 dark:text-kcs-blue-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">AI Tutor is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts */}
            {messages.length <= 1 && selectedSubject && (
              <div className="px-6 pb-2">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                  <Lightbulb size={12} /> Suggested topics:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(quickPrompts[selectedSubject as keyof typeof quickPrompts] || []).map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      disabled={isLoading}
                      className="text-xs px-3 py-2 bg-kcs-blue-50 dark:bg-kcs-blue-900/30 text-kcs-blue-700 dark:text-kcs-blue-300 rounded-xl hover:bg-kcs-blue-100 dark:hover:bg-kcs-blue-800/50 transition-colors border border-kcs-blue-100 dark:border-kcs-blue-800 disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-white dark:bg-kcs-blue-950 border-t border-gray-100 dark:border-kcs-blue-800">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your AI Tutor anything... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-kcs-blue-900/50 border border-gray-200 dark:border-kcs-blue-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kcs-blue-500 resize-none"
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 rounded-xl kcs-gradient flex items-center justify-center text-white disabled:opacity-50 hover:shadow-kcs transition-all duration-200 hover:scale-105 active:scale-95 flex-shrink-0"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                AI Tutor uses OpenAI to provide personalized academic support.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default AITutorPage
