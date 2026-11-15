"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Trophy, FileText, Send, Users, TrendingUp, Award, Activity } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { academicApi, studentsApi, examsApi, marksApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";

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

function isClassInSubjectRange(className, classRange) {
  if (!classRange || !className) return true;
  const match = className.match(/Class\s+(\d+)/i);
  if (!match) return true;
  const classNum = parseInt(match[1], 10);
  const parts = classRange.split("-").map(s => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return classNum >= parts[0] && classNum <= parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return classNum === parts[0];
  }
  return true;
}

function getSubjectGradePoint(marks) {
  if (marks >= 80) return { point: 5.0, grade: "A+" };
  if (marks >= 70) return { point: 4.0, grade: "A" };
  if (marks >= 60) return { point: 3.5, grade: "A-" };
  if (marks >= 50) return { point: 3.0, grade: "B" };
  if (marks >= 40) return { point: 2.0, grade: "C" };
  if (marks >= 33) return { point: 1.0, grade: "D" };
  return { point: 0.0, grade: "F" };
}

export default function ResultProcessing() {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allMarks, setAllMarks] = useState([]);
  
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [smsSentTo, setSmsSentTo] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [academicData, studentsData, examsData] = await Promise.all([
          academicApi.load(),
          studentsApi.list(),
          examsApi.list()
        ]);
        
        const loadedClasses = academicData.classes?.flatMap(c => 
          c.sections.map(s => ({ id: `${c.id}-${s}`, classId: c.id, section: s, name: `${c.name}-${s}` }))
        ) || [];
        setClasses(loadedClasses);
        setSubjects(academicData.subjects || []);
        setAllStudents(studentsData || []);
        
        const completableExams = (examsData || []).filter(e => {
          const status = getExamStatus(e);
          return status === "Completed" || status === "Published";
        });
        setExams(completableExams);

        if (loadedClasses.length > 0) setSelectedClassId(loadedClasses[0].name);
        if (completableExams.length > 0) setSelectedExamId(completableExams[0].id);
        
      } catch (err) {
        console.error("Failed to load data", err);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function fetchMarks() {
      if (!selectedExamId || !selectedClassId) return;
      const classObj = classes.find(c => c.name === selectedClassId);
      if (!classObj) return;
      const examObj = exams.find(e => e.id === selectedExamId);
      if (!examObj) return;
      
      try {
        const dbMarks = await marksApi.list(examObj.name, classObj.classId);
        setAllMarks(dbMarks);
      } catch (err) {
        console.error("Failed to fetch marks", err);
      }
    }
    fetchMarks();
  }, [selectedExamId, selectedClassId, classes, exams]);

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudents.filter((s) => s.className === selectedClassId);
  }, [allStudents, selectedClassId]);

  const results = useMemo(() => {
    if (!selectedExamId || !selectedClassId || classStudents.length === 0) return [];
    
    // Core subjects actually assigned to this class
    const coreSubjects = subjects.filter(s => isClassInSubjectRange(selectedClassId, s.classRange));

    let calculatedResults = classStudents.map((student) => {
      const studentDbMark = allMarks.filter(m => m.studentId === student.id);

      let total = 0;
      let totalPoints = 0;
      let subjectCount = 0;
      let hasFailed = false;

      // Only calculate based on core subjects assigned to class
      coreSubjects.forEach(sub => {
        const markRecord = studentDbMark.find(m => m.subjectId === sub.id);
        const mark = markRecord ? Number(markRecord.marksObtained) : 0;
        total += mark;
        const gp = getSubjectGradePoint(mark);
        totalPoints += gp.point;
        subjectCount += 1;
        if (mark < 33) hasFailed = true;
      });

      let gpa = subjectCount > 0 ? (totalPoints / subjectCount).toFixed(2) : "0.00";
      if (hasFailed) gpa = "0.00";

      let grade = "F";
      if (!hasFailed) {
        if (gpa >= 5.0) grade = "A+";
        else if (gpa >= 4.0) grade = "A";
        else if (gpa >= 3.5) grade = "A-";
        else if (gpa >= 3.0) grade = "B";
        else if (gpa >= 2.0) grade = "C";
        else if (gpa >= 1.0) grade = "D";
      }

      return {
        id: student.id,
        name: student.name,
        totalMarks: total,
        gpa: gpa,
        grade: grade,
        status: hasFailed ? "Failed" : "Passed",
      };
    });

    // Sort by GPA descending, then Total Marks descending to determine Rank
    calculatedResults.sort((a, b) => {
      if (Number(b.gpa) !== Number(a.gpa)) return Number(b.gpa) - Number(a.gpa);
      return b.totalMarks - a.totalMarks;
    });

    return calculatedResults.map((res, index) => ({
      ...res,
      rank: index + 1
    }));

  }, [selectedExamId, selectedClassId, classStudents, subjects, allMarks]);

  const stats = useMemo(() => {
    const total = results.length;
    const passed = results.filter(r => r.status === "Passed").length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const aPlus = results.filter(r => r.grade === "A+").length;
    
    let totalGPA = 0;
    results.forEach(r => totalGPA += Number(r.gpa));
    const avgGPA = total > 0 ? (totalGPA / total).toFixed(2) : "0.00";

    return { total, passRate, aPlus, avgGPA };
  }, [results]);

  async function handlePublish() {
    if (!selectedExamId) return;
    setIsPublishing(true);
    try {
      await examsApi.update(selectedExamId, { status: "Published" });
      setExams(prev => prev.map(e => e.id === selectedExamId ? { ...e, status: "Published" } : e));
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      alert("Failed to publish: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  }

  const selectedExamObj = exams.find(e => e.id === selectedExamId);
  const isPublished = selectedExamObj?.status === "Published";

  function getRankBadge(rank) {
    if (rank === 1) return "bg-amber-100 text-amber-700 border-amber-300";
    if (rank === 2) return "bg-slate-100 text-slate-700 border-slate-300";
    if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-white text-slate-600 border-slate-200";
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-[200px]">
            <label className="mb-2 block text-sm font-semibold text-slate-600">Exam</label>
            <select 
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="mb-2 block text-sm font-semibold text-slate-600">Class</label>
            <select 
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-end h-full mt-6 sm:mt-0">
           {!isPublished ? (
             <button 
               onClick={() => setShowConfirmModal(true)}
               disabled={isPublishing}
               className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 font-bold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
             >
               <FileText size={18} />
               {isPublishing ? "Publishing..." : "Publish Results"}
             </button>
           ) : (
             <button 
               disabled
               className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-6 font-bold text-slate-400 shadow-sm"
             >
               <CheckCircle2 size={18} />
               Results Published
             </button>
           )}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.total}</div>
            <div className="text-sm font-medium text-slate-500">Students Evaluated</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.passRate}%</div>
            <div className="text-sm font-medium text-slate-500">Pass Rate</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <Award size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.aPlus}</div>
            <div className="text-sm font-medium text-slate-500">A+ Grades Achieved</div>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Activity size={24} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.avgGPA}</div>
            <div className="text-sm font-medium text-slate-500">Average Class GPA</div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h2 className="text-[17px] font-extrabold text-slate-800">
            Merit List — {selectedClassId} | {selectedExamObj?.name || ""}
          </h2>
          {isPublished && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={14} /> Published
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
                <th className="px-6 py-4 font-bold text-center w-24">Rank</th>
                <th className="px-6 py-4 font-bold">Student Name</th>
                <th className="px-6 py-4 font-bold text-center">Total Marks</th>
                <th className="px-6 py-4 font-bold text-center">GPA</th>
                <th className="px-6 py-4 font-bold text-center">Grade</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {results.map((res) => {
                const isFail = res.status === "Failed";
                return (
                  <tr key={res.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 text-center">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-extrabold shadow-sm ${getRankBadge(res.rank)}`}>
                        {res.rank}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {res.name}
                      {res.rank === 1 && <Trophy size={14} className="inline ml-2 text-amber-500 mb-0.5" />}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {res.totalMarks}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-extrabold ${isFail ? "text-red-500" : "text-blue-650"}`}>
                        {res.gpa}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isFail ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {res.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        isFail ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      }`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <button 
                          className="text-slate-400 hover:text-blue-600 transition" 
                          title="Send SMS to Parent"
                          onClick={() => setSmsSentTo(res.name)}
                       >
                          <Send size={18} />
                       </button>
                    </td>
                  </tr>
                );
              })}
              
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    No results available to process. Please ensure marks are entered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Publish Results?"
        message="Are you sure you want to publish these results? Once published, they will be visible to students and parents."
        type="danger"
        confirmText="Yes, Publish"
        onConfirm={handlePublish}
        onCancel={() => setShowConfirmModal(false)}
      />

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
              <h3 className="mb-2 text-2xl font-black text-slate-800">Published!</h3>
              <p className="mb-8 text-sm font-medium text-slate-500">
                Results for {selectedClassId} have been published successfully.
              </p>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-600 active:scale-95"
              >
                Continue
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SMS Success Modal */}
      <AnimatePresence>
        {smsSentTo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSmsSentTo(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[24px] bg-white p-8 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <Send size={36} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-2xl font-black text-slate-800">SMS Sent!</h3>
              <p className="mb-8 text-sm font-medium text-slate-500">
                The result has been successfully sent to the parents of <strong>{smsSentTo}</strong> via SMS.
              </p>
              <button
                type="button"
                onClick={() => setSmsSentTo(null)}
                className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
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
