"use client";

import {
  Ban, BookOpen, Building2, Bus, CalendarDays, CheckCircle2, ClipboardList, CreditCard, FileText, Fingerprint, HandCoins,
  History, KeyRound, Landmark, Library, LogOut, MessageSquare, Moon, Package, RotateCcw, School, Smartphone, Undo2, Users, Video,
} from "lucide-react";
import { http } from "../../lib/api";
import { Badge, money, today } from "../ui/kit";
import GuardianManagePanel from "../guardians/GuardianManagePanel";

// Relation helpers ------------------------------------------------------------
const REL = {
  class: { endpoint: "/classes", label: (r) => r.name },
  subject: { endpoint: "/subjects", label: (r) => `${r.name} (${r.code})` },
  teacher: { endpoint: "/teachers", label: (r) => `${r.name} – ${r.id}` },
  student: { endpoint: "/students", label: (r) => `${r.name} – ${r.id} (${r.className || ""})` },
  guardian: { endpoint: "/guardians", label: (r) => `${r.name} – ${r.mobile}` },
  year: { endpoint: "/academic-years", label: (r) => r.name },
  exam: { endpoint: "/exams", label: (r) => r.name },
  feeHead: { endpoint: "/fee-heads", label: (r) => r.name },
  leaveType: { endpoint: "/leave-types", label: (r) => `${r.name} (${r.appliesTo})` },
  book: { endpoint: "/library-books", label: (r) => `${r.title}${r.author ? ` – ${r.author}` : ""}` },
  item: { endpoint: "/inventory-items", label: (r) => r.name },
  supplier: { endpoint: "/inventory-suppliers", label: (r) => r.name },
  vehicle: { endpoint: "/vehicles", label: (r) => r.registrationNo },
  route: { endpoint: "/transport-routes", label: (r) => r.name },
  halaqa: { endpoint: "/halaqas", label: (r) => r.name },
  hostelRoom: { endpoint: "/hostel-rooms", label: (r) => `${r.building} – ${r.roomNo}` },
  donor: { endpoint: "/donors", label: (r) => r.name },
  bankAccount: { endpoint: "/bank-accounts", label: (r) => `${r.bankName} – ${r.accountName}` },
  accountHead: { endpoint: "/account-heads", label: (r) => `${r.code || ""} ${r.name}` },
  user: { endpoint: "/users", label: (r) => `${r.name} (${r.email})` },
};
const rel = (key, field, label, extra = {}) => ({ key: field, label, type: "relation", relation: REL[key], ...extra });
const STATUS = ["Active", "Inactive"];

export const CONFIGS = {
  admissionCirculars: {
    title: "Admission Circulars", singular: "Circular", endpoint: "/admission-circulars", module: "admission", icon: FileText,
    subtitle: "Class-wise seats, fees, eligibility, deadlines and required documents. Published circulars appear on the public admission portal.",
    columns: [{ key: "title", label: "Title" }, { key: "className", label: "Class" }, { key: "seats", label: "Seats" },
      { key: "admissionFee", label: "Admission Fee", type: "money" }, { key: "deadline", label: "Deadline", type: "date" },
      { key: "selectionMethod", label: "Selection" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "status", label: "Status", options: ["Draft", "Published", "Closed"] }],
    fields: [
      { key: "title", label: "Title", required: true, wide: true }, rel("year", "academicYearId", "Session"),
      { key: "className", label: "Class", required: true }, { key: "seats", label: "Seats", type: "number", default: 40 },
      { key: "admissionFee", label: "Admission fee (৳)", type: "money", default: 0 }, { key: "applicationFee", label: "Application fee (৳)", type: "money", default: 0 },
      { key: "startDate", more: true, label: "Start date", type: "date" }, { key: "deadline", label: "Deadline", type: "date" },
      { key: "testRequired", label: "Admission test", type: "checkbox" }, { key: "testDate", label: "Test date", type: "date", showIf: (f) => f.testRequired },
      { key: "testVenue", label: "Test venue", showIf: (f) => f.testRequired },
      { key: "selectionMethod", more: true, label: "Selection method", type: "select", options: ["Merit", "Lottery", "First Come"], default: "Merit" },
      { key: "requiredDocuments", more: true, label: "Required documents", type: "list", default: ["Birth certificate", "Photo"], wide: true },
      { key: "eligibility", more: true, label: "Eligibility", type: "textarea", wide: true }, { key: "description", more: true, label: "Description", type: "textarea", wide: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Published", "Closed"], default: "Draft" },
    ],
    rowActions: (r, { toast, reload }) => [
      { label: "Merit list", icon: CheckCircle2, onClick: async () => {
        try { const d = await http.post(`/admissions/circulars/${r.id}/merit-list`); toast.success(`Selected ${d.selected}, waiting ${d.waiting}`); reload(); } catch (e) { toast.error(e); }
      } },
    ],
  },
  guardians: {
    title: "Guardians", singular: "Guardian", endpoint: "/guardians", module: "guardians", icon: Users,
    subtitle: "Father, mother and legal guardian profiles. Mobile number is the unique identity; siblings link to the same guardian.",
    columns: [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "mobile", label: "Mobile" }, { key: "relationDefault", label: "Relation" },
      { key: "occupation", label: "Occupation" }, { key: "portalAccess", label: "Portal", type: "boolean" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "relationDefault", label: "Relation", options: ["Father", "Mother", "Guardian", "Other"] }],
    fields: [
      { key: "name", label: "Name", required: true }, { key: "nameBn", more: true, label: "Name (Bangla)" },
      { key: "relationDefault", label: "Relation", type: "select", options: ["Father", "Mother", "Guardian", "Other"], default: "Father" },
      { key: "mobile", label: "Mobile", required: true, readOnlyOnEdit: true, hint: "Use 'Change mobile' to update with verification." },
      { key: "altMobile", more: true, label: "Alternate mobile" }, { key: "email", label: "Email", inputType: "email" }, { key: "nid", more: true, label: "NID" },
      { key: "occupation", more: true, label: "Occupation" }, { key: "incomeRange", more: true, label: "Income range", type: "select", options: ["< 15,000", "15,000–30,000", "30,000–60,000", "> 60,000"] },
      { key: "emergencyContact", more: true, label: "Emergency contact" }, { key: "address", label: "Address", type: "textarea", wide: true },
      { key: "photoUrl", label: "Profile photo (optional)", type: "image", category: "photo" },
      { key: "portalAccess", label: "Portal access", type: "checkbox", default: true }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" },
    ],
    rowActions: (r, { toast, ask, reload, openPanel }) => [
      { label: "Manage", icon: Users, variant: "primary", onClick: () => openPanel({ title: `Manage guardian – ${r.name}`, render: (close) => <GuardianManagePanel guardian={r} onClose={close} /> }) },
      { label: "App account", icon: Smartphone, onClick: async () => {
        // AeroSchool Guardian Mobile App: admin-created email login with a temporary password.
        const email = await ask({ title: "Guardian app login email", message: `Login email for ${r.name}. Guardians cannot sign up themselves.`, placeholder: "guardian@example.com", defaultValue: r.email || "" });
        if (!email) return;
        const password = await ask({ title: "Temporary password", message: "Leave blank to generate one. The guardian must change it at first login.", placeholder: "At least 8 characters (optional)", required: false });
        if (password === null) return;
        try {
          const d = await http.post(`/guardians/${r.id}/account`, { email: email.trim(), password: password.trim() || undefined, sendEmail: true });
          await ask({
            title: "Guardian app account ready",
            message: `Login email: ${d.email} · Temporary password: ${d.tempPassword}. ${d.emailQueued ? "The credentials were also queued for email delivery." : ""} Share them with the guardian; the password is not shown again.`,
            input: false, confirmLabel: "Done",
          });
          reload();
        } catch (e) { toast.error(e); }
      } },
      { label: "Login history", compact: true, icon: History, onClick: async () => {
        try {
          const [acc, rows] = await Promise.all([http.get(`/guardians/${r.id}/account`), http.get(`/guardians/${r.id}/login-history`)]);
          const a = acc.account;
          const head = a ? `Login: ${a.email} · ${a.status}${a.mustChangePassword ? " · temporary password not yet changed" : ""}.` : "No app account yet.";
          const list = (rows || []).slice(0, 15).map((x) => `${new Date(x.createdAt).toLocaleString()} – ${x.action.replace("_", " ").toLowerCase()}${x.ip ? ` (${x.ip})` : ""}`).join(" | ");
          await ask({ title: `Login history – ${r.name}`, message: `${head} ${list || "No sign-ins recorded."}`, input: false, confirmLabel: "Close" });
        } catch (e) { toast.error(e); }
      } },
      { label: "Disable app access", compact: true, icon: Ban, show: r.portalAccess !== false, onClick: async () => {
        const ok = await ask({ title: "Deactivate guardian account?", message: "The guardian is signed out and loses access to all linked students. Student records stay unchanged.", input: false, danger: true, confirmLabel: "Deactivate" });
        if (!ok) return;
        try { await http.post(`/guardians/${r.id}/portal`, { enabled: false }); toast.success("Guardian account deactivated"); reload(); } catch (e) { toast.error(e); }
      } },
      { label: "Portal login", icon: KeyRound, onClick: async () => {
        const ok = await ask({ title: "Send portal credentials?", message: `A new password will be sent by SMS to ${r.mobile}.`, input: false });
        if (!ok) return;
        try { const d = await http.post(`/guardians/${r.id}/portal`, { enabled: true, resetPassword: true }); toast.success(d.credentialsSent ? "Credentials queued for SMS delivery" : "Portal enabled"); reload(); } catch (e) { toast.error(e); }
      } },
      { label: "Change mobile", compact: true, icon: RotateCcw, onClick: async () => {
        const mobile = await ask({ title: "New mobile number", placeholder: "01XXXXXXXXX" });
        if (!mobile) return;
        const reason = await ask({ title: "Reason for change", placeholder: "e.g. guardian lost old SIM" });
        if (!reason) return;
        try { await http.post(`/guardians/${r.id}/change-mobile`, { mobile, reason }); toast.success("Mobile updated and logged"); reload(); } catch (e) { toast.error(e); }
      } },
    ],
  },
  certificates: {
    title: "Certificates", singular: "Certificate", endpoint: "/certificates", module: "certificates", icon: FileText, create: false, delete: false,
    subtitle: "TC, testimonial, character, study certificate and sanad requests. Issue happens after approval.",
    columns: [{ key: "id", label: "Serial" }, { key: "certificateType", label: "Type" }, { key: "holderName", label: "Holder" }, { key: "holderId", label: "ID" },
      { key: "status", label: "Status", type: "badge" }, { key: "issuedAt", label: "Issued", type: "date" }],
    filters: [{ key: "certificateType", label: "Type", options: ["Transfer Certificate", "Testimonial", "Character Certificate", "Study Certificate", "Sanad", "Hifz Sanad", "Experience Certificate", "Employment Letter"] },
      { key: "status", label: "Status", options: ["Pending", "Issued", "Rejected"] }],
    fields: [],
  },
  branches: {
    title: "Branches", singular: "Branch", endpoint: "/branches", module: "branches", icon: Building2,
    subtitle: "Multi-branch management: campuses / shakhas under one institution.",
    columns: [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "headName", label: "Head" }, { key: "phone", label: "Phone" }, { key: "isMain", label: "Main", type: "boolean" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code" }, { key: "institutionType", label: "Institution type", type: "select", options: ["Bangla Medium", "English Version", "English Medium", "Alia Madrasa", "Qawmi Madrasa", "Kindergarten", "College"] },
      { key: "headName", label: "Branch head" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "address", label: "Address", type: "textarea", wide: true },
      { key: "isMain", label: "Main campus", type: "checkbox" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  shifts: {
    title: "Shifts", singular: "Shift", endpoint: "/shifts", module: "academic",
    columns: [{ key: "name", label: "Shift" }, { key: "startTime", label: "Start" }, { key: "endTime", label: "End" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "startTime", label: "Start", type: "time" }, { key: "endTime", label: "End", type: "time" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  studentGroups: {
    title: "Groups", singular: "Group", endpoint: "/student-groups", module: "academic",
    columns: [{ key: "name", label: "Group" }, { key: "applicableClasses", label: "Classes" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "applicableClasses", label: "Applicable classes", hint: "e.g. 9-12" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  rooms: {
    title: "Rooms", singular: "Room", endpoint: "/rooms", module: "academic",
    columns: [{ key: "name", label: "Room" }, { key: "building", label: "Building" }, { key: "capacity", label: "Capacity" }, { key: "type", label: "Type" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "building", label: "Building" }, { key: "capacity", label: "Capacity", type: "number", default: 40 },
      { key: "type", label: "Type", type: "select", options: ["Classroom", "Lab", "Hall", "Library", "Office"], default: "Classroom" }],
  },
  classSubjects: {
    title: "Class–Subject Mapping", singular: "Mapping", endpoint: "/class-subjects", module: "academic",
    subtitle: "Compulsory / elective / 4th subject per class and group.",
    columns: [{ key: "classId", label: "Class" }, { key: "subjectId", label: "Subject" }, { key: "groupName", label: "Group" },
      { key: "isCompulsory", label: "Compulsory", type: "boolean" }, { key: "isFourthSubjectEligible", label: "4th subject", type: "boolean" }],
    filters: [{ key: "classId", label: "Class", relation: REL.class }],
    fields: [rel("class", "classId", "Class", { required: true }), rel("subject", "subjectId", "Subject", { required: true }),
      { key: "groupName", label: "Group", hint: "Blank = all groups" }, { key: "isCompulsory", label: "Compulsory", type: "checkbox", default: true },
      { key: "isFourthSubjectEligible", label: "Eligible as 4th/optional subject", type: "checkbox" }, { key: "sortOrder", label: "Order", type: "number", default: 0 }],
  },
  classTeacherHistory: {
    title: "Class Teacher History", singular: "Entry", endpoint: "/class-teacher-history", module: "academic",
    columns: [{ key: "classId", label: "Class" }, { key: "section", label: "Section" }, { key: "teacherId", label: "Teacher" }, { key: "fromDate", label: "From", type: "date" }, { key: "toDate", label: "To", type: "date" }],
    fields: [rel("class", "classId", "Class", { required: true }), { key: "section", label: "Section" }, rel("teacher", "teacherId", "Teacher"),
      { key: "fromDate", label: "From", type: "date" }, { key: "toDate", label: "To", type: "date" }, { key: "note", label: "Note", type: "textarea", wide: true }],
  },
  academicEvents: {
    title: "Academic Calendar", singular: "Event", endpoint: "/academic-events", module: "academic", icon: CalendarDays,
    subtitle: "Holidays, exams, events, meetings and admission deadlines. Public events show in the guardian portal.",
    columns: [{ key: "title", label: "Title" }, { key: "type", label: "Type", type: "badge" }, { key: "startDate", label: "From", type: "date" }, { key: "endDate", label: "To", type: "date" },
      { key: "hijriLabel", label: "Hijri" }, { key: "audience", label: "Audience" }],
    filters: [{ key: "type", label: "Type", options: ["Holiday", "Exam", "Event", "Meeting", "Admission", "Activity", "Other"] }],
    fields: [{ key: "title", label: "Title", required: true, wide: true }, { key: "type", label: "Type", type: "select", options: ["Holiday", "Exam", "Event", "Meeting", "Admission", "Activity", "Other"], default: "Event" },
      { key: "audience", label: "Audience", type: "select", options: ["All", "Students", "Guardians", "Teachers", "Staff"], default: "All" },
      { key: "startDate", label: "Start date", type: "date", required: true }, { key: "endDate", label: "End date", type: "date" },
      { key: "hijriLabel", more: true, label: "Hijri date label", hint: "e.g. 1 Ramadan 1448" }, { key: "isPublic", label: "Show in portal", type: "checkbox", default: true },
      { key: "description", label: "Description", type: "textarea", wide: true }, { key: "images", more: true, label: "Gallery image URLs", type: "list", wide: true }],
  },
  homework: {
    title: "Homework & Assignments", singular: "Homework", endpoint: "/homework", module: "homework", icon: BookOpen,
    subtitle: "Create, attach and publish homework per class/section. Visible to guardians.",
    columns: [{ key: "title", label: "Title" }, { key: "kind", label: "Type" }, { key: "classId", label: "Class" }, { key: "section", label: "Section" },
      { key: "subjectId", label: "Subject" }, { key: "dueDate", label: "Due", type: "date" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "classId", label: "Class", relation: REL.class }, { key: "kind", label: "Type", options: ["Homework", "Assignment", "Project", "Class Test"] }],
    fields: [{ key: "title", label: "Title", required: true, wide: true }, { key: "kind", label: "Type", type: "select", options: ["Homework", "Assignment", "Project", "Class Test"], default: "Homework" },
      rel("class", "classId", "Class", { required: true }), { key: "section", label: "Section" }, rel("subject", "subjectId", "Subject"), rel("teacher", "teacherId", "Teacher", { hint: "Leave empty when you are the teacher – it is filled in for you." }),
      { key: "assignedDate", more: true, label: "Assigned", type: "date", default: () => today() }, { key: "dueDate", label: "Due date", type: "date" },
      { key: "totalMarks", more: true, label: "Marks", type: "number" }, { key: "attachmentUrl", more: true, label: "Attachment URL", wide: true },
      { key: "description", label: "Description", type: "textarea", wide: true }, { key: "status", label: "Status", type: "select", options: ["Published", "Draft"], default: "Published" }],
  },
  learningResources: {
    title: "Class Notes & Resources", singular: "Resource", endpoint: "/learning-resources", module: "homework",
    columns: [{ key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "classId", label: "Class" }, { key: "subjectId", label: "Subject" }, { key: "url", label: "Link", type: "link" }],
    fields: [{ key: "title", label: "Title", required: true }, { key: "type", label: "Type", type: "select", options: ["Note", "PDF", "Image", "Video", "Link"], default: "Note" },
      rel("class", "classId", "Class"), rel("subject", "subjectId", "Subject"), { key: "url", label: "URL", wide: true }, { key: "description", label: "Description", type: "textarea", wide: true }],
  },
  syllabus: {
    title: "Syllabus & Lesson Plan", singular: "Topic", endpoint: "/syllabus", module: "homework",
    subtitle: "Planned topics and completion tracking.",
    columns: [{ key: "classId", label: "Class" }, { key: "subjectId", label: "Subject" }, { key: "chapter", label: "Chapter" }, { key: "topic", label: "Topic" },
      { key: "plannedDate", label: "Planned", type: "date" }, { key: "completed", label: "Done", type: "boolean" }],
    filters: [{ key: "classId", label: "Class", relation: REL.class }, { key: "subjectId", label: "Subject", relation: REL.subject }],
    fields: [rel("class", "classId", "Class"), rel("subject", "subjectId", "Subject"), rel("teacher", "teacherId", "Teacher"), { key: "chapter", label: "Chapter" },
      { key: "topic", label: "Topic", required: true, wide: true }, { key: "plannedDate", label: "Planned date", type: "date" },
      { key: "completed", label: "Completed", type: "checkbox" }, { key: "completedAt", label: "Completed on", type: "date", showIf: (f) => f.completed }],
  },
  substitutes: {
    title: "Substitute Teachers", singular: "Substitute", endpoint: "/substitutes", module: "routine",
    columns: [{ key: "date", label: "Date", type: "date" }, { key: "absentTeacherId", label: "Absent teacher" }, { key: "substituteTeacherId", label: "Substitute" }, { key: "note", label: "Note" }],
    fields: [{ key: "date", label: "Date", type: "date", required: true }, rel("teacher", "absentTeacherId", "Absent teacher"), rel("teacher", "substituteTeacherId", "Substitute teacher"), { key: "note", label: "Note / periods", type: "textarea", wide: true }],
  },
  onlineClasses: {
    title: "Online Classes", singular: "Online class", endpoint: "/online-classes", module: "online_classes", icon: Video,
    subtitle: "Zoom / Google Meet / Jitsi links and recorded lessons.",
    columns: [{ key: "title", label: "Title" }, { key: "classId", label: "Class" }, { key: "subjectId", label: "Subject" }, { key: "provider", label: "Provider" },
      { key: "scheduledAt", label: "Scheduled", type: "datetime" }, { key: "meetingUrl", label: "Join", type: "link" }, { key: "recordingUrl", label: "Recording", type: "link" }],
    fields: [{ key: "title", label: "Title", required: true, wide: true }, rel("class", "classId", "Class"), { key: "section", label: "Section" }, rel("subject", "subjectId", "Subject"),
      rel("teacher", "teacherId", "Teacher"), { key: "provider", label: "Provider", type: "select", options: ["Google Meet", "Zoom", "Jitsi", "Other"], default: "Google Meet" },
      { key: "meetingUrl", label: "Meeting URL", wide: true }, { key: "scheduledAt", label: "Scheduled at", type: "datetime" }, { key: "durationMinutes", label: "Duration (min)", type: "number", default: 45 },
      { key: "recordingUrl", label: "Recording URL", wide: true }, { key: "status", label: "Status", type: "select", options: ["Scheduled", "Live", "Completed", "Cancelled"], default: "Scheduled" }],
  },
  clubs: {
    title: "House / Club / ECA", singular: "Group", endpoint: "/clubs", module: "academic",
    columns: [{ key: "name", label: "Name" }, { key: "kind", label: "Type", type: "badge" }, { key: "advisorId", label: "Advisor" }, { key: "points", label: "Points" }, { key: "members", label: "Members", render: (r) => (r.members || []).length }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "kind", label: "Type", type: "select", options: ["House", "Club", "ECA"], default: "Club" }, rel("teacher", "advisorId", "Advisor"),
      { key: "points", label: "Points", type: "number", default: 0 }, { key: "members", label: "Member student IDs", type: "list", wide: true }, { key: "achievements", label: "Achievements", type: "list", wide: true }],
  },
  textbookDistributions: {
    title: "Textbook Distribution", singular: "Distribution", endpoint: "/textbook-distributions", module: "students",
    columns: [{ key: "studentId", label: "Student" }, { key: "books", label: "Books", type: "list" }, { key: "distributedOn", label: "Date", type: "date" }, { key: "acknowledged", label: "Acknowledged", type: "boolean" }],
    fields: [rel("student", "studentId", "Student", { required: true }), rel("year", "academicYearId", "Session"), { key: "books", label: "Books", type: "list", wide: true },
      { key: "distributedOn", label: "Date", type: "date" }, { key: "acknowledged", label: "Acknowledged by student", type: "checkbox" }],
  },
  exams: {
    title: "Exam Setup", singular: "Exam", endpoint: "/exams", module: "exams", icon: ClipboardList,
    subtitle: "Class test, monthly, half-yearly, annual, model, pre-test, test, mock or weighted combined exams with marks-entry window, grading scale and tie-break rule.",
    columns: [{ key: "name", label: "Exam" }, { key: "examType", label: "Type", type: "badge" }, { key: "classIds", label: "Classes" }, { key: "startDate", label: "Starts", type: "date" },
      { key: "marksEntryEnd", label: "Marks entry closes", type: "date" }, { key: "gradeScaleId", label: "Grading" }, { key: "resultStatus", label: "Result", type: "badge" }],
    filters: [{ key: "examType", label: "Type", options: ["Class Test", "Monthly", "Term", "Half-Yearly", "Annual", "Model", "Pre-Test", "Test", "Mock", "Combined"] }],
    fields: [
      { key: "name", label: "Exam name", required: true, wide: true }, { key: "examType", label: "Type", type: "select", options: ["Class Test", "Monthly", "Term", "Half-Yearly", "Annual", "Model", "Pre-Test", "Test", "Mock", "Combined"], default: "Term" },
      rel("year", "academicYearId", "Session"), { key: "classIds", label: "Classes", type: "multirelation", relation: REL.class, wide: true },
      { key: "startDate", label: "Start date", type: "date" }, { key: "endDate", label: "End date", type: "date" },
      { key: "marksEntryStart", more: true, label: "Marks entry opens", type: "date" }, { key: "marksEntryEnd", label: "Marks entry closes (auto-lock)", type: "date" },
      { key: "gradeScaleId", more: true, label: "Grading scale", type: "relation", relation: { endpoint: "/grade-scales", label: (r) => r.name } },
      { key: "weightage", more: true, label: "Weight in annual result (%)", type: "number", default: 100 },
      { key: "tieBreakRule", more: true, label: "Merit tie-break order", type: "select", options: ["total,gpa,roll", "gpa,total,roll", "total,percentage,roll", "gpa,percentage,roll"], default: "total,gpa,roll" },
      { key: "combinedFrom", label: "Combined from (JSON, for Combined type)", type: "json", default: [], wide: true, showIf: (f) => f.examType === "Combined", hint: '[{"examId":"EXM-001","weight":30},{"examId":"EXM-002","weight":70}] – weights must total 100' },
      { key: "status", label: "Status", type: "select", options: ["Scheduled", "Ongoing", "Completed"], default: "Scheduled" },
    ],
  },
  examSchedules: {
    title: "Exam Routine", singular: "Paper", endpoint: "/exam-schedules", module: "exams", icon: CalendarDays,
    subtitle: "Date, time, room, invigilator, full/pass marks and components per subject.",
    columns: [{ key: "examId", label: "Exam" }, { key: "classId", label: "Class" }, { key: "subjectId", label: "Subject" }, { key: "examDate", label: "Date", type: "date" },
      { key: "startTime", label: "Start" }, { key: "endTime", label: "End" }, { key: "room", label: "Room" }, { key: "fullMarks", label: "Full" }, { key: "passMarks", label: "Pass" }],
    filters: [{ key: "examId", label: "Exam", relation: REL.exam }, { key: "classId", label: "Class", relation: REL.class }],
    fields: [rel("exam", "examId", "Exam", { required: true }), rel("class", "classId", "Class", { required: true }), rel("subject", "subjectId", "Subject", { required: true }),
      { key: "examDate", label: "Date", type: "date" }, { key: "startTime", label: "Start", type: "time" }, { key: "endTime", label: "End", type: "time" }, { key: "room", label: "Room" },
      rel("teacher", "invigilatorId", "Invigilator"), { key: "fullMarks", label: "Full marks", type: "number", default: 100 }, { key: "passMarks", label: "Pass marks", type: "number", default: 33 },
      { key: "components", label: "Components (JSON)", type: "json", default: [], wide: true, hint: '[{"key":"cq","label":"Creative","fullMarks":70,"passMarks":23}]' }],
  },
  gradeScales: {
    title: "Grading Scales", singular: "Grade scale", endpoint: "/grade-scales", module: "settings", icon: ClipboardList,
    subtitle: "NCTB GPA 5.0, Alia (BMEB), Qawmi (Mumtaz–Rasib), Cambridge A*–U, Kindergarten – or your own.",
    columns: [{ key: "name", label: "Name" }, { key: "scaleType", label: "Type", type: "badge" }, { key: "institutionType", label: "For" },
      { key: "bands", label: "Bands", render: (r) => (r.bands || []).map((b) => `${b.grade} ≥${b.min}`).join(" · ") }, { key: "isDefault", label: "Default", type: "boolean" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "scaleType", label: "Type", type: "select", options: ["GPA", "Letter", "Division"], default: "GPA" },
      { key: "institutionType", label: "Institution type" }, { key: "maxPoint", label: "Max point", type: "number", default: 5 }, { key: "failGrade", label: "Fail grade", default: "F" },
      { key: "fourthSubjectThreshold", label: "4th subject threshold", type: "number", default: 2, hint: "NCTB: points above 2 are added" },
      { key: "bands", label: "Bands (JSON)", type: "json", wide: true, default: [{ min: 80, max: 100, grade: "A+", point: 5 }] },
      { key: "isDefault", label: "Default scale", type: "checkbox" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  feeHeads: {
    title: "Fee Heads", singular: "Fee head", endpoint: "/fee-heads", module: "fees", icon: HandCoins,
    columns: [{ key: "name", label: "Name" }, { key: "nameBn", label: "বাংলা" }, { key: "category", label: "Category" }, { key: "isRefundable", label: "Refundable", type: "boolean" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "nameBn", label: "Name (Bangla)" }, { key: "code", label: "Code" }, { key: "category", label: "Category", default: "Tuition" },
      { key: "isRefundable", label: "Refundable (deposit)", type: "checkbox" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  feeDiscounts: {
    title: "Discounts, Scholarships & Waivers", singular: "Discount", endpoint: "/fee-discounts", module: "fees", create: false, delete: false,
    columns: [{ key: "studentId", label: "Student" }, { key: "discountType", label: "Type" }, { key: "value", label: "Value", render: (r) => (r.mode === "Percent" ? `${r.value}%` : money(r.value)) },
      { key: "reason", label: "Reason" }, { key: "status", label: "Status", type: "badge" }, { key: "approvedBy", label: "Approved by" }],
    filters: [{ key: "status", label: "Status", options: ["Pending", "Approved", "Rejected", "Expired"] }],
    fields: [rel("student", "studentId", "Student")],
  },
  cashClosings: {
    title: "Cash Closings", singular: "Closing", endpoint: "/cash-closings", module: "fees", create: false, edit: false, delete: false,
    columns: [{ key: "closingDate", label: "Date", type: "date" }, { key: "collectorName", label: "Collector" }, { key: "openingBalance", label: "Opening", type: "money" },
      { key: "systemCollection", label: "System cash", type: "money" }, { key: "cashCounted", label: "Counted", type: "money" }, { key: "handedOver", label: "Handed over", type: "money" },
      { key: "mismatch", label: "Mismatch", render: (r) => <span className={Number(r.mismatch) ? "font-bold text-rose-600" : "text-emerald-600"}>{money(r.mismatch)}</span> }],
    fields: [],
  },
  gatewayTransactions: {
    title: "Online Payments", singular: "Payment", endpoint: "/gateway-transactions", module: "fees", create: false, edit: false, delete: false,
    subtitle: "bKash / Nagad / Rocket / SSLCommerz transactions with callback reconciliation.",
    columns: [{ key: "createdAt", label: "Date", type: "datetime" }, { key: "gateway", label: "Gateway" }, { key: "txnId", label: "Txn ID" }, { key: "amount", label: "Amount", type: "money" },
      { key: "status", label: "Status", type: "badge" }, { key: "posted", label: "Posted", type: "boolean" }, { key: "callbackCount", label: "Callbacks" }],
    filters: [{ key: "status", label: "Status", options: ["Pending", "Success", "Failed", "Cancelled"] }],
    fields: [],
  },
  refunds: {
    title: "Refunds", singular: "Refund", endpoint: "/refunds", module: "fees", create: false, edit: false, delete: false,
    columns: [{ key: "id", label: "ID" }, { key: "studentId", label: "Student" }, { key: "amount", label: "Amount", type: "money" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status", type: "badge" }],
    fields: [],
  },
  accountHeads: {
    title: "Chart of Accounts", singular: "Account head", endpoint: "/account-heads", module: "accounts", icon: Landmark,
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "type", label: "Type", type: "badge" }, { key: "fund", label: "Fund" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "type", label: "Type", options: ["Income", "Expense", "Asset", "Liability", "Equity"] }],
    fields: [{ key: "code", label: "Code" }, { key: "name", label: "Name", required: true }, { key: "type", label: "Type", type: "select", options: ["Income", "Expense", "Asset", "Liability", "Equity"], required: true },
      { key: "fund", label: "Fund", type: "select", options: ["General", "Development", "Donation", "Lillah", "Zakat"], default: "General" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  vouchers: {
    title: "Vouchers", singular: "Voucher", endpoint: "/vouchers", module: "accounts", delete: false, edit: false,
    subtitle: "Receipt / payment / journal vouchers. Entries must balance; posted vouchers are reversed, never edited.",
    columns: [{ key: "id", label: "No." }, { key: "voucherType", label: "Type" }, { key: "voucherDate", label: "Date", type: "date" }, { key: "narration", label: "Narration" },
      { key: "total", label: "Total", type: "money" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "voucherType", label: "Type", type: "select", options: ["Receipt", "Payment", "Journal", "Contra"], required: true, default: "Journal" },
      { key: "voucherDate", label: "Date", type: "date", default: () => today() },
      { key: "fund", label: "Fund", type: "select", options: ["General", "Development", "Donation", "Lillah", "Zakat"], default: "General" },
      { key: "narration", label: "Narration", type: "textarea", wide: true },
      { key: "entries", label: "Entries (JSON)", type: "json", wide: true, default: [{ headName: "Cash in Hand", debit: 0, credit: 0 }, { headName: "Other Income", debit: 0, credit: 0 }], hint: "Total debit must equal total credit." }],
    rowActions: (r, { ask, toast, reload }) => [
      { label: "Reverse", icon: Undo2, show: r.status === "Posted", onClick: async () => {
        const reason = await ask({ title: `Reverse ${r.id}?`, placeholder: "Reason" });
        if (!reason) return;
        try { await http.post(`/accounts/vouchers/${r.id}/reverse`, { reason }); toast.success("Reversal posted"); reload(); } catch (e) { toast.error(e); }
      } },
    ],
  },
  bankAccounts: {
    title: "Bank Accounts", singular: "Bank account", endpoint: "/bank-accounts", module: "accounts", icon: Landmark,
    columns: [{ key: "bankName", label: "Bank" }, { key: "accountName", label: "Account" }, { key: "accountNo", label: "Number" }, { key: "branch", label: "Branch" }, { key: "openingBalance", label: "Opening", type: "money" }],
    fields: [{ key: "bankName", label: "Bank", required: true }, { key: "accountName", label: "Account name", required: true }, { key: "accountNo", label: "Account number", required: true },
      { key: "branch", label: "Branch" }, { key: "openingBalance", label: "Opening balance", type: "money", default: 0 }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  bankTransactions: {
    title: "Bank Transactions", singular: "Transaction", endpoint: "/bank-transactions", module: "accounts", delete: false,
    columns: [{ key: "txnDate", label: "Date", type: "date" }, { key: "bankAccountId", label: "Account" }, { key: "txnType", label: "Type", type: "badge" }, { key: "amount", label: "Amount", type: "money" },
      { key: "reference", label: "Reference" }, { key: "reconciled", label: "Reconciled", type: "boolean" }],
    filters: [{ key: "bankAccountId", label: "Account", relation: REL.bankAccount }],
    fields: [rel("bankAccount", "bankAccountId", "Bank account", { required: true }), { key: "txnType", label: "Type", type: "select", options: ["Deposit", "Withdrawal"], required: true },
      { key: "amount", label: "Amount", type: "money", required: true }, { key: "txnDate", label: "Date", type: "date", default: () => today() },
      { key: "reference", label: "Reference" }, { key: "description", label: "Description", wide: true }, { key: "reconciled", label: "Reconciled", type: "checkbox" }],
  },
  salaryStructures: {
    title: "Salary Structures", singular: "Salary structure", endpoint: "/salary-structures", module: "payroll", icon: CreditCard,
    subtitle: "Basic, allowances, deductions, provident fund, MPO government portion.",
    columns: [{ key: "employeeType", label: "Type" }, { key: "employeeName", label: "Employee" }, { key: "basic", label: "Basic", type: "money" },
      { key: "houseRent", label: "House rent", type: "money" }, { key: "providentFund", label: "PF", type: "money" }, { key: "govtPortion", label: "Govt (MPO)", type: "money" }],
    fields: [{ key: "employeeType", label: "Employee type", type: "select", options: ["Teacher", "Staff"], required: true, default: "Teacher" },
      rel("teacher", "employeeId", "Teacher", { showIf: (f) => f.employeeType !== "Staff" }),
      { key: "employeeId", label: "Staff ID", showIf: (f) => f.employeeType === "Staff" }, { key: "employeeName", label: "Employee name" },
      { key: "basic", label: "Basic", type: "money", default: 0 }, { key: "houseRent", label: "House rent", type: "money", default: 0 }, { key: "medical", label: "Medical", type: "money", default: 0 },
      { key: "transport", label: "Transport", type: "money", default: 0 }, { key: "otherAllowance", label: "Other allowance", type: "money", default: 0 }, { key: "bonus", label: "Bonus", type: "money", default: 0 },
      { key: "providentFund", label: "Provident fund", type: "money", default: 0 }, { key: "tax", label: "Tax", type: "money", default: 0 }, { key: "otherDeduction", label: "Other deduction", type: "money", default: 0 },
      { key: "perDayAbsenceDeduction", label: "Per-day absence deduction", type: "money", default: 0 }, { key: "govtPortion", label: "MPO government portion (record only)", type: "money", default: 0 },
      { key: "bankAccount", label: "Bank account" }, { key: "effectiveFrom", label: "Effective from", type: "date" }],
  },
  salaryAdvances: {
    title: "Salary Advances & Loans", singular: "Advance", endpoint: "/salary-advances", module: "payroll", delete: false,
    columns: [{ key: "employeeName", label: "Employee" }, { key: "amount", label: "Amount", type: "money" }, { key: "installment", label: "Installment", type: "money" }, { key: "recovered", label: "Recovered", type: "money" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "employeeType", label: "Type", type: "select", options: ["Teacher", "Staff"], required: true, default: "Teacher" }, { key: "employeeId", label: "Employee ID", required: true },
      { key: "employeeName", label: "Name" }, { key: "amount", label: "Amount", type: "money", required: true }, { key: "installment", label: "Monthly installment", type: "money", default: 0 },
      { key: "issueDate", label: "Issue date", type: "date" }, { key: "note", label: "Note", type: "textarea", wide: true }],
  },
  leaveTypes: {
    title: "Leave Types", singular: "Leave type", endpoint: "/leave-types", module: "leave",
    columns: [{ key: "name", label: "Name" }, { key: "appliesTo", label: "For" }, { key: "daysPerYear", label: "Days / year" }, { key: "isPaid", label: "Paid", type: "boolean" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "appliesTo", label: "Applies to", type: "select", options: ["Staff", "Student", "Both"], default: "Staff" },
      { key: "daysPerYear", label: "Entitlement (days/year, 0 = unlimited)", type: "number", default: 0 }, { key: "isPaid", label: "Paid leave", type: "checkbox", default: true }],
  },
  leaveRequests: {
    title: "Leave Requests", singular: "Leave", endpoint: "/leave-requests", module: "leave", create: false, edit: false, delete: false,
    subtitle: "Applications are decided in Approvals; balances update automatically.",
    columns: [{ key: "id", label: "ID" }, { key: "applicantType", label: "Type" }, { key: "applicantName", label: "Applicant" }, { key: "leaveType", label: "Leave" },
      { key: "fromDate", label: "From", type: "date" }, { key: "toDate", label: "To", type: "date" }, { key: "days", label: "Days" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "applicantType", label: "Type", options: ["Student", "Teacher", "Staff"] }, { key: "status", label: "Status", options: ["Pending", "Approved", "Rejected"] }],
    fields: [],
  },
  devices: {
    title: "Attendance Devices", singular: "Device", endpoint: "/attendance-devices", module: "devices", icon: Fingerprint,
    subtitle: "Face recognition, fingerprint, RFID, QR scanners and mobile app devices push events to /api/v1/public/devices/events with their API key.",
    columns: [{ key: "name", label: "Device" }, { key: "deviceType", label: "Type", type: "badge" }, { key: "serialNo", label: "Serial" }, { key: "location", label: "Location" },
      { key: "direction", label: "Direction" }, { key: "apiKeyHint", label: "Key" }, { key: "lastSyncAt", label: "Last sync", type: "datetime" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "deviceType", label: "Type", type: "select", options: ["Face Recognition", "Fingerprint", "RFID", "QR Scanner", "Mobile App"], required: true },
      { key: "serialNo", label: "Serial no." }, { key: "location", label: "Location" }, { key: "direction", label: "Direction", type: "select", options: ["Both", "In", "Out"], default: "Both" },
      { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
    rowActions: (r, { ask, toast, reload }) => [
      { label: "API key", icon: KeyRound, onClick: async () => {
        const ok = await ask({ title: "Generate a new API key?", message: "The previous key stops working immediately.", input: false });
        if (!ok) return;
        try {
          const d = await http.post(`/devices/${r.id}/key`);
          await ask({ title: "Device API key (shown once)", message: `Send header X-Device-Key: ${d.apiKey} to ${d.endpoint}`, input: false, confirmLabel: "Done" });
          reload();
        } catch (e) { toast.error(e); }
      } },
    ],
  },
  biometricEnrollments: {
    title: "Credentials (RFID / Fingerprint / Face)", singular: "Credential", endpoint: "/biometric-enrollments", module: "devices",
    columns: [{ key: "personType", label: "Person" }, { key: "personId", label: "ID" }, { key: "credentialType", label: "Type", type: "badge" }, { key: "credentialValue", label: "Value" }, { key: "deviceUserId", label: "Device user" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "credentialType", label: "Type", options: ["RFID Card", "Fingerprint", "Face", "QR"] }],
    fields: [{ key: "personType", label: "Person type", type: "select", options: ["Student", "Teacher", "Staff"], required: true, default: "Student" },
      { key: "personId", label: "Person ID", required: true, hint: "e.g. STU-4001 / TCH-1001" }, { key: "credentialType", label: "Credential", type: "select", options: ["RFID Card", "Fingerprint", "Face", "QR"], required: true },
      { key: "credentialValue", label: "Card UID / template ref", required: true }, { key: "deviceUserId", label: "Device user ID" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  deviceEvents: {
    title: "Entry / Exit Log", singular: "Event", endpoint: "/device-events", module: "devices", create: false, edit: false, delete: false,
    subtitle: "Raw device events with match status. Unmatched scans need manual verification.",
    columns: [{ key: "eventTime", label: "Time", type: "datetime" }, { key: "personType", label: "Person" }, { key: "personId", label: "ID" }, { key: "eventType", label: "Event", type: "badge" },
      { key: "status", label: "Status", type: "badge" }, { key: "message", label: "Message" }, { key: "deviceId", label: "Device" }],
    filters: [{ key: "status", label: "Status", options: ["Processed", "Unmatched", "Duplicate", "Error"] }, { key: "eventType", label: "Event", options: ["IN", "OUT"] }],
    fields: [],
  },
  messageTemplates: {
    title: "Message Templates", singular: "Template", endpoint: "/message-templates", module: "communication", icon: MessageSquare,
    subtitle: "Bangla / English SMS & email templates. Placeholders: {student} {date} {time} {exam} {gpa} {grade} {due} {amount} {receipt} {institute}.",
    columns: [{ key: "templateKey", label: "Key" }, { key: "name", label: "Name" }, { key: "channel", label: "Channel" }, { key: "language", label: "Lang" }, { key: "body", label: "Body", cellClass: "max-w-md truncate" }],
    filters: [{ key: "language", label: "Language", options: ["bn", "en"] }],
    fields: [{ key: "templateKey", label: "Key", required: true }, { key: "name", label: "Name", required: true }, { key: "channel", label: "Channel", type: "select", options: ["SMS", "Email", "Push"], default: "SMS" },
      { key: "language", label: "Language", type: "select", options: ["bn", "en"], default: "bn" }, { key: "subject", label: "Subject (email)" }, { key: "body", label: "Body", type: "textarea", required: true, wide: true }],
  },
  messageLogs: {
    title: "Message & Delivery Log", singular: "Message", endpoint: "/message-logs", module: "communication", create: false, edit: false, delete: false,
    subtitle: "SMS / email / push / portal delivery status, cost and failures.",
    columns: [{ key: "createdAt", label: "Time", type: "datetime" }, { key: "channel", label: "Channel" }, { key: "eventType", label: "Event" }, { key: "recipient", label: "Recipient" },
      { key: "body", label: "Message", cellClass: "max-w-sm truncate" }, { key: "status", label: "Status", type: "badge" }, { key: "cost", label: "Cost", render: (r) => (Number(r.cost) ? `৳${Number(r.cost).toFixed(2)}` : "—") }, { key: "error", label: "Error", cellClass: "max-w-xs truncate text-rose-600" }],
    filters: [{ key: "channel", label: "Channel", options: ["SMS", "Email", "Push", "Portal"] }, { key: "status", label: "Status", options: ["Queued", "Sent", "Delivered", "Failed", "Read"] }],
    fields: [],
    headerActions: ({ toast, reload }) => (
      <button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={async () => {
        try { const d = await http.post("/messages/retry-failed"); toast.success(`${d.requeued} message(s) re-queued`); reload(); } catch (e) { toast.error(e); }
      }}>Retry failed</button>
    ),
  },
  complaints: {
    title: "Complaints & Feedback", singular: "Complaint", endpoint: "/complaints", module: "communication",
    subtitle: "Guardian complaint → assign → respond → resolve.",
    columns: [{ key: "id", label: "ID" }, { key: "subject", label: "Subject" }, { key: "category", label: "Category" }, { key: "studentId", label: "Student" }, { key: "assignedTo", label: "Assigned" }, { key: "status", label: "Status", type: "badge" }, { key: "createdAt", label: "Date", type: "date" }],
    filters: [{ key: "status", label: "Status", options: ["Open", "In Progress", "Resolved", "Closed"] }],
    fields: [{ key: "subject", label: "Subject", required: true, wide: true }, { key: "category", label: "Category", type: "select", options: ["General", "Academic", "Fees", "Transport", "Behaviour", "Facility"], default: "General" },
      rel("student", "studentId", "Student"), rel("guardian", "guardianId", "Guardian"), rel("user", "assignedTo", "Assign to"),
      { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Resolved", "Closed"], default: "Open" },
      { key: "description", label: "Description", type: "textarea", wide: true }, { key: "response", label: "Response", type: "textarea", wide: true }],
  },
  ptmSlots: {
    title: "Parent–Teacher Meeting Slots", singular: "Slot", endpoint: "/ptm-slots", module: "communication",
    columns: [{ key: "slotDate", label: "Date", type: "date" }, { key: "startTime", label: "Start" }, { key: "endTime", label: "End" }, { key: "teacherId", label: "Teacher" }, { key: "guardianId", label: "Booked by" }, { key: "status", label: "Status", type: "badge" }],
    fields: [rel("teacher", "teacherId", "Teacher", { required: true }), { key: "slotDate", label: "Date", type: "date", required: true }, { key: "startTime", label: "Start", type: "time", required: true },
      { key: "endTime", label: "End", type: "time", required: true }, { key: "status", label: "Status", type: "select", options: ["Available", "Booked", "Completed", "Cancelled"], default: "Available" }, { key: "note", label: "Note", wide: true }],
  },
  libraryBooks: {
    title: "Book Catalog", singular: "Book", endpoint: "/library-books", module: "library", icon: Library,
    columns: [{ key: "id", label: "ID" }, { key: "title", label: "Title" }, { key: "author", label: "Author" }, { key: "category", label: "Category" }, { key: "shelf", label: "Shelf" },
      { key: "availableCopies", label: "Available", render: (r) => `${r.availableCopies}/${r.totalCopies}` }],
    fields: [{ key: "title", label: "Title", required: true, wide: true }, { key: "author", label: "Author" }, { key: "isbn", more: true, label: "ISBN" }, { key: "publisher", more: true, label: "Publisher" },
      { key: "category", label: "Category" }, { key: "language", more: true, label: "Language", type: "select", options: ["Bangla", "English", "Arabic", "Urdu", "Other"] }, { key: "shelf", more: true, label: "Shelf" },
      { key: "totalCopies", label: "Total copies", type: "number", default: 1 }, { key: "availableCopies", more: true, label: "Available copies", type: "number", default: 1 }, { key: "price", more: true, label: "Price", type: "money" }],
  },
  libraryIssues: {
    title: "Issued Books", singular: "Issue", endpoint: "/library-issues", module: "library", edit: false, delete: false,
    createLabel: "Issue book", createFn: (p) => http.post("/ops/library/issue", p),
    columns: [{ key: "id", label: "ID" }, { key: "bookId", label: "Book" }, { key: "borrowerName", label: "Borrower" }, { key: "borrowerType", label: "Type" },
      { key: "issueDate", label: "Issued", type: "date" }, { key: "dueDate", label: "Due", type: "date" }, { key: "fine", label: "Fine", type: "money" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "status", label: "Status", options: ["Issued", "Overdue", "Returned", "Lost"] }],
    fields: [rel("book", "bookId", "Book", { required: true }), { key: "borrowerType", label: "Borrower type", type: "select", options: ["Student", "Teacher", "Staff"], required: true, default: "Student" },
      { key: "borrowerId", label: "Borrower ID", required: true, hint: "STU-… / TCH-… / STF-…" }, { key: "dueDate", label: "Due date", type: "date" }, { key: "note", label: "Note", wide: true }],
    rowActions: (r, { toast, reload, ask }) => [
      { label: "Return", icon: Undo2, show: ["Issued", "Overdue"].includes(r.status), onClick: async () => {
        const ok = await ask({ title: "Return book", message: "Any overdue fine (৳5/day) is calculated automatically and recorded as collected at the counter.", input: false, confirmLabel: "Confirm return" });
        if (!ok) return;
        try { const d = await http.post(`/ops/library/return/${r.id}`, { finePaid: true }); toast.success(`Returned. Fine ${money(d.fine)}`); reload(); } catch (e) { toast.error(e); }
      } },
      { label: "Lost", compact: true, icon: LogOut, show: ["Issued", "Overdue"].includes(r.status), onClick: async () => {
        try { const d = await http.post(`/ops/library/return/${r.id}`, { lost: true }); toast.success(`Marked lost. Charge ${money(d.fine)}`); reload(); } catch (e) { toast.error(e); }
      } },
    ],
  },
  inventoryItems: {
    title: "Inventory Items", singular: "Item", endpoint: "/inventory-items", module: "inventory", icon: Package,
    columns: [{ key: "id", label: "ID" }, { key: "name", label: "Item" }, { key: "category", label: "Category" },
      { key: "quantity", label: "Stock", render: (r) => <span className={Number(r.quantity) <= Number(r.reorderLevel) ? "font-bold text-rose-600" : ""}>{Number(r.quantity)} {r.unit}</span> },
      { key: "reorderLevel", label: "Reorder at" }, { key: "location", label: "Location" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "category", label: "Category" }, { key: "unit", label: "Unit", default: "pcs" },
      { key: "reorderLevel", label: "Reorder level", type: "number", default: 0 }, { key: "unitPrice", label: "Unit price", type: "money" }, { key: "location", label: "Location" }],
  },
  inventorySuppliers: {
    title: "Suppliers", singular: "Supplier", endpoint: "/inventory-suppliers", module: "inventory",
    columns: [{ key: "name", label: "Name" }, { key: "contactPerson", label: "Contact" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "contactPerson", label: "Contact person" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "address", label: "Address", type: "textarea", wide: true }],
  },
  inventoryTransactions: {
    title: "Stock Movements", singular: "Movement", endpoint: "/inventory-transactions", module: "inventory", edit: false, delete: false,
    createLabel: "Record movement", createFn: (p) => http.post("/ops/inventory/movement", p),
    columns: [{ key: "txnDate", label: "Date", type: "date" }, { key: "itemId", label: "Item" }, { key: "txnType", label: "Type", type: "badge" }, { key: "quantity", label: "Qty" }, { key: "issuedTo", label: "Issued to" }, { key: "note", label: "Note" }],
    fields: [rel("item", "itemId", "Item", { required: true }), { key: "txnType", label: "Type", type: "select", options: ["Stock In", "Stock Out", "Issue", "Return", "Adjustment"], required: true },
      { key: "quantity", label: "Quantity", type: "number", required: true }, rel("supplier", "supplierId", "Supplier", { showIf: (f) => f.txnType === "Stock In" }),
      { key: "issuedTo", label: "Issued to (staff)", showIf: (f) => f.txnType === "Issue" }, { key: "unitPrice", label: "Unit price", type: "money" }, { key: "note", label: "Note", wide: true }],
  },
  assets: {
    title: "Asset Register", singular: "Asset", endpoint: "/assets", module: "inventory",
    columns: [{ key: "id", label: "ID" }, { key: "name", label: "Asset" }, { key: "category", label: "Category" }, { key: "location", label: "Location" }, { key: "condition", label: "Condition", type: "badge" },
      { key: "purchaseValue", label: "Value", type: "money" }, { key: "nextMaintenance", label: "Next maintenance", type: "date" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "category", label: "Category" }, { key: "location", label: "Location" }, { key: "purchaseDate", label: "Purchase date", type: "date" },
      { key: "purchaseValue", label: "Value", type: "money" }, { key: "condition", label: "Condition", type: "select", options: ["Good", "Fair", "Needs Repair", "Damaged", "Disposed"], default: "Good" },
      { key: "lastMaintenance", label: "Last maintenance", type: "date" }, { key: "nextMaintenance", label: "Next maintenance", type: "date" }],
  },
  visitors: {
    title: "Visitor Log", singular: "Visitor", endpoint: "/visitors", module: "inventory",
    columns: [{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "purpose", label: "Purpose" }, { key: "whomToMeet", label: "To meet" }, { key: "checkIn", label: "In", type: "datetime" }, { key: "checkOut", label: "Out", type: "datetime" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "phone", label: "Phone" }, { key: "purpose", label: "Purpose", required: true }, { key: "whomToMeet", label: "Whom to meet" }, { key: "idProof", label: "ID proof" }, { key: "note", label: "Note", wide: true }],
    rowActions: (r, { toast, reload }) => [{ label: "Check out", icon: LogOut, show: !r.checkOut, onClick: async () => {
      try { await http.post(`/ops/visitors/${r.id}/checkout`); toast.success("Checked out"); reload(); } catch (e) { toast.error(e); }
    } }],
  },
  vehicles: {
    title: "Vehicles", singular: "Vehicle", endpoint: "/vehicles", module: "transport", icon: Bus,
    columns: [{ key: "registrationNo", label: "Reg. no." }, { key: "vehicleType", label: "Type" }, { key: "capacity", label: "Capacity" }, { key: "driverName", label: "Driver" }, { key: "driverPhone", label: "Phone" }, { key: "gpsDeviceId", label: "GPS device" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "registrationNo", label: "Registration no.", required: true }, { key: "vehicleType", label: "Type", type: "select", options: ["Bus", "Minibus", "Microbus", "Van"], default: "Bus" },
      { key: "capacity", label: "Capacity", type: "number", default: 40 }, { key: "driverName", label: "Driver name" }, { key: "driverPhone", label: "Driver phone" }, { key: "helperName", label: "Helper" },
      { key: "gpsDeviceId", label: "GPS device ID", hint: "Trackers post to /api/v1/public/gps with X-GPS-Key" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  routes: {
    title: "Transport Routes", singular: "Route", endpoint: "/transport-routes", module: "transport",
    columns: [{ key: "name", label: "Route" }, { key: "vehicleId", label: "Vehicle" }, { key: "stops", label: "Stops", render: (r) => (r.stops || []).map((s) => s.name).join(" → ") }, { key: "monthlyFare", label: "Fare", type: "money" }, { key: "morningDeparture", label: "Departs" }],
    fields: [{ key: "name", label: "Route name", required: true }, rel("vehicle", "vehicleId", "Vehicle"), { key: "monthlyFare", label: "Monthly fare", type: "money", default: 0 },
      { key: "morningDeparture", label: "Morning departure", type: "time" }, { key: "eveningDeparture", label: "Evening departure", type: "time" },
      { key: "stops", label: "Stops (JSON)", type: "json", wide: true, default: [{ name: "Stop 1", time: "07:00", fare: 0, lat: null, lng: null }], hint: "Add lat / lng (and optional radius in metres) to a stop to send automatic bus-arrival alerts to guardians." }],
  },
  transportAssignments: {
    title: "Student Transport Assignment", singular: "Assignment", endpoint: "/transport-assignments", module: "transport",
    columns: [{ key: "studentId", label: "Student" }, { key: "routeId", label: "Route" }, { key: "stopName", label: "Pickup stop" }, { key: "dropoffStop", label: "Drop-off stop" }, { key: "monthlyFee", label: "Fee", type: "money" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "routeId", label: "Route", relation: REL.route }],
    fields: [rel("student", "studentId", "Student", { required: true }), rel("route", "routeId", "Route", { required: true }), { key: "stopName", label: "Pickup stop" }, { key: "dropoffStop", label: "Drop-off stop", hint: "Leave empty when the child is dropped at the pickup stop." },
      { key: "monthlyFee", label: "Monthly fee", type: "money", default: 0 }, { key: "startDate", label: "Start date", type: "date" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
  halaqas: {
    title: "Halaqa", singular: "Halaqa", endpoint: "/halaqas", module: "madrasa", icon: Moon,
    columns: [{ key: "name", label: "Halaqa" }, { key: "halaqaType", label: "Type", type: "badge" }, { key: "ustadId", label: "Ustad" }, { key: "room", label: "Room" }, { key: "capacity", label: "Capacity" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "halaqaType", label: "Type", type: "select", options: ["Hifz", "Nazera", "Nurani", "Kitab"], default: "Hifz" },
      rel("teacher", "ustadId", "Ustad"), { key: "room", label: "Room" }, { key: "capacity", label: "Capacity", type: "number", default: 20 }],
  },
  halaqaMembers: {
    title: "Halaqa Members", singular: "Member", endpoint: "/halaqa-members", module: "madrasa",
    columns: [{ key: "halaqaId", label: "Halaqa" }, { key: "studentId", label: "Student" }, { key: "joinedOn", label: "Joined", type: "date" }],
    filters: [{ key: "halaqaId", label: "Halaqa", relation: REL.halaqa }],
    fields: [rel("halaqa", "halaqaId", "Halaqa", { required: true }), rel("student", "studentId", "Student", { required: true }), { key: "joinedOn", label: "Joined", type: "date" }],
  },
  hostelRooms: {
    title: "Hostel Rooms (Darul Iqama)", singular: "Room", endpoint: "/hostel-rooms", module: "hostel", icon: School,
    columns: [{ key: "building", label: "Building" }, { key: "roomNo", label: "Room" }, { key: "capacity", label: "Seats" }, { key: "gender", label: "Gender" }, { key: "monthlyFee", label: "Fee", type: "money" }],
    fields: [{ key: "building", label: "Building", required: true }, { key: "roomNo", label: "Room no.", required: true }, { key: "capacity", label: "Seats", type: "number", default: 4 },
      { key: "gender", label: "Gender", type: "select", options: ["Male", "Female"] }, { key: "monthlyFee", label: "Monthly fee", type: "money", default: 0 }],
  },
  hostelAllocations: {
    title: "Seat Allocations", singular: "Allocation", endpoint: "/hostel-allocations", module: "hostel",
    columns: [{ key: "roomId", label: "Room" }, { key: "studentId", label: "Student" }, { key: "seatNo", label: "Seat" }, { key: "fromDate", label: "From", type: "date" }, { key: "isLillah", label: "Lillah", type: "boolean" }, { key: "status", label: "Status", type: "badge" }],
    fields: [rel("hostelRoom", "roomId", "Room", { required: true }), rel("student", "studentId", "Student", { required: true }), { key: "seatNo", label: "Seat no." },
      { key: "fromDate", label: "From", type: "date" }, { key: "toDate", label: "To", type: "date" }, { key: "isLillah", label: "Lillah (free boarding)", type: "checkbox" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" }],
  },
  mealRecords: {
    title: "Meal Records (Matbakh)", singular: "Meal record", endpoint: "/meal-records", module: "hostel",
    columns: [{ key: "mealDate", label: "Date", type: "date" }, { key: "mealType", label: "Meal" }, { key: "mealCount", label: "Count" }, { key: "bazarCost", label: "Bazar cost", type: "money" },
      { key: "perHead", label: "Per head", render: (r) => (r.mealCount ? money(Number(r.bazarCost) / Number(r.mealCount)) : "—") }, { key: "menu", label: "Menu" }],
    fields: [{ key: "mealDate", label: "Date", type: "date", required: true }, { key: "mealType", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner", "Sehri", "Iftar"], required: true },
      { key: "mealCount", label: "Meal count", type: "number", default: 0 }, { key: "bazarCost", label: "Bazar cost", type: "money", default: 0 }, { key: "menu", label: "Menu" }, { key: "note", label: "Note", wide: true }],
  },
  donors: {
    title: "Donors", singular: "Donor", endpoint: "/donors", module: "donations",
    columns: [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "mobile", label: "Mobile" }, { key: "donorType", label: "Type" }],
    fields: [{ key: "name", label: "Name", required: true }, { key: "mobile", label: "Mobile" }, { key: "email", label: "Email" }, { key: "donorType", label: "Type", type: "select", options: ["Individual", "Organization"], default: "Individual" }, { key: "address", label: "Address", type: "textarea", wide: true }],
  },
  donations: {
    title: "Donations (Zakat / Sadaqah / Lillah / General)", singular: "Donation", endpoint: "/donations", module: "donations", edit: false, delete: false, icon: HandCoins,
    columns: [{ key: "id", label: "Receipt" }, { key: "donationDate", label: "Date", type: "date" }, { key: "donorName", label: "Donor" }, { key: "fund", label: "Fund", type: "badge" }, { key: "amount", label: "Amount", type: "money" }, { key: "method", label: "Method" }],
    filters: [{ key: "fund", label: "Fund", options: ["General", "Zakat", "Sadaqah", "Lillah", "Development", "Waqf"] }],
    fields: [rel("donor", "donorId", "Donor"), { key: "donorName", label: "Donor name" }, { key: "fund", label: "Fund", type: "select", options: ["General", "Zakat", "Sadaqah", "Lillah", "Development", "Waqf"], required: true, default: "General" },
      { key: "amount", label: "Amount", type: "money", required: true }, { key: "donationDate", label: "Date", type: "date" }, { key: "method", label: "Method", type: "select", options: ["Cash", "bKash", "Nagad", "Bank"], default: "Cash" },
      { key: "referenceNo", label: "Reference" }, { key: "note", label: "Note", wide: true }],
  },
  approvalDelegations: {
    title: "Approval Delegation", singular: "Delegation", endpoint: "/approval-delegations", module: "approvals",
    subtitle: "Temporarily delegate approval power; expires automatically after the end date.",
    columns: [{ key: "fromUserId", label: "From" }, { key: "toUserId", label: "To" }, { key: "startDate", label: "Start", type: "date" }, { key: "endDate", label: "End", type: "date" }, { key: "status", label: "Status", type: "badge" }],
    fields: [rel("user", "fromUserId", "From user", { required: true }), rel("user", "toUserId", "To user", { required: true }), { key: "startDate", label: "Start", type: "date", required: true },
      { key: "endDate", label: "End", type: "date", required: true }, { key: "requestTypes", label: "Request types (blank = all)", type: "list", wide: true }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Active" }],
  },
};

export function MiniStatus({ value }) {
  return <Badge>{value}</Badge>;
}
