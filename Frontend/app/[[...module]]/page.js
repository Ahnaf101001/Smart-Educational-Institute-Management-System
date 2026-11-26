"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaSchool } from "react-icons/fa6";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bell, BookOpen, BriefcaseBusiness, Bus, Calculator, CalendarDays, ChevronDown, CircleHelp, ClipboardCheck,
  ClipboardList, CreditCard, DollarSign, FileText, Globe2, IdCard, LayoutDashboard, Library, LogOut, Menu, MessageSquare,
  Moon, MoonStar, Package, Search, Settings as SettingsIcon, ShieldCheck, UserPlus, UserRound, UserRoundCheck, Users, UsersRound, X,
} from "lucide-react";

import Academic from "../components/Academic";
import AddStudent from "../components/AddStudent";
import AdmissionOverview from "../components/AdmissionOverview";
import Applications from "../components/Applications";
import DashboardContent from "../components/DashboardContent";
import NewApplication from "../components/NewApplication";
import Staff from "../components/Staff";
import StudentList from "../components/StudentList";
import Teachers from "../components/Teachers";
import Attendance from "../components/Attendance";
import ExamsOverview from "../components/ExamsOverview";
import ResultProcessing from "../components/ResultProcessing";
import Marksheet from "../components/Marksheet";
import Routine from "../components/Routine";
import FeesOverview from "../components/FeesOverview";
import AddFee from "../components/AddFee";
import CollectFee from "../components/CollectFee";
import Receipts from "../components/Receipts";
import AccountsOverview from "../components/AccountsOverview";
import IncomeEntry from "../components/IncomeEntry";
import ExpenseEntry from "../components/ExpenseEntry";
import Ledger from "../components/Ledger";
import Payroll from "../components/Payroll";
import NoticeSMS from "../components/NoticeSMS";
import Reports from "../components/Reports";
import Settings from "../components/Settings";
import Login from "../components/Login";

import Overview from "../components/admin/Overview";
import Approvals from "../components/admin/Approvals";
import AuditLog from "../components/admin/AuditLog";
import InstitutionSetup from "../components/admin/InstitutionSetup";
import RolesPermissions from "../components/admin/RolesPermissions";
import IdCardCenter from "../components/idcards/IdCardCenter";
import MarksEntryPro from "../components/exams/MarksEntryPro";
import ResultWorkflow from "../components/exams/ResultWorkflow";
import StudentTools, { Student360 } from "../components/students/StudentTools";
import { AccountBooks, FeeOperations } from "../components/finance/FinanceOps";
import { AttendanceHub, CommunicationHub, HrHub, MadrasaHub, SimpleTabsPage, TransportHub } from "../components/operations/Hubs";
import { GalleryPreview, HijriHolidays } from "../components/extensions/CalendarGallery";
import TeacherPortal from "../components/portals/TeacherPortal";
import GuardianPortal from "../components/portals/GuardianPortal";
import ResourceManager from "../components/ui/ResourceManager";
import CommandPalette from "../components/ui/CommandPalette";
import { CONFIGS } from "../components/modules/configs";
import {
  AccountSecurity, BoardCenter, BranchDashboard, EXTRA_CONFIGS, FinanceExports, HifzTargets, IntegrationsPage, LearningHub, Moderation, SeatPlan,
  SpecialScheduleBanner,
} from "../components/extensions/Extras";

import { authApi, http, systemSettingsApi, instituteProfileApi } from "../lib/api";
import { can, UserContext } from "../lib/access";
import { I18nContext, toBanglaDate, toBnDigits, toHijriDate, translate } from "../lib/i18n";

const RM = (key) => function ResourcePage() { return <ResourceManager config={CONFIGS[key]} />; };
const RMX = (key) => function ExtraResourcePage() { return <ResourceManager config={EXTRA_CONFIGS[key]} />; };
const OPTIONAL = ["madrasa", "transport", "library", "inventory", "online_classes", "hostel", "donations"];
const OPT_IN_ONLY = ["madrasa", "hostel", "donations"];

// Navigation (SRS Appendix A). `perm` = [module, action] pairs; any match shows the item.
const NAVIGATION = [
  {
    label: "Dashboard", icon: LayoutDashboard, perm: [["dashboard"]],
    children: [
      { label: "Overview", render: (ctx) => <Overview onNavigate={ctx.navigateTo} /> },
      { label: "Charts", render: () => <DashboardContent /> },
      { label: "My Day", show: (u) => u?.linkedType === "Teacher", render: (ctx) => <TeacherPortal onNavigate={ctx.navigateTo} /> },
      { label: "Branches", render: () => <BranchDashboard /> },
    ],
  },
  {
    label: "Admission", icon: UserPlus, perm: [["admission"]],
    children: [
      { label: "Circulars", render: RM("admissionCirculars") },
      { label: "Overview", render: () => <AdmissionOverview /> },
      { label: "New Application", render: (ctx) => <NewApplication onSubmitted={() => ctx.navigateTo("Admission", "Applications")} /> },
      { label: "Applications", render: (ctx) => <Applications onViewStudents={() => ctx.navigateTo("Students", "Student List")} /> },
    ],
  },
  {
    label: "Students", icon: Users, perm: [["students"]],
    children: [
      { label: "Student List", render: (ctx) => <StudentList onAddStudent={() => ctx.navigateTo("Students", "Add Student")} /> },
      { label: "Add Student", perm: [["students", "create"]], render: (ctx) => <AddStudent onCancel={() => ctx.navigateTo("Students", "Student List")} onSaved={() => ctx.navigateTo("Students", "Student List")} /> },
      { label: "Student 360", render: () => <Student360 /> },
      { label: "Promotion & Import", perm: [["students", "edit"], ["students", "create"]], render: () => <StudentTools /> },
      { label: "Certificates", perm: [["certificates"]], render: RM("certificates") },
      { label: "Board & Stipend", render: () => <BoardCenter /> },
      { label: "Textbooks & Clubs", render: () => <SimpleTabsPage title="Textbooks, Houses & Clubs" icon={BookOpen} tabs={[{ key: "tb", label: "Textbook distribution", render: () => <ResourceManager embedded config={CONFIGS.textbookDistributions} /> }, { key: "clubs", label: "House / Club / ECA", render: () => <ResourceManager embedded config={CONFIGS.clubs} /> }, { key: "points", label: "House points", render: () => <ResourceManager embedded config={EXTRA_CONFIGS.housePoints} /> }, { key: "clubatt", label: "Club attendance", render: () => <ResourceManager embedded config={EXTRA_CONFIGS.clubAttendance} /> }, { key: "daily", label: "Pre-school daily log", render: () => <ResourceManager embedded config={EXTRA_CONFIGS.dailyLogs} /> }, { key: "groups", label: "Group changes", render: () => <ResourceManager embedded config={EXTRA_CONFIGS.studentGroupHistory} /> }]} /> },
    ],
  },
  { label: "Guardians", icon: UsersRound, perm: [["guardians"]], render: RM("guardians") },
  {
    label: "ID Card Center", icon: IdCard, perm: [["idcards"]],
    children: [
      { label: "Template Gallery", render: () => <IdCardCenter initialTab="gallery" /> },
      { label: "Generate & Print", render: () => <IdCardCenter initialTab="generate" /> },
      { label: "Print History", render: () => <IdCardCenter initialTab="history" /> },
      { label: "Issued Cards", render: () => <IdCardCenter initialTab="cards" /> },
    ],
  },
  { label: "Teachers", icon: UserRoundCheck, perm: [["teachers"]], render: () => <Teachers /> },
  { label: "Staff", icon: BriefcaseBusiness, perm: [["staff"]], render: () => <Staff /> },
  {
    label: "HR & Payroll", icon: CreditCard, perm: [["payroll"]],
    children: [
      { label: "Payroll", render: () => <Payroll /> },
      { label: "Salary Structure", render: () => <HrHub /> },
    ],
  },
  {
    label: "Academic", icon: BookOpen, perm: [["academic"], ["homework"], ["online_classes"]],
    children: [
      { label: "Setup", perm: [["academic"]], render: () => <Academic /> },
      { label: "Subject Mapping", perm: [["academic"]], render: () => <SimpleTabsPage title="Subjects per class & class teachers" icon={BookOpen} tabs={[{ key: "map", label: "Class–subject mapping", render: () => <ResourceManager embedded config={CONFIGS.classSubjects} /> }, { key: "ct", label: "Class teacher history", render: () => <ResourceManager embedded config={CONFIGS.classTeacherHistory} /> }]} /> },
      { label: "Calendar", perm: [["academic"]], render: () => <SimpleTabsPage title="Academic Calendar" icon={BookOpen} subtitle="Holidays, exams and events; Hijri occasions suggested automatically" tabs={[{ key: "events", label: "Events & holidays", render: () => <ResourceManager embedded config={CONFIGS.academicEvents} /> }, { key: "hijri", label: "Hijri holiday suggestions", render: () => <HijriHolidays /> }]} /> },
      { label: "Homework", perm: [["homework"]], render: RM("homework") },
      { label: "Resources & Syllabus", perm: [["homework"]], render: () => <SimpleTabsPage title="Class notes, resources & syllabus" icon={BookOpen} tabs={[{ key: "r", label: "Resources", render: () => <ResourceManager embedded config={CONFIGS.learningResources} /> }, { key: "s", label: "Syllabus & lesson plan", render: () => <ResourceManager embedded config={CONFIGS.syllabus} /> }]} /> },
      { label: "Online Classes", perm: [["online_classes"]], optional: "online_classes", render: RM("onlineClasses") },
      { label: "Quizzes & Coursework", perm: [["homework"], ["online_classes"]], render: () => <LearningHub /> },
    ],
  },
  {
    label: "Routine", icon: CalendarDays, perm: [["routine"]],
    children: [
      { label: "Class Routine", render: () => <><SpecialScheduleBanner /><Routine /></> },
      { label: "Special Schedules", render: RMX("specialSchedules") },
      { label: "Substitutes", render: RM("substitutes") },
    ],
  },
  {
    label: "Attendance", icon: ClipboardList, perm: [["attendance"], ["staff_attendance"], ["devices"], ["leave"]],
    children: [
      { label: "Student Attendance", perm: [["attendance"]], render: () => <Attendance /> },
      { label: "Staff Attendance", perm: [["staff_attendance"]], render: () => <AttendanceHub initialTab="staff" /> },
      { label: "Leave Requests", perm: [["leave"], ["attendance"]], render: () => <AttendanceHub initialTab="leave" /> },
      { label: "Devices & RFID", perm: [["devices"], ["attendance", "create"]], render: () => <AttendanceHub initialTab="scan" /> },
      { label: "Attendance Reports", perm: [["attendance"]], render: () => <AttendanceHub initialTab="reports" /> },
    ],
  },
  {
    label: "Exams & Results", icon: FileText, perm: [["exams"], ["marks"], ["results"]],
    children: [
      { label: "Overview", perm: [["exams"]], render: () => <ExamsOverview /> },
      { label: "Exam Setup", perm: [["exams"]], render: RM("exams") },
      { label: "Seat Plan", perm: [["exams"]], render: () => <SeatPlan /> },
      { label: "Marks Entry", perm: [["marks"]], render: () => <MarksEntryPro /> },
      { label: "Result Workflow", perm: [["results"], ["exams"]], render: () => <ResultWorkflow /> },
      { label: "Result Processing", perm: [["results"]], render: () => <ResultProcessing /> },
      { label: "Marksheet", perm: [["results"]], render: () => <Marksheet /> },
    ],
  },
  {
    label: "Fees", icon: DollarSign, perm: [["fees"]],
    children: [
      { label: "Overview", render: () => <FeesOverview /> },
      { label: "Add Fee", perm: [["fees", "create"]], render: () => <AddFee /> },
      { label: "Collect Fee", perm: [["fees", "create"]], render: () => <CollectFee /> },
      { label: "Receipts", render: () => <Receipts /> },
      { label: "Fee Operations", render: () => <FeeOperations /> },
    ],
  },
  {
    label: "Accounts", icon: Calculator, perm: [["accounts"]],
    children: [
      { label: "Overview", render: (ctx) => <AccountsOverview onNavigate={(child) => ctx.navigateTo("Accounts", child)} /> },
      { label: "Income Entry", render: () => <IncomeEntry /> },
      { label: "Expense Entry", render: () => <ExpenseEntry /> },
      { label: "Ledger", render: () => <Ledger /> },
      { label: "Books & Reports", render: () => <AccountBooks /> },
      { label: "Exports", perm: [["accounts", "export"], ["payroll", "export"]], render: () => <FinanceExports /> },
    ],
  },
  {
    label: "Communication", icon: MessageSquare, perm: [["communication"]],
    children: [
      { label: "Notice & SMS", render: () => <NoticeSMS /> },
      { label: "Message Log", render: () => <CommunicationHub initialTab="logs" /> },
      { label: "Messages", render: () => <CommunicationHub initialTab="messages" /> },
      { label: "Complaints & PTM", render: () => <CommunicationHub initialTab="complaints" /> },
      { label: "Photo Gallery", render: () => <SimpleTabsPage title="Photo Gallery" icon={MessageSquare} subtitle="Event albums for the website, guardian portal and guardian app" tabs={[{ key: "preview", label: "Albums", render: () => <GalleryPreview /> }, { key: "albums", label: "Manage albums", render: () => <ResourceManager embedded config={EXTRA_CONFIGS.galleryAlbums} /> }, { key: "photos", label: "Photos", render: () => <ResourceManager embedded config={EXTRA_CONFIGS.galleryPhotos} /> }]} /> },
      { label: "Moderation", perm: [["communication", "approve"]], render: () => <Moderation /> },
    ],
  },
  { label: "Library", icon: Library, perm: [["library"]], optional: "library", render: () => <SimpleTabsPage title="Library" icon={Library} subtitle="Catalog, issue/return, due dates and fines" tabs={[{ key: "issues", label: "Issue & return", render: () => <ResourceManager embedded config={CONFIGS.libraryIssues} /> }, { key: "books", label: "Book catalog", render: () => <ResourceManager embedded config={CONFIGS.libraryBooks} /> }]} /> },
  { label: "Inventory & Assets", icon: Package, perm: [["inventory"]], optional: "inventory", render: () => <SimpleTabsPage title="Inventory, Assets & Visitors" icon={Package} tabs={[{ key: "items", label: "Items", render: () => <ResourceManager embedded config={CONFIGS.inventoryItems} /> }, { key: "mv", label: "Stock movements", render: () => <ResourceManager embedded config={CONFIGS.inventoryTransactions} /> }, { key: "sup", label: "Suppliers", render: () => <ResourceManager embedded config={CONFIGS.inventorySuppliers} /> }, { key: "assets", label: "Asset register", render: () => <ResourceManager embedded config={CONFIGS.assets} /> }, { key: "visitors", label: "Visitor log", render: () => <ResourceManager embedded config={CONFIGS.visitors} /> }]} /> },
  { label: "Transport", icon: Bus, perm: [["transport"]], optional: "transport", render: () => <TransportHub /> },
  {
    label: "Madrasa", icon: MoonStar, perm: [["madrasa"], ["hostel"], ["donations"]], optional: "madrasa",
    children: [
      { label: "Hifz & Halaqa", perm: [["madrasa"]], render: () => <MadrasaHub initialTab="hifz" /> },
      { label: "Salah", perm: [["madrasa"]], render: () => <MadrasaHub initialTab="salah" /> },
      { label: "Hostel & Meals", perm: [["hostel"]], render: () => <MadrasaHub initialTab="hostel" /> },
      { label: "Donations", perm: [["donations"]], render: () => <MadrasaHub initialTab="donations" /> },
      { label: "Hifz Targets", perm: [["madrasa"]], render: () => <HifzTargets /> },
    ],
  },
  { label: "Approvals", icon: ClipboardCheck, perm: [["approvals"], ["fees", "approve"], ["results", "approve"], ["attendance", "approve"], ["leave", "approve"], ["accounts", "approve"], ["admission", "approve"], ["communication", "approve"], ["idcards", "approve"], ["marks", "approve"], ["students", "edit"], ["fees", "edit"], ["marks", "create"], ["attendance", "create"]], render: () => <Approvals /> },
  {
    label: "Reports", icon: BarChart3, perm: [["reports"]],
    children: [
      { label: "Report Library", render: () => <Reports /> },
      { label: "Analytics", render: (ctx) => <Overview initialTab="analytics" onNavigate={ctx.navigateTo} /> },
    ],
  },
  {
    label: "Settings", icon: SettingsIcon, perm: [["settings"], ["users"], ["audit"], ["dashboard"]],
    children: [
      { label: "Institution Setup", perm: [["settings"]], render: () => <InstitutionSetup /> },
      { label: "Roles & Permissions", perm: [["users"]], render: () => <RolesPermissions /> },
      { label: "Approval Rules", perm: [["approvals"]], render: RMX("approvalRules") },
      { label: "Integrations & API", perm: [["settings"]], render: () => <IntegrationsPage /> },
      { label: "My Account & Devices", render: () => <AccountSecurity /> },
      { label: "Audit Log", perm: [["audit"]], render: () => <AuditLog /> },
      { label: "General", perm: [["settings"]], render: () => <Settings /> },
    ],
  },
];

function toRouteSegment(value) {
  return value.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function getRoutePath(parent, child) {
  if (parent === "Dashboard" && !child) return "/";
  const p = toRouteSegment(parent);
  return child ? `/${p}/${toRouteSegment(child)}` : `/${p}`;
}
function findByPath(pathname) {
  const clean = pathname.replace(/\/$/, "") || "/";
  if (clean === "/") return { parent: "Dashboard", child: null };
  for (const item of NAVIGATION) {
    if (getRoutePath(item.label) === clean) return { parent: item.label, child: null };
    for (const c of item.children || []) if (getRoutePath(item.label, c.label) === clean) return { parent: item.label, child: c.label };
  }
  return { parent: "Dashboard", child: null };
}

function allowed(user, perm) {
  if (!perm) return true;
  return perm.some(([m, a]) => can(user, m, a || "view"));
}
// Opt-in modules (madrasa, hostel, donations) appear when enabled (or when a
// madrasa line is configured); default-on modules hide only when switched off ("!key").
function optionalVisible(key, settings, profile) {
  if (!key || !OPTIONAL.includes(key)) return true;
  const enabled = settings?.enabledModules || [];
  const types = profile?.institutionTypes || [];
  if (OPT_IN_ONLY.includes(key)) {
    return enabled.includes(key) || (key === "madrasa" && types.some((t) => /Madrasa/i.test(t)));
  }
  return !enabled.includes(`!${key}`);
}

// Sidebar groups: daily tasks first, setup last. Only the order and headings change –
// every page, URL and permission filter stays exactly as defined in NAVIGATION.
const NAV_GROUPS = [
  ["Daily work", ["Dashboard", "Attendance", "Fees", "Communication", "Approvals"]],
  ["People", ["Students", "Admission", "Guardians", "Teachers", "Staff", "ID Card Center"]],
  ["Academics & exams", ["Academic", "Routine", "Exams & Results"]],
  ["Finance & HR", ["Accounts", "HR & Payroll"]],
  ["Operations & settings", ["Library", "Inventory & Assets", "Transport", "Madrasa", "Reports", "Settings"]],
];
const GROUP_OF = Object.fromEntries(NAV_GROUPS.flatMap(([g, labels], gi) => labels.map((l, li) => [l, { group: g, order: gi * 100 + li }])));

function useVisibleNavigation(user, settings, profile) {
  return useMemo(() => NAVIGATION
    .filter((i) => allowed(user, i.perm) && optionalVisible(i.optional, settings, profile))
    .map((i) => ({ ...i, group: GROUP_OF[i.label]?.group || "Operations & settings", children: i.children?.filter((c) => allowed(user, c.perm) && (!c.show || c.show(user)) && optionalVisible(c.optional, settings, profile)) }))
    .filter((i) => !i.children || i.children.length)
    .sort((a, b) => (GROUP_OF[a.label]?.order ?? 999) - (GROUP_OF[b.label]?.order ?? 999)), [user, settings, profile]);
}

function Sidebar({ isOpen, close, collapsed, toggleCollapsed, active, navigateTo, expanded, setExpanded, user, items, t, profile, badges }) {
  function toggleSection(label) {
    setExpanded((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]));
  }
  function select(parent, child) {
    navigateTo(parent, child);
    if (window.innerWidth < 1024) close();
  }
  return (
    <>
      <AnimatePresence>
        {isOpen && <motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />}
      </AnimatePresence>
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#223f91] text-white shadow-2xl transition-[width,transform] duration-300 lg:translate-x-0 ${collapsed ? "lg:w-[88px]" : "lg:w-[280px]"} ${isOpen ? "translate-x-0" : "-translate-x-full"}`} style={profile?.brandColor ? { backgroundColor: profile.brandColor } : undefined}>
        <div className={`flex h-[88px] shrink-0 items-center border-b border-white/10 ${collapsed ? "lg:justify-center lg:px-0" : "px-5"}`}>
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#55a5ff] to-[#1673f8] shadow-lg">
            {profile?.logoUrl ? <img src={profile.logoUrl} alt="" className="size-full bg-white object-contain p-1" /> : <FaSchool size={23} />}
          </div>
          <div className={`ml-3 min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <h1 className="truncate text-[15px] font-extrabold leading-5">{profile?.name || "Smart Educational Institute"}</h1>
            <p className="truncate text-xs font-medium text-[#9fd0ff]">Management System</p>
          </div>
          <button aria-label="Toggle menu" className={`ml-auto rounded-lg p-2 text-[#79bcff] hover:bg-white/10 hover:text-white ${collapsed ? "lg:hidden" : ""}`} onClick={() => (window.innerWidth < 1024 ? close() : toggleCollapsed())}>
            <X size={19} />
          </button>
        </div>
        {collapsed && <button aria-label="Expand menu" className="mx-auto mt-2 hidden rounded-lg p-2 text-[#79bcff] hover:bg-white/10 lg:block" onClick={toggleCollapsed}><Menu size={19} /></button>}
        <nav className={`sidebar-scroll flex-1 overflow-y-auto py-3 ${collapsed ? "lg:px-2" : "px-3"}`}>
          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive = active.parent === item.label;
            const isExpanded = expanded.includes(item.label) || isActive;
            const badge = badges[item.label];
            const newGroup = index === 0 || items[index - 1].group !== item.group;
            return (
              <div className="mb-1" key={item.label}>
                {newGroup && (
                  <p className={`px-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8fb8ee] ${index ? "pt-4" : "pt-1"} ${collapsed ? "lg:hidden" : ""}`}>{t(item.group)}</p>
                )}
                {newGroup && index > 0 && collapsed && <hr className="mx-3 my-2 hidden border-white/10 lg:block" />}
                <button
                  title={collapsed ? t(item.label) : undefined}
                  className={`flex w-full items-center rounded-[17px] py-2.5 text-left text-[15px] font-semibold transition ${collapsed ? "lg:justify-center lg:px-0" : "gap-3.5 px-4"} ${isActive ? (collapsed ? "bg-white/15" : "border-l-4 border-[#65bcff] bg-white/15 pl-3") : "text-[#dceaff] hover:bg-white/10 hover:text-white"}`}
                  onClick={() => (item.children && (!collapsed || window.innerWidth < 1024) ? toggleSection(item.label) : select(item.label, item.children ? item.children[0].label : null))}
                >
                  <Icon size={19} strokeWidth={1.8} className="shrink-0 text-[#59b2ff]" />
                  <span className={`flex-1 ${collapsed ? "lg:hidden" : ""}`}>{t(item.label)}</span>
                  {badge > 0 && <span className={`rounded-full bg-rose-500 px-1.5 text-[11px] font-bold ${collapsed ? "lg:hidden" : ""}`}>{badge}</span>}
                  {item.children && <ChevronDown size={15} className={`text-[#59b2ff] transition-transform ${collapsed ? "lg:hidden" : ""} ${isExpanded ? "" : "-rotate-90"}`} />}
                </button>
                <AnimatePresence initial={false}>
                  {item.children && isExpanded && (
                    <motion.div className={`ml-7 overflow-hidden border-l border-[#3e60aa] ${collapsed ? "lg:hidden" : ""}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="space-y-0.5 py-1 pl-3">
                        {item.children.map((c) => {
                          const on = isActive && active.child === c.label;
                          return (
                            <button key={c.label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold ${on ? "bg-[#2b59ba] text-white" : "text-[#9fd0ff] hover:bg-white/10 hover:text-white"}`} onClick={() => select(item.label, c.label)}>
                              <span className={`size-1.5 rounded-full ${on ? "bg-[#65bcff]" : "bg-[#2684ff]"}`} />{t(c.label)}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
        <div className={`flex h-[72px] shrink-0 items-center border-t border-white/10 ${collapsed ? "lg:justify-center lg:px-0" : "gap-3 px-5"}`}>
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#439bff] to-[#6963f4] text-sm font-bold">{user?.name?.slice(0, 2).toUpperCase() || "U"}</span>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <strong className="block truncate text-sm">{user?.name}</strong>
            <span className="block truncate text-xs text-[#9fd0ff]">{(user?.roles || [user?.role]).join(", ")}</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ openMenu, pageTitle, dark, setDark, onLogout, user, navigateTo, t, lang, setLang, digits, approvalsCount, openSearch }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const profileRef = useRef(null);
  const [formattedDate] = useState(() => new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  useEffect(() => {
    function close(e) {
      if (e.key === "Escape") { setProfileOpen(false); setNotifOpen(false); return; }
      if (e.type === "mousedown" && profileRef.current && !profileRef.current.contains(e.target)) { setProfileOpen(false); setNotifOpen(false); }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);
  useEffect(() => { http.get("/portal/notifications").then(setNotifications).catch(() => {}); }, [notifOpen]);
  const unread = notifications.filter((n) => !n.readAt).length + approvalsCount;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-3 sm:px-4 lg:px-7" ref={profileRef}>
      <button aria-label="Open navigation" className="mr-2 rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden" onClick={openMenu}><Menu size={20} /></button>
      <div className="min-w-0 flex-1 md:flex-none lg:w-[340px]">
        <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">{t(pageTitle)}</h2>
        <p className="hidden truncate text-xs text-slate-500 sm:block" suppressHydrationWarning title={toHijriDate(new Date(), lang)}>{digits(formattedDate)} · {toBanglaDate(new Date(), lang)}</p>
      </div>
      <button type="button" onClick={() => openSearch("")} className="ml-4 hidden h-10 w-[300px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-left text-sm text-slate-400 hover:border-blue-300 md:flex">
        <Search size={18} className="shrink-0 text-slate-500" />
        <span className="flex-1 truncate">{t("Search pages and students…")}</span>
        <kbd className="rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-500">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
        <button aria-label={t("Search")} className="grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => openSearch("")}><Search size={20} /></button>
        <button className="flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:px-3" onClick={() => setLang(lang === "bn" ? "en" : "bn")} title="Language / ভাষা">
          <Globe2 size={19} /><span className="hidden sm:inline">{lang === "bn" ? "বাংলা" : "EN"}</span>
        </button>
        <button aria-label="Toggle dark mode" className="hidden size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 sm:grid" onClick={() => setDark((v) => !v)}><Moon size={20} fill={dark ? "currentColor" : "none"} /></button>
        <div className="relative">
          <button aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}>
            <Bell size={21} />{unread > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div className="absolute right-0 top-[54px] w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {approvalsCount > 0 && <button className="block w-full bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-800" onClick={() => { setNotifOpen(false); navigateTo("Approvals"); }}>{approvalsCount} request(s) waiting for your approval →</button>}
                <div className="max-h-80 overflow-y-auto">
                  {!notifications.length && <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications.</p>}
                  {notifications.map((n) => <div key={n.id} className="border-t border-slate-100 px-4 py-3 text-sm"><b className="block">{n.subject || n.eventType}</b><span className="text-slate-600">{n.body}</span></div>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="relative">
          <button aria-expanded={profileOpen} className={`ml-1 flex items-center gap-2 rounded-2xl p-1.5 pr-2.5 sm:gap-3 ${profileOpen ? "bg-slate-100" : "hover:bg-slate-100"}`} onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}>
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#2879ff] to-[#6a62f6] text-xs font-bold text-white">{user?.name?.slice(0, 2).toUpperCase() || "U"}</span>
            <span className="hidden text-left lg:block"><strong className="block text-sm leading-4 text-slate-900">{user?.name}</strong><small className="text-xs text-slate-500">{user?.role}</small></span>
            <ChevronDown size={15} className={`hidden text-slate-400 transition-transform lg:block ${profileOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div className="absolute right-0 top-[58px] w-[240px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {[
                  ["My Profile", UserRound, () => navigateTo("Settings", "Roles & Permissions")],
                  ["Approvals", ShieldCheck, () => navigateTo("Approvals")],
                  ["Settings", SettingsIcon, () => navigateTo("Settings", can(user, "settings") ? "Institution Setup" : "Roles & Permissions")],
                  ["Help & Support", CircleHelp, () => window.open("/apply", "_blank")],
                  ["Sign Out", LogOut, onLogout],
                ].map(([label, Icon, action]) => (
                  <button key={label} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-slate-700 hover:bg-slate-100" onClick={() => { setProfileOpen(false); action(); }}>
                    <Icon size={18} strokeWidth={1.8} />{t(label)}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPath, setCurrentPath] = useState(pathname);
  const [expanded, setExpanded] = useState([]);
  const [dark, setDark] = useState(false);
  const [lang, setLangState] = useState("en");
  const [stateLoaded, setStateLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [profile, setProfile] = useState({});
  const [approvalsCount, setApprovalsCount] = useState(0);
  const active = findByPath(currentPath);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem("edumanage-lang", l); } catch { /* ignore */ }
  }, []);
  const i18n = useMemo(() => ({
    lang, setLang,
    t: (k) => translate(lang, k),
    digits: (v) => (lang === "bn" || settings.digitSystem === "bn" ? toBnDigits(v) : String(v ?? "")),
  }), [lang, setLang, settings.digitSystem]);

  const [search, setSearch] = useState({ open: false, query: "" });
  const navigateTo = useCallback((parent, child, query) => {
    const item = NAVIGATION.find((i) => i.label === parent);
    const target = child ?? (item?.children && parent !== "Dashboard" ? item.children[0].label : null);
    const next = getRoutePath(parent, target);
    router.push(query ? `${next}?${query}` : next);
    setCurrentPath(next);
  }, [router]);

  // Ctrl+K (or Cmd+K) opens the page / student search from anywhere.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch({ open: true, query: "" }); }
    }
    const onOpen = () => setSearch({ open: true, query: "" });
    window.addEventListener("keydown", onKey);
    window.addEventListener("edumanage:open-search", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("edumanage:open-search", onOpen); };
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("edumanage-token");
    localStorage.removeItem("edumanage-user");
    setUser(null);
  }, []);

  useEffect(() => { setCurrentPath(pathname); }, [pathname]);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const saved = JSON.parse(localStorage.getItem("edumanage-ui-state") || "{}");
        if (Array.isArray(saved.expanded)) setExpanded(saved.expanded);
        if (typeof saved.sidebarCollapsed === "boolean") setSidebarCollapsed(saved.sidebarCollapsed);
        if (typeof saved.dark === "boolean") setDark(saved.dark);
        const storedLang = localStorage.getItem("edumanage-lang");
        if (storedLang) setLangState(storedLang);
        if (localStorage.getItem("edumanage-token")) {
          try { setUser(await authApi.me()); } catch { localStorage.removeItem("edumanage-token"); localStorage.removeItem("edumanage-user"); }
        }
      } catch {
        localStorage.removeItem("edumanage-ui-state");
      } finally {
        setStateLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    systemSettingsApi.get().then((s) => { setSettings(s); if (!localStorage.getItem("edumanage-lang") && s.language) setLangState(s.language); }).catch(() => {});
    instituteProfileApi.get().then(setProfile).catch(() => {});
    const loadApprovals = () => http.get("/approvals/summary").then((s) => setApprovalsCount(s.pendingForMe || 0)).catch(() => {});
    loadApprovals();
    const iv = setInterval(loadApprovals, 60000);
    return () => clearInterval(iv);
  }, [user]);

  // Session expiry from the API and idle timeout.
  useEffect(() => {
    const expired = () => handleLogout();
    window.addEventListener("edumanage:session-expired", expired);
    return () => window.removeEventListener("edumanage:session-expired", expired);
  }, [handleLogout]);
  useEffect(() => {
    if (!user) return undefined;
    const minutes = Number(settings.sessionTimeoutMinutes || 30);
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(handleLogout, minutes * 60 * 1000); };
    ["mousemove", "keydown", "click", "touchstart"].forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => { clearTimeout(timer); ["mousemove", "keydown", "click", "touchstart"].forEach((e) => window.removeEventListener(e, reset)); };
  }, [user, settings.sessionTimeoutMinutes, handleLogout]);

  useEffect(() => {
    if (!stateLoaded) return;
    localStorage.setItem("edumanage-ui-state", JSON.stringify({ expanded, sidebarCollapsed, dark }));
  }, [expanded, sidebarCollapsed, dark, stateLoaded]);

  const items = useVisibleNavigation(user, settings, profile);

  if (!stateLoaded) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fb]">
        <div className="flex flex-col items-center">
          <div className="relative grid size-16 place-items-center"><span className="absolute inset-0 animate-spin rounded-full border-[3px] border-blue-100 border-t-[#2879ff]" /><FaSchool className="text-[#2879ff]" size={24} /></div>
          <p className="mt-4 text-sm font-semibold text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Login onLoginSuccess={(u) => { setUser(u); router.push("/"); setCurrentPath("/"); }} />;
  }

  const ctxValue = { user, settings, profile };
  const isGuardian = user.linkedType === "Guardian" || (user.roles || []).some((r) => String(r).toLowerCase() === "guardian");
  if (isGuardian && !user.isAdmin) {
    return (
      <I18nContext.Provider value={i18n}>
        <UserContext.Provider value={ctxValue}><GuardianPortal onLogout={handleLogout} /></UserContext.Provider>
      </I18nContext.Provider>
    );
  }

  // Student logins have no staff permissions; show a clear next step instead of an empty admin shell.
  const isStudentOnly = user.linkedType === "Student" || (!items.length && (user.roles || [user.role]).some((r) => String(r).toLowerCase() === "student"));
  if (isStudentOnly && !user.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600"><UserRound size={28} /></div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">{lang === "bn" ? `আসসালামু আলাইকুম, ${user.name}` : `Welcome, ${user.name}`}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {lang === "bn"
              ? "শিক্ষার্থীদের উপস্থিতি, ফলাফল, ফি ও নোটিশ অভিভাবক অ্যাপে দেখা যায়। অ্যাপে প্রবেশের জন্য আপনার অভিভাবক বা স্কুল অফিসের সাথে যোগাযোগ করুন।"
              : "Attendance, results, fees and notices for students are shown in the guardian app. Ask your guardian or the school office for access."}
          </p>
          {profile?.phone && <p className="mt-3 text-sm font-semibold text-slate-700">{profile.name} · {profile.phone}</p>}
          <div className="mt-5 flex justify-center gap-2">
            <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>{lang === "bn" ? "English" : "বাংলা"}</button>
            <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={handleLogout}>{i18n.t("Sign Out")}</button>
          </div>
        </div>
      </div>
    );
  }

  const parentItem = items.find((i) => i.label === active.parent);
  let view = null;
  let title = active.child || active.parent;
  if (parentItem) {
    if (parentItem.children) {
      const childItem = parentItem.children.find((c) => c.label === active.child)
        || (active.parent === "Dashboard" && !active.child ? (parentItem.children.find((c) => c.label === "My Day") || parentItem.children[0]) : null);
      if (childItem) { view = childItem.render({ navigateTo }); title = childItem.label === "Overview" && active.parent !== "Dashboard" ? `${active.parent} ${childItem.label}` : childItem.label; }
    } else {
      view = parentItem.render({ navigateTo });
    }
  }
  if (!view) {
    const first = items[0];
    view = (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <ShieldCheck className="mx-auto text-slate-300" size={48} />
          <p className="mt-3 text-lg font-bold text-slate-700">You do not have access to this page.</p>
          {first && <button className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => navigateTo(first.label, first.children?.[0]?.label)}>Go to {first.label}</button>}
        </div>
      </div>
    );
  }

  return (
    <I18nContext.Provider value={i18n}>
      <UserContext.Provider value={ctxValue}>
        <div className={dark ? "dark-shell" : ""} lang={lang}>
          <Sidebar
            isOpen={sidebarOpen} close={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} toggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            active={active} navigateTo={navigateTo} expanded={expanded} setExpanded={setExpanded} user={user} items={items} t={i18n.t} profile={profile}
            badges={{ Approvals: approvalsCount }}
          />
          <main className={`min-h-screen min-w-0 bg-[#f7f8fb] transition-[margin,width] duration-300 ${sidebarCollapsed ? "lg:ml-[88px] lg:w-[calc(100%-88px)]" : "lg:ml-[280px] lg:w-[calc(100%-280px)]"}`}>
            <Topbar openMenu={() => setSidebarOpen(true)} pageTitle={title} dark={dark} setDark={setDark} onLogout={handleLogout} user={user}
              navigateTo={navigateTo} t={i18n.t} lang={lang} setLang={setLang} digits={i18n.digits} approvalsCount={approvalsCount}
              openSearch={(query) => setSearch({ open: true, query })} />
            <section key={currentPath} className="motion-page min-h-[calc(100vh-4rem)] min-w-0 overflow-x-clip p-3 sm:p-5 lg:p-7">
              {/* NF-43: the institution requires two-step sign-in for administrators. */}
              {settings.enforceAdminTwoFactor && user.isAdmin && (!user.twoFactorEnabled || !user.phone) && active.child !== "My Account & Devices" && (
                <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span>{lang === "bn"
                    ? "প্রশাসকদের জন্য দুই-ধাপ সাইন-ইন (OTP) বাধ্যতামূলক। আপনার মোবাইল নম্বর যোগ করুন ও 2FA চালু করুন।"
                    : "Two-step sign-in (SMS OTP) is required for administrators. Add your mobile number and turn on 2FA."}</span>
                  <button className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700" onClick={() => navigateTo("Settings", "My Account & Devices")}>
                    {lang === "bn" ? "এখনই সেট করুন" : "Set up now"}
                  </button>
                </div>
              )}
              {view}
            </section>
          </main>
          <CommandPalette open={search.open} initialQuery={search.query} onClose={() => setSearch({ open: false, query: "" })}
            items={items} t={i18n.t} navigateTo={navigateTo} canSearchStudents={can(user, "students")} />
        </div>
      </UserContext.Provider>
    </I18nContext.Provider>
  );
}
