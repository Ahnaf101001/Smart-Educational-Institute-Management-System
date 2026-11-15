"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CircleCheck,
  Clock3,
  CreditCard,
  DollarSign,
  FileText,
  TrendingUp,
  UserPlus,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { dashboardApi } from "../lib/api";

const iconMap = {
  UserPlus,
  DollarSign,
  FileText,
  UserRoundCheck,
  Bell,
  BookOpen
};

const cardAnimation = {
  hidden: { opacity: 0, y: 14 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: index * 0.05 },
  }),
};

function Panel({ children, className = "" }) {
  return (
    <div className={`dashboard-panel ${className}`}>
      {children}
    </div>
  );
}

function Sparkline({ negative = false }) {
  const stroke = negative ? "#ff414d" : "#16c763";
  const fillId = negative ? "redSpark" : "greenSpark";
  const path = negative
    ? "M4 30 C45 23, 76 18, 111 23 S171 29, 220 20 S262 17, 290 13"
    : "M4 28 C48 24, 85 21, 120 24 S177 29, 219 23 S263 18, 290 14";

  return (
    <svg viewBox="0 0 294 58" className="mt-4 h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity=".18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L290 58 L4 58 Z`} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

function WelcomeBanner({ totalStudents, attendanceRate, monthlyIncome }) {
  const [userName, setUserName] = useState("Super Admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedUser = JSON.parse(localStorage.getItem("edumanage-user") || "{}");
        if (savedUser && savedUser.name) {
          setUserName(savedUser.name);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const formatCurrency = (num) => "৳" + Math.round(num).toLocaleString("en-IN");
  return (
    <motion.section
      variants={cardAnimation}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-sky-400 to-indigo-500 px-7 py-7 text-white shadow-sm"
    >
      <div className="absolute -top-16 left-24 size-48 rounded-full bg-white/7" />
      <div className="absolute -bottom-28 right-28 size-64 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold sm:text-[28px]">
            Welcome back, {userName}! <span aria-hidden="true">👋</span>
          </h2>
          <p className="mt-2 text-sm font-medium text-blue-100 sm:text-base">
            Academic Year 2026-27 | Session: June 2026 – May 2027
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/20">
          {[
            [totalStudents.toLocaleString(), "Total Students"],
            [attendanceRate, "Attendance Today"],
            [formatCurrency(monthlyIncome), "Monthly Revenue"],
          ].map(([value, label]) => (
            <div className="px-4 text-center sm:px-7" key={label}>
              <strong className="block text-xl font-extrabold sm:text-3xl">{value}</strong>
              <span className="mt-1 block text-[11px] text-blue-100 sm:text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function OverviewCards({ cards }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            custom={index}
            variants={cardAnimation}
            initial="hidden"
            animate="visible"
          >
            <Panel className="h-full p-6">
              <div className="flex items-start justify-between">
                <span className={`grid size-14 place-items-center rounded-2xl ${card.iconClass}`}>
                  <Icon size={27} strokeWidth={2} />
                </span>
                <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${card.negative ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
                  {card.negative ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  {card.change}
                </span>
              </div>
              <strong className="mt-7 block text-3xl font-extrabold tracking-tight text-slate-900">{card.value}</strong>
              <p className="mt-1 text-base text-slate-600">{card.label}</p>
              <p className="mt-1 text-sm text-slate-400">{card.note}</p>
            </Panel>
          </motion.div>
        );
      })}
    </div>
  );
}

function FinanceCard({ title, value, change, negative }) {
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <strong className="mt-1 block text-[28px] font-extrabold text-slate-900">{value}</strong>
        </div>
        <span className={`grid size-12 place-items-center rounded-2xl ${negative ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
          {negative ? <ArrowDownRight size={24} /> : <TrendingUp size={24} />}
        </span>
      </div>
      <p className={`mt-4 text-sm font-medium ${negative ? "text-red-500" : "text-emerald-600"}`}>
        {negative ? "↗" : "↗"} {change} vs last month
      </p>
      <Sparkline negative={negative} />
    </Panel>
  );
}

function FeeCollection({ finance }) {
  const rate = finance.feeCollectionRate;
  const collected = finance.feeCollected;
  
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-slate-500">Fee Collection</p>
          <strong className="mt-1 block text-3xl font-extrabold text-slate-900">{rate}%</strong>
          <p className="mt-1 text-sm font-medium text-emerald-600">৳{collected.toLocaleString("en-IN")} collected</p>
        </div>
        <div 
          className="grid size-24 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#2864e8 0% ${rate}%, #93c5fd ${rate}% 100%)`
          }}
        >
          <div className="size-14 rounded-full bg-white" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-500">
        {[["Collected", `${rate}%`, "bg-blue-600"], ["Pending / Due", `${100 - rate}%`, "bg-blue-300"]].map(([label, value, color]) => (
          <div key={label}>
            <span className="flex items-center gap-1.5"><i className={`size-2 rounded-full ${color}`} />{label}</span>
            <strong className="ml-3.5 font-medium">{value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function StudentGrowthChart({ data: propData }) {
  const [hovered, setHovered] = useState(null);
  const data = propData || [
    ["Jan", 1820], ["Feb", 1900], ["Mar", 2100], ["Apr", 2050],
    ["May", 2250], ["Jun", 2350], ["Jul", 2320], ["Aug", 2400],
    ["Sep", 2520], ["Oct", 2630], ["Nov", 2710], ["Dec", 2780],
  ];

  const maxVal = Math.max(...data.map(d => d[1]), 10);
  const steps = [maxVal, Math.round(maxVal * 0.75), Math.round(maxVal * 0.5), Math.round(maxVal * 0.25), 0];
  
  const width = 600;
  const height = 190;
  const points = data.map((d, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - (d[1] / maxVal) * height;
    return { x, y, month: d[0], students: d[1] };
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }
  const fillPathD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="dashboard-title">Student Growth</h3>
          <p className="dashboard-subtitle">Monthly enrollment 2026</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600">+8.2% YoY</span>
      </div>
      <div className="mt-5 flex h-56">
        <div className="flex w-10 flex-col justify-between pb-6 text-right text-[11px] text-slate-500">
          {steps.map(s => <span key={s}>{s.toLocaleString()}</span>)}
        </div>
        <div className="relative ml-3 flex-1 border-b border-l border-dashed border-slate-200">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_calc(100%-1px),#e8edf5_1px),linear-gradient(to_bottom,transparent_calc(100%-1px),#e8edf5_1px)] bg-[size:8.33%_100%,100%_25%] opacity-80" />
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2864e8" stopOpacity=".17" />
                <stop offset="100%" stopColor="#2864e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPathD} fill="url(#growthFill)" />
            <path d={pathD} fill="none" stroke="#2864e8" strokeWidth="3" />
          </svg>
          <div className="absolute inset-0 flex">
            {points.map((pt, index) => (
              <button
                aria-label={`${pt.month}: ${pt.students} students`}
                className="relative h-full flex-1 border-none outline-none bg-transparent cursor-pointer"
                key={pt.month}
                onMouseEnter={() => setHovered({ month: pt.month, students: pt.students, index })}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered({ month: pt.month, students: pt.students, index })}
                onBlur={() => setHovered(null)}
              />
            ))}
          </div>
          <AnimatePresence>
            {hovered && (
              <>
                <motion.span
                  className="pointer-events-none absolute inset-y-0 w-px bg-slate-400/70"
                  style={{ left: `${(hovered.index / (data.length - 1)) * 100}%` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.span
                  className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
                  style={{
                    left: `${(hovered.index / (data.length - 1)) * 100}%`,
                    top: `${100 - (hovered.students / maxVal) * 100}%`,
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                />
                <motion.div
                  className="pointer-events-none absolute top-1/2 z-10 w-40 -translate-y-1/2 border border-slate-200 bg-white p-4 text-sm shadow-xl"
                  style={{
                    left: `clamp(5px, calc(${(hovered.index / (data.length - 1)) * 100}% - 80px), calc(100% - 165px))`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <strong className="text-base text-slate-900">{hovered.month}</strong>
                  <p className="mt-3 text-blue-600">Students : {hovered.students.toLocaleString()}</p>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <div className="absolute inset-x-0 -bottom-6 flex justify-between text-[10px] text-slate-500 sm:text-xs">
            {data.map(([month]) => <span key={month}>{month}</span>)}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function AttendanceChart({ data: propData }) {
  const [hovered, setHovered] = useState(null);
  const data = propData || [["Mon", 94], ["Tue", 89], ["Wed", 96], ["Thu", 91], ["Fri", 86], ["Sat", 79]];
  const averageRate = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item[1], 0) / data.length) : 0;
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="dashboard-title">Weekly Attendance</h3>
          <p className="dashboard-subtitle">Present vs Absent rate</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">Avg {averageRate}%</span>
      </div>
      <div className="relative mt-6 flex h-56 items-end gap-3 border-b border-dashed border-slate-200 px-3 sm:gap-6">
        {data.map(([day, value], index) => (
          <button
            className={`flex h-full flex-1 flex-col items-center justify-end transition ${hovered?.index === index ? "bg-slate-300/60" : ""}`}
            key={day}
            onMouseEnter={() => setHovered({ day, value, index })}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered({ day, value, index })}
            onBlur={() => setHovered(null)}
          >
            <div className="relative flex h-[180px] w-full max-w-8 items-end bg-[#fa9ca0] rounded-t-md overflow-hidden">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${value}%` }}
                transition={{ duration: 0.7 }}
                className="w-full bg-[#2864e8] transition hover:bg-[#1d4ed8]"
              />
            </div>
            <span className="mt-2 text-xs text-slate-500">{day}</span>
          </button>
        ))}
        <AnimatePresence>
          {hovered && (
            <motion.div
              className="pointer-events-none absolute top-1/2 z-10 w-36 -translate-y-1/2 border border-slate-200 bg-white p-4 text-sm shadow-xl"
              style={{
                left: `clamp(5px, calc(${((hovered.index + 0.5) / data.length) * 100}% - 72px), calc(100% - 149px))`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <strong className="text-base text-slate-900">{hovered.day}</strong>
              <p className="mt-3 text-blue-600">Present : {hovered.value}%</p>
              <p className="mt-2 text-red-400">Absent : {100 - hovered.value}%</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-8 flex justify-center gap-5 text-xs">
        <span className="flex items-center gap-2 text-blue-600"><i className="size-3 bg-[#2864e8] rounded-sm" />Present</span>
        <span className="flex items-center gap-2 text-red-400"><i className="size-3 bg-[#fa9ca0] rounded-sm" />Absent</span>
      </div>
    </Panel>
  );
}

function RevenueChart({ monthlyRevenue }) {
  const [hovered, setHovered] = useState(null);
  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="dashboard-title">Revenue Analytics</h3>
          <p className="dashboard-subtitle">Income vs Expense (6 months)</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-2"><i className="h-2.5 w-4 rounded-full bg-blue-600" />Income</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-4 rounded-full bg-red-300" />Expense</span>
        </div>
      </div>
      <div className="relative mt-6 flex h-64 items-end gap-4 border-b border-dashed border-slate-200 px-3 sm:gap-7">
        {monthlyRevenue.map((item, index) => (
          <button
            key={item.month}
            className={`group relative flex h-full flex-1 items-end justify-center gap-1 transition ${hovered?.index === index ? "bg-slate-300/70" : ""}`}
            onMouseEnter={() => setHovered({ ...item, index })}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered({ ...item, index })}
            onBlur={() => setHovered(null)}
          >
            <motion.span initial={{ height: 0 }} animate={{ height: `${item.income / 6}%` }} className="w-3 rounded-t bg-blue-600 sm:w-5" />
            <motion.span initial={{ height: 0 }} animate={{ height: `${item.expense / 6}%` }} className="w-3 rounded-t bg-red-300 sm:w-5" />
            <span className="absolute -bottom-6 text-xs text-slate-500">{item.month}</span>
          </button>
        ))}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute top-4 z-10 w-48 border border-slate-200 bg-white p-4 text-sm shadow-xl"
              style={{
                left: `clamp(5px, calc(${((hovered.index + 0.5) / monthlyRevenue.length) * 100}% - 96px), calc(100% - 197px))`,
              }}
            >
              <strong className="text-base">{hovered.month}</strong>
              <p className="mt-3 text-blue-600">Income : ৳{hovered.income * 1000}</p>
              <p className="mt-2 text-red-400">Expense : ৳{hovered.expense * 1000}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function UpcomingExams({ exams }) {
  const statusClasses = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
  };
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="dashboard-title">Upcoming Exams</h3>
        <button className="text-sm font-semibold text-blue-600 hover:text-blue-800">View all →</button>
      </div>
      <div className="mt-5 space-y-3">
        {exams.map((exam) => (
          <button key={exam.name} className="flex w-full items-start justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left transition hover:border-blue-100 hover:bg-blue-50/40">
            <span>
              <strong className="block text-sm text-slate-900 sm:text-base">{exam.name}</strong>
              <small className="mt-1 block text-slate-500">{exam.className}</small>
              <small className="mt-1 block font-medium text-blue-600">{exam.date}</small>
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[exam.color] || statusClasses.blue}`}>{exam.status}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function RecentActivities({ activities }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    teal: "bg-teal-50 text-teal-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="dashboard-title">Recent Activities</h3>
        <button className="text-sm font-semibold text-blue-600 hover:text-blue-800">View all →</button>
      </div>
      <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {activities.map((activity) => {
          const Icon = iconMap[activity.icon] || Bell;
          return (
            <div className="flex items-start gap-4" key={activity.text}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tones[activity.tone] || tones.blue}`}>
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900 sm:text-base">{activity.text}</p>
                <span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} />{activity.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function BottomStats({ stats }) {
  const formatCurrency = (num) => "৳" + Math.round(num).toLocaleString("en-IN");
  
  const items = [
    { value: stats.newAdmissions.toString(), label: "New Admissions (This Month)", icon: UserPlus, color: "from-sky-400 to-blue-500" },
    { value: formatCurrency(stats.feeDue), label: "Fee Due This Month", icon: CircleCheck, color: "from-amber-400 to-orange-500" },
    { value: stats.reportsGenerated.toString(), label: "Total Reports Generated", icon: BookOpen, color: "from-emerald-400 to-teal-500" },
    { value: formatCurrency(stats.payrollProcessed), label: "Payroll Processed This Month", icon: CreditCard, color: "from-fuchsia-400 to-purple-500" },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className={`rounded-2xl bg-gradient-to-br ${item.color} p-5 text-white shadow-sm`} key={item.label}>
            <span className="grid size-10 place-items-center rounded-xl bg-white/15"><Icon size={20} /></span>
            <strong className="mt-4 block text-2xl font-extrabold">{item.value}</strong>
            <p className="mt-1 text-sm text-white/85">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardContent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getSummary();
      setData(res || null);
    } catch (err) {
      console.error("Error loading dashboard details:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  if (loading || !data) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <TrendingUp className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading dashboard stats...</p>
        </div>
      </div>
    );
  }

  const counts = data.counts || {};
  const finance = data.finance || {};
  const examsList = data.exams || [];
  const activitiesList = data.activities || [];
  const bottomStats = data.bottomStats || {};

  const overviewCards = [
    {
      label: "Total Students",
      value: (counts.students || 0).toLocaleString(),
      note: "Across all classes",
      change: "+8.2%",
      icon: Users,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      label: "Total Teachers",
      value: (counts.teachers || 0).toLocaleString(),
      note: "Active teaching staff",
      change: "+3.4%",
      icon: UserRoundCheck,
      iconClass: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Total Staff",
      value: (counts.staff || 0).toLocaleString(),
      note: "Admin & support",
      change: "-1.2%",
      negative: true,
      icon: BriefcaseBusiness,
      iconClass: "bg-purple-50 text-purple-600",
    },
    {
      label: "Today's Attendance",
      value: counts.attendanceRate || "0%",
      note: counts.attendanceDetails || "0/0 present",
      change: "+2.1%",
      icon: CircleCheck,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
  ];

  const formatCurrency = (num) => "৳" + Math.round(num).toLocaleString("en-IN");

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <WelcomeBanner 
        totalStudents={counts.students || 0} 
        attendanceRate={counts.attendanceRate || "0%"} 
        monthlyIncome={finance.monthlyIncome || 0} 
      />
      <OverviewCards cards={overviewCards} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1.05fr]">
        <FinanceCard title="Monthly Income" value={formatCurrency(finance.monthlyIncome || 0)} change="+12.5%" />
        <FinanceCard title="Monthly Expense" value={formatCurrency(finance.monthlyExpense || 0)} change="+5.8%" negative />
        <FeeCollection finance={finance} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <StudentGrowthChart data={data.studentGrowth} />
        <AttendanceChart data={data.weeklyAttendance} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <RevenueChart monthlyRevenue={finance.monthlyRevenue || []} />
        <UpcomingExams exams={examsList} />
      </div>
      <RecentActivities activities={activitiesList} />
      <BottomStats stats={bottomStats} />
    </motion.div>
  );
}
