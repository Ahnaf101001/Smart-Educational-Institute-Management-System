"use client";

// One-click shortcuts to the daily tasks a role is allowed to do. Each action is shown only when
// the user holds the matching permission (the server still checks every request).
import { ClipboardCheck, FilePenLine, Megaphone, Search, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import { can, useUser } from "../../lib/access";
import { useI18n } from "../../lib/i18n";

export const openSearch = () => window.dispatchEvent(new CustomEvent("edumanage:open-search"));

const ACTIONS = [
  { label: "Take attendance", icon: ClipboardCheck, perm: ["attendance", "create"], go: ["Attendance", "Student Attendance"], tone: "bg-emerald-50 text-emerald-700" },
  { label: "Collect a fee", icon: Wallet, perm: ["fees", "create"], go: ["Fees", "Collect Fee"], tone: "bg-blue-50 text-blue-700" },
  { label: "Enter marks", icon: FilePenLine, perm: ["marks", "create"], go: ["Exams & Results", "Marks Entry"], tone: "bg-purple-50 text-purple-700" },
  { label: "Send a notice", icon: Megaphone, perm: ["communication", "create"], go: ["Communication", "Notice & SMS"], tone: "bg-amber-50 text-amber-700" },
  { label: "Add a student", icon: UserPlus, perm: ["students", "create"], go: ["Students", "Add Student"], tone: "bg-sky-50 text-sky-700" },
  { label: "Find a student", icon: Search, perm: ["students", "view"], action: openSearch, tone: "bg-slate-100 text-slate-700" },
  { label: "Approvals", icon: ShieldCheck, perm: ["approvals", "view"], go: ["Approvals"], tone: "bg-rose-50 text-rose-700" },
];

export default function QuickActions({ onNavigate, only, badges = {} }) {
  const { user } = useUser();
  const { t } = useI18n();
  const visible = ACTIONS.filter((a) => (!only || only.includes(a.label)) && can(user, a.perm[0], a.perm[1]));
  if (!visible.length) return null;
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t("Quick actions")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
        {visible.map((a) => {
          const Icon = a.icon;
          const badge = badges[a.label];
          return (
            <button key={a.label} type="button" onClick={() => (a.action ? a.action() : onNavigate?.(...a.go))}
              className="flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:shadow">
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${a.tone}`}><Icon size={17} /></span>
              <span className="min-w-0 flex-1 truncate">{t(a.label)}</span>
              {badge > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
