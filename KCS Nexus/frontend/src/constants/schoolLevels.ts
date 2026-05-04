export const KINDERGARTEN_LEVELS = ['K1', 'K2', 'K3', 'K4', 'K5'] as const

export const GRADE_LEVELS = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
] as const

export const SCHOOL_LEVELS = [...KINDERGARTEN_LEVELS, ...GRADE_LEVELS] as const

export const SCHOOL_DIVISIONS = [
  {
    id: 'kindergarten',
    title: 'Kindergarten',
    levels: 'K1-K5',
    description: 'Early learning from K1 through K5 with faith, play, literacy, numeracy, and character formation.',
  },
  {
    id: 'elementary',
    title: 'Elementary School',
    levels: 'Grade 1-Grade 5',
    description: 'Primary academic foundations across Grade 1 through Grade 5.',
  },
  {
    id: 'middle',
    title: 'Middle School',
    levels: 'Grade 6-Grade 8',
    description: 'Growing independence, study habits, and character across Grade 6 through Grade 8.',
  },
  {
    id: 'high',
    title: 'High School',
    levels: 'Grade 9-Grade 12',
    description: 'College preparation, leadership, and advanced coursework across Grade 9 through Grade 12.',
  },
] as const
