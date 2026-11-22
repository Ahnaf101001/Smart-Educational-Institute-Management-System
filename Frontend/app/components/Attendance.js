"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogOut,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { academicApi, studentsApi, attendanceApi } from "../lib/api";
import { discardAttendance, flushAttendance, isNetworkError, pendingAttendance, queueAttendance } from "../lib/offlineQueue";
import { today } from "./ui/kit";

const statuses = [
  { id: "Present", label: "Present", color: "bg-emerald-500", text: "text-emerald-500", icon: CheckCircle2 },
  { id: "Absent", label: "Absent", color: "bg-red-500", text: "text-red-500", icon: XCircle },
  { id: "Late", label: "Late", color: "bg-amber-500", text: "text-amber-500", icon: Clock },
  // Left school before the end of the day (counts as present; shown to guardians as early leave).
  { id: "Early Leave", label: "Early leave", color: "bg-sky-500", text: "text-sky-500", icon: LogOut },
];

function getInitials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export default function Attendance() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    today()
  );
  const [attendance, setAttendance] = useState({}); // studentId -> status
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [existingRecords, setExistingRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [offlineItems, setOfflineItems] = useState([]);
  const [offlineNote, setOfflineNote] = useState("");

  // Sync registers saved while offline as soon as the connection is back (ATT-06).
  useEffect(() => {
    const refresh = () => setOfflineItems(pendingAttendance());
    const sync = async () => {
      if (!pendingAttendance().length) return;
      const r = await flushAttendance((payload) => attendanceApi.bulkUpdate(payload));
      refresh();
      if (r.synced) setOfflineNote(`${r.synced} offline register(s) synced.`);
    };
    refresh();
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("edumanage:offline-queue", refresh);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("edumanage:offline-queue", refresh); };
  }, []);

  useEffect(() => {
    async function loadInitial() {
      setIsLoading(true);
      try {
        const [allStudents, academicData] = await Promise.all([
          studentsApi.list(),
          academicApi.load()
        ]);
        const allClasses = academicData.classes || [];
        setStudents(allStudents);
        setClasses(allClasses);

        // Default to Class 9-A when it exists, otherwise the first class/section the
        // institution actually has (madrasa and pre-school lines have no "Class 9").
        const options = allClasses.flatMap((c) => (c.sections || []).map((s) => `${c.name}-${s}`));
        if (options.length > 0) {
          setSelectedClass(options.includes("Class 9-A") ? "Class 9-A" : options[0]);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitial();
  }, []);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s) => s.status !== "Inactive" && s.className === selectedClass);
  }, [students, selectedClass]);

  const displayStudents = classStudents;

  // Load attendance when class or date changes
  useEffect(() => {
    async function fetchAttendance() {
      if (!selectedClass || !selectedDate) return;
      try {
        const records = await attendanceApi.list(selectedClass, selectedDate);
        setExistingRecords(records);

        const initial = {};
        records.forEach(r => {
          initial[r.studentId] = r.status;
        });

        // Default any missing students to Present
        displayStudents.forEach(s => {
          if (!initial[s.id]) {
            initial[s.id] = "Present";
          }
        });
        setAttendance(initial);

        // Fetch monthly summary
        const dateObj = new Date(selectedDate);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const daysInMonth = new Date(year, dateObj.getMonth() + 1, 0).getDate();
        const fromDate = `${year}-${month}-01`;
        const toDate = `${year}-${month}-${daysInMonth}`;
        
        const summary = await attendanceApi.summary(selectedClass, fromDate, toDate);
        
        const days = Array.from({ length: daysInMonth }, (_, i) => {
          const dayString = `${year}-${month}-${String(i + 1).padStart(2, '0')}`;
          const record = summary.find(s => s.attendanceDate === dayString);
          return {
            day: i + 1,
            value: record ? parseFloat(record.attendanceRate) : null,
          };
        });
        
        setChartData(days);
        
        const validDays = days.filter(d => d.value !== null);
        const avg = validDays.length ? validDays.reduce((a, b) => a + b.value, 0) / validDays.length : 0;
        setAvgAttendance(avg);
      } catch (err) {
        console.error("Failed to fetch attendance", err);
      }
    }
    fetchAttendance();
  }, [selectedClass, selectedDate, displayStudents]);

  const totalStudents = displayStudents.length;
  const presentCount = Object.values(attendance).filter((s) => s === "Present").length;
  const absentCount = Object.values(attendance).filter((s) => s === "Absent").length;
  const lateCount = Object.values(attendance).filter((s) => s === "Late").length;

  function markAll(status) {
    const next = {};
    displayStudents.forEach((s) => (next[s.id] = status));
    setAttendance(next);
  }

  function handleStatus(id, status) {
    setAttendance((prev) => ({ ...prev, [id]: status }));
  }

  function handlePrevMonth() {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    d.setDate(1); // Set to 1st of the new month
    setSelectedDate(today(d));
  }

  function handleNextMonth() {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(1); // Set to 1st of the new month
    setSelectedDate(today(d));
  }

  const displayMonthYear = new Date(selectedDate).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalStudents}</div>
            <div className="text-sm font-medium text-slate-500">Total Students</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{presentCount}</div>
            <div className="text-sm font-medium text-slate-500">Present</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <XCircle size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{absentCount}</div>
            <div className="text-sm font-medium text-slate-500">Absent</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{lateCount}</div>
            <div className="text-sm font-medium text-slate-500">Late</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left Side: Attendance List */}
        <div className="flex flex-col rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[600px]">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <select
                className="h-11 rounded-xl border border-slate-200 px-4 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map((c) =>
                  (c.sections || []).map(section => (
                    <option key={`${c.name}-${section}`} value={`${c.name}-${section}`}>
                      {c.name}-{section}
                    </option>
                  ))
                )}
              </select>
              <div className="relative">
                <input
                  type="date"
                  className="h-11 w-[160px] rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-600 transition hover:bg-emerald-100"
                onClick={() => markAll("Present")}
              >
                ✓ All Present
              </button>
              <button
                className="flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
                onClick={() => markAll("Absent")}
              >
                ✗ All Absent
              </button>
            </div>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="min-w-[600px]">
              {displayStudents.map((student, index) => {
                const status = attendance[student.id];
                const activeStatusObj = statuses.find((s) => s.id === status);
                const isAbsent = status === "Absent";
                const isLate = status === "Late";

                return (
                  <div
                    key={student.id}
                    className={`group flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${isAbsent ? "bg-red-50/50" : isLate ? "bg-amber-50/50" : "hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-xs font-bold text-slate-400">
                        {String(index + 1).padStart(3, "0")}
                      </span>
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAbsent
                            ? "bg-red-100 text-red-600"
                            : isLate
                              ? "bg-amber-100 text-amber-600"
                              : "bg-emerald-100 text-emerald-600"
                          }`}
                      >
                        {getInitials(student.name)}
                      </div>
                      <span className="font-bold text-slate-800">
                        {student.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        {statuses.map((s) => {
                          const isActive = status === s.id;
                          return (
                            <button
                              key={s.id}
                              className={`h-8 rounded-full px-4 text-xs font-bold transition-all ${isActive
                                  ? `${s.color} text-white shadow-sm`
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                              onClick={() => handleStatus(student.id, s.id)}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="w-6 flex justify-center">
                        {activeStatusObj && (
                          <activeStatusObj.icon
                            size={18}
                            className={activeStatusObj.text}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-5">
            <div className="text-sm font-semibold text-slate-500">
              {presentCount} present · {absentCount} absent · {lateCount} late
              {offlineNote && <p className="mt-1 text-xs font-semibold text-amber-700">{offlineNote}</p>}
              {offlineItems.length > 0 && (
                <div className="mt-1 space-y-1 text-xs font-medium text-amber-800">
                  {offlineItems.map((i) => (
                    <div key={i.id}>
                      Waiting to sync: {i.payload.className} · {i.payload.date}{i.error ? <span className="text-rose-600"> – {i.error}</span> : null}
                      {i.error && <button type="button" className="ml-2 underline" onClick={() => { discardAttendance(i.id); setOfflineItems(pendingAttendance()); }}>Discard</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  const records = displayStudents.map(s => ({
                    studentId: s.id,
                    status: attendance[s.id] || "Present",
                  }));

                  await attendanceApi.bulkUpdate({
                    className: selectedClass,
                    date: selectedDate,
                    records
                  });
                  
                  // refresh existing records
                  const fetchedRecords = await attendanceApi.list(selectedClass, selectedDate);
                  setExistingRecords(fetchedRecords);
                  setShowSuccessModal(true);
                } catch (err) {
                  if (isNetworkError(err)) {
                    queueAttendance({
                      className: selectedClass,
                      date: selectedDate,
                      records: displayStudents.map((s) => ({ studentId: s.id, status: attendance[s.id] || "Present" })),
                    });
                    setOfflineItems(pendingAttendance());
                    setOfflineNote("No connection – the register is saved on this device and will sync automatically.");
                  } else {
                    console.error("Failed to save attendance", err);
                    alert("Failed to save attendance: " + err.message);
                  }
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              <CalendarDays size={18} />
              {isSaving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </div>

        {/* Right Side: Overview Chart */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
              Monthly<br />Overview
            </h3>
            <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
              <button onClick={handlePrevMonth} className="p-1 hover:text-slate-900 transition"><ChevronLeft size={18} /></button>
              {displayMonthYear}
              <button onClick={handleNextMonth} className="p-1 hover:text-slate-900 transition"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-blue-600 mb-8">
            <TrendingUp size={20} className="shrink-0" />
            <div className="text-[15px]">
              <strong className="font-extrabold">Avg: {avgAttendance.toFixed(1)}%</strong> this month
            </div>
          </div>

          {/* Chart placeholder */}
          <div className="h-[220px] flex items-end gap-[2px] mb-6">
            <div className="w-6 flex flex-col justify-between h-full text-[10px] font-semibold text-slate-400 pb-6">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            <div className="flex-1 flex items-end justify-between h-full border-b border-slate-100 pb-6 relative">
              {/* grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none">
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full"></div>
              </div>

              {/* bars */}
              {chartData.slice(0, 31).map((d, i) => (
                <div key={i} className="flex flex-col justify-end w-full px-[1px] h-full z-10">
                  {d.value ? (
                    <div
                      className={`w-full rounded-t-[4px] transition-all duration-500 hover:opacity-80 ${d.value >= 90 ? 'bg-blue-600' : d.value >= 80 ? 'bg-blue-400' : 'bg-red-400'
                        }`}
                      title={`${d.value}% on Day ${d.day}`}
                      style={{ height: `${d.value}%` }}
                    />
                  ) : (
                    <div className="w-full bg-slate-200 rounded-t-[4px] h-full opacity-40" title={`No data on Day ${d.day}`} />
                  )}
                </div>
              ))}

              {/* x axis labels */}
              <div className="absolute -bottom-1 left-0 right-0 flex justify-between text-[10px] font-semibold text-slate-400 px-1">
                <span>1</span>
                <span>4</span>
                <span>7</span>
                <span>10</span>
                <span>13</span>
                <span>16</span>
                <span>19</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-600"></span> ≥90%</div>
            <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-400"></span> 80-90%</div>
            <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-400"></span> &lt;80%</div>
            <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-200"></span> Holiday</div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[24px] bg-white p-8 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-2xl font-black text-slate-800">Saved!</h3>
              <p className="mb-8 text-sm font-medium text-slate-500">
                Attendance for {selectedClass} has been successfully recorded.
              </p>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-600 active:scale-95"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
