// Institution-type presets (SRS v1 PC-14/19, §11; v3 §27). Selecting a type
// creates default levels/classes, subjects (with marks components), grade
// scale, fee heads and role display names. Everything stays editable.

const CQ_MCQ = [
  { key: "cq", label: "Creative (CQ)", fullMarks: 70, passMarks: 23 },
  { key: "mcq", label: "MCQ", fullMarks: 30, passMarks: 10 },
];
const CQ_MCQ_PRAC = [
  { key: "cq", label: "Creative (CQ)", fullMarks: 50, passMarks: 17 },
  { key: "mcq", label: "MCQ", fullMarks: 25, passMarks: 8 },
  { key: "practical", label: "Practical", fullMarks: 25, passMarks: 8 },
];
const WRITTEN_ORAL = [
  { key: "written", label: "Written", fullMarks: 80, passMarks: 26 },
  { key: "oral", label: "Oral / CA", fullMarks: 20, passMarks: 7 },
];
const PAPER_COURSEWORK = [
  { key: "paper", label: "Paper", fullMarks: 80, passMarks: null },
  { key: "coursework", label: "Coursework", fullMarks: 20, passMarks: null },
];

function range(prefix, from, to, extra = {}) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push({ name: `${prefix} ${i}`, level: extra.level, ...extra });
  return out;
}

const GENERAL_SUBJECTS = [
  { code: "BAN1", name: "Bangla 1st Paper", nameBn: "বাংলা ১ম পত্র", components: CQ_MCQ },
  { code: "BAN2", name: "Bangla 2nd Paper", nameBn: "বাংলা ২য় পত্র", components: CQ_MCQ },
  { code: "ENG1", name: "English 1st Paper", nameBn: "ইংরেজি ১ম পত্র" },
  { code: "ENG2", name: "English 2nd Paper", nameBn: "ইংরেজি ২য় পত্র" },
  { code: "MATH", name: "Mathematics", nameBn: "গণিত", components: CQ_MCQ },
  { code: "GSCI", name: "General Science", nameBn: "সাধারণ বিজ্ঞান", components: CQ_MCQ },
  { code: "BGS", name: "Bangladesh & Global Studies", nameBn: "বাংলাদেশ ও বিশ্বপরিচয়", components: CQ_MCQ },
  { code: "REL", name: "Islam & Moral Education", nameBn: "ইসলাম ও নৈতিক শিক্ষা", components: CQ_MCQ, isReligious: true },
  { code: "HREL", name: "Hindu Religion & Moral Education", nameBn: "হিন্দুধর্ম ও নৈতিক শিক্ষা", components: CQ_MCQ, isReligious: true },
  { code: "ICT", name: "Information & Communication Technology", nameBn: "তথ্য ও যোগাযোগ প্রযুক্তি", fullMarks: 50, passMarks: 17 },
  { code: "PHY", name: "Physics", nameBn: "পদার্থবিজ্ঞান", components: CQ_MCQ_PRAC, group: "Science" },
  { code: "CHEM", name: "Chemistry", nameBn: "রসায়ন", components: CQ_MCQ_PRAC, group: "Science" },
  { code: "BIO", name: "Biology", nameBn: "জীববিজ্ঞান", components: CQ_MCQ_PRAC, group: "Science", optional: true },
  { code: "HMATH", name: "Higher Mathematics", nameBn: "উচ্চতর গণিত", components: CQ_MCQ_PRAC, group: "Science", optional: true },
  { code: "ACC", name: "Accounting", nameBn: "হিসাববিজ্ঞান", components: CQ_MCQ, group: "Business Studies" },
  { code: "FIN", name: "Finance & Banking", nameBn: "ফিন্যান্স ও ব্যাংকিং", components: CQ_MCQ, group: "Business Studies" },
  { code: "BENT", name: "Business Entrepreneurship", nameBn: "ব্যবসায় উদ্যোগ", components: CQ_MCQ, group: "Business Studies" },
  { code: "HIST", name: "History of Bangladesh & World Civilization", nameBn: "বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা", components: CQ_MCQ, group: "Humanities" },
  { code: "GEO", name: "Geography & Environment", nameBn: "ভূগোল ও পরিবেশ", components: CQ_MCQ, group: "Humanities" },
  { code: "CIV", name: "Civics & Citizenship", nameBn: "পৌরনীতি ও নাগরিকতা", components: CQ_MCQ, group: "Humanities" },
  { code: "AGRI", name: "Agriculture Studies", nameBn: "কৃষিশিক্ষা", components: CQ_MCQ_PRAC, optional: true },
];

const PRESETS = {
  "Bangla Medium": {
    label: "General Line – Bangla Medium (NCTB)",
    gradeTemplate: "nctb_gpa5",
    classes: [
      ...range("Class", 1, 5, { level: "Primary" }),
      ...range("Class", 6, 8, { level: "Junior Secondary" }),
      ...range("Class", 9, 10, { level: "Secondary (SSC)", hasGroups: true }),
    ],
    groups: ["Science", "Humanities", "Business Studies"],
    subjects: GENERAL_SUBJECTS,
    feeHeads: ["Admission Fee", "Session Fee", "Tuition Fee", "Exam Fee", "Library Fee", "Transport Fee", "Development Fee", "Late Fine", "Board Registration Fee", "Others"],
    roleNames: {},
  },
  "English Version": {
    label: "General Line – English Version (NCTB)",
    gradeTemplate: "nctb_gpa5",
    classes: [
      ...range("Class", 1, 5, { level: "Primary", version: "English" }),
      ...range("Class", 6, 8, { level: "Junior Secondary", version: "English" }),
      ...range("Class", 9, 10, { level: "Secondary (SSC)", hasGroups: true, version: "English" }),
    ].map((c) => ({ ...c, name: `${c.name} (EV)` })),
    groups: ["Science", "Humanities", "Business Studies"],
    subjects: GENERAL_SUBJECTS.map((s) => ({ ...s, code: `EV-${s.code}` })),
    feeHeads: ["Admission Fee", "Session Fee", "Tuition Fee", "Exam Fee", "Development Fee", "Late Fine", "Others"],
    roleNames: {},
  },
  "English Medium": {
    label: "English Medium (Cambridge / Edexcel)",
    gradeTemplate: "cambridge_letter",
    classes: [
      { name: "Playgroup", level: "Pre-school" }, { name: "Nursery", level: "Pre-school" }, { name: "KG", level: "Pre-school" },
      ...range("Grade", 1, 8, { level: "Primary & Middle" }),
      { name: "O Level (Year 1)", level: "O Level" }, { name: "O Level (Year 2)", level: "O Level" },
      { name: "A Level (AS)", level: "A Level" }, { name: "A Level (A2)", level: "A Level" },
    ],
    groups: [],
    subjects: [
      { code: "EM-ENGL", name: "English Language", components: PAPER_COURSEWORK },
      { code: "EM-ENLIT", name: "English Literature", components: PAPER_COURSEWORK },
      { code: "EM-MATH", name: "Mathematics" },
      { code: "EM-PHY", name: "Physics", components: PAPER_COURSEWORK },
      { code: "EM-CHEM", name: "Chemistry", components: PAPER_COURSEWORK },
      { code: "EM-BIO", name: "Biology", components: PAPER_COURSEWORK },
      { code: "EM-CS", name: "Computer Science", components: PAPER_COURSEWORK },
      { code: "EM-BAN", name: "Bangla" },
      { code: "EM-ISL", name: "Islamiyat", isReligious: true },
      { code: "EM-ACC", name: "Accounting" },
      { code: "EM-ECO", name: "Economics" },
      { code: "EM-BUS", name: "Business Studies" },
    ],
    feeHeads: ["Admission Fee", "Term Fee", "Tuition Fee", "Development Fee", "Security Deposit (Refundable)", "Exam Entry Fee", "Transport Fee", "Late Fine", "Others"],
    roleNames: { "Class Teacher": "Homeroom Teacher", "Exam Controller": "Exam Officer" },
  },
  "Alia Madrasa": {
    label: "Alia Madrasa (BMEB)",
    gradeTemplate: "bmeb_gpa5",
    classes: [
      ...range("Ebtedayi", 1, 5, { level: "Ebtedayi" }),
      ...range("Dakhil", 6, 10, { level: "Dakhil", hasGroups: true }),
      { name: "Alim 1st Year", level: "Alim", hasGroups: true }, { name: "Alim 2nd Year", level: "Alim", hasGroups: true },
      { name: "Fazil", level: "Fazil" }, { name: "Kamil", level: "Kamil" },
    ],
    groups: ["General", "Science", "Mujabbid", "Hifzul Quran"],
    subjects: [
      { code: "AM-QUR", name: "Quran Majid & Tajweed", nameBn: "কুরআন মজিদ ও তাজবিদ", nameAr: "القرآن المجيد والتجويد", components: WRITTEN_ORAL, isReligious: true },
      { code: "AM-HAD", name: "Hadith Sharif", nameBn: "হাদিস শরিফ", nameAr: "الحديث الشريف", isReligious: true },
      { code: "AM-AQF", name: "Aqaid & Fiqh", nameBn: "আকাইদ ও ফিকহ", nameAr: "العقائد والفقه", isReligious: true },
      { code: "AM-AR1", name: "Arabic 1st Paper", nameBn: "আরবি ১ম পত্র", nameAr: "اللغة العربية الورقة الأولى" },
      { code: "AM-AR2", name: "Arabic 2nd Paper", nameBn: "আরবি ২য় পত্র", nameAr: "اللغة العربية الورقة الثانية" },
      { code: "AM-BAN", name: "Bangla", nameBn: "বাংলা", components: CQ_MCQ },
      { code: "AM-ENG", name: "English", nameBn: "ইংরেজি" },
      { code: "AM-MATH", name: "Mathematics", nameBn: "গণিত", components: CQ_MCQ },
      { code: "AM-SCI", name: "General Science", nameBn: "সাধারণ বিজ্ঞান", components: CQ_MCQ },
      { code: "AM-BGS", name: "Bangladesh & Global Studies", nameBn: "বাংলাদেশ ও বিশ্বপরিচয়", components: CQ_MCQ },
      { code: "AM-ICT", name: "ICT", nameBn: "তথ্য ও যোগাযোগ প্রযুক্তি", fullMarks: 50, passMarks: 17 },
      { code: "AM-ISH", name: "Islamic History", nameBn: "ইসলামের ইতিহাস", optional: true },
    ],
    feeHeads: ["Admission Fee", "Session Fee", "Tuition Fee", "Exam Fee", "Board Registration Fee", "Hostel Fee", "Development Fee", "Late Fine", "Others"],
    roleNames: { Principal: "Principal / Super" },
    modules: ["madrasa", "hostel", "donations"],
  },
  "Qawmi Madrasa": {
    label: "Qawmi Madrasa (Befaq / Al-Haiatul Ulya)",
    gradeTemplate: "qawmi_division",
    classes: [
      { name: "Nurani", level: "Nurani" }, { name: "Nazera", level: "Nazera" }, { name: "Hifzul Quran", level: "Hifz" },
      { name: "Ibtedaiyah", level: "Ibtedaiyah (Marhala)" }, { name: "Mutawassitah", level: "Mutawassitah (Marhala)" },
      { name: "Sanabia Ulya", level: "Sanabia Ulya (Marhala)" }, { name: "Fazilat", level: "Fazilat (Marhala)" },
      { name: "Takmil (Dawrah Hadith)", level: "Takmil (Marhala)" },
    ],
    groups: [],
    subjects: [
      { code: "QM-NAZ", name: "Quran Nazera", nameAr: "القرآن ناظرة", kitab: "Quran Majid", isReligious: true, components: WRITTEN_ORAL },
      { code: "QM-TAJ", name: "Tajweed", nameAr: "التجويد", kitab: "Jamalul Quran", isReligious: true },
      { code: "QM-NAHU", name: "Nahw (Arabic Grammar)", nameAr: "النحو", kitab: "Hidayatun Nahu" },
      { code: "QM-KAF", name: "Nahw Advanced", nameAr: "الكافية", kitab: "Kafiya" },
      { code: "QM-SARF", name: "Sarf (Morphology)", nameAr: "الصرف", kitab: "Ilmus Sigah" },
      { code: "QM-FIQ1", name: "Fiqh", nameAr: "الفقه", kitab: "Nurul Izah / Quduri" },
      { code: "QM-USUL", name: "Usul al-Fiqh", nameAr: "أصول الفقه", kitab: "Usulush Shashi" },
      { code: "QM-TAF", name: "Tafsir", nameAr: "التفسير", kitab: "Jalalain" },
      { code: "QM-HAD1", name: "Hadith", nameAr: "الحديث", kitab: "Mishkatul Masabih" },
      { code: "QM-BUK", name: "Sahih al-Bukhari", nameAr: "صحيح البخاري", kitab: "Bukhari Sharif" },
      { code: "QM-ADAB", name: "Arabic Literature", nameAr: "الأدب العربي", kitab: "Nafhatul Arab" },
      { code: "QM-URDU", name: "Urdu", kitab: "Urdu Qaida" },
      { code: "QM-BAN", name: "Bangla" },
      { code: "QM-MATH", name: "Mathematics" },
    ],
    feeHeads: ["Admission Fee", "Monthly Fee", "Exam Fee", "Boarding (Darul Iqama) Fee", "Khana (Matbakh) Fee", "Befaq Registration Fee", "Others"],
    roleNames: { Principal: "Muhtamim", "Exam Controller": "Nazim-e-Talimat", "HR / Office Staff": "Nazim", Accountant: "Hishab Rokkhok", "Class Teacher": "Ustad (Class)", "Subject Teacher": "Ustad / Mudarris" },
    modules: ["madrasa", "hostel", "donations"],
    calendar: "Hijri",
  },
  Kindergarten: {
    label: "Kindergarten / Pre-school",
    gradeTemplate: "kindergarten",
    classes: [
      { name: "Playgroup", level: "Pre-school" }, { name: "Nursery", level: "Pre-school" },
      { name: "KG-1", level: "Kindergarten" }, { name: "KG-2", level: "Kindergarten" },
    ],
    groups: [],
    subjects: [
      { code: "KG-ENG", name: "English (Rhymes & Letters)" },
      { code: "KG-BAN", name: "Bangla (Chhora & Borno)" },
      { code: "KG-MATH", name: "Numbers & Maths" },
      { code: "KG-ART", name: "Drawing & Colouring" },
      { code: "KG-GK", name: "General Knowledge" },
      { code: "KG-ARB", name: "Arabic (Qaida)", isReligious: true },
    ],
    feeHeads: ["Admission Fee", "Tuition Fee", "Activity Fee", "Tiffin Fee", "Transport Fee", "Others"],
    roleNames: { "Class Teacher": "Class Teacher (Miss)" },
  },
  College: {
    label: "College – Higher Secondary (HSC)",
    gradeTemplate: "nctb_gpa5",
    classes: [
      { name: "Class 11 (HSC 1st Year)", level: "Higher Secondary", hasGroups: true },
      { name: "Class 12 (HSC 2nd Year)", level: "Higher Secondary", hasGroups: true },
    ],
    groups: ["Science", "Humanities", "Business Studies"],
    subjects: [
      { code: "HSC-BAN1", name: "Bangla 1st Paper (HSC)", components: CQ_MCQ },
      { code: "HSC-BAN2", name: "Bangla 2nd Paper (HSC)", components: CQ_MCQ },
      { code: "HSC-ENG1", name: "English 1st Paper (HSC)" },
      { code: "HSC-ENG2", name: "English 2nd Paper (HSC)" },
      { code: "HSC-ICT", name: "ICT (HSC)", components: CQ_MCQ_PRAC },
      { code: "HSC-PHY1", name: "Physics 1st Paper", components: CQ_MCQ_PRAC, group: "Science" },
      { code: "HSC-CHEM1", name: "Chemistry 1st Paper", components: CQ_MCQ_PRAC, group: "Science" },
      { code: "HSC-BIO1", name: "Biology 1st Paper", components: CQ_MCQ_PRAC, group: "Science", optional: true },
      { code: "HSC-HMATH1", name: "Higher Math 1st Paper", components: CQ_MCQ_PRAC, group: "Science", optional: true },
      { code: "HSC-ACC1", name: "Accounting 1st Paper", components: CQ_MCQ, group: "Business Studies" },
      { code: "HSC-ECO1", name: "Economics 1st Paper", components: CQ_MCQ, group: "Humanities" },
    ],
    feeHeads: ["Admission Fee", "Session Fee", "Tuition Fee", "Exam Fee", "Board Form Fill-up Fee", "Late Fine", "Others"],
    roleNames: {},
  },
};

const INSTITUTION_TYPES = Object.keys(PRESETS);

module.exports = { PRESETS, INSTITUTION_TYPES };
