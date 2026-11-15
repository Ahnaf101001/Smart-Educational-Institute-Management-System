"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { publicApi } from "../lib/api";
import PublicShell from "../components/public/PublicShell";
import { Badge, Button, Card, Field, Input, Select, useToast } from "../components/ui/kit";

export default function ResultPage() {
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState({ examId: "", studentId: "", dateOfBirth: "" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { publicApi.resultExams().then((x) => { setExams(x); if (x[0]) setForm((f) => ({ ...f, examId: x[0].id })); }).catch(() => {}); }, []);
  async function lookup() {
    setBusy(true);
    try { setResult(await publicApi.resultLookup(form)); } catch (e) { setResult(null); toast.error(e); } finally { setBusy(false); }
  }
  return (
    <PublicShell title="Online Result">
      <h1 className="mb-1 text-3xl font-extrabold text-slate-900">Online Result</h1>
      <p className="mb-5 text-slate-600">Enter the student ID and date of birth to view a published result.</p>
      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Exam"><Select value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })} options={exams.map((x) => ({ value: x.id, label: x.name }))} placeholder="Select exam" /></Field>
          <Field label="Student ID"><Input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} placeholder="STU-4001" /></Field>
          <Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></Field>
          <div className="flex items-end"><Button icon={Search} loading={busy} disabled={!form.examId || !form.studentId || !form.dateOfBirth} onClick={lookup}>View result</Button></div>
        </div>
      </Card>
      {result && (
        <Card className="mt-5" title={`${result.studentName} – ${result.examName}`} subtitle={`${result.className || ""} · Roll ${result.roll || "—"}${result.version > 1 ? ` · revised (v${result.version})` : ""}`}
          actions={<Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>}>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-3xl font-extrabold text-blue-700">{result.gpa}</p><p className="text-xs font-semibold text-blue-700">GPA</p></div>
            <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-extrabold">{result.grade}</p><p className="text-xs text-slate-500">Grade</p></div>
            <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-extrabold">{Number(result.totalMarks)}</p><p className="text-xs text-slate-500">of {Number(result.maxMarks)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3 text-center"><Badge tone={result.status === "Pass" ? "green" : "red"}>{result.status}</Badge><p className="mt-1 text-xs text-slate-500">Position {result.classPosition || "—"}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Subject</th><th className="text-center">Marks</th><th className="text-center">Grade</th><th className="text-center">Point</th></tr></thead>
            <tbody>{(result.subjects || []).map((s) => (
              <tr key={s.subjectId} className="border-b border-slate-100"><td className="py-2">{s.subjectName}{s.isFourth ? " (4th)" : ""}</td><td className="text-center">{s.absent ? "AB" : `${s.obtained}/${s.fullMarks}`}</td><td className={`text-center font-bold ${s.passed ? "" : "text-rose-600"}`}>{s.grade}</td><td className="text-center">{s.point}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </PublicShell>
  );
}
