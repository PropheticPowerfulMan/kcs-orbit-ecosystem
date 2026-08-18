const kcsPublicImage = (path: string) =>
  `https://kinshasachristianschool.org/${path.split('/').map(encodeURIComponent).join('/')}`

export const kcsPublicImages = {
  logo: kcsPublicImage('Images/logo.png'),
  founder: kcsPublicImage('Images/pastjean.jpg'),
  assembly: kcsPublicImage('Images/kcs assembly.jpg'),
  retreat: kcsPublicImage('Images/kcs retreate.jpg'),
  kindergarten: kcsPublicImage('Images/Elementary (1).jpg'),
  elementary: kcsPublicImage('Images/Elementary (1).jpg'),
  elementaryHome: kcsPublicImage('Images/Elementary (1).jpg'),
  middleSchool: kcsPublicImage('Images/kcs46MiddleSchool.jpg'),
  highSchool: kcsPublicImage('Images/kcs45HighSchool.jpg'),
  qualityEducation: kcsPublicImage('Images/quality educationkcs.jpg'),
  graduation: kcsPublicImage('Images/graduation.jpg'),
  spiritualLife: kcsPublicImage('Images/spiritual.jpg'),
  annualRetreat: kcsPublicImage('Images/retreat.jpg'),
  springConcert: kcsPublicImage('Images/spring concert.jpg'),
  usaTrip: kcsPublicImage('Images/USA TRIP - Copy.jpg'),
  usaTripCopy: kcsPublicImage('Images/USA TRIP - Copy.jpg'),
  brazzavilleTrip: kcsPublicImage('Images/brazza2.jpg'),
  thanksgiving: kcsPublicImage('Images/Thanksgiving.jpg'),
  campusGlory: kcsPublicImage('Images/kcsglo.jpg'),
  students: kcsPublicImage('Images/m7lvsvba.png'),
  teachers: kcsPublicImage('Images/teachers.JPG'),
  about: kcsPublicImage('Images/aboutuss.jpg'),
  community: kcsPublicImage('Images/about us.jpg'),
} as const
