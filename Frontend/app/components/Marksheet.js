"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

function getSubjectGradePoint(marks) {
  if (marks >= 80) return { point: 5.0, grade: "A+", gradeColor: "bg-emerald-50 text-emerald-600" };
  if (marks >= 70) return { point: 4.0, grade: "A", gradeColor: "bg-blue-50 text-blue-600" };
  if (marks >= 60) return { point: 3.5, grade: "A-", gradeColor: "bg-indigo-50 text-indigo-600" };
  if (marks >= 50) return { point: 3.0, grade: "B", gradeColor: "bg-teal-50 text-teal-600" };
  if (marks >= 40) return { point: 2.0, grade: "C", gradeColor: "bg-amber-50 text-amber-600" };
  if (marks >= 33) return { point: 1.0, grade: "D", gradeColor: "bg-orange-50 text-orange-600" };
  return { point: 0.0, grade: "F", gradeColor: "bg-red-50 text-red-600" };
}

export default function Marksheet() {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allMarks, setAllMarks] = useState([]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

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
        
        const publishedExams = (examsData || []).filter(e => {
          const status = getExamStatus(e);
          return status === "Published";
        });
        setExams(publishedExams);

        if (loadedClasses.length > 0) setSelectedClassId(loadedClasses[0].name);
        if (publishedExams.length > 0) setSelectedExamId(publishedExams[0].id);
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

  useEffect(() => {
    if (classStudents.length > 0 && !classStudents.find(s => s.id === selectedStudentId)) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [classStudents, selectedStudentId]);

  const marksData = useMemo(() => {
    if (!selectedExamId || !selectedClassId || classStudents.length === 0) return { marksList: [], summary: null };

    const coreSubjects = subjects.filter(s => isClassInSubjectRange(selectedClassId, s.classRange));

    let classResults = classStudents.map((student) => {
      const studentDbMark = allMarks.filter(m => m.studentId === student.id);

      let total = 0;
      let totalPoints = 0;
      let subjectCount = 0;
      let hasFailed = false;

      const subjectsMarksDetails = coreSubjects.map(subInfo => {
        const markRecord = studentDbMark.find(m => m.subjectId === subInfo.id);
        const mark = markRecord ? Number(markRecord.marksObtained) : 0;
        total += mark;
        
        const gp = getSubjectGradePoint(mark);
        totalPoints += gp.point;
        subjectCount += 1;
        if (mark < 33) hasFailed = true;

        return {
          subject: subInfo.name,
          full: 100,
          pass: 33,
          obtained: mark,
          grade: gp.grade,
          gradeColor: gp.gradeColor,
          status: mark >= 33 ? "Pass" : "Fail",
          statusColor: mark >= 33 ? "text-emerald-600" : "text-red-600"
        };
      });

      let gpa = subjectCount > 0 ? (totalPoints / subjectCount).toFixed(2) : "0.00";
      if (hasFailed) gpa = "0.00";

      let finalGrade = "F";
      if (!hasFailed) {
        if (gpa >= 5.0) finalGrade = "A+";
        else if (gpa >= 4.0) finalGrade = "A";
        else if (gpa >= 3.5) finalGrade = "A-";
        else if (gpa >= 3.0) finalGrade = "B";
        else if (gpa >= 2.0) finalGrade = "C";
        else if (gpa >= 1.0) finalGrade = "D";
      }

      return {
        id: student.id,
        name: student.name,
        roll: student.rollNo || "N/A",
        marksList: subjectsMarksDetails,
        totalMarks: total,
        maxTotal: subjectCount * 100,
        gpa: gpa,
        finalGrade: finalGrade,
        percentage: subjectCount > 0 ? Math.round((total / (subjectCount * 100)) * 100) : 0,
        status: hasFailed ? "FAIL" : "PASS",
        statusColor: hasFailed ? "text-red-600" : "text-emerald-600",
        finalGradeColor: hasFailed ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
      };
    });

    // Calculate rank
    classResults.sort((a, b) => {
      if (Number(b.gpa) !== Number(a.gpa)) return Number(b.gpa) - Number(a.gpa);
      return b.totalMarks - a.totalMarks;
    });

    const targetStudentIndex = classResults.findIndex(r => r.id === selectedStudentId);
    
    if (targetStudentIndex === -1) return { marksList: [], summary: null };

    const summary = classResults[targetStudentIndex];
    summary.rank = targetStudentIndex + 1;
    summary.totalStudents = classResults.length;

    return { marksList: summary.marksList, summary };
  }, [selectedExamId, selectedClassId, selectedStudentId, classStudents, subjects, allMarks]);

  function handlePrint() {
    window.print();
  }

  function handleDownloadPDF() {
    if (!marksData.summary || isDownloading) return;

    setIsDownloading(true);

    try {
      const summary = marksData.summary;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const left = 16;
      const right = pageWidth - 16;
      const contentWidth = right - left;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(145, 145, 145);
      doc.text("EduManage School & College", pageWidth / 2, 24, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(155, 155, 155);
      doc.text("123 Education Road, Dhaka, Bangladesh", pageWidth / 2, 31, { align: "center" });

      const selectedExamObj = exams.find(e => e.id === selectedExamId);
      const examNameText = selectedExamObj ? selectedExamObj.name : "Exam";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(170, 170, 170);
      doc.text(`${examNameText} 2024 - Result Sheet`, pageWidth / 2, 43, { align: "center" });

      const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const infoColumns = [
        { x: left + 6, label: "Student Name", value: summary.name },
        { x: left + 66, label: "Class", value: selectedClassId },
        { x: left + 126, label: "Roll No", value: summary.roll },
      ];
      const secondInfoColumns = [
        { x: left + 6, label: "Session", value: "2024-25" },
        { x: left + 66, label: "Exam", value: examNameText },
        { x: left + 126, label: "Date", value: dateLabel },
      ];

      const drawInfoRow = (items, labelY, valueY) => {
        items.forEach((item) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          doc.text(item.label, item.x, labelY);
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(String(item.value), item.x, valueY);
        });
      };

      drawInfoRow(infoColumns, 60, 67);
      drawInfoRow(secondInfoColumns, 77, 84);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(left, 92, right, 92);

      autoTable(doc, {
        head: [["Subject", "Full Marks", "Pass Marks", "Obtained", "Grade", "Status"]],
        body: marksData.marksList.map((row) => [
          row.subject,
          row.full,
          row.pass,
          row.obtained,
          row.grade,
          row.status,
        ]),
        startY: 98,
        margin: { left: left + 6, right: left + 6 },
        theme: "plain",
        headStyles: {
          fontStyle: "bold",
          fontSize: 8,
          textColor: [51, 65, 85],
          lineColor: [203, 213, 225],
          lineWidth: { bottom: 0.25 },
          cellPadding: { top: 2, bottom: 3, left: 0, right: 0 },
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: { bottom: 0.2 },
          cellPadding: { top: 3, bottom: 3, left: 0, right: 0 },
        },
        columnStyles: {
          0: { cellWidth: 45, halign: "left" },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 25, halign: "center", fontStyle: "bold", textColor: [15, 23, 42] },
          4: { cellWidth: 18, halign: "center", fontStyle: "bold", textColor: [37, 99, 235] },
          5: { cellWidth: 28, halign: "center", fontStyle: "bold", textColor: [5, 150, 105] },
        },
      });

      const summaryY = doc.lastAutoTable.finalY + 8;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(left + 6, summaryY, contentWidth - 12, 19, 4, 4, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("Total", left + 12, summaryY + 12);
      doc.setFontSize(11);
      doc.text(`${summary.totalMarks} / ${summary.maxTotal}`, pageWidth / 2 + 2, summaryY + 12, { align: "center" });
      doc.setFontSize(8);
      doc.setTextColor(5, 150, 105);
      doc.text(summary.finalGrade, right - 41, summaryY + 12, { align: "center" });
      doc.text(summary.status, right - 14, summaryY + 12, { align: "center" });

      const statsY = summaryY + 33;
      const statCenters = [left + 40, pageWidth / 2, right - 40];
      const statLabels = ["Percentage", "GPA", "Position"];
      const statValues = [`${summary.percentage}%`, summary.gpa, `${summary.rank} / ${summary.totalStudents}`];

      doc.setDrawColor(203, 213, 225);
      doc.line((statCenters[0] + statCenters[1]) / 2, statsY - 4, (statCenters[0] + statCenters[1]) / 2, statsY + 12);
      doc.line((statCenters[1] + statCenters[2]) / 2, statsY - 4, (statCenters[1] + statCenters[2]) / 2, statsY + 12);

      statLabels.forEach((label, index) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(label, statCenters[index], statsY, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(String(statValues[index]), statCenters[index], statsY + 10, { align: "center" });
      });

      const safeStudentName = summary.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Student";
      doc.save(`${safeStudentName}_${examNameText.replace(/\s+/g, "_")}_Marksheet.pdf`);
    } catch (error) {
      console.error("Unable to download marksheet PDF:", error);
      window.alert("PDF download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Filter Controls (Hidden when printing) */}
      <div className="flex flex-wrap items-center gap-6 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex-1 min-w-[150px]">
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
        <div className="flex-1 min-w-[150px]">
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
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Student</label>
          <select 
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            {classStudents.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.rollNo || s.id})</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-end h-[76px] gap-3">
          <button 
            onClick={handlePrint}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            disabled={!marksData.summary}
          >
            <Printer size={18} />
            Print
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#2863eb] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            disabled={!marksData.summary || isDownloading}
          >
            <Download size={18} />
            {isDownloading ? "Downloading..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Marksheet Card */}
      {marksData.summary ? (
        <div id="marksheet-content" className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          {/* Header Gradient */}
          <div className="bg-gradient-to-br from-[#2863eb] to-[#5138ed] p-6 text-center text-white">
            <h1 className="text-2xl font-extrabold mb-1">EduManage School & College</h1>
            <p className="text-sm font-medium text-blue-100 mb-4">
              123 Education Road, Dhaka, Bangladesh
            </p>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm font-bold backdrop-blur-sm">
              {exams.find(e => e.id === selectedExamId)?.name || "Exam"} 2024 — Result Sheet
            </div>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-100">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">Student Name</div>
              <div className="font-extrabold text-slate-900 text-[15px]">{marksData.summary.name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">Class</div>
              <div className="font-extrabold text-slate-900 text-[15px]">{selectedClassId}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">Roll No</div>
              <div className="font-extrabold text-slate-900 text-[15px]">{marksData.summary.roll}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">Session</div>
              <div className="font-extrabold text-slate-900 text-[15px]">2024-25</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">Exam</div>
              <div className="font-extrabold text-slate-900 text-[15px]">{exams.find(e => e.id === selectedExamId)?.name || "Exam"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">Date</div>
              <div className="font-extrabold text-slate-900 text-[15px]">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          {/* Marks Table */}
          <div className="p-6 pb-0 flex-1">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 font-bold">Subject</th>
                  <th className="pb-3 font-bold text-center">Full Marks</th>
                  <th className="pb-3 font-bold text-center">Pass Marks</th>
                  <th className="pb-3 font-bold text-center">Obtained</th>
                  <th className="pb-3 font-bold text-center">Grade</th>
                  <th className="pb-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {marksData.marksList.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-medium text-slate-700">{row.subject}</td>
                    <td className="py-2.5 text-center text-slate-500">{row.full}</td>
                    <td className="py-2.5 text-center text-slate-500">{row.pass}</td>
                    <td className="py-2.5 text-center font-extrabold text-slate-900">{row.obtained}</td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-flex h-7 w-8 items-center justify-center rounded-full text-[11px] font-extrabold ${row.gradeColor}`}>
                        {row.grade}
                      </span>
                    </td>
                    <td className={`py-2.5 text-center font-bold text-sm ${row.statusColor}`}>
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total & Summary Section */}
          <div className="p-6 pt-3">
            <div className="flex items-center rounded-2xl bg-slate-50 p-5 border border-slate-100">
              <div className="w-[40%] font-extrabold text-slate-900 text-[15px]">Total</div>
              <div className="flex-1 flex items-center justify-between">
                <div className="text-center font-extrabold text-slate-900 text-[17px] w-full max-w-[200px]">
                  {marksData.summary.totalMarks} / {marksData.summary.maxTotal}
                </div>
                <div className="w-16 text-center">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold ${marksData.summary.finalGradeColor}`}>
                    {marksData.summary.finalGrade}
                  </span>
                </div>
                <div className={`w-16 text-center font-extrabold text-sm ${marksData.summary.statusColor}`}>
                  {marksData.summary.status}
                </div>
              </div>
            </div>
            
            {/* Bottom Stats */}
            <div className="grid grid-cols-3 gap-6 mt-6 mb-1">
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-400 mb-1.5">Percentage</div>
                <div className="text-2xl font-extrabold text-slate-900">{marksData.summary.percentage}%</div>
              </div>
              <div className="text-center border-x border-slate-200">
                <div className="text-xs font-semibold text-slate-400 mb-1.5">GPA</div>
                <div className="text-2xl font-extrabold text-slate-900">{marksData.summary.gpa}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-400 mb-1.5">Position</div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {marksData.summary.rank}<span className="text-xs align-super ml-0.5">{
                    marksData.summary.rank % 10 === 1 && marksData.summary.rank !== 11 ? 'st' :
                    marksData.summary.rank % 10 === 2 && marksData.summary.rank !== 12 ? 'nd' :
                    marksData.summary.rank % 10 === 3 && marksData.summary.rank !== 13 ? 'rd' : 'th'
                  }</span> <span className="text-base font-bold text-slate-400">/ {marksData.summary.totalStudents}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[20px] border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">Please select a class and student to generate marksheet.</p>
        </div>
      )}
    </div>
  );
}
