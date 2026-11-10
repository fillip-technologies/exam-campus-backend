/**
 * Home page copy that the frontend keeps inside its JSX section components (not in src/data/*), transcribed
 * as-is from exam-campus-frontend/src/pages/Home/sections/* and components/layout/*. After the frontend reads
 * from the API, these values live only in the database and the admin edits them there.
 */

export const site = {
  siteName: 'ExamCampus',
  tagline: 'One Campus All Exam',
  logoMarkUrl: '/images/brand/logo-mark.png',
  logoWordmarkUrl: '/images/brand/logo-wordmark.png',
  headerLoginLabel: 'Login',
  headerCtaLabel: 'Start Learning',
  headerCtaAnchor: 'start',
  searchPlaceholder: 'Search exam, class or test series',
  footerTagline: 'Test series and online practice for government and competitive exams.',
  copyrightText: 'ExamCampus. All rights reserved.',
  developerName: 'Fillip Technologies',
  developerUrl: 'https://filliptechnologies.com/',
  developerLogoUrl: '/images/brand/fillip-technologies.png',
}

export const announcement = {
  text: 'Learn, Practice & Prepare for Every Important Exam — All in One Place',
  mobileText: 'Every important exam, all in one place',
  ctaLabel: 'Explore Free Tests',
  anchor: 'free-tests',
  theme: 'dark',
}

/** Placeholder pass from lib/products.js + benefits from TestPass.jsx. */
export const pass = {
  slug: 'pass',
  title: 'ExamCampus Pass',
  validityMonths: 12,
  price: 1999,
  mrp: 5999,
  benefits: [
    'Access to every test series across all exams',
    'Full-length, sectional and topic-wise tests',
    'Previous year papers with solutions',
    'Detailed analysis after every test',
  ],
}

export const homeFaqs = [
  {
    q: 'What is a test series?',
    a: 'A test series is a set of mock tests designed around a specific exam. It helps you practise the paper pattern, manage your time and see how you are performing before the real exam.',
  },
  {
    q: 'What is included in an ExamCampus test series?',
    a: 'Each test series includes full-length mock tests, sectional tests, topic-wise tests and previous year papers, along with a detailed analysis after every test.',
  },
  {
    q: 'How do I take a test?',
    a: 'After enrolling, log in to your account and open the test from My Tests. The test runs online in a timed exam-style interface that works on your phone, tablet or computer.',
  },
  {
    q: 'Can I try a test before buying a test series?',
    a: 'Yes. You can take free mock tests for popular exams to experience the platform before you purchase a test series.',
  },
  {
    q: 'In which languages are the tests available?',
    a: 'Tests are available in Hindi and English. The language options for each test series are shown on its details page.',
  },
  {
    q: 'Will I get solutions and performance analysis?',
    a: 'Yes. After submitting a test you can see your score, accuracy, time taken, subject-wise performance and detailed solutions for every question.',
  },
  {
    q: 'How long is a test series valid?',
    a: 'The validity depends on the test series or plan you choose and is shown on its details page before you buy.',
  },
  {
    q: 'How can I contact support?',
    a: 'You can reach our support team through the Contact Us page. We will help you with enrolment, access to your tests and any other questions.',
  },
]

type Item = {
  role?: 'ITEM' | 'CTA_PRIMARY' | 'CTA_SECONDARY'
  iconKey?: string
  title?: string
  text?: string
  anchor?: string
}

export type SectionSeed = {
  key: string
  type:
    | 'HERO'
    | 'WHY_POINTS'
    | 'EXAM_CATEGORIES'
    | 'PASS'
    | 'FREE_TESTS'
    | 'EXAM_EXPERIENCE'
    | 'MOBILE_APP'
    | 'FAQ'
    | 'FINAL_CTA'
  anchorId?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
  config?: Record<string, unknown>
  items?: Item[]
}

/** Sections in the order of HomePage.jsx. */
export const homeSections: SectionSeed[] = [
  {
    key: 'hero',
    type: 'HERO',
    anchorId: 'home',
    title: 'Online test series for competitive and school exams',
    config: { seriesAnchorId: 'test-series' },
    items: [
      { role: 'CTA_PRIMARY', iconKey: 'PlayCircle', title: 'Take a Free Test', anchor: 'free-tests' },
      { role: 'CTA_SECONDARY', title: 'View All', anchor: 'all-test-series' },
    ],
  },
  {
    key: 'why',
    type: 'WHY_POINTS',
    title: 'Why practise on ExamCampus',
    items: [
      { iconKey: 'MonitorCheck', title: 'Real exam interface', text: 'Practise on a timed test screen that follows the actual exam pattern.' },
      { iconKey: 'FileCheck2', title: 'Detailed solutions', text: 'Every question comes with a clear solution you can review after the test.' },
      { iconKey: 'BarChart3', title: 'Analysis after every test', text: 'See your score, accuracy and weak areas as soon as you submit.' },
      { iconKey: 'Languages', title: 'Hindi and English', text: 'Choose the language you are most comfortable with.' },
    ],
  },
  {
    key: 'exams',
    type: 'EXAM_CATEGORIES',
    anchorId: 'exams',
    title: 'Popular Exams',
    subtitle: 'Pick your exam to see its test series, free mock tests, previous year papers and exam details.',
    config: { examsPerCard: 5 },
    items: [{ role: 'CTA_PRIMARY', title: 'Explore all exams', text: 'Browse the full exam directory', anchor: 'all-exams' }],
  },
  {
    key: 'pass',
    type: 'PASS',
    anchorId: 'pass',
    eyebrow: 'ExamCampus Pass',
    title: 'All Test Series. One Pass.',
    subtitle: 'Preparing for more than one exam? Get unlimited access to test series across exams with a single pass.',
    config: { buttonLabel: 'Get ExamCampus Pass', secondaryLabel: 'See what is included', validityNote: 'Valid on all test series for 12 months.' },
  },
  {
    key: 'free-tests',
    type: 'FREE_TESTS',
    anchorId: 'free-tests',
    title: 'Start Practising for Free.',
    subtitle: 'Take a free mock test, experience the ExamCampus test platform and start preparing for your exam today.',
    config: {
      maxRows: 5,
      allFilterLabel: 'All',
      featuredHighlights: ['Full-length paper in the real exam format', 'Instant score and answer review'],
      emptyRowsMessage: 'This is the only free test in this category for now. Explore all free tests to try more exams.',
    },
    items: [{ role: 'CTA_PRIMARY', title: 'Explore All Free Tests', anchor: 'all-free-tests' }],
  },
  {
    key: 'experience',
    type: 'EXAM_EXPERIENCE',
    anchorId: 'free-test',
    title: 'Practice Like It’s the Real Exam.',
    subtitle: 'Experience a focused test environment designed to help you practise, manage your time and perform with confidence.',
    config: {
      preview: {
        title: 'SBI PO Prelims · Full Mock 12',
        meta: '100 questions · 60 minutes',
        totalQuestions: 100,
        marking: { correct: '+1', wrong: '−0.25' },
        sections: ['English Language', 'Quantitative Aptitude', 'Reasoning Ability'],
        questions: [
          { n: 11, text: 'Find the next number in the series: 3, 6, 12, 24, ?', options: ['36', '42', '48', '60'] },
          { n: 12, text: 'A train 150 m long passes a pole in 15 seconds. What is the speed of the train in km/h?', options: ['36', '40', '45', '54'] },
          { n: 13, text: 'The simple interest on ₹8,000 for 3 years is ₹2,400. What is the rate of interest per annum?', options: ['8%', '10%', '12%', '15%'] },
        ],
      },
    },
    items: [
      { iconKey: 'Timer', title: 'Timed Test Experience', text: 'Practice managing your time in a focused exam environment.' },
      { iconKey: 'LayoutGrid', title: 'Easy Question Navigation', text: 'Move between questions and keep track of your progress.' },
      { iconKey: 'BarChart3', title: 'Detailed Performance Analysis', text: 'Understand your score, accuracy and performance after every test.' },
      { iconKey: 'Target', title: 'Learn From Every Attempt', text: 'Identify areas that need more practice and prepare smarter.' },
      { role: 'CTA_PRIMARY', title: 'Try a Free Test', anchor: 'free-tests' },
    ],
  },
  {
    key: 'app',
    type: 'MOBILE_APP',
    anchorId: 'app',
    title: 'The ExamCampus app is',
    body: 'Practise mock tests and test series on your phone, wherever you are. Get notified the moment the app is live.',
    config: {
      mode: 'WAITLIST',
      badge: 'Launching soon',
      highlight: 'on its way.',
      formLabel: 'Get notified at launch',
      placeholder: 'Enter your email address',
      buttonLabel: 'Notify Me',
      successMessage: 'Thanks! We’ll let you know when the app launches.',
      playStoreUrl: null,
      appStoreUrl: null,
    },
    items: [
      { iconKey: 'ClipboardCheck', text: 'Take mock tests anywhere' },
      { iconKey: 'BarChart3', text: 'Track your progress after every test' },
      { iconKey: 'Smartphone', text: 'Smooth, exam-style experience on your phone' },
    ],
  },
  {
    key: 'faq',
    type: 'FAQ',
    anchorId: 'faq',
    title: 'Frequently Asked Questions',
    subtitle: 'Can’t find what you are looking for? Visit our Contact Us page.',
    items: [{ role: 'CTA_PRIMARY', title: 'Contact Us', anchor: 'contact' }],
  },
  {
    key: 'final-cta',
    type: 'FINAL_CTA',
    title: 'Start your preparation today.',
    subtitle: 'Take a free mock test and see how ExamCampus helps you practise for your exam.',
    items: [
      { role: 'CTA_PRIMARY', title: 'Take a Free Test', anchor: 'free-tests' },
      { role: 'CTA_SECONDARY', title: 'Explore Test Series', anchor: 'test-series' },
    ],
  },
]

/** Footer.jsx. `exam` = link to that exam hub by name; `anchor` = same-page hash link as today. */
export const footer = {
  columns: [
    { title: 'Popular Exams', links: ['SBI PO', 'IBPS PO', 'SSC CGL', 'RRB NTPC', 'BPSC TRE', 'CTET', 'UPSC CSE', 'NDA'].map((exam) => ({ label: exam, exam })) },
    {
      title: 'Test Series',
      links: ['Banking & Insurance', 'SSC', 'Teaching', 'Railway', 'UPSC & State PSC', 'Defence'].map((label) => ({ label, anchor: 'test-series' })),
    },
    {
      title: 'Free Resources',
      links: [
        { label: 'Free Mock Tests', anchor: 'free-tests' },
        { label: 'Previous Year Papers', anchor: 'test-series' },
        { label: 'Exam Notifications', anchor: 'notifications' },
        { label: 'Syllabus & Exam Pattern', anchor: 'syllabus' },
        { label: 'Results', anchor: 'results' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', anchor: 'about' },
        { label: 'Contact Us', anchor: 'contact' },
        { label: 'Blog', anchor: 'blog' },
        { label: 'Campus Store', anchor: 'campus-store' },
        { label: 'Help & Support', anchor: 'faq' },
      ],
    },
  ] as { title: string; links: { label: string; exam?: string; anchor?: string }[] }[],
  legal: ['Terms of Use', 'Privacy Policy', 'Refund Policy'],
  // Today these are "#youtube"-style placeholders; replace with the real profile URLs in the admin.
  social: ['YouTube', 'Instagram', 'Facebook', 'Telegram'],
}

/** Conducting-body names for the org keys used by the frontend. Unknown keys get the key in capitals; edit in the admin. */
export const orgNames: Record<string, string> = {
  sbi: 'State Bank of India',
  ibps: 'Institute of Banking Personnel Selection',
  rbi: 'Reserve Bank of India',
  lic: 'Life Insurance Corporation of India',
  ssc: 'Staff Selection Commission',
  upsc: 'Union Public Service Commission',
  bpsc: 'Bihar Public Service Commission',
  rrb: 'Railway Recruitment Board',
  cbse: 'Central Board of Secondary Education',
  nta: 'National Testing Agency',
}
