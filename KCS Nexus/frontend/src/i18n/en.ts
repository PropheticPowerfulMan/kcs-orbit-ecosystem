const en = {
  // Navigation
  nav: {
    home: 'Home',
    about: 'About',
    academics: 'Academics',
    news: 'News & Events',
    admissions: 'Admissions',
    gallery: 'Gallery',
    contact: 'Contact',
    portal: 'Portal',
    login: 'Sign In',
    logout: 'Sign Out',
    dashboard: 'Dashboard',
    applyNow: 'Apply Now',
    visitSchool: 'Visit School',
  },

  // Hero
  hero: {
    badge: 'American International School',
    title: 'Excellence in Education,',
    titleHighlight: 'Rooted in Faith',
    subtitle: 'Empowering the next generation of African leaders through world-class American education, Christian values, and innovative technology.',
    cta1: 'Apply Now',
    cta2: 'Explore Programs',
    stats: {
      students: 'Students',
      teachers: 'Teachers',
      years: 'Years of Excellence',
      nationalities: 'Nationalities',
    },
  },

  // About
  about: {
    title: 'About KCS',
    subtitle: 'A Legacy of Excellence Since 1967',
    mission: {
      title: 'Our Mission',
      text: 'To provide an exceptional American education rooted in Christian values, empowering students in Kinshasa and across the Congo to become servant leaders who transform their communities and the world.',
    },
    vision: {
      title: 'Our Vision',
      text: 'To be the leading international school in Central Africa, recognized for academic excellence, spiritual depth, and the development of globally minded leaders.',
    },
    values: {
      title: 'Core Values',
      faith: { title: 'Faith', desc: 'Grounded in Christian principles and values' },
      excellence: { title: 'Excellence', desc: 'Pursuing the highest academic standards' },
      integrity: { title: 'Integrity', desc: 'Honesty and character in all we do' },
      community: { title: 'Community', desc: 'Building meaningful relationships' },
      innovation: { title: 'Innovation', desc: 'Embracing technology and new ideas' },
      leadership: { title: 'Leadership', desc: 'Developing servant leaders for Africa' },
    },
  },

  // Academics
  academics: {
    title: 'Academic Programs',
    subtitle: 'World-Class Curriculum, African Heart',
    programs: {
      elementary: {
        title: 'Elementary School',
        grades: 'K1-K5',
        desc: 'Building a strong foundation through engaging, faith-integrated learning.',
      },
      middle: {
        title: 'Middle School',
        grades: 'Grades 6-8',
        desc: 'Navigating adolescence with academic challenge and spiritual growth.',
      },
      high: {
        title: 'High School',
        grades: 'Grades 9-12',
        desc: 'Preparing students for top universities worldwide with AP and honors courses.',
      },
    },
    curriculum: 'American Curriculum',
    accreditation: 'Accredited by ACSI',
  },

  // News
  news: {
    title: 'News & Events',
    subtitle: 'Stay connected with the KCS community',
    readMore: 'Read More',
    viewAll: 'View All',
    categories: {
      all: 'All',
      news: 'News',
      events: 'Events',
      announcements: 'Announcements',
      achievements: 'Achievements',
    },
  },

  // Admissions
  admissions: {
    title: 'Admissions',
    subtitle: 'Join the KCS Family',
    steps: {
      title: 'Application Process',
      apply: { title: 'Submit Application', desc: 'Complete the online application form' },
      docs: { title: 'Upload Documents', desc: 'Submit required academic records' },
      interview: { title: 'Interview', desc: 'Meet with our admissions team' },
      decision: { title: 'Decision', desc: 'Receive your admission decision' },
    },
    requirements: 'Requirements',
    applyOnline: 'Apply Online',
    trackApplication: 'Track Application',
  },

  // Portal
  portal: {
    student: {
      title: 'Student Portal',
      welcome: 'Welcome back',
      dashboard: 'Dashboard',
      grades: 'My Grades',
      assignments: 'Assignments',
      timetable: 'Timetable',
      aiTutor: 'AI Tutor',
    },
    parent: {
      title: 'Parent Portal',
      dashboard: 'Dashboard',
      performance: 'Performance',
      messages: 'Messages',
      notifications: 'Notifications',
    },
    admin: {
      title: 'Admin Panel',
      students: 'Students',
      teachers: 'Teachers',
      courses: 'Courses',
      admissions: 'Admissions',
      analytics: 'Analytics',
      settings: 'Settings',
    },
  },

  // AI
  ai: {
    chat: {
      title: 'KCS Assistant',
      subtitle: 'Ask me anything about KCS',
      placeholder: 'Ask a question...',
      thinking: 'Thinking...',
      greeting: 'Hello! I\'m the KCS AI Assistant. How can I help you today? I can answer questions about admissions, academics, schedules, and more.',
    },
    tutor: {
      title: 'AI Tutor',
      subtitle: 'Personalized learning support',
      start: 'Start a Session',
      subject: 'Choose a Subject',
    },
  },

  // Contact
  contact: {
    title: 'Contact Us',
    subtitle: 'We\'d love to hear from you',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    hours: 'Office Hours',
    form: {
      name: 'Full Name',
      email: 'Email Address',
      subject: 'Subject',
      message: 'Message',
      send: 'Send Message',
      success: 'Message sent successfully!',
    },
  },

  // Auth
  auth: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email Address',
    password: 'Password',
    forgotPassword: 'Forgot Password?',
    rememberMe: 'Remember me',
    orContinueWith: 'Or continue with',
    google: 'Continue with Google',
    noAccount: 'Don\'t have an account?',
    hasAccount: 'Already have an account?',
  },

  // Common
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Try Again',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    download: 'Download',
    upload: 'Upload',
    submit: 'Submit',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    confirm: 'Confirm',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    language: 'Language',
    notifications: 'Notifications',
    profile: 'Profile',
    settings: 'Settings',
    noData: 'No data available',
    seeAll: 'See All',
  },
}

export type TranslationKeys = typeof en
export default en
