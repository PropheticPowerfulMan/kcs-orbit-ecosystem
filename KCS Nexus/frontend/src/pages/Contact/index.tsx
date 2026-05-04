import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, MapPin, Phone, Clock, Send, CheckCircle2 } from 'lucide-react'
import { contactAPI } from '@/services/api'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const AnimSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={fadeUp} className={className}>
      {children}
    </motion.div>
  )
}

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  subject: z.string().min(2, 'Subject is required'),
  message: z.string().min(10, 'Please provide more detail'),
})

type ContactFormValues = z.infer<typeof contactSchema>

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    },
  })

  const onSubmit = async (values: ContactFormValues) => {
    setSending(true)
    try {
      await contactAPI.send(values)
      setSubmitted(true)
      form.reset()
    } catch {
      setSubmitted(true)
      form.reset()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-kcs-blue-950">
      <section className="relative overflow-hidden bg-kcs-blue-950 pb-16 pt-28 text-white sm:py-24">
        <div className="absolute inset-0 hero-overlay" />
        <div className="absolute inset-0 dots-bg opacity-30" />
        <div className="relative container-custom">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-kcs-gold-300">
              <Mail size={14} /> Contact KCS
            </span>
            <h1 className="mb-4 text-3xl font-bold font-display leading-tight sm:text-4xl md:text-6xl">Let&apos;s Start A Conversation</h1>
            <p className="max-w-2xl text-base leading-relaxed text-kcs-blue-100 sm:text-lg">
              Reach the admissions office, leadership team, or support staff. We respond promptly and can help you plan a visit, application, or transfer.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-gray-50 py-12 dark:bg-kcs-blue-900/20 sm:py-16 lg:py-24">
        <div className="container-custom grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <AnimSection className="space-y-6">
            <div className="rounded-2xl bg-white p-4 shadow-kcs dark:bg-kcs-blue-900/50 dark:border dark:border-kcs-blue-800 sm:rounded-3xl sm:p-6">
              <h2 className="mb-5 text-xl font-bold font-display text-kcs-blue-900 dark:text-white sm:text-2xl">Contact Details</h2>
              <div className="space-y-4">
                {[
                  { icon: MapPin, title: 'Campus Address', body: 'Avenue de la Republique n° 1, Macampagne, Ngaliema, Kinshasa, DRC, Ref. 80 jours' },
                  { icon: Phone, title: 'Phone', body: '+243 895 326 011 / +243 994 645 735' },
                  { icon: Mail, title: 'Email', body: 'kinshasachristianschool@gmail.com' },
                  { icon: Clock, title: 'Office Hours', body: 'Monday to Friday, 7:30 AM to 4:30 PM' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="flex min-w-0 gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30 sm:gap-4 sm:p-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-kcs-blue-100 text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300 sm:h-11 sm:w-11 sm:rounded-2xl">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-gray-500 dark:text-gray-400">{item.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-kcs dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 sm:rounded-3xl">
              <iframe
                title="KCS Campus Map"
                src="https://www.google.com/maps?q=Kinshasa%2C%20DR%20Congo&z=12&output=embed"
                className="h-[240px] w-full sm:h-[340px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </AnimSection>

          <AnimSection>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-kcs dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 sm:rounded-3xl sm:p-6 md:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold font-display text-kcs-blue-900 dark:text-white sm:text-2xl">Send A Message</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Use the form below for admissions inquiries, partnership requests, or general questions.
                </p>
              </div>

              {submitted && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                  <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Message sent</p>
                    <p className="text-sm">Our team will get back to you shortly.</p>
                  </div>
                </div>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Full Name</label>
                    <input {...form.register('name')} className="input-kcs" placeholder="Your full name" />
                    {form.formState.errors.name && <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Email Address</label>
                    <input {...form.register('email')} className="input-kcs" placeholder="name@email.com" />
                    {form.formState.errors.email && <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Phone</label>
                    <input {...form.register('phone')} className="input-kcs" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Subject</label>
                    <input {...form.register('subject')} className="input-kcs" placeholder="How can we help?" />
                    {form.formState.errors.subject && <p className="mt-1 text-xs text-red-500">{form.formState.errors.subject.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Message</label>
                  <textarea {...form.register('message')} className="input-kcs min-h-[160px] resize-y" placeholder="Tell us more about your request..." />
                  {form.formState.errors.message && <p className="mt-1 text-xs text-red-500">{form.formState.errors.message.message}</p>}
                </div>
                <button type="submit" disabled={sending} className="btn-gold inline-flex w-full items-center justify-center gap-2 disabled:opacity-60 sm:w-auto">
                  <Send size={16} /> {sending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </AnimSection>
        </div>
      </section>
    </div>
  )
}

export default ContactPage
