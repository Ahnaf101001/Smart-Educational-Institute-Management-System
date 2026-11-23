"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, LayoutGrid, List, Plus, Printer, User, BookOpen, Trash2 } from "lucide-react";
import { academicApi, routineApi, teachersApi } from "../lib/api";

// Color mapping for subjects
const subjectColors = {
  "Mathematics": "bg-blue-50 text-blue-700 border-blue-200",
  "English": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Bangla": "bg-amber-50 text-amber-700 border-amber-200",
  "Physics": "bg-purple-50 text-purple-700 border-purple-200",
  "Chemistry": "bg-rose-50 text-rose-700 border-rose-200",
  "Biology": "bg-teal-50 text-teal-700 border-teal-200",
  "Social Studies": "bg-orange-50 text-orange-700 border-orange-200",
  "Islamic Studies": "bg-green-50 text-green-700 border-green-200",
  "Computer Science": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Phys. Ed": "bg-lime-50 text-lime-700 border-lime-200",
};

const dotColors = {
  "Mathematics": "bg-blue-500",
  "English": "bg-emerald-500",
  "Bangla": "bg-amber-500",
  "Physics": "bg-purple-500",
  "Chemistry": "bg-rose-500",
  "Biology": "bg-teal-500",
  "Social Studies": "bg-orange-500",
  "Islamic Studies": "bg-green-500",
  "Computer Science": "bg-indigo-500",
  "Phys. Ed": "bg-lime-500",
};

const fallbackPeriods = [
  { id: "P1", time: "08:00–08:45" },
  { id: "P2", time: "08:45–09:30" },
  { id: "P3", time: "09:30–10:15" },
  { id: "B1", time: "10:15–10:30", isBreak: true, label: "BREAK" },
  { id: "P4", time: "10:30–11:15" },
  { id: "P5", time: "11:15–12:00" },
  { id: "P6", time: "12:00–12:45" },
  { id: "B2", time: "12:45–01:00", isBreak: true, label: "BREAK" },
  { id: "P7", time: "01:00–01:45" },
  { id: "P8", time: "01:45–02:30" },
];

const fallbackDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Saturday"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = dayNames[new Date().getDay()];
const DEFAULT_ACADEMIC_SETTINGS = {
  workingDays: 6,
  startTime: "08:00 AM",
  periodDuration: 45,
  periodsPerDay: 8,
  breakAfterPeriods: [3, 6],
  breakDurationMinutes: 15,
};
const schoolDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseBreakAfterPeriods(value) {
  if (Array.isArray(value)) return value.map(Number).filter((item) => Number.isInteger(item) && item > 0);
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function buildWorkingDays(workingDays) {
  const count = Math.min(Math.max(Number(workingDays) || 6, 1), 7);
  if (count === 6) return fallbackDays;
  return schoolDays.slice(0, count);
}

function parseTimeToMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 8 * 60;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function buildPeriods(settings) {
  const periodCount = Math.min(Math.max(Number(settings.periodsPerDay) || 8, 1), 12);
  const periodDuration = Math.min(Math.max(Number(settings.periodDuration) || 45, 1), 180);
  const breakDuration = Math.min(Math.max(Number(settings.breakDurationMinutes) || 15, 1), 120);
  const breakAfter = new Set(
    parseBreakAfterPeriods(settings.breakAfterPeriods).filter((periodNo) => periodNo < periodCount),
  );
  let cursor = parseTimeToMinutes(settings.startTime);
  const generated = [];

  for (let periodNo = 1; periodNo <= periodCount; periodNo += 1) {
    const periodStart = cursor;
    const periodEnd = periodStart + periodDuration;
    generated.push({
      id: `P${periodNo}`,
      time: `${formatTime(periodStart)} - ${formatTime(periodEnd)}`,
    });
    cursor = periodEnd;

    if (breakAfter.has(periodNo)) {
      const breakEnd = cursor + breakDuration;
      generated.push({
        id: `B${periodNo}`,
        time: `${formatTime(cursor)} - ${formatTime(breakEnd)}`,
        isBreak: true,
        label: "BREAK",
      });
      cursor = breakEnd;
    }
  }

  return generated.length ? generated : fallbackPeriods;
}

export default function Routine() {
  const [view, setView] = useState("grid"); // 'grid' | 'list'
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Database States
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicSettings, setAcademicSettings] = useState(DEFAULT_ACADEMIC_SETTINGS);
  
  // Selection States
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [routineEntries, setRoutineEntries] = useState([]);
  const [activeYear, setActiveYear] = useState("");

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [academicData, teachersData] = await Promise.all([
          academicApi.load(),
          // Teachers may view the routine without access to the teacher list.
          teachersApi.list().catch((e) => (e?.status === 403 ? [] : Promise.reject(e)))
        ]);
        
        const allClasses = academicData.classes || [];
        setClasses(allClasses);
        setSubjects(academicData.subjects || []);
        setTeachers(teachersData || []);
        setAcademicSettings({
          ...DEFAULT_ACADEMIC_SETTINGS,
          ...(academicData.settings || {}),
          breakAfterPeriods: parseBreakAfterPeriods(academicData.settings?.breakAfterPeriods || DEFAULT_ACADEMIC_SETTINGS.breakAfterPeriods),
          breakDurationMinutes: academicData.settings?.breakDurationMinutes || DEFAULT_ACADEMIC_SETTINGS.breakDurationMinutes,
        });

        if (allClasses.length > 0) {
          const firstClass = allClasses[0];
          setSelectedClass(firstClass.id);
          setSelectedSection(firstClass.sections?.[0] || "A");
        }

        const allYears = academicData.years || [];
        const currentYear = allYears.find(y => y.status === "Active") || allYears[0];
        if (currentYear) setActiveYear(currentYear.name);
      } catch (err) {
        console.error("Failed to load routine dependencies", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch routine whenever class or section changes
  const fetchRoutine = async () => {
    if (!selectedClass || !selectedSection) return;
    try {
      const entries = await routineApi.list(selectedClass, selectedSection);
      setRoutineEntries(entries || []);
    } catch (err) {
      console.error("Failed to fetch routine", err);
    }
  };

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    routineApi.list(selectedClass, selectedSection)
      .then((entries) => setRoutineEntries(entries || []))
      .catch((err) => console.error("Failed to fetch routine", err));
  }, [selectedClass, selectedSection]);

  const days = useMemo(
    () => buildWorkingDays(academicSettings.workingDays),
    [academicSettings.workingDays],
  );
  const periods = useMemo(
    () => buildPeriods(academicSettings),
    [academicSettings],
  );

  // Transform raw routineEntries into scheduleData map { Day -> Period -> Data }
  const scheduleData = useMemo(() => {
    const data = {};
    days.forEach(d => { data[d] = {}; });
    
    routineEntries.forEach(entry => {
      if (!data[entry.dayOfWeek]) data[entry.dayOfWeek] = {};
      
      const subject = subjects.find(s => s.id === entry.subjectId);
      const teacher = teachers.find(t => t.id === entry.teacherId);
      
      data[entry.dayOfWeek][entry.periodCode] = {
        id: entry.id,
        subject: subject ? subject.name : "Unknown",
        teacher: teacher ? teacher.name : "Unknown",
        room: entry.roomNo || "N/A"
      };
    });
    return data;
  }, [routineEntries, subjects, teachers, days]);

  // Add Modal States
  const [isSaving, setIsSaving] = useState(false);
  const [formClassSection, setFormClassSection] = useState("");
  const [formDay, setFormDay] = useState(days[0]);
  const [formPeriod, setFormPeriod] = useState("P1");
  const [formSubject, setFormSubject] = useState("");
  const [formTeacher, setFormTeacher] = useState("");
  const [formRoom, setFormRoom] = useState("");

  // Calculate Today's Summary
  const todaySummary = useMemo(() => {
    const todaysEntries = routineEntries.filter(e => e.dayOfWeek === today);
    const totalPeriods = todaysEntries.length;
    
    const subjectsSet = new Set(todaysEntries.map(e => e.subjectId));
    const uniqueSubjects = subjectsSet.size;
    
    let lastPeriodIndex = -1;
    let endTime = "--:--";
    
    if (totalPeriods > 0) {
      todaysEntries.forEach(entry => {
        const pIndex = periods.findIndex(p => p.id === entry.periodCode);
        if (pIndex > lastPeriodIndex) {
          lastPeriodIndex = pIndex;
        }
      });
      
      if (lastPeriodIndex !== -1) {
        const lastP = periods[lastPeriodIndex];
        if (lastP && lastP.time) {
          endTime = lastP.time.split(" - ")[1] || "--:--";
        }
      }
    }
    
    const breaksCount = totalPeriods > 0 
      ? periods.filter((p, i) => p.isBreak && i < lastPeriodIndex).length 
      : 0;
      
    return {
      totalPeriods,
      uniqueSubjects,
      breaksCount,
      endTime
    };
  }, [routineEntries, periods]);

  // Filter teachers based on selected subject
  const availableTeachers = useMemo(() => {
    if (!formSubject) return teachers;
    const selectedSubjObj = subjects.find(s => s.id === formSubject);
    if (!selectedSubjObj) return teachers;
    
    const subjectName = selectedSubjObj.name.toLowerCase();
    return teachers.filter(t => {
      const matchesSubject = t.subjects && Array.isArray(t.subjects) && t.subjects.some(s => s.toLowerCase() === subjectName);
      const matchesDept = t.department && t.department.toLowerCase() === subjectName;
      return matchesSubject || matchesDept;
    });
  }, [formSubject, subjects, teachers]);

  const handleSavePeriod = async () => {
    const validPeriods = periods.filter((period) => !period.isBreak);
    const selectedDay = days.includes(formDay) ? formDay : days[0];
    const selectedPeriod = validPeriods.some((period) => period.id === formPeriod) ? formPeriod : validPeriods[0]?.id;

    if (!formClassSection || !formSubject || !formTeacher || !selectedDay || !selectedPeriod) {
      alert("Please fill all required fields");
      return;
    }
    
    const [classId, section] = formClassSection.split("|");
    setIsSaving(true);
    try {
      await routineApi.create({
        class_id: classId,
        section: section,
        day_of_week: selectedDay,
        period_code: selectedPeriod,
        subject_id: formSubject,
        teacher_id: formTeacher,
        room_no: formRoom,
        is_break: false
      });
      
      setShowAddModal(false);
      // Refresh if it's the currently viewed class
      if (classId === selectedClass && section === selectedSection) {
        fetchRoutine();
      }
    } catch (err) {
      console.error("Failed to save period", err);
      alert("Failed to save period: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Top Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:border-blue-400 transition cursor-pointer">
            <Calendar size={18} className="text-slate-500" />
            <select 
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              value={`${selectedClass}|${selectedSection}`}
              onChange={(e) => {
                const [cId, sec] = e.target.value.split("|");
                setSelectedClass(cId);
                setSelectedSection(sec);
              }}
            >
              {classes.map(c => 
                c.sections.map(sec => (
                  <option key={`${c.id}-${sec}`} value={`${c.id}|${sec}`}>
                    {c.name}-{sec}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            <button 
              onClick={() => setView("grid")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${view === "grid" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutGrid size={16} /> Grid View
            </button>
            <button 
              onClick={() => setView("list")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${view === "list" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              <List size={16} /> List View
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setFormDay(days[0] || "Sunday");
              setFormPeriod(periods.find((period) => !period.isBreak)?.id || "P1");
              setShowAddModal(true);
            }}
            className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Period
          </button>
          <button 
            onClick={() => window.print()}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Printer size={18} />
            Print
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 rounded-[16px] border border-slate-200 bg-white p-4 px-6 shadow-sm">
        <span className="text-sm font-bold text-slate-600">Subjects:</span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {subjects.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${dotColors[sub.name] || 'bg-slate-400'}`}></span>
              <span className="text-sm font-medium text-slate-500">{sub.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {view === "grid" ? (
        <div className="flex flex-col gap-6">
          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 min-w-[1000px]">
              <h2 className="text-lg font-extrabold text-slate-800">
                Weekly Timetable — {classes.find(c => c.id === selectedClass)?.name}-{selectedSection}
              </h2>
              <div className="text-sm font-medium text-slate-400">Academic Year {activeYear}</div>
            </div>
            
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 px-6 text-sm font-bold text-slate-400 w-[140px] border-b border-r border-slate-100">Period / Day</th>
                  {days.map(day => (
                    <th 
                      key={day} 
                      className={`p-4 text-center border-b border-slate-100 font-bold text-sm ${day === today ? "bg-green-50/50 text-green-600" : "text-slate-600"}`}
                    >
                      {day}
                      {day === today && <div className="text-xs font-semibold text-green-500 mt-1">Today</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period, index) => {
                  if (period.isBreak) {
                    return (
                      <tr key={index} className="bg-slate-50/50">
                        <td className="p-4 px-6 border-r border-slate-100">
                          <div className="font-bold text-slate-400 text-sm">{period.label}</div>
                          <div className="text-xs font-semibold text-slate-400 mt-1">{period.time}</div>
                        </td>
                        <td colSpan={days.length} className="p-4 text-center">
                          <div className="border-t border-dashed border-slate-200 mx-4"></div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={index} className="border-b border-slate-50 last:border-0">
                      <td className="p-4 px-6 border-r border-slate-100 align-top pt-6">
                        <div className="font-bold text-slate-800 text-sm">{period.id}</div>
                        <div className="text-xs font-semibold text-slate-400 mt-1">{period.time}</div>
                      </td>
                      {days.map(day => {
                        const classData = scheduleData[day]?.[period.id];
                        return (
                          <td key={day} className={`p-3 align-top relative group ${day === today ? "bg-green-50/30" : ""}`}>
                            {classData ? (
                              <div className={`rounded-xl border p-3 flex flex-col gap-2 transition hover:shadow-md ${subjectColors[classData.subject] || "bg-slate-50 border-slate-200 text-slate-700"}`}>
                                <div className="flex justify-between items-start">
                                  <div className="font-bold text-[13px]">{classData.subject}</div>
                                  <button 
                                    onClick={async () => {
                                      if(confirm("Delete this period?")) {
                                        await routineApi.remove(classData.id);
                                        fetchRoutine();
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1"
                                    title="Delete Period"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1 text-[11px] font-semibold opacity-80">
                                  <div className="flex items-center gap-1.5"><User size={12} /> {classData.teacher}</div>
                                  <div className="flex items-center gap-1.5"><BookOpen size={12} /> {classData.room}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full min-h-[80px] rounded-xl border border-dashed border-slate-200 bg-slate-50/50"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* List View */}
          {days.map(day => (
            <div key={day} className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className={`flex items-center justify-between p-4 px-6 border-b border-slate-100 ${day === today ? "bg-green-600 text-white" : "bg-slate-50 text-slate-800"}`}>
                <h3 className="text-lg font-extrabold">{day}</h3>
                {day === today && (
                  <span className="rounded-full bg-white/20 px-4 py-1 text-xs font-bold backdrop-blur-sm">Today</span>
                )}
              </div>
              <div className="p-2">
                <table className="w-full text-left">
                  <tbody>
                    {periods.filter(p => !p.isBreak).map((period) => {
                      const classData = scheduleData[day]?.[period.id];
                      if (!classData) return null;
                      
                      const subjectColorClasses = subjectColors[classData.subject] || "border-slate-200 text-slate-700";
                      // Extract the border color part for the left accent line
                      const borderColor = subjectColorClasses.match(/border-([a-z]+-\d+)/)?.[0] || "border-slate-200";
                      
                      return (
                        <tr key={period.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                          <td className="p-4 px-6 w-[200px] align-top">
                            <div className="font-extrabold text-slate-800 text-sm">{period.id}</div>
                            <div className="text-xs font-semibold text-slate-400 mt-1">{period.time}</div>
                          </td>
                          <td className="p-4 align-top w-[400px]">
                            <div className="flex gap-4 items-start">
                              <div className={`w-1 h-10 rounded-full border-l-4 ${borderColor}`}></div>
                              <div>
                                <div className="font-bold text-[15px] text-slate-800 mb-1">{classData.subject}</div>
                                <div className="text-sm font-semibold text-slate-500">{classData.teacher}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-top text-right px-6">
                            <div className="font-bold text-[15px] text-slate-800 mb-1">{classData.room}</div>
                            <div className="text-sm font-semibold text-slate-400">{period.time}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Footer - Always visible at bottom */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm mt-6">
        <h3 className="text-[15px] font-extrabold text-slate-800 mb-6">Today&apos;s Schedule Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
            <div className="text-[28px] leading-tight font-black text-slate-800">{todaySummary.totalPeriods}</div>
            <div className="text-xs font-bold text-slate-500 mt-1.5">Total Periods</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
            <div className="text-[28px] leading-tight font-black text-slate-800">{todaySummary.uniqueSubjects}</div>
            <div className="text-xs font-bold text-slate-500 mt-1.5">Subjects</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
            <div className="text-[28px] leading-tight font-black text-slate-800">{todaySummary.breaksCount}</div>
            <div className="text-xs font-bold text-slate-500 mt-1.5">Breaks</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
            <div className="text-[28px] leading-tight font-black text-slate-800">{todaySummary.endTime}</div>
            <div className="text-xs font-bold text-slate-500 mt-1.5">End Time</div>
          </div>
        </div>
      </div>

      {/* Add Period Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#3b5ae0] to-[#5a30eb] p-6 text-white relative">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Add Period</h3>
                  <p className="text-sm font-medium text-white/80">Schedule a new class period</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Class *</label>
                  <select 
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                    value={formClassSection}
                    onChange={(e) => setFormClassSection(e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => 
                      c.sections.map(sec => (
                        <option key={`${c.id}-${sec}`} value={`${c.id}|${sec}`}>
                          {c.name}-{sec}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Day *</label>
                  <select 
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value)}
                  >
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Period *</label>
                  <select 
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                  >
                    {periods.filter(p => !p.isBreak).map(p => (
                      <option key={p.id} value={p.id}>{p.id} ({p.time})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Room</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 401" 
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 placeholder:font-normal"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="mb-2 block text-sm font-bold text-slate-700">Subject *</label>
                <select 
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                  value={formSubject}
                  onChange={(e) => {
                    setFormSubject(e.target.value);
                    setFormTeacher(""); // Reset teacher when subject changes
                  }}
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-8">
                <label className="mb-2 block text-sm font-bold text-slate-700">Teacher *</label>
                <select 
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                  value={formTeacher}
                  onChange={(e) => setFormTeacher(e.target.value)}
                  disabled={!formSubject}
                >
                  <option value="">{formSubject ? "Select Teacher" : "Select a Subject First"}</option>
                  {availableTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 transition hover:bg-slate-50"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSavePeriod}
                  className="h-11 flex-1 rounded-xl bg-blue-600 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Period"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
