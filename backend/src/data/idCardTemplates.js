// Ready-made ID card templates (SRS §7.1 IDC-01..05).
// 5 student designs + 5 teacher designs, each in a distinct category.
// Dimensions are CR80 (85.60 x 53.98 mm). `layout` selects the renderer.

const CR80_P = { orientation: "portrait", widthMm: 53.98, heightMm: 85.6 };
const CR80_L = { orientation: "landscape", widthMm: 85.6, heightMm: 53.98 };

const STUDENT_FIELDS = {
  photo: true, name: true, nameBn: false, nameAr: false, studentId: true, className: true, section: true,
  roll: true, session: true, shift: false, group: false, dob: false, bloodGroup: true, guardianPhone: false,
  validity: true,
};
const TEACHER_FIELDS = {
  photo: true, name: true, nameBn: false, employeeId: true, designation: true, department: true,
  bloodGroup: true, phone: true, joinDate: false, email: false, validity: true,
};

const DEFAULT_RULES = [
  "This card is the property of the institution and is non-transferable.",
  "Always carry this card inside the campus.",
  "Loss of this card must be reported to the office immediately.",
];
const DEFAULT_RETURN = "If found, please return to the institution address above.";

function back(colors, extra = {}) {
  return {
    colors,
    showRules: true,
    rules: DEFAULT_RULES,
    showEmergency: true,
    showAddress: true,
    showReturn: true,
    returnText: DEFAULT_RETURN,
    showSignature: true,
    signatureLabel: "Authorized Signature",
    qr: true,
    barcode: true,
    ...extra,
  };
}

function front(layout, colors, fields, extra = {}) {
  return {
    layout,
    colors,
    fontFamily: "Inter",
    fontScale: 1,
    textAlign: "center",
    fields,
    qr: true,
    barcode: false,
    showLogo: true,
    showSignature: false,
    offsets: {},
    fieldStyles: {},
    ...extra,
  };
}

const TEMPLATES = [
  // ------------------------------------------------------------- Students
  {
    templateKey: "student-aurora", name: "Aurora Wave", audience: "Student", category: "Modern",
    description: "Portrait card with a flowing gradient header, circular photo and bold name block.",
    ...CR80_P,
    front: front("aurora", { primary: "#1d4ed8", secondary: "#06b6d4", accent: "#f59e0b", text: "#0f172a", background: "#ffffff" },
      STUDENT_FIELDS, { title: "STUDENT ID CARD" }),
    back: back({ primary: "#1d4ed8", secondary: "#06b6d4", accent: "#f59e0b", text: "#0f172a", background: "#ffffff" }),
    isDefault: true,
  },
  {
    templateKey: "student-heritage", name: "Heritage Crest", audience: "Student", category: "Classic",
    description: "Traditional portrait card with crest, double border and serif typography.",
    ...CR80_P,
    front: front("heritage", { primary: "#7f1d1d", secondary: "#b45309", accent: "#d4a017", text: "#1c1917", background: "#fffbeb" },
      STUDENT_FIELDS, { title: "IDENTITY CARD", fontFamily: "Georgia" }),
    back: back({ primary: "#7f1d1d", secondary: "#b45309", accent: "#d4a017", text: "#1c1917", background: "#fffbeb" }),
  },
  {
    templateKey: "student-slate", name: "Clean Slate", audience: "Student", category: "Minimal",
    description: "Landscape minimal card with a slim accent bar, square photo and lots of white space.",
    ...CR80_L,
    front: front("slate", { primary: "#0f766e", secondary: "#14b8a6", accent: "#0f766e", text: "#111827", background: "#ffffff" },
      STUDENT_FIELDS, { title: "Student", textAlign: "left" }),
    back: back({ primary: "#0f766e", secondary: "#14b8a6", accent: "#0f766e", text: "#111827", background: "#ffffff" }),
  },
  {
    templateKey: "student-rainbow", name: "Rainbow Kids", audience: "Student", category: "Colorful",
    description: "Playful portrait card with confetti shapes – ideal for kindergarten and primary.",
    ...CR80_P,
    front: front("rainbow", { primary: "#db2777", secondary: "#7c3aed", accent: "#facc15", text: "#1e1b4b", background: "#fdf4ff" },
      { ...STUDENT_FIELDS, guardianPhone: true }, { title: "MY SCHOOL CARD" }),
    back: back({ primary: "#db2777", secondary: "#7c3aed", accent: "#facc15", text: "#1e1b4b", background: "#fdf4ff" }),
  },
  {
    templateKey: "student-crescent", name: "Crescent Noor", audience: "Student", category: "Formal",
    description: "Formal portrait card with Islamic geometric pattern – suited for Alia & Qawmi madrasa.",
    ...CR80_P,
    front: front("crescent", { primary: "#065f46", secondary: "#047857", accent: "#d4af37", text: "#022c22", background: "#f0fdf4" },
      { ...STUDENT_FIELDS, nameAr: true }, { title: "بطاقة الطالب · STUDENT CARD" }),
    back: back({ primary: "#065f46", secondary: "#047857", accent: "#d4af37", text: "#022c22", background: "#f0fdf4" }),
  },
  // ------------------------------------------------------------- Teachers
  {
    templateKey: "teacher-executive", name: "Executive Panel", audience: "Teacher", category: "Modern",
    description: "Portrait card with a deep navy side panel, large photo and designation badge.",
    ...CR80_P,
    front: front("executive", { primary: "#0b1f4d", secondary: "#2563eb", accent: "#38bdf8", text: "#0f172a", background: "#ffffff" },
      TEACHER_FIELDS, { title: "FACULTY" }),
    back: back({ primary: "#0b1f4d", secondary: "#2563eb", accent: "#38bdf8", text: "#0f172a", background: "#ffffff" }),
    isDefault: true,
  },
  {
    templateKey: "teacher-faculty", name: "Faculty Classic", audience: "Teacher", category: "Classic",
    description: "Landscape classic card with institution header band and serif details table.",
    ...CR80_L,
    front: front("faculty", { primary: "#1e3a8a", secondary: "#93c5fd", accent: "#b91c1c", text: "#111827", background: "#f8fafc" },
      TEACHER_FIELDS, { title: "TEACHER IDENTITY CARD", fontFamily: "Georgia", textAlign: "left" }),
    back: back({ primary: "#1e3a8a", secondary: "#93c5fd", accent: "#b91c1c", text: "#111827", background: "#f8fafc" }),
  },
  {
    templateKey: "teacher-mono", name: "Mono Line", audience: "Teacher", category: "Minimal",
    description: "Portrait minimal card in monochrome with hairline dividers.",
    ...CR80_P,
    front: front("mono", { primary: "#111827", secondary: "#6b7280", accent: "#111827", text: "#111827", background: "#ffffff" },
      TEACHER_FIELDS, { title: "STAFF" }),
    back: back({ primary: "#111827", secondary: "#6b7280", accent: "#111827", text: "#111827", background: "#ffffff" }),
  },
  {
    templateKey: "teacher-prism", name: "Prism Diagonal", audience: "Teacher", category: "Colorful",
    description: "Landscape card with vibrant diagonal colour blocks and rounded photo.",
    ...CR80_L,
    front: front("prism", { primary: "#ea580c", secondary: "#9333ea", accent: "#0891b2", text: "#1f2937", background: "#ffffff" },
      TEACHER_FIELDS, { title: "TEACHER", textAlign: "left" }),
    back: back({ primary: "#ea580c", secondary: "#9333ea", accent: "#0891b2", text: "#1f2937", background: "#ffffff" }),
  },
  {
    templateKey: "teacher-royal", name: "Royal Seal", audience: "Teacher", category: "Formal",
    description: "Formal portrait card in navy and gold with seal ribbon – suited for principals and madrasa ustads.",
    ...CR80_P,
    front: front("royal", { primary: "#172554", secondary: "#1e40af", accent: "#ca8a04", text: "#0f172a", background: "#fefce8" },
      TEACHER_FIELDS, { title: "OFFICIAL IDENTITY CARD", fontFamily: "Georgia" }),
    back: back({ primary: "#172554", secondary: "#1e40af", accent: "#ca8a04", text: "#0f172a", background: "#fefce8" }),
  },
];

module.exports = { TEMPLATES };
