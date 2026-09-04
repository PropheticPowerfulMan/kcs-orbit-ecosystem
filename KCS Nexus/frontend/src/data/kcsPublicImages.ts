const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
const kcsPublicImage = (fileName: string) => `${basePath}images/kcs/${fileName}`

export const kcsPublicImages = {
  logo: kcsPublicImage('logo.png'),
  founder: kcsPublicImage('founder.jpg'),
  assembly: kcsPublicImage('assembly.jpg'),
  retreat: kcsPublicImage('school-retreat.jpg'),
  kindergarten: kcsPublicImage('elementary.jpg'),
  elementary: kcsPublicImage('elementary.jpg'),
  elementaryHome: kcsPublicImage('elementary.jpg'),
  middleSchool: kcsPublicImage('middle-school.jpg'),
  highSchool: kcsPublicImage('high-school.jpg'),
  qualityEducation: kcsPublicImage('quality-education.jpg'),
  graduation: kcsPublicImage('graduation.jpg'),
  spiritualLife: kcsPublicImage('spiritual-life.jpg'),
  annualRetreat: kcsPublicImage('annual-retreat.jpg'),
  springConcert: kcsPublicImage('spring-concert.jpg'),
  usaTrip: kcsPublicImage('usa-trip.jpg'),
  usaTripCopy: kcsPublicImage('usa-trip.jpg'),
  brazzavilleTrip: kcsPublicImage('usa-trip.jpg'),
  thanksgiving: kcsPublicImage('assembly.jpg'),
  campusGlory: kcsPublicImage('spiritual-life.jpg'),
  students: kcsPublicImage('elementary.jpg'),
  teachers: kcsPublicImage('quality-education.jpg'),
  about: kcsPublicImage('assembly.jpg'),
  community: kcsPublicImage('school-retreat.jpg'),
} as const
