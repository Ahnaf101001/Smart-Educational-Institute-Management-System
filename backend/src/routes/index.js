const express = require("express");
const authRoutes = require("./auth");
const publicRoutes = require("./public");
const attendanceRoutes = require("./attendance");
const marksRoutes = require("./marks");
const feesRoutes = require("./fees");
const admissionActions = require("./admissions");
const settingsRoutes = require("./settings");
const instituteProfileRoutes = require("./instituteProfile");
const systemSettingsRoutes = require("./systemSettings");
const dashboardRoutes = require("./dashboard");
const dashboardsRoutes = require("./dashboards");
const reportsRoutes = require("./reports");
const draftRoutes = require("./drafts");
const workflowRoutes = require("./workflows");
const approvalsRoutes = require("./approvals");
const auditRoutes = require("./audit");
const setupRoutes = require("./setup");
const studentRoutes = require("./students");
const guardianRoutes = require("./guardians");
const examRoutes = require("./exams");
const leaveRoutes = require("./leave");
const deviceRoutes = require("./devices");
const accountsRoutes = require("./accounts");
const operationsRoutes = require("./operations");
const idCardRoutes = require("./idcards");
const portalRoutes = require("./portal");
const uploadRoutes = require("./uploads");
const backupRoutes = require("./backup");
const createCrudRouter = require("./crud");
const { authenticate, requirePermission } = require("../middleware/auth");
require("../services/approvalHandlers");

const router = express.Router();

// Unauthenticated.
router.use("/auth", authRoutes);
router.use("/public", publicRoutes);

router.use(authenticate);

router.use("/dashboard", requirePermission("dashboard", "view"), dashboardRoutes);
router.use("/dashboard", dashboardsRoutes);
router.use("/reports", requirePermission("reports", "view"), reportsRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/marks", marksRoutes);
router.use("/fees", feesRoutes);
router.use("/academic-settings", settingsRoutes);
router.use("/institute-profile", instituteProfileRoutes);
router.use("/system-settings", systemSettingsRoutes);
router.use("/admissions", admissionActions);
router.use("/drafts", draftRoutes);
router.use("/approvals", approvalsRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/setup", setupRoutes);
router.use("/students", studentRoutes);
router.use("/guardians", guardianRoutes);
router.use("/exams", examRoutes);
router.use("/leave", leaveRoutes);
router.use("/devices", deviceRoutes);
router.use("/accounts", accountsRoutes);
router.use("/ops", operationsRoutes);
router.use("/idcards", idCardRoutes);
router.use("/portal", portalRoutes);
router.use("/uploads", uploadRoutes);
router.use("/backups", backupRoutes);
router.use(workflowRoutes);

for (const [path, resource] of [
  ["students", "students"],
  ["admissions", "admissions"],
  ["admission-circulars", "admissionCirculars"],
  ["guardians", "guardians"],
  ["guardian-students", "guardianStudents"],
  ["enrollments", "enrollments"],
  ["student-documents", "studentDocuments"],
  ["student-status-history", "studentStatusHistory"],
  ["certificates", "certificates"],
  ["teachers", "teachers"],
  ["staff", "staff"],
  ["branches", "branches"],
  ["shifts", "shifts"],
  ["student-groups", "studentGroups"],
  ["rooms", "rooms"],
  ["classes", "classes"],
  ["subjects", "subjects"],
  ["class-subjects", "classSubjects"],
  ["class-teacher-history", "classTeacherHistory"],
  ["academic-years", "academicYears"],
  ["academic-events", "academicEvents"],
  ["homework", "homework"],
  ["learning-resources", "learningResources"],
  ["syllabus", "syllabus"],
  ["substitutes", "substitutes"],
  ["assignments", "assignments"],
  ["exams", "exams"],
  ["exam-schedules", "examSchedules"],
  ["grade-scales", "gradeScales"],
  ["results", "results"],
  ["result-versions", "resultVersions"],
  ["marks-entry-status", "marksEntryStatus"],
  ["fee-heads", "feeHeads"],
  ["fee-structures", "feeStructures"],
  ["fee-invoices", "feeInvoices"],
  ["fee-discounts", "feeDiscounts"],
  ["cash-closings", "cashClosings"],
  ["refunds", "refunds"],
  ["gateway-transactions", "gatewayTransactions"],
  ["transactions", "transactions"],
  ["account-heads", "accountHeads"],
  ["vouchers", "vouchers"],
  ["bank-accounts", "bankAccounts"],
  ["bank-transactions", "bankTransactions"],
  ["payroll", "payroll"],
  ["salary-structures", "salaryStructures"],
  ["salary-advances", "salaryAdvances"],
  ["routine", "routine"],
  ["notices", "notices"],
  ["message-templates", "messageTemplates"],
  ["message-logs", "messageLogs"],
  ["complaints", "complaints"],
  ["ptm-slots", "ptmSlots"],
  ["attendance-records", "attendance"],
  ["staff-attendance", "staffAttendance"],
  ["attendance-devices", "devices"],
  ["biometric-enrollments", "biometricEnrollments"],
  ["device-events", "deviceEvents"],
  ["leave-types", "leaveTypes"],
  ["leave-requests", "leaveRequests"],
  ["library-books", "libraryBooks"],
  ["library-issues", "libraryIssues"],
  ["inventory-suppliers", "inventorySuppliers"],
  ["inventory-items", "inventoryItems"],
  ["inventory-transactions", "inventoryTransactions"],
  ["assets", "assets"],
  ["visitors", "visitors"],
  ["textbook-distributions", "textbookDistributions"],
  ["clubs", "clubs"],
  ["vehicles", "vehicles"],
  ["transport-routes", "routes"],
  ["transport-assignments", "transportAssignments"],
  ["halaqas", "halaqas"],
  ["halaqa-members", "halaqaMembers"],
  ["hifz-logs", "hifzLogs"],
  ["hifz-progress", "hifzProgress"],
  ["salah-attendance", "salahAttendance"],
  ["hostel-rooms", "hostelRooms"],
  ["hostel-allocations", "hostelAllocations"],
  ["meal-records", "mealRecords"],
  ["donors", "donors"],
  ["donations", "donations"],
  ["online-classes", "onlineClasses"],
  ["id-card-print-jobs", "idCardPrintJobs"],
  ["approval-delegations", "approvalDelegations"],
  ["saved-filters", "savedFilters"],
  ["users", "users"],
  ["roles", "roles"],
]) {
  router.use(`/${path}`, createCrudRouter(resource));
}

module.exports = router;
