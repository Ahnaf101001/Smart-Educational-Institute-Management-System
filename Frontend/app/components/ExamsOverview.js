"use client";

import { useState, useEffect } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Edit2,
  Trash2
} from "lucide-react";
import { examsApi } from "../lib/api";

function getExamStatus(exam) {
  if (exam.status === "Published") return "Published";
  if (!exam.startDate || !exam.endDate) return "Upcoming";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(exam.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(exam.endDate);
  end.setHours(23, 59, 59, 999);
  
  if (today < start) return "Upcoming";
  if (today > end) return "Completed";
  return "Ongoing";
}

function getStatusColor(status) {
  switch (status) {
    case "Upcoming": return "bg-orange-50 text-orange-600";
    case "Ongoing": return "bg-emerald-50 text-emerald-600";
    case "Completed": return "bg-blue-50 text-blue-600";
    case "Published": return "bg-purple-50 text-purple-600";
    default: return "bg-slate-50 text-slate-600";
  }
}

const performanceData = [
  { subject: "Bangla", score: 80 },
  { subject: "English", score: 78 },
  { subject: "Math", score: 82 },
  { subject: "Science", score: 82 },
  { subject: "Social", score: 77 },
  { subject: "Religion", score: 92 },
];

export default function ExamsOverview() {
  const [exams, setExams] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formId, setFormId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      const data = await examsApi.list();
      const derivedExams = (data || []).map(e => ({
        ...e,
        derivedStatus: getExamStatus(e)
      }));
      setExams(derivedExams);
    } catch (err) {
      console.error("Failed to load exams", err);
    }
  }

  function handleEditExam(exam) {
    setFormId(exam.id);
    setFormName(exam.name);
    setFormStartDate(exam.startDate ? exam.startDate.split('T')[0] : "");
    setFormEndDate(exam.endDate ? exam.endDate.split('T')[0] : "");
    setShowAddModal(true);
  }

  async function handleDeleteExam(id) {
    if (!window.confirm("Are you sure you want to delete this exam?")) return;
    try {
      await examsApi.remove(id);
      loadExams();
    } catch (err) {
      alert("Failed to delete exam: " + err.message);
    }
  }

  async function handleSaveExam() {
    if (!formName || !formStartDate || !formEndDate) {
      alert("Please fill all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formName,
        startDate: formStartDate,
        endDate: formEndDate,
        status: "Scheduled"
      };
      if (formId) {
        await examsApi.update(formId, payload);
      } else {
        await examsApi.create(payload);
      }
      setShowAddModal(false);
      setFormId(null);
      setFormName("");
      setFormStartDate("");
      setFormEndDate("");
      loadExams();
    } catch (err) {
      alert("Failed to save exam: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const stats = {
    total: exams.length,
    ongoing: exams.filter(e => e.derivedStatus === "Ongoing").length,
    completed: exams.filter(e => e.derivedStatus === "Completed").length,
    published: exams.filter(e => e.derivedStatus === "Published").length,
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileText size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.total}</div>
            <div className="text-sm font-medium text-slate-500">Total Exams</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.ongoing}</div>
            <div className="text-sm font-medium text-slate-500">Ongoing</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.completed}</div>
            <div className="text-sm font-medium text-slate-500">Completed</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-500">
            <Award size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.published}</div>
            <div className="text-sm font-medium text-slate-500">Results Published</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_450px]">
        {/* Left Side: Exam Schedule */}
        <div className="flex flex-col rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-6 flex justify-between items-center">
            <h3 className="text-lg font-extrabold text-slate-900">Exam Schedule</h3>
            <button 
              onClick={() => {
                setFormId(null);
                setFormName("");
                setFormStartDate("");
                setFormEndDate("");
                setShowAddModal(true);
              }}
              className="flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              New Exam
            </button>
          </div>
          <div className="flex-1 p-2">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="group flex items-center justify-between rounded-xl px-4 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{exam.name}</h4>
                    <p className="text-sm font-medium text-slate-500">
                      {exam.startDate ? new Date(exam.startDate).toLocaleDateString() : 'TBA'} - {exam.endDate ? new Date(exam.endDate).toLocaleDateString() : 'TBA'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`rounded-full px-4 py-1.5 text-xs font-bold ${getStatusColor(exam.derivedStatus)}`}>
                    {exam.derivedStatus}
                  </span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEditExam(exam)}
                      className="p-2 text-slate-400 hover:text-blue-600 transition"
                      title="Edit Exam"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteExam(exam.id)}
                      className="p-2 text-slate-400 hover:text-red-600 transition"
                      title="Delete Exam"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {exams.length === 0 && (
              <div className="p-8 text-center text-slate-500 font-medium">
                No exams scheduled yet. Click "New Exam" to create one.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Subject-wise Performance Chart */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <h3 className="text-lg font-extrabold text-slate-900 mb-8">
            Subject-wise Performance
          </h3>
          
          <div className="flex-1 flex items-end gap-4 min-h-[300px]">
            {/* Y-axis Labels */}
            <div className="flex flex-col justify-between h-full text-xs font-semibold text-slate-400 pb-8 pt-2">
              <span>100</span>
              <span>90</span>
              <span>80</span>
              <span>70</span>
              <span>60</span>
            </div>
            
            {/* Chart Area */}
            <div className="flex-1 flex items-end justify-between h-full relative pb-8">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pb-8 pt-2 pointer-events-none">
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
                <div className="w-full border-t border-dashed border-slate-100"></div>
              </div>

              {/* Bars */}
              {performanceData.map((d, i) => {
                // The chart ranges from 60 to 100. So the height is (score - 60) / 40 * 100%
                // But let's add a bit of padding to the top so 100% isn't hitting the very top edge.
                // The visual shows 100 at the top line, 60 at the bottom line.
                // Height percentage:
                const heightPercentage = Math.max(0, ((d.score - 60) / 40) * 100);
                
                return (
                  <div key={i} className="flex flex-col items-center justify-end h-full z-10 w-full px-2 pt-2">
                    <div 
                      className="w-full max-w-[32px] bg-[#2863eb] rounded-t-lg transition-all duration-500 hover:opacity-80" 
                      style={{ height: `${heightPercentage}%` }}
                    />
                    {/* X-axis label */}
                    <span className="absolute -bottom-1 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {d.subject}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Exam Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#3b5ae0] to-[#5a30eb] p-6 text-white relative">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{formId ? "Edit Exam" : "New Exam"}</h3>
                  <p className="text-sm font-medium text-white/80">
                    {formId ? "Update examination details" : "Create a new examination schedule"}
                  </p>
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
              <div className="mb-6">
                <label className="mb-2 block text-sm font-bold text-slate-700">Exam Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g., Monthly Assessment" 
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 placeholder:font-normal"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Start Date *</label>
                  <input 
                    type="date" 
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">End Date *</label>
                  <input 
                    type="date" 
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
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
                  onClick={handleSaveExam}
                  className="h-11 flex-1 rounded-xl bg-blue-600 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : formId ? "Update Exam" : "Create Exam"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
