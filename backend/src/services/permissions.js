// Role-Based Access Control (SRS RP-01..10, §4.1 permission matrix).
// Permission = Module x Action. A user may hold several roles; the effective
// permission set is the union of all assigned roles (RP-05 / v1 RP-07).

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "print", "send"];

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "admission", label: "Admission" },
  { key: "students", label: "Students" },
  { key: "guardians", label: "Guardians" },
  { key: "idcards", label: "ID Card Center" },
  { key: "certificates", label: "Certificates" },
  { key: "teachers", label: "Teachers" },
  { key: "staff", label: "Staff & HR" },
  { key: "academic", label: "Academic" },
  { key: "routine", label: "Routine" },
  { key: "homework", label: "Homework & Resources" },
  { key: "attendance", label: "Student Attendance" },
  { key: "staff_attendance", label: "Staff Attendance" },
  { key: "devices", label: "Attendance Devices" },
  { key: "leave", label: "Leave Management" },
  { key: "exams", label: "Exams" },
  { key: "marks", label: "Marks Entry" },
  { key: "results", label: "Results" },
  { key: "fees", label: "Fees" },
  { key: "accounts", label: "Accounts" },
  { key: "payroll", label: "Payroll" },
  { key: "communication", label: "Notice & Communication" },
  { key: "library", label: "Library" },
  { key: "inventory", label: "Inventory & Assets" },
  { key: "transport", label: "Transport" },
  { key: "madrasa", label: "Madrasa (Hifz/Salah/Halaqa)" },
  { key: "hostel", label: "Hostel & Meals" },
  { key: "donations", label: "Donations & Funds" },
  { key: "online_classes", label: "Online Classes" },
  { key: "approvals", label: "Approvals" },
  { key: "reports", label: "Reports & Analytics" },
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users & Roles" },
  { key: "audit", label: "Audit Log" },
  { key: "branches", label: "Branches" },
];

const MODULE_KEYS = MODULES.map((m) => m.key);

function full() {
  return [...ACTIONS];
}
const VIEW = ["view"];
const VIEW_EXPORT = ["view", "export", "print"];
const CRUD = ["view", "create", "edit", "export", "print"];
const CRUD_DEL = ["view", "create", "edit", "delete", "export", "print"];

function allModules(actions = ACTIONS) {
  return Object.fromEntries(MODULE_KEYS.map((key) => [key, [...actions]]));
}

// Default roles (SRS v3 RP-01 + v1 §4.4 institution-specific display names).
const DEFAULT_ROLES = [
  {
    name: "School Admin",
    description: "System setup, users/roles and all modules.",
    color: "bg-red-50 text-red-600",
    canViewSensitive: true,
    matrix: allModules(),
  },
  {
    name: "Principal",
    description: "Academic supervision, approvals, monitoring (Head Teacher / Muhtamim / Super).",
    color: "bg-purple-50 text-purple-600",
    canViewSensitive: true,
    matrix: {
      ...allModules(VIEW_EXPORT),
      approvals: ["view", "approve"],
      attendance: ["view", "edit", "approve", "export", "print"],
      results: ["view", "approve", "export", "print", "send"],
      exams: ["view", "approve", "export", "print"],
      marks: ["view", "approve", "export"],
      idcards: ["view", "approve", "print", "export"],
      communication: ["view", "create", "approve", "send"],
      leave: ["view", "approve"],
      certificates: ["view", "approve", "print"],
      fees: ["view", "approve", "export", "print"],
      accounts: ["view", "approve", "export", "print"],
      payroll: ["view", "approve", "export", "print"],
      settings: ["view"],
      users: ["view"],
      audit: ["view", "export"],
    },
  },
  {
    name: "Admission Officer",
    description: "Admission circulars, applications, verification and confirmation.",
    color: "bg-sky-50 text-sky-600",
    matrix: {
      dashboard: VIEW,
      admission: CRUD_DEL,
      students: CRUD,
      guardians: CRUD,
      academic: VIEW,
      reports: VIEW_EXPORT,
    },
  },
  {
    name: "Accountant",
    description: "Fees, invoices, payments, receipts, expenses and cash closing.",
    color: "bg-emerald-50 text-emerald-600",
    canViewSensitive: true,
    matrix: {
      dashboard: VIEW,
      students: VIEW,
      guardians: VIEW,
      fees: ["view", "create", "edit", "export", "print", "send"],
      accounts: CRUD,
      payroll: CRUD,
      donations: CRUD,
      reports: VIEW_EXPORT,
      approvals: VIEW,
    },
  },
  {
    name: "Cashier",
    description: "Counter collection, receipts and daily cash closing.",
    color: "bg-teal-50 text-teal-600",
    matrix: {
      dashboard: VIEW,
      students: VIEW,
      fees: ["view", "create", "print"],
      reports: VIEW,
    },
  },
  {
    name: "Class Teacher",
    description: "Own class students, attendance, leave approval and guardian communication.",
    color: "bg-blue-50 text-blue-600",
    matrix: {
      dashboard: VIEW,
      students: VIEW,
      guardians: VIEW,
      attendance: ["view", "create", "edit"],
      leave: ["view", "approve"],
      marks: ["view", "create", "edit"],
      results: VIEW,
      homework: CRUD_DEL,
      routine: VIEW,
      academic: VIEW,
      communication: ["view", "create", "send"],
      madrasa: CRUD,
      online_classes: CRUD,
      fees: VIEW,
    },
  },
  {
    name: "Subject Teacher",
    description: "Own subject attendance, marks entry and homework.",
    color: "bg-indigo-50 text-indigo-600",
    matrix: {
      dashboard: VIEW,
      students: VIEW,
      attendance: ["view", "create"],
      marks: ["view", "create", "edit"],
      results: VIEW,
      homework: CRUD_DEL,
      routine: VIEW,
      academic: VIEW,
      madrasa: CRUD,
      online_classes: CRUD,
      leave: ["view", "create"],
    },
  },
  {
    name: "Exam Controller",
    description: "Exam setup, marks collection, result processing and publication workflow.",
    color: "bg-amber-50 text-amber-600",
    matrix: {
      dashboard: VIEW,
      students: VIEW,
      academic: VIEW,
      exams: CRUD_DEL,
      marks: ["view", "edit", "export", "print"],
      results: ["view", "create", "edit", "export", "print"],
      reports: VIEW_EXPORT,
    },
  },
  {
    name: "HR / Office Staff",
    description: "Staff records, leave, documents, ID cards and office operations.",
    color: "bg-slate-100 text-slate-700",
    matrix: {
      dashboard: VIEW,
      students: CRUD,
      guardians: CRUD,
      teachers: CRUD,
      staff: CRUD,
      staff_attendance: CRUD,
      leave: CRUD,
      idcards: ["view", "create", "edit", "print", "export"],
      certificates: CRUD,
      inventory: CRUD,
      transport: CRUD,
      hostel: CRUD,
      communication: ["view", "create"],
      reports: VIEW,
    },
  },
  {
    name: "Librarian",
    description: "Book catalog, issue/return and fines.",
    color: "bg-orange-50 text-orange-600",
    matrix: { dashboard: VIEW, library: CRUD_DEL, students: VIEW, reports: VIEW },
  },
  {
    name: "Guardian",
    description: "Linked students' attendance, results, fees, notices (Guardian Portal).",
    color: "bg-pink-50 text-pink-600",
    matrix: {},
  },
  {
    name: "Student",
    description: "Optional student portal: routine, homework, result and notices.",
    color: "bg-lime-50 text-lime-700",
    matrix: {},
  },
];

// Legacy (pre-RBAC) roles that existing databases already contain.
const LEGACY_ROLE_MATRIX = {
  "super admin": allModules(),
  "institute admin": { ...allModules(), settings: ["view"], users: ["view"] },
  teacher: DEFAULT_ROLES.find((r) => r.name === "Subject Teacher").matrix,
  accountant: DEFAULT_ROLES.find((r) => r.name === "Accountant").matrix,
  staff: { dashboard: VIEW, staff: VIEW },
};

const ADMIN_ROLE_NAMES = ["admin", "super admin", "school admin"];

function isAdminRoleName(name) {
  return ADMIN_ROLE_NAMES.includes(String(name || "").toLowerCase());
}

function mergeMatrices(matrices) {
  const result = {};
  for (const matrix of matrices) {
    for (const [module, actions] of Object.entries(matrix || {})) {
      const set = new Set(result[module] || []);
      (Array.isArray(actions) ? actions : []).forEach((a) => set.add(a));
      result[module] = [...set];
    }
  }
  return result;
}

// Converts the old free-text permission list to a matrix so legacy roles keep working.
function legacyPermissionsToMatrix(list = []) {
  const map = {
    Dashboard: { dashboard: VIEW },
    "Dashboard (limited)": { dashboard: VIEW },
    Students: { students: CRUD_DEL, guardians: CRUD },
    Teachers: { teachers: CRUD_DEL },
    Admission: { admission: CRUD_DEL },
    Fees: { fees: CRUD_DEL },
    "Fee Collection": { fees: ["view", "create", "print"] },
    Accounts: { accounts: CRUD_DEL },
    Payroll: { payroll: CRUD_DEL },
    Reports: { reports: VIEW_EXPORT },
    "Financial Reports": { reports: VIEW_EXPORT, accounts: VIEW },
    Settings: { settings: full(), users: full() },
    "Attendance (own classes)": { attendance: ["view", "create", "edit"] },
    "Marks Entry": { marks: ["view", "create", "edit"], exams: VIEW },
    Routine: { routine: VIEW, academic: VIEW },
    "All Modules": allModules(),
  };
  return mergeMatrices(list.map((p) => map[p]).filter(Boolean));
}

function can(matrix, module, action) {
  if (!matrix) return false;
  const actions = matrix[module];
  return Array.isArray(actions) && actions.includes(action);
}

module.exports = {
  ACTIONS,
  MODULES,
  MODULE_KEYS,
  DEFAULT_ROLES,
  LEGACY_ROLE_MATRIX,
  allModules,
  isAdminRoleName,
  mergeMatrices,
  legacyPermissionsToMatrix,
  can,
};
