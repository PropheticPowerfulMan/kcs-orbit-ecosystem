const kcsPublicImage = (path: string) =>
  `https://kinshasachristianschool.netlify.app/${path.split('/').map(encodeURIComponent).join('/')}`

export const kcsPublicImages = {
  logo: kcsPublicImage('Images/logo.png'),
  founder: kcsPublicImage('images/pastjean.jpg'),
  assembly: kcsPublicImage('images/kcs assembly.jpg'),
  retreat: kcsPublicImage('images/kcs retreate.jpg'),
  kindergarten: kcsPublicImage('images/Elementary (1).jpg'),
  elementary: kcsPublicImage('images/Elementary (1).jpg'),
  elementaryHome: kcsPublicImage('images/Elementary (1).jpg'),
  middleSchool: kcsPublicImage('images/kcs46MiddleSchool.jpg'),
  highSchool: kcsPublicImage('images/kcs45HighSchool.jpg'),
  qualityEducation: kcsPublicImage('images/quality educationkcs.jpg'),
  graduation: kcsPublicImage('images/graduation.jpg'),
  spiritualLife: kcsPublicImage('images/spiritual.jpg'),
  annualRetreat: kcsPublicImage('images/retreat.jpg'),
  springConcert: kcsPublicImage('images/spring concert.jpg'),
  usaTrip: kcsPublicImage('images/USA TRIP - Copy.jpg'),
  usaTripCopy: kcsPublicImage('images/USA TRIP - Copy.jpg'),
  brazzavilleTrip: kcsPublicImage('images/USA TRIP - Copy.jpg'),
  thanksgiving: kcsPublicImage('images/kcs assembly.jpg'),
  campusGlory: kcsPublicImage('images/spiritual.jpg'),
  students: kcsPublicImage('images/Elementary (1).jpg'),
  teachers: kcsPublicImage('images/quality educationkcs.jpg'),
  about: kcsPublicImage('images/kcs assembly.jpg'),
  community: kcsPublicImage('images/kcs retreate.jpg'),
} as const
