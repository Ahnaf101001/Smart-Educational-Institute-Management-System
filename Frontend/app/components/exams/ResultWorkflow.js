"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Cog, FileText, Printer, Send, Wrench } from "lucide-react";
import { http, instituteProfileApi, resource } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import ResourceManager from "../ui/ResourceManager";
import { CONFIGS } from "../modules/configs";
import { NarrativeModal } from "../extensions/Extras";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, StatCard, Table, Tabs, Textarea, exportRows, formatDate, useToast } from "../ui/kit";

const STEPS = ["Draft", "Marks Entry", "Processed", "Reviewed", "Pending Approval", "Published"];

function Stepper({ status }) {
  const idx = Math.max(0, STEPS.indexOf(status));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${i <= idx ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
          <span className={`text-xs font-semibold ${i <= idx ? "text-blue-700" : "text-slate-400"}`}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function AdmitCards({ examId, classes }) {
  const toast = useToast();
  const [classId, setClassId] = useState("");
  const [data, setData] = useState(null);
  const [inst, setInst] = useState({});
  useEffect(() => { instituteProfileApi.get().then(setInst).catch(() => {}); }, []);
  useEffect(() => {
    if (!classId) return;
    http.get(`/exams/${examId}/admit-cards`, { classId }).then(setData).catch((e) => toast.error(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, examId]);
  return (
    <Card title="Admit cards" subtitle="Bulk generate & print. Students with dues are blocked when the policy is enabled." actions={data && <Button size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>}>
      <Field label="Class" className="mb-4 max-w-xs"><Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select class" /></Field>
      {data && (
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {data.students.map((s) => (
            <div key={s.id} className={`rounded-xl border-2 p-4 ${s.blocked ? "border-rose-300 bg-rose-50/40 print:hidden" : "border-slate-300 bg-white"}`} style={{ breakInside: "avoid" }}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div><p className="font-extrabold">{inst.name}</p><p className="text-xs text-slate-500">ADMIT CARD · {data.exam.name}</p></div>
                {s.photoUrl ? <img src={s.photoUrl} alt="" className="h-16 w-14 rounded object-cover" /> : <div className="h-16 w-14 rounded bg-slate-100" />}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <p><span className="text-slate-500">Name:</span> <b>{s.name}</b></p><p><span className="text-slate-500">ID:</span> {s.id}</p>
                <p><span className="text-slate-500">Class:</span> {s.className}</p><p><span className="text-slate-500">Roll:</span> {s.roll || "—"}</p>
              </div>
              <table className="mt-2 w-full text-xs"><tbody>{data.routine.map((r, i) => <tr key={i} className="border-t border-slate-100"><td className="py-0.5">{formatDate(r.examDate)}</td><td>{r.startTime || ""}</td><td>{r.subjectName}</td><td>{r.room || ""}</td></tr>)}</tbody></table>
              {s.blocked && <p className="mt-2 text-xs font-bold text-rose-600">Blocked: outstanding dues ৳{Number(s.due).toLocaleString()}</p>}
              <div className="mt-6 flex justify-end text-xs"><span className="border-t border-slate-400 px-4 pt-1">{inst.principalTitle || "Principal"}</span></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ResultWorkflow({ initialTab = "progress" }) {
  const { user } = useUser();
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [examId, setExamId] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [narrative, setNarrative] = useState(null);
  const [classId, setClassId] = useState("");
  const [tab2, setTab2] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [corr, setCorr] = useState({ studentId: "", subjectId: "", marksObtained: "", graceMarks: "", reason: "", kind: "correction" });
  const [subjects, setSubjects] = useState([]);

  const loadExams = useCallback(() => resource("/exams").all().then((x) => { setExams(x); if (!examId && x[0]) setExamId(x[0].id); }).catch((e) => toast.error(e)), [examId, toast]);
  useEffect(() => {
    loadExams();
    resource("/classes").all().then(setClasses).catch((e) => toast.error(e));
    resource("/subjects").all().then(setSubjects).catch((e) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const exam = exams.find((e) => e.id === examId);

  const loadTab = useCallback(async () => {
    if (!examId) return;
    try {
      if (tab === "progress") setProgress(await http.get("/marks/progress", { examId }));
      if (tab === "results") setResults(await http.get(`/exams/${examId}/results`, { classId }));
      if (tab === "tabulation" && classId) setTab2(await http.get(`/exams/${examId}/tabulation`, { classId }));
      if (tab === "analytics") setAnalytics(await http.get(`/exams/${examId}/analytics`));
    } catch (e) { toast.error(e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, tab, classId]);
  useEffect(() => { loadTab(); }, [loadTab]);

  async function step(path, msg) {
    setBusy(true);
    try { await http.post(`/exams/${examId}/${path}`, {}); toast.success(msg); await loadExams(); loadTab(); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }
  async function generateRoutine() {
    if (!exam?.classIds?.length) { toast.warning("Edit the exam and choose its classes first (Exam Setup)."); return; }
    try { const d = await http.post(`/exams/${examId}/schedule/generate`, {}); toast.success(`${d.created} routine rows created`); } catch (e) { toast.error(e); }
  }
  async function submitCorrection() {
    try {
      await http.post(`/exams/${examId}/correction`, {
        studentId: corr.studentId, subjectId: corr.subjectId, reason: corr.reason, kind: corr.kind,
        ...(corr.kind === "grace" ? { graceMarks: Number(corr.graceMarks) } : { marksObtained: Number(corr.marksObtained) }),
      });
      toast.success("Sent for approval. A new result version is created after approval.");
      setCorr({ ...corr, marksObtained: "", graceMarks: "", reason: "" });
    } catch (e) { toast.error(e); }
  }

  const resultColumns = [
    { key: "classPosition", label: "Pos." }, { key: "roll", label: "Roll" }, { key: "studentName", label: "Student" }, { key: "className", label: "Class" },
    { key: "totalMarks", label: "Total", render: (r) => `${Number(r.totalMarks)}/${Number(r.maxMarks)}` }, { key: "percentage", label: "%" },
    { key: "gpa", label: "GPA" }, { key: "grade", label: "Grade", render: (r) => <Badge tone={r.status === "Pass" ? "green" : "red"}>{r.grade}</Badge>, exportValue: (r) => r.grade },
    { key: "status", label: "Result", render: (r) => <Badge>{r.status}</Badge>, exportValue: (r) => r.status }, { key: "version", label: "Ver." },
    { key: "narrative", label: "Comment", exportValue: (r) => r.teacherComment || "", render: (r) => (can(user, "results", "edit") && !r.published
      ? <Button size="sm" variant="ghost" onClick={() => setNarrative(r)}>{r.teacherComment ? "Edit comment" : "Add comment"}</Button>
      : <span className="text-xs text-slate-500">{r.teacherComment || "—"}</span>) },
  ];

  return (
    <div>
      <PageHeader title="Result Processing & Publication" icon={FileText}
        subtitle="Setup → marks entry → validation → lock → Exam Controller review → Principal approval → publish → guardian notification (§10)." />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Exam" className="min-w-[260px]"><Select value={examId} onChange={(e) => setExamId(e.target.value)} options={exams.map((x) => ({ value: x.id, label: `${x.name} (${x.examType})` }))} placeholder="Select exam" /></Field>
          {exam && <Stepper status={exam.resultStatus} />}
        </div>
        {exam && (
          <div className="mt-4 flex flex-wrap gap-2">
            {can(user, "exams", "edit") && <Button size="sm" variant="secondary" icon={Cog} onClick={generateRoutine}>Generate routine from class subjects</Button>}
            {can(user, "results", "create") && exam.resultStatus !== "Published" && <Button size="sm" icon={Cog} loading={busy} onClick={() => step("process", "Results calculated (GPA, grades, merit positions)")}>Process results</Button>}
            {can(user, "results", "edit") && ["Processed", "Reviewed"].includes(exam.resultStatus) && <Button size="sm" variant="secondary" icon={CheckCircle2} loading={busy} onClick={() => step("review", "Marked as reviewed by Exam Controller")}>Mark reviewed</Button>}
            {can(user, "results", "edit") && exam.resultStatus === "Reviewed" && <Button size="sm" variant="success" icon={Send} loading={busy} onClick={() => step("request-publish", "Sent to Principal for publication approval")}>Request publication</Button>}
            {exam.resultStatus === "Published" && <Badge tone="green">Published {formatDate(exam.publishedAt)} · v{exam.publishVersion}</Badge>}
          </div>
        )}
      </Card>
      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[
          { key: "progress", label: "Marks progress" }, { key: "routine", label: "Exam routine" }, { key: "admit", label: "Admit cards" },
          { key: "results", label: "Results & merit" }, { key: "tabulation", label: "Tabulation sheet" }, { key: "analytics", label: "Analytics" }, { key: "corrections", label: "Corrections" },
        ]} />
        {!examId ? <EmptyState title="Create an exam in Exam Setup first." /> : (
          <>
            {tab === "progress" && (progress ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <StatCard label="Subjects" value={progress.summary.total} tone="blue" />
                  <StatCard label="Submitted" value={progress.summary.submitted} tone="green" />
                  <StatCard label="Pending" value={progress.summary.pending} tone="amber" />
                  <StatCard label="Overdue" value={progress.summary.overdue} tone="red" />
                </div>
                <Card title="Marks entry progress" subtitle="Who has submitted, who is pending">
                  <Table dense rows={(progress.rows || []).map((r) => ({ ...r, _key: `${r.classId ?? r.className ?? ""}:${r.subjectId}` }))} rowKey="_key" columns={[
                    { key: "className", label: "Class" }, { key: "subjectName", label: "Subject" }, { key: "teacherName", label: "Teacher" },
                    { key: "entered", label: "Entered", render: (r) => `${r.entered}/${r.students}` },
                    { key: "status", label: "Status", render: (r) => <>{r.overdue ? <Badge tone="red">Overdue</Badge> : <Badge>{r.status}</Badge>}</> },
                    { key: "submittedBy", label: "Submitted by" },
                  ]} />
                </Card>
              </div>
            ) : <Spinner />)}
            {tab === "routine" && <ResourceManager embedded config={CONFIGS.examSchedules} fixedFilters={{ examId }} />}
            {tab === "admit" && <AdmitCards examId={examId} classes={classes} />}
            {tab === "results" && (
              <Card title="Results & merit list" actions={(
                <>
                  <Select className="!h-9 !w-auto" value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="All classes" />
                  <Button size="sm" variant="secondary" onClick={() => exportRows("xlsx", { title: `Merit list ${exam?.name}`, columns: resultColumns, rows: results })}>Excel</Button>
                  <Button size="sm" variant="secondary" onClick={() => exportRows("pdf", { title: `Merit list ${exam?.name}`, columns: resultColumns, rows: results })}>PDF</Button>
                  <Button size="sm" variant="secondary" onClick={() => exportRows("pdf", { title: `Failed list ${exam?.name}`, columns: resultColumns, rows: results.filter((r) => r.status === "Fail") })}>Failed list</Button>
                </>
              )}>
                <Table dense rows={results} columns={resultColumns} />
                {narrative && <NarrativeModal result={narrative} onClose={() => setNarrative(null)} onSaved={loadTab} />}
              </Card>
            )}
            {tab === "tabulation" && (
              <Card title="Tabulation sheet" actions={(
                <>
                  <Select className="!h-9 !w-auto" value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select class" />
                  {tab2 && <Button size="sm" variant="secondary" onClick={() => {
                    const cols = [{ key: "roll", label: "Roll" }, { key: "studentName", label: "Name" }, ...tab2.subjects.map((s) => ({ key: s.id, label: s.code || s.name, exportValue: (r) => { const x = (r.subjects || []).find((y) => y.subjectId === s.id); return x ? `${x.absent ? "AB" : x.obtained} (${x.grade})` : ""; } })), { key: "totalMarks", label: "Total" }, { key: "gpa", label: "GPA" }, { key: "grade", label: "Grade" }, { key: "classPosition", label: "Pos" }];
                    exportRows("pdf", { title: `Tabulation ${exam?.name}`, columns: cols, rows: tab2.rows });
                  }}>PDF</Button>}
                </>
              )}>
                {!classId ? <EmptyState title="Select a class." /> : !tab2 ? <Spinner /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-xs">
                      <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="px-2 py-2 text-left">Roll</th><th className="px-2 py-2 text-left">Name</th>{tab2.subjects.map((s) => <th key={s.id} className="px-2 py-2">{s.code || s.name}</th>)}<th className="px-2">Total</th><th className="px-2">GPA</th><th className="px-2">Grade</th><th className="px-2">Pos</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{tab2.rows.map((r) => (
                        <tr key={r.studentId}><td className="px-2 py-1.5">{r.roll}</td><td className="px-2 py-1.5 font-semibold">{r.studentName}</td>
                          {tab2.subjects.map((s) => { const x = (r.subjects || []).find((y) => y.subjectId === s.id); return <td key={s.id} className={`px-2 py-1.5 text-center ${x && !x.passed ? "font-bold text-rose-600" : ""}`}>{x ? `${x.absent ? "AB" : x.obtained} · ${x.grade}` : "—"}{x?.isFourth ? "*" : ""}</td>; })}
                          <td className="px-2 text-center">{Number(r.totalMarks)}</td><td className="px-2 text-center font-bold">{r.gpa}</td><td className="px-2 text-center">{r.grade}</td><td className="px-2 text-center">{r.classPosition}</td></tr>
                      ))}</tbody>
                    </table>
                    <p className="mt-2 text-xs text-slate-500">* 4th / optional subject (NCTB: points above 2.00 are added to GPA, capped at 5.00).</p>
                  </div>
                )}
              </Card>
            )}
            {tab === "analytics" && (analytics ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="Students" value={analytics.totals.students} icon={BarChart3} />
                  <StatCard label="Passed" value={analytics.totals.passed} tone="green" />
                  <StatCard label="Failed" value={analytics.totals.failed} tone="red" />
                </div>
                <Card title="Grade distribution">
                  <div className="flex flex-wrap gap-3">{Object.entries(analytics.gradeDistribution).map(([g, n]) => (
                    <div key={g} className="min-w-[90px] rounded-xl bg-slate-50 p-3 text-center"><p className="text-xl font-extrabold text-slate-900">{n}</p><p className="text-xs font-semibold text-slate-500">{g}</p></div>
                  ))}</div>
                </Card>
                <Card title="Class comparison"><Table dense rows={analytics.classes} rowKey="className" columns={[{ key: "className", label: "Class" }, { key: "students", label: "Students" }, { key: "passRate", label: "Pass %" }, { key: "avgGpa", label: "Avg GPA" }, { key: "aplus", label: "Top grade" }]} /></Card>
                <Card title="Subject-wise & teacher-wise performance"><Table dense rows={(analytics.subjects || []).map((r) => ({ ...r, _key: `${r.classId ?? r.className ?? ""}:${r.subjectId}` }))} rowKey="_key" columns={[{ key: "className", label: "Class" }, { key: "subjectName", label: "Subject" }, { key: "teacher", label: "Teacher" }, { key: "students", label: "Students" }, { key: "passRate", label: "Pass %" }, { key: "avgPercent", label: "Avg %" }, { key: "highest", label: "Highest" }]} /></Card>
                <Card title="Failed list"><Table dense rows={analytics.failed} rowKey="studentId" columns={[{ key: "name", label: "Student" }, { key: "className", label: "Class" }, { key: "roll", label: "Roll" }, { key: "failedSubjects", label: "Failed in", render: (r) => r.failedSubjects.join(", ") }]} /></Card>
              </div>
            ) : <Spinner />)}
            {tab === "corrections" && (
              <Card title="Result correction / grace marks" subtitle="Published results change only through approval; the previous version is kept and guardians are notified.">
                <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
                  <Field label="Type"><Select value={corr.kind} onChange={(e) => setCorr({ ...corr, kind: e.target.value })} options={[{ value: "correction", label: "Marks correction" }, { value: "grace", label: "Grace marks" }]} /></Field>
                  <Field label="Student ID"><Input value={corr.studentId} onChange={(e) => setCorr({ ...corr, studentId: e.target.value.trim() })} placeholder="STU-…" /></Field>
                  <Field label="Subject"><Select value={corr.subjectId} onChange={(e) => setCorr({ ...corr, subjectId: e.target.value })} options={subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select" /></Field>
                  {corr.kind === "grace"
                    ? <Field label="Grace marks"><Input type="number" value={corr.graceMarks} onChange={(e) => setCorr({ ...corr, graceMarks: e.target.value })} /></Field>
                    : <Field label="Corrected total marks"><Input type="number" value={corr.marksObtained} onChange={(e) => setCorr({ ...corr, marksObtained: e.target.value })} /></Field>}
                  <Field label="Reason (mandatory)" className="sm:col-span-2"><Textarea value={corr.reason} onChange={(e) => setCorr({ ...corr, reason: e.target.value })} /></Field>
                  <div><Button icon={Wrench} disabled={!corr.studentId || !corr.subjectId || !corr.reason} onClick={submitCorrection}>Submit for approval</Button></div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
