"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { academicApi, studentsApi, examsApi, marksApi } from "../lib/api";

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

function getGradeInfo(total, maxTotal) {
  const percentage = (total / maxTotal) * 100;
  if (percentage >= 90) return { grade: "A+", color: "bg-emerald-50 text-emerald-600" };
  if (percentage >= 80) return { grade: "A", color: "bg-blue-50 text-blue-600" };
  if (percentage >= 70) return { grade: "B", color: "bg-indigo-50 text-indigo-600" };
  if (percentage >= 60) return { grade: "C", color: "bg-amber-50 text-amber-600" };
  if (percentage >= 50) return { grade: "D", color: "bg-orange-50 text-orange-600" };
  return { grade: "F", color: "bg-red-50 text-red-600" };
}

export default function MarksEntry() {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");
  
  const [marks, setMarks] = useState({}); // { studentId: { subjectId: score } }
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
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
        
        // Only allow data entry for exams that have finished but results are not yet published.
        const completedExams = (examsData || []).filter(e => getExamStatus(e) === "Completed");
        setExams(completedExams);

        if (loadedClasses.length > 0) {
          setSelectedClass(loadedClasses[0].name);
        }
        if (completedExams.length > 0) {
          setSelectedExam(completedExams[0].name);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    }
    loadInitialData();
  }, []);

  // Reset selected subject when class changes
  useEffect(() => {
    setSelectedSubject("All Subjects");
  }, [selectedClass]);

  // Filter students based on selected class
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return allStudents.filter((s) => s.className === selectedClass);
  }, [allStudents, selectedClass]);

  // Load marks when exam or class changes
  useEffect(() => {
    async function fetchMarks() {
      if (!selectedExam || !selectedClass || classStudents.length === 0) return;
      
      try {
        const classObj = classes.find(c => c.name === selectedClass);
        if (!classObj) return;

        const dbMarks = await marksApi.list(selectedExam, classObj.classId);
        
        const newMarks = {};
        classStudents.forEach((student) => {
          newMarks[student.id] = {};
        });

        dbMarks.forEach(m => {
          if (!newMarks[m.studentId]) newMarks[m.studentId] = {};
          newMarks[m.studentId][m.subjectId] = m.marksObtained;
        });
        
        setMarks(newMarks);
      } catch (err) {
        console.error("Failed to load marks", err);
      }
    }
    fetchMarks();
  }, [selectedExam, selectedClass, classStudents, classes]);

  function handleMarkChange(studentId, subjectId, value) {
    let numValue = value;
    if (value !== "") {
      numValue = Number(value);
      if (numValue < 0) numValue = 0;
      if (numValue > 100) numValue = 100;
    }

    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [subjectId]: numValue
      }
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const classObj = classes.find(c => c.name === selectedClass);
      const examObj = exams.find(e => e.name === selectedExam);

      const recordsToSave = classStudents.map(student => ({
        studentId: student.id,
        marks: marks[student.id] || {}
      }));

      await marksApi.bulkUpdate({
        exam: selectedExam,
        examId: examObj ? examObj.id : null,
        classId: classObj ? classObj.classId : selectedClass,
        records: recordsToSave
      });
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Failed to save marks", err);
      alert("Failed to save marks: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const classSubjects = useMemo(() => {
    return subjects.filter(s => isClassInSubjectRange(selectedClass, s.classRange));
  }, [subjects, selectedClass]);

  const displaySubjects = useMemo(() => {
    if (selectedSubject === "All Subjects") {
      return classSubjects;
    }
    const found = classSubjects.find(s => s.id === selectedSubject);
    return found ? [found] : [];
  }, [selectedSubject, classSubjects]);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center gap-6 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Exam</label>
          <select 
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
          >
            {exams.map(ex => (
              <option key={ex.id} value={ex.name}>{ex.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Class</label>
          <select 
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            {classes.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Subject</label>
          <select 
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="All Subjects">All Subjects</option>
            {classSubjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Marks Table */}
      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h2 className="text-[17px] font-extrabold text-slate-800">
            Marks Entry — {selectedClass} | {selectedExam} 2024
          </h2>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? "Saving..." : "Save All Marks"}
          </button>
        </div>

        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="p-4 font-bold w-[200px]">Student</th>
                {displaySubjects.map(sub => (
                  <th key={sub.id} className="p-4 font-bold text-center">
                    {sub.name}<br/><span className="text-xs font-medium text-slate-400">(100)</span>
                  </th>
                ))}
                <th className="p-4 font-bold text-center">Total</th>
                <th className="p-4 font-bold text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((student) => {
                const studentMarks = marks[student.id] || {};
                let total = 0;
                let maxTotal = 0;

                displaySubjects.forEach(sub => {
                  total += (Number(studentMarks[sub.id]) || 0);
                  maxTotal += 100; // assuming each subject is out of 100
                });

                // Avoid division by 0 if no subjects
                if (maxTotal === 0) maxTotal = 100;
                
                const gradeInfo = getGradeInfo(total, maxTotal);

                return (
                  <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-800">{student.name}</td>
                    {displaySubjects.map(sub => (
                      <td key={sub.id} className="p-4 text-center">
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          className={`h-10 w-16 rounded-xl border text-center font-semibold outline-none focus:ring-2 focus:ring-blue-100 transition-colors ${
                            (studentMarks[sub.id] !== undefined && studentMarks[sub.id] !== "" && Number(studentMarks[sub.id]) < 33) 
                              ? "border-red-400 bg-red-50 text-red-700 focus:border-red-500" 
                              : "border-slate-200 text-slate-700 focus:border-blue-500"
                          }`}
                          value={studentMarks[sub.id] ?? ""}
                          onChange={(e) => handleMarkChange(student.id, sub.id, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="p-4 text-center font-extrabold text-slate-900">
                      {total}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${gradeInfo.color}`}>
                        {total > 0 ? gradeInfo.grade : "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              
              {classStudents.length === 0 && (
                <tr>
                  <td colSpan={displaySubjects.length + 3} className="p-8 text-center text-slate-500 font-medium">
                    No students found in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                Marks for {selectedClass} have been successfully recorded.
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
