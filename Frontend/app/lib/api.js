const API_BASE = "/api/backend";
const LEGACY_ACADEMIC_STORAGE_KEYS = [
  "edumanage-academic-classes",
  "edumanage-academic-subjects",
  "edumanage-academic-years",
  "edumanage-academic-settings",
  "edumanage-academic-assignments",
];
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(typeof window !== "undefined" && localStorage.getItem("edumanage-token")
        ? { "Authorization": `Bearer ${localStorage.getItem("edumanage-token")}` }
        : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent("edumanage:session-expired"));
    }
    const error = new Error(payload?.message || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.details = payload?.details;
    error.code = payload?.code;
    throw error;
  }
  return payload;
}

export { request };

// Generic CRUD helper for config-driven screens.
// A list some roles may not read (e.g. teachers viewing the teacher list): use [] instead of
// failing the whole page. Any other error still surfaces.
export const optionalList = (promise, fallback = []) =>
  promise.catch((e) => (e?.status === 403 ? fallback : Promise.reject(e)));

export function resource(path) {
  return {
    list: (params = {}) => {
      const q = new URLSearchParams(Object.entries({ page: 1, limit: 200, ...params }).filter(([, v]) => v !== undefined && v !== null && v !== ""));
      return request(`${path}?${q.toString()}`).then((p) => p);
    },
    all: (params = {}) => {
      const q = new URLSearchParams(Object.entries({ page: 1, limit: 1000, ...params }).filter(([, v]) => v !== undefined && v !== null && v !== ""));
      return request(`${path}?${q.toString()}`).then((p) => p.data);
    },
    get: (id) => request(`${path}/${id}`).then((p) => p.data),
    create: (data) => request(path, { method: "POST", body: JSON.stringify(data) }).then((p) => p?.data),
    update: (id, data) => request(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(data) }).then((p) => p?.data),
    remove: (id) => request(`${path}/${id}`, { method: "DELETE" }),
  };
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) }).then((p) => p?.data ?? p);
const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body || {}) }).then((p) => p?.data ?? p);
const patch = (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body || {}) }).then((p) => p?.data ?? p);
const get = (path, params) => {
  const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()}` : "";
  return request(`${path}${q}`).then((p) => p?.data ?? p);
};
const del = (path, params) => {
  const q = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()}` : "";
  return request(`${path}${q}`, { method: "DELETE" }).then((p) => p?.data ?? p);
};
export const http = { get, post, put, patch, del };

export const setupApi = {
  types: () => get("/setup/institution-types"),
  applyPreset: (types) => post("/setup/apply-preset", { types }),
  session: (id, action) => post(`/setup/sessions/${id}/${action}`),
  modules: () => get("/setup/modules"),
};

export const approvalsApi = {
  list: (status = "Pending", type) => get("/approvals", { status, type }),
  summary: () => get("/approvals/summary"),
  decide: (id, decision, note) => post(`/approvals/${id}/decide`, { decision, note }),
  resubmit: (id, note, payload) => post(`/approvals/${id}/resubmit`, { note, payload }),
  cancel: (id, note) => post(`/approvals/${id}/cancel`, { note }),
};

export const auditApi = { list: (params) => request(`/audit-logs?${new URLSearchParams(params || {}).toString()}`) };

export const idCardsApi = {
  templates: (params) => get("/idcards/templates", params),
  template: (id) => get(`/idcards/templates/${id}`),
  duplicate: (id, data) => post(`/idcards/templates/${id}/duplicate`, data),
  saveDraft: (id, data) => patch(`/idcards/templates/${id}`, data),
  publish: (id) => post(`/idcards/templates/${id}/publish`),
  setDefault: (id) => post(`/idcards/templates/${id}/default`),
  reset: (id) => post(`/idcards/templates/${id}/reset`),
  archive: (id) => request(`/idcards/templates/${id}`, { method: "DELETE" }),
  holders: (params) => get("/idcards/holders", params),
  validate: (data) => post("/idcards/validate", data),
  generate: (data) => post("/idcards/generate", data),
  cards: (params) => get("/idcards/cards", params),
  block: (id, reason) => post(`/idcards/cards/${id}/block`, { reason }),
  replace: (id, data) => post(`/idcards/cards/${id}/replace`, data),
  reprint: (data) => post("/idcards/reprint", data),
  jobs: (params) => resource("/id-card-print-jobs").all(params),
  job: (id) => get(`/idcards/print-jobs/${id}`),
  jobStatus: (id, status, extra = {}) => patch(`/idcards/print-jobs/${id}/status`, { status, ...extra }),
  stats: () => get("/idcards/stats"),
};

export const uploadsApi = {
  upload: (file, extra = {}) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => post("/uploads", { data: reader.result, fileName: file.name, ...extra }).then(resolve, reject);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  }),
};

export const portalApi = {
  guardianHome: () => get("/portal/guardian/home"),
  attendance: (id, month) => get(`/portal/guardian/students/${id}/attendance`, { month }),
  results: (id) => get(`/portal/guardian/students/${id}/results`),
  fees: (id) => get(`/portal/guardian/students/${id}/fees`),
  academics: (id) => get(`/portal/guardian/students/${id}/academics`),
  extras: (id) => get(`/portal/guardian/students/${id}/extras`),
  notifications: () => get("/portal/guardian/notifications"),
  complaints: () => get("/portal/guardian/complaints"),
  complain: (data) => post("/portal/guardian/complaints", data),
  ptmSlots: () => get("/portal/guardian/ptm-slots"),
  bookPtm: (id, studentId) => post(`/portal/guardian/ptm-slots/${id}/book`, { studentId }),
  teacherToday: () => get("/portal/teacher/today"),
  myNotifications: () => get("/portal/notifications"),
};

function list(path) {
  return request(`${path}?page=1&limit=100`).then((payload) => payload.data);
}

function create(path, data) {
  return request(path, { method: "POST", body: JSON.stringify(data) })
    .then((payload) => payload.data);
}

function update(path, id, data) {
  return request(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(data) })
    .then((payload) => payload.data);
}

function remove(path, id) {
  return request(`${path}/${id}`, { method: "DELETE" });
}

export const admissionsApi = {
  list: () => list("/admissions"),
  create: (data) => create("/admissions", data),
  update: (id, data) => update("/admissions", id, data),
  remove: (id) => remove("/admissions", id),
  approve: (id) => request(`/admissions/${id}/approve`, { method: "POST" }).then((payload) => payload.data),
};

export const academicApi = {
  clearLegacyStorage() {
    if (typeof window === "undefined") return;
    LEGACY_ACADEMIC_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  },
  load() {
    return Promise.all([
      list("/classes"),
      list("/subjects"),
      list("/academic-years"),
      request("/academic-settings").then((payload) => payload.data),
      list("/assignments"),
      // Teacher names are display-only here; roles without Teacher access (e.g. teachers
      // themselves) must still get classes and subjects instead of a failed page.
      optionalList(list("/teachers")),
    ]).then(([classes, subjects, years, settings, assignments, teachers]) => ({
      classes,
      subjects,
      years,
      settings,
      assignments,
      teachers,
    }));
  },
  classes: {
    list: () => list("/classes"),
    create: (data) => create("/classes", data),
    update: (id, data) => update("/classes", id, data),
    remove: (id) => remove("/classes", id),
  },
  subjects: {
    create: (data) => create("/subjects", data),
    update: (id, data) => update("/subjects", id, data),
    remove: (id) => remove("/subjects", id),
  },
  years: {
    list: () => list("/academic-years"),
    create: (data) => create("/academic-years", data),
    update: (id, data) => update("/academic-years", id, data),
    remove: (id) => remove("/academic-years", id),
  },
  assignments: {
    create: (data) => create("/assignments", data),
    update: (id, data) => update("/assignments", id, data),
    remove: (id) => remove("/assignments", id),
  },
  settings: {
    update: (data) => request("/academic-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }).then((payload) => payload.data),
  },
};

export const teachersApi = {
  list: () => list("/teachers"),
  create: (data) => create("/teachers", data),
  update: (id, data) => update("/teachers", id, data),
  remove: (id) => remove("/teachers", id),
};

export const usersApi = {
  list: () => list("/users"),
  create: (data) => create("/users", data),
  update: (id, data) => update("/users", id, data),
  remove: (id) => remove("/users", id),
};

export const rolesApi = {
  list: () => list("/roles"),
  create: (data) => create("/roles", data),
  update: (id, data) => update("/roles", id, data),
  remove: (id) => remove("/roles", id),
};

export const instituteProfileApi = {
  get: () => request("/institute-profile").then(payload => payload.data),
  update: (data) => request("/institute-profile", { method: "PATCH", body: JSON.stringify(data) }).then(payload => payload.data),
};

export const systemSettingsApi = {
  get: () => request("/system-settings").then(payload => payload.data),
  update: (data) => request("/system-settings", { method: "PATCH", body: JSON.stringify(data) }).then(payload => payload.data),
};

export const studentsApi = {
  list: () => list("/students"),
  create: (data) => create("/students", data),
  update: (id, data) => update("/students", id, data),
  remove: (id) => remove("/students", id),
};

export const attendanceApi = {
  list: (className, date) => {
    const params = new URLSearchParams();
    if (className) params.append("className", className);
    if (date) params.append("date", date);
    return request(`/attendance?${params.toString()}`).then(payload => payload.data);
  },
  bulkUpdate: (data) => request("/attendance/bulk", { method: "PUT", body: JSON.stringify(data) }),
  summary: (className, from, to) => {
    const params = new URLSearchParams();
    if (className) params.append("className", className);
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return request(`/attendance/summary?${params.toString()}`).then(payload => payload.data);
  }
};

export const routineApi = {
  list: (classId, section) => {
    const params = new URLSearchParams();
    if (classId) params.append("class_id", classId);
    if (section) params.append("section", section);
    return request(`/routine?${params.toString()}`).then(payload => payload.data);
  },
  create: (data) => create("/routine", data),
  update: (id, data) => update("/routine", id, data),
  remove: (id) => remove("/routine", id),
};
export const examsApi = {
  list: () => list("/exams"),
  create: (data) => create("/exams", data),
  update: (id, data) => update("/exams", id, data),
  remove: (id) => remove("/exams", id),
};

export const marksApi = {
  list: (exam, classId) => {
    const params = new URLSearchParams();
    if (exam) params.append("exam", exam);
    if (classId) params.append("classId", classId);
    return request(`/marks?${params.toString()}`).then(payload => payload.data);
  },
  bulkUpdate: (data) => request("/marks/bulk", { method: "PUT", body: JSON.stringify(data) }),
};

export const feeStructuresApi = {
  list: () => list("/fee-structures"),
  get: (id) => request(`/fee-structures/${id}`).then((payload) => payload.data),
  create: (data) => create("/fee-structures", data),
  update: (id, data) => update("/fee-structures", id, data),
  remove: (id) => remove("/fee-structures", id),
};

export const feeInvoicesApi = {
  list: (params) => {
    const q = new URLSearchParams(params || {});
    if (!q.has("page")) q.set("page", "1");
    if (!q.has("limit")) q.set("limit", "100");
    return request(`/fee-invoices?${q.toString()}`).then((payload) => payload.data);
  },
  get: (id) => request(`/fee-invoices/${id}`).then((payload) => payload.data),
  create: (data) => create("/fee-invoices", data),
  update: (id, data) => update("/fee-invoices", id, data),
  remove: (id) => remove("/fee-invoices", id),
};

export const feesApi = {
  getDues: (className) => {
    const params = new URLSearchParams();
    if (className) params.append("className", className);
    return request(`/fees/dues?${params.toString()}`).then((payload) => payload.data);
  },
  collectPayment: (data) => create("/fees/payments", data),
  getPayments: (studentId) => {
    const params = new URLSearchParams();
    if (studentId) params.append("studentId", studentId);
    return request(`/fees/payments?${params.toString()}`).then((payload) => payload.data);
  },
};

export const transactionsApi = {
  list: (params) => {
    const q = new URLSearchParams(params || {});
    if (!q.has("page")) q.set("page", "1");
    if (!q.has("limit")) q.set("limit", "1000");
    return request(`/transactions?${q.toString()}`).then((payload) => payload.data);
  },
  // Entries go through the approval-aware endpoint (expense threshold, Zakat rule).
  create: (data) => request("/accounts/entries", { method: "POST", body: JSON.stringify(data) }).then((p) => p.data.transaction),
  update: (id, data) => update("/transactions", id, data),
  // Financial records are never deleted: removal posts a reversal entry.
  remove: (id, reason = "Reversed from entry screen") => request(`/accounts/entries/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
};

export const payrollApi = {
  list: (params) => {
    const q = new URLSearchParams(params || {});
    if (!q.has("page")) q.set("page", "1");
    if (!q.has("limit")) q.set("limit", "100");
    return request(`/payroll?${q.toString()}`).then((payload) => payload.data);
  },
  create: (data) => create("/payroll", data),
  update: (id, data) => update("/payroll", id, data),
  remove: (id) => remove("/payroll", id),
  pay: (id) => request(`/payroll/${id}/pay`, { method: "POST" }).then((payload) => payload.data),
  process: (month) => request("/payroll/process", { method: "POST", body: JSON.stringify({ month }) }).then((payload) => payload.data),
};

export const staffApi = {
  list: () => list("/staff"),
  create: (data) => create("/staff", data),
  update: (id, data) => update("/staff", id, data),
  remove: (id) => remove("/staff", id),
};

export const noticesApi = {
  list: () => list("/notices"),
  create: (data) => create("/notices", data),
  send: (id) => request(`/notices/${id}/send`, { method: "POST" }).then((payload) => payload.data),
  remove: (id) => remove("/notices", id),
};

export const dashboardApi = {
  getSummary: () => request("/dashboard/summary").then((payload) => payload.data),
};

export const authApi = {
  login: (email, password) => request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then((payload) => payload.data),
  me: () => request("/auth/me").then((payload) => payload.data),
};

export const reportsApi = {
  catalog: () => request("/reports/catalog").then((payload) => payload.data),
  get: (type, from, to) => {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return request(`/reports?${params.toString()}`).then((payload) => payload.data);
  },
};

export const authExtraApi = {
  verify2fa: (challenge, code) => post("/auth/verify-otp", { challenge, code }),
  otpRequest: (mobile) => post("/auth/otp/request", { mobile }),
  otpVerify: (challenge, code) => post("/auth/otp/verify", { challenge, code }),
  pinLogin: (identifier, pin) => post("/auth/pin/login", { identifier, pin }),
  forgot: (identifier) => request("/auth/password/forgot", { method: "POST", body: JSON.stringify({ identifier }) }),
  reset: (token, password) => post("/auth/password/reset", { token, password }),
  changePassword: (currentPassword, newPassword) => post("/auth/change-password", { currentPassword, newPassword }),
  logoutAll: () => post("/auth/logout-all"),
  preferences: (data) => patch("/auth/preferences", data),
  permissionCatalog: () => get("/auth/permission-catalog"),
};

export const publicApi = {
  institute: () => get("/public/institute"),
  circulars: () => get("/public/circulars"),
  apply: (data) => post("/public/admissions/apply", data),
  status: (applicationId, mobile) => post("/public/admissions/status", { applicationId, mobile }),
  resultExams: () => get("/public/results/exams"),
  resultLookup: (data) => post("/public/results/lookup", data),
  verifyCard: (token) => get(`/public/cards/verify/${token}`),
  sandbox: (id) => get(`/public/payments/sandbox/${id}`),
  sandboxComplete: (id, status) => post(`/public/payments/sandbox/${id}/complete`, { status }),
  paymentReturnTarget: (id) => get(`/public/payments/return-target/${id}`),
  // Applicant photo for the online admission form (no login required).
  uploadPhoto: (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => post("/public/uploads/photo", { data: reader.result, fileName: file.name }).then(resolve, reject);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  }),
};
