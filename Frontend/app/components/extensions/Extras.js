"use client";

// Screens added by the SRS gap audit: branches, seat plan, board & government
// exports, homework tracking, quizzes, integrations, finance exports, hifz
// targets, moderation, transcript/progress, account security and guardian
// learning views.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, BookOpenCheck, Building2, Download, FileSpreadsheet, KeyRound, LayoutGrid, Link2, LogOut, MapPin, MessageSquare,
  MonitorSmartphone, Play, Plug, Printer, RefreshCw, Send, ShieldCheck, Target, Trash2, Upload, Video,
} from "lucide-react";
import { http, request } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import ResourceManager from "../ui/ResourceManager";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Tabs, Textarea,
  downloadBlob, formatDate, formatDateTime, money, today, useToast,
  thisMonth,
} from "../ui/kit";

// ----------------------------------------------------------------- helpers
const REL = {
  class: { endpoint: "/classes", label: (r) => r.name },
  subject: { endpoint: "/subjects", label: (r) => `${r.name} (${r.code})` },
  teacher: { endpoint: "/teachers", label: (r) => `${r.name} – ${r.id}` },
  student: { endpoint: "/students", label: (r) => `${r.name} – ${r.id} (${r.className || ""})` },
  year: { endpoint: "/academic-years", label: (r) => r.name },
  club: { endpoint: "/clubs", label: (r) => `${r.name} (${r.kind})` },
  branch: { endpoint: "/branches", label: (r) => r.name },
  coursework: { endpoint: "/coursework", label: (r) => r.title },
  album: { endpoint: "/gallery-albums", label: (r) => r.title },
};
const rel = (key, field, label, extra = {}) => ({ key: field, label, type: "relation", relation: REL[key], ...extra });

export async function downloadFile(path, fallbackName) {
  const token = typeof window !== "undefined" ? localStorage.getItem("edumanage-token") : null;
  const res = await fetch(`/api/backend${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Download failed (${res.status})`);
  }
  const disposition = res.headers.get("content-disposition") || "";
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] || fallbackName;
  downloadBlob(await res.blob(), name);
}

function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const key = JSON.stringify(deps);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); } catch (e) { toast.error(e); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, toast]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load, setData };
}

// ----------------------------------------------------------------- progress chart
export function ProgressChart({ points = [], metric = "gpa" }) {
  const values = points.filter((p) => p[metric] !== null && p[metric] !== undefined);
  if (values.length < 1) return <EmptyState title="No published results yet." />;
  const max = metric === "gpa" ? 5 : 100;
  const w = 560; const h = 180; const pad = 28;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((p, i) => [pad + i * step, h - pad - (Number(p[metric]) / max) * (h - pad * 2)]);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full min-w-[420px]" role="img" aria-label="Term to term progress">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad} x2={w - pad} y1={h - pad - f * (h - pad * 2)} y2={h - pad - f * (h - pad * 2)} stroke="currentColor" className="text-slate-200" />
            <text x={4} y={h - pad - f * (h - pad * 2) + 4} className="fill-slate-400 text-[10px]">{(max * f).toFixed(metric === "gpa" ? 1 : 0)}</text>
          </g>
        ))}
        <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" points={pts.map((p) => p.join(",")).join(" ")} />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill="#2563eb" />
            <text x={x} y={y - 9} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">{Number(values[i][metric]).toFixed(metric === "gpa" ? 2 : 0)}</text>
            <text x={x} y={h - 8} textAnchor="middle" className="fill-slate-500 text-[9px]">{String(values[i].exam).slice(0, 14)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ----------------------------------------------------------------- transcript
export function TranscriptCard({ studentId }) {
  const { data, loading } = useLoad(() => http.get(`/x/students/${studentId}/transcript`), [studentId]);
  const [metric, setMetric] = useState("gpa");
  if (loading) return <Card title="Transcript & progress"><Spinner /></Card>;
  if (!data) return null;
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = data.results.map((r) => `<tr><td>${r.sessionName || ""}</td><td>${r.examName}</td><td>${r.className || ""}</td><td>${r.totalMarks ?? ""}/${r.maxMarks ?? ""}</td><td>${r.gpa ?? ""}</td><td>${r.grade || r.division || ""}</td><td>${r.status || ""}</td></tr>`).join("");
    const board = data.boardResults.map((b) => `<tr><td>${b.examLevel}</td><td>${b.passingYear}</td><td>${b.board || ""}</td><td>${b.gpa ?? ""}</td><td>${b.grade || ""}</td></tr>`).join("");
    w.document.write(`<html><head><title>Transcript ${data.student.id}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #999;padding:6px;font-size:12px;text-align:left}h1{font-size:18px;margin:0}</style></head><body>
      <h1>Academic Transcript</h1><p>${data.student.name}${data.student.nameBn ? ` (${data.student.nameBn})` : ""} · ID ${data.student.id} · DOB ${formatDate(data.student.dateOfBirth)}</p>
      <table><tr><th>Session</th><th>Exam</th><th>Class</th><th>Marks</th><th>GPA</th><th>Grade</th><th>Status</th></tr>${rows}</table>
      ${board ? `<h3>Public examinations</h3><table><tr><th>Exam</th><th>Year</th><th>Board</th><th>GPA</th><th>Grade</th></tr>${board}</table>` : ""}
      <p style="margin-top:40px">Generated ${new Date().toLocaleDateString()} · ____________________ Authorised signature</p></body></html>`);
    w.document.close();
    w.print();
  };
  return (
    <Card title="Transcript & progress" subtitle="Term-to-term graph and full academic history" actions={<div className="flex gap-2"><Select className="!h-8 !w-auto" value={metric} onChange={(e) => setMetric(e.target.value)} options={[{ value: "gpa", label: "GPA" }, { value: "percentage", label: "Percentage" }]} /><Button size="sm" variant="secondary" icon={Printer} onClick={print}>Transcript</Button></div>}>
      <ProgressChart points={data.progress} metric={metric} />
      {data.boardResults.length > 0 && (
        <div className="mt-3"><Table dense rows={data.boardResults} columns={[{ key: "examLevel", label: "Public exam" }, { key: "passingYear", label: "Year" }, { key: "board", label: "Board" }, { key: "gpa", label: "GPA" }, { key: "grade", label: "Grade" }]} /></div>
      )}
      {data.results.some((r) => r.teacherComment || Object.keys(r.skillRatings || {}).length) && (
        <div className="mt-3 space-y-2">
          {data.results.filter((r) => r.teacherComment || Object.keys(r.skillRatings || {}).length).map((r) => (
            <div key={r.examId} className="rounded-xl bg-slate-50 p-3 text-sm">
              <b>{r.examName}</b>{r.teacherComment && <p className="mt-1 text-slate-600">“{r.teacherComment}”</p>}
              <div className="mt-1 flex flex-wrap gap-1">{Object.entries(r.skillRatings || {}).map(([k, v]) => <Badge key={k} tone="blue">{k}: {v}</Badge>)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------- narrative editor
export function NarrativeModal({ result, onClose, onSaved }) {
  const toast = useToast();
  const [comment, setComment] = useState(result?.teacherComment || "");
  const [skills, setSkills] = useState(Object.entries(result?.skillRatings || {}).map(([k, v]) => ({ k, v })));
  const save = async () => {
    try {
      const ratings = Object.fromEntries(skills.filter((s) => s.k.trim()).map((s) => [s.k.trim(), s.v]));
      await http.patch(`/x/results/${result.id}/narrative`, { teacherComment: comment, skillRatings: ratings });
      toast.success("Saved"); onSaved?.(); onClose();
    } catch (e) { toast.error(e); }
  };
  return (
    <Modal open={Boolean(result)} onClose={onClose} title="Teacher comment & skill ratings" footer={<Button onClick={save}>Save</Button>}>
      <Field label="Narrative comment"><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <p className="mt-3 text-xs font-semibold text-slate-600">Skill ratings</p>
      {skills.map((s, i) => (
        <div key={i} className="mt-2 flex gap-2">
          <Input value={s.k} placeholder="Skill (e.g. Reading)" onChange={(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
          <Select value={s.v} onChange={(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} options={["Excellent", "Very good", "Good", "Satisfactory", "Needs improvement"]} placeholder="Rating" />
          <Button variant="ghost" icon={Trash2} onClick={() => setSkills(skills.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button className="mt-2" size="sm" variant="secondary" onClick={() => setSkills([...skills, { k: "", v: "Good" }])}>Add skill</Button>
    </Modal>
  );
}

// ----------------------------------------------------------------- branches
const BRANCH_TRANSFERS = {
  title: "Transfer history", singular: "Transfer", endpoint: "/branch-transfers", module: "branches", create: false, edit: false, delete: false,
  columns: [{ key: "personType", label: "Type" }, { key: "personId", label: "Person" }, { key: "fromBranchId", label: "From" }, { key: "toBranchId", label: "To" }, { key: "effectiveDate", label: "Effective", type: "date" }, { key: "reason", label: "Reason" }, { key: "createdBy", label: "By" }],
  fields: [],
};
export function BranchDashboard() {
  const { user } = useUser();
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => http.get("/x/branches/summary"), []);
  const [form, setForm] = useState({ personType: "Student", personId: "", toBranchId: "", reason: "" });
  const submit = async () => {
    try { await http.post("/x/branch-transfers", form); toast.success("Transferred"); setForm({ ...form, personId: "", reason: "" }); reload(); } catch (e) { toast.error(e); }
  };
  return (
    <div>
      <PageHeader title="Branch Dashboard" icon={Building2} subtitle="Branch-wise students, staff, income, dues, attendance and results; transfers keep history (v1 PC-12/13)." actions={<Button variant="secondary" icon={RefreshCw} onClick={reload}>Refresh</Button>} />
      {loading ? <Spinner /> : (
        <>
          {!data?.branches?.length ? <Card><EmptyState title="No branches yet." hint="Add branches in Academic → Setup / Institution setup, then assign students and staff." /></Card> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.branches.map((b) => (
                <Card key={b.id} title={<span className="flex items-center gap-2">{b.name}{b.isMain && <Badge tone="blue">Main</Badge>}</span>} subtitle={b.code}>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-slate-500">Students</p><p className="text-xl font-bold">{b.students}</p></div>
                    <div><p className="text-slate-500">Staff</p><p className="text-xl font-bold">{b.staff}</p></div>
                    <div><p className="text-slate-500">Income (month)</p><p className="font-bold">{money(b.incomeMonth)}</p></div>
                    <div><p className="text-slate-500">Due</p><p className="font-bold text-rose-600">{money(b.due)}</p></div>
                    <div><p className="text-slate-500">Attendance (30d)</p><p className="font-bold">{b.attendancePct === null ? "—" : `${b.attendancePct}%`}</p></div>
                    <div><p className="text-slate-500">Avg GPA</p><p className="font-bold">{b.avgGpa ?? "—"}</p></div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {data?.unassignedStudents > 0 && <p className="mt-3 text-sm text-amber-700">{data.unassignedStudents} active students are not assigned to a branch.</p>}
        </>
      )}
      {can(user, "branches", "edit") && (
        <Card className="mt-4" title="Transfer between branches" subtitle="Moves the student / teacher / staff and records the transfer">
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Type"><Select value={form.personType} onChange={(e) => setForm({ ...form, personType: e.target.value })} options={["Student", "Teacher", "Staff"]} /></Field>
            <Field label="ID"><Input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value.trim() })} placeholder="STU-… / TCH-… / STF-…" /></Field>
            <Field label="To branch"><Select value={form.toBranchId} onChange={(e) => setForm({ ...form, toBranchId: e.target.value })} options={(data?.branches || []).map((b) => ({ value: b.id, label: b.name }))} placeholder="Choose" /></Field>
            <Field label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
            <div className="flex items-end"><Button onClick={submit} disabled={!form.personId || !form.toBranchId}>Transfer</Button></div>
          </div>
        </Card>
      )}
      {/* Transfer history is branch data; roles without Branch access only see the summary. */}
      {can(user, "branches", "view") && <div className="mt-4"><ResourceManager embedded config={BRANCH_TRANSFERS} /></div>}
    </div>
  );
}

// ----------------------------------------------------------------- seat plan
export function SeatPlan() {
  const toast = useToast();
  const { data: exams } = useLoad(() => http.get("/exams", { limit: 200 }), []);
  const [examId, setExamId] = useState("");
  const [rooms, setRooms] = useState([{ room: "Room 101", capacity: 30 }]);
  const [mix, setMix] = useState(true);
  const [plan, setPlan] = useState(null);
  const load = useCallback(async () => { if (examId) setPlan(await http.get(`/x/exams/${examId}/seat-plan`)); }, [examId]);
  useEffect(() => { load().catch((e) => toast.error(e)); }, [load, toast]);
  const generate = async () => {
    try { const r = await http.post(`/x/exams/${examId}/seat-plan`, { rooms, mixClasses: mix }); toast.success(`${r.seated} students seated`); load(); } catch (e) { toast.error(e); }
  };
  const byRoom = useMemo(() => {
    const out = {};
    for (const s of plan?.seats || []) (out[s.room] ||= []).push(s);
    return out;
  }, [plan]);
  return (
    <div>
      <PageHeader title="Seat Plan & Invigilation" icon={LayoutGrid} subtitle="Auto seat plan by room capacity with class mixing; invigilator duty comes from the exam routine." actions={plan?.seats?.length > 0 && <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>} />
      <Card className="print:hidden">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Exam"><Select value={examId} onChange={(e) => setExamId(e.target.value)} options={(exams || []).map((x) => ({ value: x.id, label: x.name }))} placeholder="Choose exam" /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={mix} onChange={(e) => setMix(e.target.checked)} /> Mix classes (neighbours from different classes)</label>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-600">Rooms</p>
        {rooms.map((r, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <Input value={r.room} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, room: e.target.value } : x)))} placeholder="Room" />
            <Input type="number" min="1" value={r.capacity} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, capacity: Number(e.target.value) } : x)))} className="!w-32" />
            <Button variant="ghost" icon={Trash2} onClick={() => setRooms(rooms.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setRooms([...rooms, { room: "", capacity: 30 }])}>Add room</Button>
          <Button size="sm" onClick={generate} disabled={!examId}>Generate seat plan</Button>
        </div>
      </Card>
      {examId && plan && (
        <>
          {!plan.seats.length ? <Card className="mt-4"><EmptyState title="No seat plan generated yet." /></Card> : Object.entries(byRoom).map(([room, seats]) => (
            <Card key={room} className="mt-4 break-inside-avoid" title={`${room} – ${seats.length} seats`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {seats.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-2 text-xs"><b>Seat {s.seatNo}</b><p className="truncate">{s.studentName}</p><p className="text-slate-500">{s.className} · Roll {s.roll || "—"}</p></div>
                ))}
              </div>
            </Card>
          ))}
          <Card className="mt-4" title="Invigilator duty"><Table dense rows={plan.invigilators} rowKey="examDate" empty="Assign invigilators in Exam Setup → routine." columns={[{ key: "examDate", label: "Date", render: (r) => formatDate(r.examDate) }, { key: "startTime", label: "Time" }, { key: "subject", label: "Subject" }, { key: "room", label: "Room" }, { key: "invigilator", label: "Invigilator" }]} /></Card>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- board & government
const BOARDS = ["Dhaka", "Chattogram", "Rajshahi", "Cumilla", "Jashore", "Barishal", "Sylhet", "Dinajpur", "Mymensingh", "BMEB", "IAU", "Befaq", "Haiatul Ulya", "CAIE", "Edexcel"];
const LEVELS = ["JSC", "SSC", "HSC", "Dakhil", "Alim", "Fazil", "Kamil", "Mutawassitah", "Sanabia Ulya", "Fazilat", "Takmil", "O Level", "AS Level", "A Level"];
const BOARD_REG = {
  title: "Board Registrations & Candidates", singular: "Registration", endpoint: "/board-registrations", module: "students",
  subtitle: "SSC/HSC, Dakhil/Alim, Befaq and Cambridge/Edexcel candidate entries with subjects, centre, entry fee and predicted grades.",
  columns: [{ key: "studentId", label: "Student" }, { key: "board", label: "Board" }, { key: "examLevel", label: "Exam" }, { key: "examYear", label: "Year" }, { key: "registrationNo", label: "Reg. no" }, { key: "candidateNo", label: "Candidate / roll" }, { key: "entryFee", label: "Fee", type: "money" }, { key: "formFillupStatus", label: "Form fill-up", type: "badge" }],
  filters: [{ key: "board", label: "Board", options: BOARDS }, { key: "examLevel", label: "Exam", options: LEVELS }, { key: "formFillupStatus", label: "Form fill-up", options: ["Pending", "Eligible", "Blocked", "Submitted"] }],
  fields: [rel("student", "studentId", "Student", { required: true }), { key: "board", label: "Board", type: "select", options: BOARDS, required: true }, { key: "examLevel", label: "Exam", type: "select", options: LEVELS, required: true },
    { key: "examYear", label: "Year" }, { key: "examSession", label: "Session (e.g. May/June)" }, { key: "registrationNo", label: "Registration no" }, { key: "candidateNo", label: "Candidate / roll no" }, { key: "centre", label: "Centre" },
    { key: "subjects", label: "Subject codes", type: "list", wide: true }, { key: "entryFee", label: "Entry fee", type: "money" },
    { key: "predictedGrades", label: "Predicted grades (JSON)", type: "json", default: {}, hint: '{"Maths":"A*","Physics":"A"}', wide: true },
    { key: "formFillupStatus", label: "Form fill-up", type: "select", options: ["Pending", "Eligible", "Blocked", "Submitted"], default: "Pending" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Submitted", "Confirmed"], default: "Draft" }],
};
const BOARD_RESULTS = {
  title: "Board Results", singular: "Board result", endpoint: "/board-results", module: "results",
  columns: [{ key: "studentId", label: "Student" }, { key: "examLevel", label: "Exam" }, { key: "passingYear", label: "Year" }, { key: "board", label: "Board" }, { key: "rollNo", label: "Roll" }, { key: "gpa", label: "GPA" }, { key: "grade", label: "Grade" }],
  fields: [rel("student", "studentId", "Student", { required: true }), { key: "examLevel", label: "Exam", type: "select", options: LEVELS, required: true }, { key: "passingYear", label: "Year", required: true },
    { key: "board", label: "Board", type: "select", options: BOARDS }, { key: "rollNo", label: "Roll" }, { key: "registrationNo", label: "Registration" }, { key: "gpa", label: "GPA", type: "number" }, { key: "grade", label: "Grade" }],
};
const STIPEND = {
  title: "Stipend (Upobritti) Beneficiaries", singular: "Beneficiary", endpoint: "/stipend-beneficiaries", module: "students",
  columns: [{ key: "studentId", label: "Student" }, { key: "program", label: "Program" }, { key: "mobileBankingProvider", label: "MFS" }, { key: "mobileBankingNumber", label: "Number" }, { key: "amount", label: "Amount", type: "money" }, { key: "status", label: "Status", type: "badge" }],
  fields: [rel("student", "studentId", "Student", { required: true }), { key: "program", label: "Program", default: "Upobritti" }, rel("year", "academicYearId", "Session"),
    { key: "mobileBankingProvider", label: "Mobile banking", type: "select", options: ["bKash", "Nagad", "Rocket", "Upay", "Bank"] }, { key: "mobileBankingNumber", label: "Account / mobile no" }, { key: "accountHolder", label: "Account holder" },
    { key: "amount", label: "Amount", type: "money" }, { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" }],
};

function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).filter((x) => x !== "").map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  const [head, ...rows] = lines;
  const keys = split(head);
  return rows.map((r) => Object.fromEntries(split(r).map((v, i) => [keys[i], v])));
}

function BoardTools() {
  const toast = useToast();
  const { data: exams } = useLoad(() => http.get("/exams", { limit: 200 }), []);
  const [exp, setExp] = useState({ board: "", level: "", year: "" });
  const [ff, setFf] = useState({ examId: "", level: "", year: "" });
  const [elig, setElig] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [importText, setImportText] = useState("");
  const [importReport, setImportReport] = useState(null);
  const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
  const check = async () => { try { setElig(await http.get("/x/board/form-fillup", ff)); setOverrides([]); } catch (e) { toast.error(e); } };
  const apply = async () => { try { const r = await http.post("/x/board/form-fillup/apply", { ...ff, overrides }); toast.success(`${r.eligible} eligible, ${r.blocked} blocked`); check(); } catch (e) { toast.error(e); } };
  const runImport = async (dryRun) => {
    try {
      const rows = parseCsv(importText);
      const r = await http.post("/x/board/results/import", { rows, dryRun });
      setImportReport(r);
      toast.success(dryRun ? `Checked: ${r.total - r.rejected} valid, ${r.rejected} invalid` : `Imported ${r.imported}`);
    } catch (e) { toast.error(e); }
  };
  return (
    <div className="space-y-4">
      <Card title="Registration / form fill-up export" subtitle="CSV with the fields the boards ask for; adjust columns to the board's latest template before upload">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Board"><Select value={exp.board} onChange={(e) => setExp({ ...exp, board: e.target.value })} options={BOARDS} placeholder="All" /></Field>
          <Field label="Exam"><Select value={exp.level} onChange={(e) => setExp({ ...exp, level: e.target.value })} options={LEVELS} placeholder="All" /></Field>
          <Field label="Year"><Input value={exp.year} onChange={(e) => setExp({ ...exp, year: e.target.value })} placeholder="e.g. 2027" /></Field>
          <div className="flex items-end gap-2">
            <Button icon={Download} onClick={() => downloadFile(`/x/board/export?${qs(exp)}`, "board-export.csv").catch((e) => toast.error(e))}>Export CSV</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => downloadFile("/x/board/banbeis?format=csv", "banbeis.csv").catch((e) => toast.error(e))}>BANBEIS / EMIS summary</Button>
          <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => downloadFile("/x/board/stipend/export", "stipend.csv").catch((e) => toast.error(e))}>Stipend beneficiary list</Button>
        </div>
      </Card>
      <Card title="Form fill-up eligibility" subtitle="Students who failed the test / pre-test exam are blocked unless an authorised override is ticked">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Test exam"><Select value={ff.examId} onChange={(e) => setFf({ ...ff, examId: e.target.value })} options={(exams || []).map((x) => ({ value: x.id, label: x.name }))} placeholder="Choose" /></Field>
          <Field label="Exam level"><Select value={ff.level} onChange={(e) => setFf({ ...ff, level: e.target.value })} options={LEVELS} placeholder="All" /></Field>
          <Field label="Year"><Input value={ff.year} onChange={(e) => setFf({ ...ff, year: e.target.value })} /></Field>
          <div className="flex items-end gap-2"><Button variant="secondary" onClick={check} disabled={!ff.examId}>Check</Button>{elig && <Button onClick={apply}>Apply statuses</Button>}</div>
        </div>
        {elig && <div className="mt-3"><Table dense rows={elig} rowKey="registrationId" empty="No registrations match." columns={[
          { key: "name", label: "Student" }, { key: "className", label: "Class" }, { key: "testStatus", label: "Test result", render: (r) => r.testStatus || "—" }, { key: "gpa", label: "GPA" },
          { key: "eligible", label: "Eligible", render: (r) => (r.eligible ? <Badge tone="green">Eligible</Badge> : <Badge tone="red">{r.reason}</Badge>) },
          { key: "o", label: "Override", render: (r) => !r.eligible && <input type="checkbox" className="accent-blue-600" checked={overrides.includes(r.studentId)} onChange={(e) => setOverrides(e.target.checked ? [...overrides, r.studentId] : overrides.filter((x) => x !== r.studentId))} /> },
        ]} /></div>}
      </Card>
      <Card title="Import board results" subtitle="Paste CSV: studentId or registrationNo/rollNo, examLevel, passingYear, board, gpa, grade. Check first, then import">
        <Textarea rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"registrationNo,examLevel,passingYear,board,gpa,grade\nR-12345,SSC,2027,Dhaka,5.00,A+"} />
        <div className="mt-2 flex gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"><Upload size={14} /> Load file<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImportText(await f.text()); }} /></label>
          <Button variant="secondary" onClick={() => runImport(true)} disabled={!importText.trim()}>Check rows</Button>
          <Button onClick={() => runImport(false)} disabled={!importText.trim()}>Import valid rows</Button>
        </div>
        {importReport && <div className="mt-3"><Table dense rows={importReport.report} rowKey="row" columns={[{ key: "row", label: "Row" }, { key: "studentId", label: "Student" }, { key: "ok", label: "Status", render: (r) => (r.ok ? <Badge tone="green">OK</Badge> : <span className="text-rose-600">{r.errors.join("; ")}</span>) }]} /></div>}
      </Card>
    </div>
  );
}

export function BoardCenter() {
  const [tab, setTab] = useState("reg");
  return (
    <div>
      <PageHeader title="Board, Candidates & Stipend" icon={Award} subtitle="Public exam registration, form fill-up control, board result import, stipend and government returns." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "reg", label: "Registrations" }, { key: "tools", label: "Exports & eligibility" }, { key: "results", label: "Board results" }, { key: "stipend", label: "Stipend" }]} />
      {tab === "reg" && <ResourceManager embedded config={BOARD_REG} />}
      {tab === "tools" && <BoardTools />}
      {tab === "results" && <ResourceManager embedded config={BOARD_RESULTS} />}
      {tab === "stipend" && <ResourceManager embedded config={STIPEND} />}
    </div>
  );
}

// ----------------------------------------------------------------- homework submissions
export function HomeworkTracker() {
  const toast = useToast();
  const { data: homework } = useLoad(() => http.get("/homework", { limit: 200 }), []);
  const [hwId, setHwId] = useState("");
  const [roster, setRoster] = useState(null);
  const [edits, setEdits] = useState({});
  const load = useCallback(async () => { if (hwId) { const d = await http.get(`/x/homework/${hwId}/submissions`); setRoster(d); setEdits({}); } }, [hwId]);
  useEffect(() => { load().catch((e) => toast.error(e)); }, [load, toast]);
  const row = (r) => ({ ...r, ...(edits[r.studentId] || {}) });
  const set = (id, patch) => setEdits({ ...edits, [id]: { ...(edits[id] || {}), ...patch } });
  const save = async () => {
    try {
      const entries = Object.entries(edits).map(([studentId, e]) => ({ studentId, ...row(roster.roster.find((x) => x.studentId === studentId)), ...e }));
      const r = await http.post(`/x/homework/${hwId}/submissions`, { entries });
      toast.success(`${r.saved} saved`); load();
    } catch (e) { toast.error(e); }
  };
  return (
    <Card title="Homework submission status" subtitle="Mark submitted / not submitted / late and marks for each student (v1 AC-12)" actions={Object.keys(edits).length > 0 && <Button size="sm" onClick={save}>Save {Object.keys(edits).length}</Button>}>
      <Field label="Homework"><Select value={hwId} onChange={(e) => setHwId(e.target.value)} options={(homework || []).map((h) => ({ value: h.id, label: `${h.title} – ${h.className || ""} (due ${formatDate(h.dueDate)})` }))} placeholder="Choose homework" /></Field>
      {roster && (
        <div className="mt-3"><Table dense rows={roster.roster} rowKey="studentId" columns={[
          { key: "roll", label: "Roll" }, { key: "name", label: "Student" },
          { key: "status", label: "Status", render: (r) => <Select className="!h-8" value={row(r).status || ""} onChange={(e) => set(r.studentId, { status: e.target.value })} options={["Submitted", "Not Submitted", "Late", "Excused"]} placeholder="—" /> },
          { key: "marks", label: "Marks", render: (r) => <Input className="!h-8 !w-20" type="number" value={row(r).marks ?? ""} onChange={(e) => set(r.studentId, { marks: e.target.value, status: row(r).status || "Submitted" })} /> },
          { key: "remarks", label: "Remarks", render: (r) => <Input className="!h-8" value={row(r).remarks || ""} onChange={(e) => set(r.studentId, { remarks: e.target.value, status: row(r).status || "Submitted" })} /> },
        ]} /></div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------- quizzes and coursework
function QuizEditor({ quiz, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ title: "", classId: "", subjectId: "", durationMinutes: 20, opensAt: "", closesAt: "", status: "Draft", questions: [], ...(quiz || {}) }));
  const { data: classes } = useLoad(() => http.get("/classes", { limit: 300 }), []);
  const { data: subjects } = useLoad(() => http.get("/subjects", { limit: 500 }), []);
  const setQ = (i, patch) => setForm({ ...form, questions: form.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const save = async () => {
    try {
      const body = { ...form, opensAt: form.opensAt || null, closesAt: form.closesAt || null, classId: form.classId || null, subjectId: form.subjectId || null };
      if (form.questions.some((q) => !q.q || (q.options || []).filter(Boolean).length < 2)) throw new Error("Each question needs text and at least two options.");
      if (quiz?.id) await http.patch(`/quizzes/${quiz.id}`, body); else await http.post("/quizzes", body);
      toast.success("Quiz saved"); onSaved(); onClose();
    } catch (e) { toast.error(e); }
  };
  const dt = (v) => (v ? String(v).slice(0, 16) : "");
  return (
    <Modal open onClose={onClose} title={quiz?.id ? "Edit quiz" : "New quiz"} width="max-w-3xl" footer={<Button onClick={save}>Save</Button>}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Title" className="md:col-span-3"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Class"><Select value={form.classId || ""} onChange={(e) => setForm({ ...form, classId: e.target.value })} options={(classes || []).map((c) => ({ value: c.id, label: c.name }))} placeholder="All classes" /></Field>
        <Field label="Subject"><Select value={form.subjectId || ""} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} options={(subjects || []).map((s) => ({ value: s.id, label: s.name }))} placeholder="—" /></Field>
        <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={["Draft", "Published", "Closed"]} /></Field>
        <Field label="Opens"><Input type="datetime-local" value={dt(form.opensAt)} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></Field>
        <Field label="Closes"><Input type="datetime-local" value={dt(form.closesAt)} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></Field>
        <Field label="Duration (min)"><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></Field>
      </div>
      <p className="mt-4 text-sm font-semibold">Questions (auto-marked)</p>
      {form.questions.map((q, i) => (
        <div key={i} className="mt-2 rounded-xl border border-slate-200 p-3">
          <div className="flex gap-2"><Input value={q.q} placeholder={`Question ${i + 1}`} onChange={(e) => setQ(i, { q: e.target.value })} /><Input className="!w-24" type="number" min="1" value={q.marks || 1} onChange={(e) => setQ(i, { marks: Number(e.target.value) })} title="Marks" /><Button variant="ghost" icon={Trash2} onClick={() => setForm({ ...form, questions: form.questions.filter((_, j) => j !== i) })} /></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(q.options || ["", "", "", ""]).map((o, k) => (
              <label key={k} className="flex items-center gap-2"><input type="radio" name={`ans-${i}`} className="accent-emerald-600" checked={Number(q.answer) === k} onChange={() => setQ(i, { answer: k })} title="Correct answer" /><Input value={o} placeholder={`Option ${k + 1}`} onChange={(e) => setQ(i, { options: (q.options || ["", "", "", ""]).map((x, m) => (m === k ? e.target.value : x)) })} /></label>
            ))}
          </div>
        </div>
      ))}
      <Button className="mt-2" size="sm" variant="secondary" onClick={() => setForm({ ...form, questions: [...form.questions, { q: "", options: ["", "", "", ""], answer: 0, marks: 1 }] })}>Add question</Button>
    </Modal>
  );
}

const COURSEWORK = {
  title: "Coursework & Projects", singular: "Coursework", endpoint: "/coursework", module: "homework",
  columns: [{ key: "title", label: "Title" }, { key: "kind", label: "Type", type: "badge" }, { key: "classId", label: "Class" }, { key: "subjectId", label: "Subject" }, { key: "deadline", label: "Deadline", type: "date" }, { key: "maxMarks", label: "Max" }, { key: "status", label: "Status", type: "badge" }],
  fields: [{ key: "title", label: "Title", required: true, wide: true }, { key: "kind", label: "Type", type: "select", options: ["Coursework", "Project", "Assignment", "Practical"], default: "Coursework" },
    rel("class", "classId", "Class"), rel("subject", "subjectId", "Subject"), rel("teacher", "teacherId", "Teacher"), { key: "deadline", label: "Deadline", type: "date" },
    { key: "maxMarks", label: "Max marks", type: "number", default: 100 }, { key: "description", label: "Description", type: "textarea", wide: true }, { key: "status", label: "Status", type: "select", options: ["Open", "Closed"], default: "Open" }],
};
const COURSEWORK_SUB = {
  title: "Coursework Tracking", singular: "Submission", endpoint: "/coursework-submissions", module: "homework",
  columns: [{ key: "courseworkId", label: "Coursework" }, { key: "studentId", label: "Student" }, { key: "submittedOn", label: "Submitted", type: "date" }, { key: "marks", label: "Marks" }, { key: "grade", label: "Grade" }, { key: "status", label: "Status", type: "badge" }],
  filters: [{ key: "status", label: "Status", options: ["Pending", "Submitted", "Late", "Graded", "Missing"] }],
  fields: [rel("coursework", "courseworkId", "Coursework", { required: true }), rel("student", "studentId", "Student", { required: true }), { key: "submittedOn", label: "Submitted on", type: "date" },
    { key: "marks", label: "Marks", type: "number" }, { key: "grade", label: "Grade" }, { key: "status", label: "Status", type: "select", options: ["Pending", "Submitted", "Late", "Graded", "Missing"], default: "Pending" }, { key: "feedback", label: "Feedback", type: "textarea", wide: true }],
};
const QUIZ_ATTEMPTS = {
  title: "Quiz results", singular: "Attempt", endpoint: "/quiz-attempts", module: "online_classes", create: false, edit: false, delete: false,
  columns: [{ key: "quizId", label: "Quiz" }, { key: "studentId", label: "Student" }, { key: "score", label: "Score", render: (r) => `${Number(r.score)}/${Number(r.maxScore)}` }, { key: "submittedAt", label: "Submitted", type: "datetime" }, { key: "submittedBy", label: "By" }],
  fields: [],
};
const LIVE_ATTENDANCE = {
  title: "Live class attendance", singular: "Join", endpoint: "/online-class-attendance", module: "online_classes", create: false, edit: false, delete: false,
  columns: [{ key: "onlineClassId", label: "Class" }, { key: "studentId", label: "Student" }, { key: "joinedAt", label: "Joined", type: "datetime" }, { key: "joinedBy", label: "By" }],
  fields: [],
};

export function LearningHub() {
  const { user } = useUser();
  const [tab, setTab] = useState("quizzes");
  const [editing, setEditing] = useState(null);
  const { data: quizzes, reload } = useLoad(() => http.get("/quizzes", { limit: 200 }), []);
  return (
    <div>
      <PageHeader title="Quizzes, Coursework & Homework" icon={BookOpenCheck} subtitle="Online MCQ quizzes with auto marking, coursework / project tracking and homework submission status." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "quizzes", label: "Quizzes" }, { key: "attempts", label: "Quiz results" }, { key: "homework", label: "Homework status" }, { key: "coursework", label: "Coursework" }, { key: "cwsub", label: "Coursework tracking" }, { key: "live", label: "Live class attendance" }]} />
      {tab === "quizzes" && (
        <Card title="Quizzes" actions={can(user, "online_classes", "create") && <Button size="sm" onClick={() => setEditing({})}>New quiz</Button>}>
          <Table dense rows={quizzes || []} empty="No quizzes yet." columns={[
            { key: "title", label: "Title" }, { key: "q", label: "Questions", render: (q) => (q.questions || []).length },
            { key: "opensAt", label: "Opens", render: (q) => formatDateTime(q.opensAt) }, { key: "closesAt", label: "Closes", render: (q) => formatDateTime(q.closesAt) },
            { key: "status", label: "Status", render: (q) => <Badge>{q.status}</Badge> },
            { key: "a", label: "", render: (q) => can(user, "online_classes", "edit") && <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>Edit</Button> },
          ]} />
        </Card>
      )}
      {tab === "attempts" && <ResourceManager embedded config={QUIZ_ATTEMPTS} />}
      {tab === "homework" && <HomeworkTracker />}
      {tab === "coursework" && <ResourceManager embedded config={COURSEWORK} />}
      {tab === "cwsub" && <ResourceManager embedded config={COURSEWORK_SUB} />}
      {tab === "live" && <ResourceManager embedded config={LIVE_ATTENDANCE} />}
      {editing && <QuizEditor quiz={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

// ----------------------------------------------------------------- integrations
const WEBHOOKS = {
  title: "Webhooks", singular: "Webhook", endpoint: "/webhooks", module: "settings",
  subtitle: "POSTs every matching event as JSON signed with X-Signature: sha256=HMAC(secret, body). Events look like fee_payments.create, results.publish, admissions.update or * for all.",
  columns: [{ key: "name", label: "Name" }, { key: "url", label: "URL" }, { key: "events", label: "Events", type: "list" }, { key: "status", label: "Status", type: "badge" }, { key: "lastStatus", label: "Last HTTP" }, { key: "lastDeliveryAt", label: "Last delivery", type: "datetime" }],
  fields: [{ key: "name", label: "Name", required: true }, { key: "url", label: "Endpoint URL (https)", required: true, wide: true }, { key: "events", label: "Events", type: "list", default: ["*"], wide: true }, { key: "secret", label: "Signing secret", required: true }, { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" }],
  rowActions: (r, ctx) => [{ label: "Send test", icon: Send, onClick: async () => { try { const d = await http.post(`/x/webhooks/${r.id}/test`); ctx.toast.success(d.error ? `Failed: ${d.error}` : `Delivered (HTTP ${d.status})`); ctx.reload(); } catch (e) { ctx.toast.error(e); } } }],
};
const DELIVERIES = {
  title: "Webhook deliveries", singular: "Delivery", endpoint: "/webhook-deliveries", module: "settings", create: false, edit: false, delete: false,
  columns: [{ key: "createdAt", label: "When", type: "datetime" }, { key: "event", label: "Event" }, { key: "statusCode", label: "HTTP" }, { key: "error", label: "Error" }], fields: [],
};
const SCHEDULES = {
  title: "Scheduled report e-mails", singular: "Schedule", endpoint: "/report-schedules", module: "reports",
  subtitle: "e.g. daily collection summary to the owner at 8 PM (v1 OM-11). Recipients: e-mail addresses (or mobile numbers for SMS).",
  columns: [{ key: "name", label: "Name" }, { key: "reportType", label: "Report" }, { key: "frequency", label: "Frequency", type: "badge" }, { key: "sendHour", label: "Hour" }, { key: "recipients", label: "Recipients", type: "list" }, { key: "lastRunAt", label: "Last sent", type: "datetime" }, { key: "status", label: "Status", type: "badge" }],
  fields: [{ key: "name", label: "Name", required: true }, { key: "reportType", label: "Report", type: "select", required: true, options: [
    { value: "daily_collection", label: "Daily collection summary" }, { value: "attendance_summary", label: "Attendance summary" }, { value: "fee_due", label: "Fee due summary" },
    { value: "income_expense", label: "Income / expense (month to date)" }, { value: "admissions", label: "Admission pipeline" }, { value: "pending_approvals", label: "Pending approvals" }] },
  { key: "frequency", label: "Frequency", type: "select", options: ["Daily", "Weekly", "Monthly"], default: "Daily" }, { key: "sendHour", label: "Send after hour (0-23)", type: "number", default: 20 },
  { key: "recipients", label: "Recipients", type: "list", wide: true }, { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" }],
  rowActions: (r, ctx) => [{ label: "Send now", icon: Play, onClick: async () => { try { const d = await http.post(`/x/report-schedules/${r.id}/run`); ctx.toast.success(`Queued for ${d.queued} recipient(s)`); ctx.reload(); } catch (e) { ctx.toast.error(e); } } }],
};

function ApiKeys() {
  const toast = useToast();
  const { data: keys, reload } = useLoad(() => http.get("/x/api-keys"), []);
  const { data: roles } = useLoad(() => http.get("/roles", { limit: 200 }), []);
  const [form, setForm] = useState({ name: "", role: "Principal", canWrite: false, expiresAt: "" });
  const [issued, setIssued] = useState(null);
  const create = async () => {
    try { const d = await http.post("/x/api-keys", { ...form, expiresAt: form.expiresAt || null }); setIssued(d.key); setForm({ ...form, name: "" }); reload(); } catch (e) { toast.error(e); }
  };
  return (
    <div className="space-y-4">
      <Card title="Open REST API keys" subtitle="Send as header X-API-Key. A key acts with its role's permissions and is read-only unless write is enabled (§34 Open REST API).">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. BI dashboard" /></Field>
          <Field label="Acts as role"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={(roles || []).filter((r) => !/admin/i.test(r.name)).map((r) => r.name)} /></Field>
          <Field label="Expires"><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={form.canWrite} onChange={(e) => setForm({ ...form, canWrite: e.target.checked })} /> Allow write</label>
          <div className="flex items-end"><Button icon={KeyRound} onClick={create} disabled={!form.name}>Create key</Button></div>
        </div>
        {issued && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"><b>Copy this key now – it is not shown again:</b><code className="mt-1 block break-all font-mono">{issued}</code></div>}
      </Card>
      <Card title="Issued keys"><Table dense rows={keys || []} columns={[{ key: "name", label: "Name" }, { key: "keyPrefix", label: "Prefix" }, { key: "role", label: "Role" }, { key: "canWrite", label: "Write", render: (k) => (k.canWrite ? "Yes" : "No") },
        { key: "lastUsedAt", label: "Last used", render: (k) => formatDateTime(k.lastUsedAt) }, { key: "expiresAt", label: "Expires", render: (k) => formatDate(k.expiresAt) }, { key: "status", label: "Status", render: (k) => <Badge>{k.status}</Badge> },
        { key: "a", label: "", render: (k) => k.status === "Active" && <Button size="sm" variant="ghost" className="text-rose-600" onClick={async () => { try { await http.post(`/x/api-keys/${k.id}/revoke`); reload(); } catch (e) { toast.error(e); } }}>Revoke</Button> }]} /></Card>
    </div>
  );
}

function ApiDocs() {
  const { data, loading } = useLoad(() => http.get("/x/api-docs"), []);
  if (loading) return <Spinner />;
  return (
    <Card title="API reference" subtitle={data?.authentication?.join(" · ")}>
      <p className="mb-3 text-sm text-slate-600">{data?.webhooks}</p>
      <Table dense rows={data?.resources || []} rowKey="path" columns={[{ key: "path", label: "Endpoint" }, { key: "resource", label: "Resource" }, { key: "permissionModule", label: "Permission" }, { key: "methods", label: "Methods", render: (r) => r.methods.join(" · ") }]} />
    </Card>
  );
}

export function IntegrationsPage() {
  const [tab, setTab] = useState("keys");
  return (
    <div>
      <PageHeader title="Integrations & API" icon={Plug} subtitle="Open REST API keys, signed webhooks, scheduled report e-mails. SMS / e-mail / WhatsApp / payment credentials are set in backend/.env." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "keys", label: "API keys" }, { key: "hooks", label: "Webhooks" }, { key: "deliveries", label: "Deliveries" }, { key: "schedules", label: "Scheduled reports" }, { key: "docs", label: "API reference" }]} />
      {tab === "keys" && <ApiKeys />}
      {tab === "hooks" && <ResourceManager embedded config={WEBHOOKS} />}
      {tab === "deliveries" && <ResourceManager embedded config={DELIVERIES} />}
      {tab === "schedules" && <ResourceManager embedded config={SCHEDULES} />}
      {tab === "docs" && <ApiDocs />}
    </div>
  );
}

// ----------------------------------------------------------------- approval rules
export const APPROVAL_RULES = {
  title: "Approval rules", singular: "Rule", endpoint: "/approval-rules", module: "approvals",
  subtitle: "Multi-level, amount-based chains (v1 RP-15/16). The rule with the highest minimum amount that a request reaches is used. Each level needs a permission module with Approve or a named role.",
  columns: [{ key: "requestType", label: "Request type" }, { key: "minAmount", label: "From amount", type: "money" }, { key: "levels", label: "Levels", render: (r) => (r.levels || []).map((l, i) => `${i + 1}. ${l.label || l.role || l.module}`).join(" → ") }, { key: "status", label: "Status", type: "badge" }],
  fields: [{ key: "requestType", label: "Request type", type: "select", required: true, options: ["expense", "fee_waiver", "refund", "receipt_cancel", "payroll", "result_publish", "result_correction", "grace_marks", "marks_unlock", "attendance_correction", "bulk_sms", "admission_confirm", "certificate_issue", "id_card_print", "leave", "student_promotion", "lillah_boarding", "duplicate_override"] },
    { key: "minAmount", label: "Applies from amount (৳)", type: "money", default: 0 },
    { key: "levels", label: "Levels (JSON, in order)", type: "json", required: true, wide: true, default: [{ label: "Principal", module: "accounts" }], hint: '[{"label":"Principal","module":"accounts"},{"label":"Committee President","role":"Committee President"}]' },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" }],
};

// ----------------------------------------------------------------- finance exports
export function FinanceExports() {
  const toast = useToast();
  const [range, setRange] = useState({ from: `${new Date().getFullYear()}-01-01`, to: today() });
  const [month, setMonth] = useState(thisMonth());
  const dl = (path, name) => downloadFile(path, name).catch((e) => toast.error(e));
  return (
    <div className="space-y-4">
      <PageHeader title="Accounting & Payroll Exports" icon={FileSpreadsheet} subtitle="Tally import XML / Excel CSV of approved vouchers and the salary bank advice sheet." />
      <Card title="Accounting software export" subtitle="Approved, non-reversed income and expense entries">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="From"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button icon={Download} onClick={() => dl(`/x/accounts/export/tally?from=${range.from}&to=${range.to}`, "tally.xml")}>Tally XML</Button>
            <Button variant="secondary" icon={Download} onClick={() => dl(`/x/accounts/export/tally?format=csv&from=${range.from}&to=${range.to}`, "accounts.csv")}>Excel CSV</Button>
          </div>
        </div>
      </Card>
      <Card title="Salary bank advice" subtitle="Per-employee net pay with bank account for the bank (v1 HR-08)">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Payroll month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          <div className="flex items-end"><Button icon={Download} onClick={() => dl(`/x/payroll/bank-advice?month=${month}`, "bank-advice.csv")}>Download bank advice</Button></div>
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------- hifz targets
const HIFZ_TARGETS = {
  title: "Monthly hifz targets", singular: "Target", endpoint: "/hifz-targets", module: "madrasa",
  columns: [{ key: "studentId", label: "Student" }, { key: "targetMonth", label: "Month" }, { key: "targetPages", label: "Target pages" }, { key: "note", label: "Note" }],
  fields: [rel("student", "studentId", "Student", { required: true }), { key: "targetMonth", label: "Month (YYYY-MM)", required: true, default: thisMonth() }, { key: "targetPages", label: "Target pages", type: "number", default: 20 }, { key: "note", label: "Note", wide: true }],
};
export function HifzTargets() {
  const [month, setMonth] = useState(thisMonth());
  const { data, loading, reload } = useLoad(() => http.get("/x/hifz/targets-report", { month }), [month]);
  return (
    <div className="space-y-4">
      <PageHeader title="Hifz Targets" icon={Target} subtitle="Target vs actual pages per month; students falling behind are alerted from the 20th (v1 QM-16)." />
      <Card title="Target vs actual" actions={<div className="flex gap-2"><Input type="month" className="!h-8 !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} /><Button size="sm" variant="secondary" icon={RefreshCw} onClick={reload} /></div>}>
        {loading ? <Spinner /> : <Table dense rows={data || []} empty="No targets for this month." columns={[
          { key: "name", label: "Student" }, { key: "halaqa", label: "Halaqa" }, { key: "targetPages", label: "Target" }, { key: "actualPages", label: "Actual" },
          { key: "percent", label: "Achieved", render: (r) => <div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${r.behind ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, r.percent)}%` }} /></div>{r.percent}%</div> },
          { key: "behind", label: "Status", render: (r) => (r.behind ? <Badge tone="red">Behind</Badge> : <Badge tone="green">On track</Badge>) },
        ]} />}
      </Card>
      <ResourceManager embedded config={HIFZ_TARGETS} onChanged={reload} />
    </div>
  );
}

// ----------------------------------------------------------------- moderation (v1 CM-06)
export function Moderation() {
  const toast = useToast();
  const { data, loading } = useLoad(() => http.get("/x/conversations/all"), []);
  const [thread, setThread] = useState(null);
  const open = async (key) => { try { setThread({ key, messages: await http.get(`/conversations/${encodeURIComponent(key)}`) }); } catch (e) { toast.error(e); } };
  return (
    <Card title="All guardian–teacher conversations" subtitle="Moderation view for the Principal; every opening is audit-logged (v1 CM-06)">
      {loading ? <Spinner /> : <Table dense rows={data || []} rowKey="threadKey" empty="No conversations." onRowClick={(r) => open(r.threadKey)} columns={[
        { key: "senderName", label: "Last from" }, { key: "recipientType", label: "To", render: (r) => `${r.recipientType} ${r.recipientId}` }, { key: "studentId", label: "Student" },
        { key: "body", label: "Last message", render: (r) => <span className="line-clamp-1">{r.body}</span> }, { key: "messageCount", label: "Msgs" }, { key: "createdAt", label: "When", render: (r) => formatDateTime(r.createdAt) },
      ]} />}
      <Modal open={Boolean(thread)} onClose={() => setThread(null)} title="Conversation">
        <div className="space-y-2">{(thread?.messages || []).map((m) => <div key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between text-xs text-slate-500"><b>{m.senderName}</b>{formatDateTime(m.createdAt)}</div><p className="mt-1">{m.body}</p></div>)}</div>
      </Modal>
    </Card>
  );
}

// ----------------------------------------------------------------- account security
const PREF_EVENTS = [["Absent", "Absence alerts"], ["Late", "Late arrival"], ["EntryExit", "Entry / exit"], ["Result", "Results"], ["FeeReminder", "Fee reminders"], ["Payment", "Payment receipts"], ["Notice", "Notices"], ["Homework", "Homework"]];
export function AccountSecurity({ guardian = false }) {
  const { user } = useUser();
  const toast = useToast();
  const { data: sessions, reload } = useLoad(() => http.get("/auth/sessions"), []);
  const [pin, setPin] = useState("");
  const [prefs, setPrefs] = useState(null);
  const [quiet, setQuiet] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const isTeacher = ["Teacher", "Staff"].includes(user?.linkedType);
  useEffect(() => {
    if (guardian) http.get("/x/portal/preferences").then(setPrefs).catch(() => setPrefs({}));
    if (user?.linkedType === "Teacher") http.get("/x/me/quiet-hours").then((q) => setQuiet({ enabled: false, start: "18:00", end: "08:00", ...q })).catch(() => {});
  }, [guardian, user?.linkedType]);
  const savePin = async () => { try { await http.post("/auth/pin", { pin }); setPin(""); toast.success("PIN saved – use it for quick sign-in on this device"); } catch (e) { toast.error(e); } };
  const signOut = async (id) => { try { await request(`/auth/sessions/${id}`, { method: "DELETE" }); reload(); } catch (e) { toast.error(e); } };
  const savePrefs = async (next) => { try { setPrefs(await http.patch("/x/portal/preferences", next)); toast.success("Saved"); } catch (e) { toast.error(e); } };
  const doCheckin = (type) => {
    const send = async (coords) => {
      try { setCheckin(await http.post("/x/staff-attendance/check-in", { type, latitude: coords?.latitude, longitude: coords?.longitude })); toast.success(type === "out" ? "Checked out" : "Checked in"); } catch (e) { toast.error(e); }
    };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => send(p.coords), () => send(null), { timeout: 8000 });
    else send(null);
  };
  return (
    <div className="space-y-4">
      {!guardian && <PageHeader title="My Account & Devices" icon={ShieldCheck} subtitle="Signed-in devices, quick PIN, quiet hours and mobile check-in." />}
      {isTeacher && (
        <Card title="My attendance" subtitle="Mobile check-in records time and, if allowed, your location (v1 AT-10)">
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={MapPin} onClick={() => doCheckin("in")}>Check in</Button>
            <Button variant="secondary" onClick={() => doCheckin("out")}>Check out</Button>
            {checkin && <span className="text-sm text-slate-600">{checkin.status} · in {formatDateTime(checkin.inTime)}{checkin.outTime ? ` · out ${formatDateTime(checkin.outTime)}` : ""}</span>}
          </div>
        </Card>
      )}
      {quiet && (
        <Card title="Message quiet hours" subtitle="Guardian messages still arrive, but alerts wait until your quiet hours end (v1 CM-05)">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={Boolean(quiet.enabled)} onChange={(e) => setQuiet({ ...quiet, enabled: e.target.checked })} /> Enabled</label>
            <Field label="From"><Input type="time" value={quiet.start} onChange={(e) => setQuiet({ ...quiet, start: e.target.value })} /></Field>
            <Field label="Until"><Input type="time" value={quiet.end} onChange={(e) => setQuiet({ ...quiet, end: e.target.value })} /></Field>
            <div className="flex items-end"><Button onClick={async () => { try { await http.patch("/x/me/quiet-hours", quiet); toast.success("Saved"); } catch (e) { toast.error(e); } }}>Save</Button></div>
          </div>
        </Card>
      )}
      {guardian && prefs && (
        <Card title="Notification preferences" subtitle="Choose channels and alerts. Emergency notices and OTP are always sent.">
          <div className="flex flex-wrap gap-4">
            {[["sms", "SMS"], ["push", "App notification"], ["email", "E-mail"], ["whatsapp", "WhatsApp"]].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={prefs[k] !== false} onChange={(e) => savePrefs({ ...prefs, [k]: e.target.checked })} /> {label}</label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PREF_EVENTS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={prefs.events?.[k] !== false} onChange={(e) => savePrefs({ ...prefs, events: { ...(prefs.events || {}), [k]: e.target.checked } })} /> {label}</label>
            ))}
          </div>
        </Card>
      )}
      <Card title="Quick sign-in PIN" subtitle="After signing in once with password or OTP, use mobile + PIN">
        <div className="flex gap-2"><Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4–6 digits" className="!w-40" /><Button onClick={savePin} disabled={pin.length < 4}>Save PIN</Button></div>
      </Card>
      <Card title="Signed-in devices" subtitle="Sign out a lost or old device">
        <Table dense rows={sessions || []} empty="No active devices." columns={[
          { key: "userAgent", label: "Device", render: (s) => <span className="flex items-center gap-2"><MonitorSmartphone size={14} /><span className="line-clamp-1 max-w-xs">{s.userAgent || "Unknown"}</span>{s.current && <Badge tone="green">This device</Badge>}</span> },
          { key: "method", label: "Sign-in" }, { key: "ip", label: "IP" }, { key: "lastSeenAt", label: "Last active", render: (s) => formatDateTime(s.lastSeenAt) },
          { key: "a", label: "", render: (s) => !s.current && <Button size="sm" variant="ghost" icon={LogOut} className="text-rose-600" onClick={() => signOut(s.id)}>Sign out</Button> },
        ]} />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------- guardian learning view (quizzes, live classes, coursework, daily log)
function QuizTake({ quiz, studentId, onDone, onSubmitted }) {
  const toast = useToast();
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const submit = async () => {
    try { const r = await http.post(`/x/quizzes/${quiz.id}/attempt`, { studentId, answers }); setResult(r); onSubmitted?.(); } catch (e) { toast.error(e); }
  };
  return (
    <Modal open onClose={onDone} title={quiz.title} footer={!result && <Button onClick={submit}>Submit answers</Button>}>
      {result ? <p className="text-lg font-bold">Score: {result.score} / {result.maxScore}</p> : quiz.questions.map((q) => (
        <div key={q.index} className="mb-3"><p className="font-semibold">{q.index + 1}. {q.q} <span className="text-xs text-slate-500">({q.marks})</span></p>
          {q.options.map((o, k) => o && <label key={k} className="mt-1 flex items-center gap-2 text-sm"><input type="radio" name={`q${q.index}`} className="accent-blue-600" checked={answers[q.index] === k} onChange={() => { const a = [...answers]; a[q.index] = k; setAnswers(a); }} />{o}</label>)}
        </div>
      ))}
    </Modal>
  );
}

export function GuardianLearning({ studentId }) {
  const toast = useToast();
  const { data, loading } = useLoad(() => http.get(`/x/portal/children/${studentId}/extras`), [studentId]);
  const { data: quizzes, reload: reloadQuizzes } = useLoad(() => http.get(`/x/quizzes/for-student/${studentId}`), [studentId]);
  const [taking, setTaking] = useState(null);
  const join = async (c) => {
    try { const r = await http.post(`/x/online-classes/${c.id}/join`, { studentId }); if (r.meetingUrl) window.open(r.meetingUrl, "_blank", "noopener"); else toast.error("No meeting link yet."); } catch (e) { toast.error(e); }
  };
  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <TranscriptCard studentId={studentId} />
      <Card title="Online classes" subtitle="Joining records attendance">
        <Table dense rows={data?.onlineClasses || []} empty="No online classes." columns={[{ key: "title", label: "Class" }, { key: "subjectName", label: "Subject" }, { key: "scheduledAt", label: "When", render: (c) => formatDateTime(c.scheduledAt) },
          { key: "a", label: "", render: (c) => <div className="flex gap-1">{c.hasLink && c.status !== "Completed" && <Button size="sm" icon={Video} onClick={() => join(c)}>Join</Button>}{c.recordingUrl && <a className="text-xs font-semibold text-blue-600" href={c.recordingUrl} target="_blank" rel="noreferrer">Recording</a>}{c.attended && <Badge tone="green">Attended</Badge>}</div> }]} />
      </Card>
      <Card title="Quizzes">
        <Table dense rows={quizzes || []} empty="No quizzes." columns={[{ key: "title", label: "Quiz" }, { key: "subjectName", label: "Subject" }, { key: "closesAt", label: "Closes", render: (q) => formatDateTime(q.closesAt) },
          { key: "a", label: "", render: (q) => (q.attempted ? <Badge tone="green">{Number(q.score)}/{Number(q.maxScore)}</Badge> : q.open ? <Button size="sm" onClick={() => setTaking(q)}>Start</Button> : <Badge>Closed</Badge>) }]} />
      </Card>
      {(data?.homeworkStatus?.length > 0 || data?.coursework?.length > 0) && (
        <Card title="Homework & coursework status">
          {data.homeworkStatus.length > 0 && <Table dense rows={data.homeworkStatus} rowKey="title" columns={[{ key: "title", label: "Homework" }, { key: "dueDate", label: "Due", render: (h) => formatDate(h.dueDate) }, { key: "status", label: "Status", render: (h) => <Badge>{h.status}</Badge> }, { key: "marks", label: "Marks" }, { key: "remarks", label: "Remarks" }]} />}
          {data.coursework.length > 0 && <div className="mt-3"><Table dense rows={data.coursework} rowKey="title" columns={[{ key: "title", label: "Coursework" }, { key: "subjectName", label: "Subject" }, { key: "deadline", label: "Deadline", render: (c) => formatDate(c.deadline) }, { key: "status", label: "Status", render: (c) => <Badge>{c.status || "Pending"}</Badge> }, { key: "grade", label: "Grade", render: (c) => c.grade || (c.marks ? `${c.marks}/${c.maxMarks}` : "—") }]} /></div>}
        </Card>
      )}
      {data?.houses?.length > 0 && <Card title="House / club"><div className="flex flex-wrap gap-2">{data.houses.map((h) => <Badge key={h.name} tone="blue">{h.name} ({h.kind}) · house {h.points} pts · own {h.myPoints}</Badge>)}</div></Card>}
      {data?.dailyLogs?.length > 0 && (
        <Card title="Daily log" subtitle="Meals, nap and activities (pre-school)">
          <Table dense rows={data.dailyLogs} rowKey="logDate" columns={[{ key: "logDate", label: "Date", render: (l) => formatDate(l.logDate) }, { key: "meal", label: "Meal" }, { key: "nap", label: "Nap" }, { key: "activity", label: "Activity" }, { key: "mood", label: "Mood" },
            { key: "photoUrl", label: "", render: (l) => l.photoUrl && <a className="text-xs font-semibold text-blue-600" href={l.photoUrl} target="_blank" rel="noreferrer">Photo</a> }]} />
        </Card>
      )}
      {taking && <QuizTake quiz={taking} studentId={studentId} onSubmitted={reloadQuizzes} onDone={() => setTaking(null)} />}
    </div>
  );
}

// ----------------------------------------------------------------- simple configs used in navigation
export const EXTRA_CONFIGS = {
  clubAttendance: {
    title: "Club Attendance", singular: "Attendance", endpoint: "/club-attendance", module: "academic",
    subtitle: "Who attended each club / house / ECA session (shown to guardians in the app).",
    columns: [{ key: "sessionDate", label: "Date", type: "date" }, { key: "clubId", label: "Club" }, { key: "studentId", label: "Student" }, { key: "status", label: "Status", type: "badge" }, { key: "activity", label: "Activity" }],
    fields: [rel("club", "clubId", "Club / house / ECA", { required: true }), rel("student", "studentId", "Student", { required: true }), { key: "sessionDate", label: "Session date", type: "date", required: true, default: today() },
      { key: "status", label: "Status", type: "select", options: ["Present", "Absent", "Late", "Excused"], default: "Present" }, { key: "activity", label: "Activity", wide: true }, { key: "note", label: "Note", wide: true }],
  },
  galleryAlbums: {
    title: "Gallery Albums", singular: "Album", endpoint: "/gallery-albums", module: "communication",
    subtitle: "Event photo albums. Public albums show on the website; Guardians albums in the guardian portal and app.",
    columns: [{ key: "coverUrl", label: "", type: "image" }, { key: "title", label: "Album" }, { key: "eventDate", label: "Event date", type: "date" }, { key: "audience", label: "Audience", type: "badge" }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "title", label: "Title", required: true }, { key: "titleBn", label: "শিরোনাম (বাংলা)" }, { key: "eventDate", label: "Event date", type: "date", default: today() },
      { key: "audience", label: "Audience", type: "select", options: ["Guardians", "Public", "Staff"], default: "Guardians" }, { key: "status", label: "Status", type: "select", options: ["Published", "Draft"], default: "Published" },
      { key: "coverUrl", label: "Cover photo", type: "image", category: "gallery", wide: true }, { key: "description", label: "Description", type: "textarea", wide: true }],
  },
  galleryPhotos: {
    title: "Gallery Photos", singular: "Photo", endpoint: "/gallery-photos", module: "communication",
    columns: [{ key: "imageUrl", label: "", type: "image" }, { key: "albumId", label: "Album" }, { key: "caption", label: "Caption" }, { key: "sortOrder", label: "Order" }],
    fields: [rel("album", "albumId", "Album", { required: true }), { key: "imageUrl", label: "Photo", type: "image", category: "gallery", required: true, wide: true },
      { key: "caption", label: "Caption", wide: true }, { key: "sortOrder", label: "Order", type: "number", default: 0 }],
  },
  housePoints: {
    title: "House Points", singular: "Award", endpoint: "/house-points", module: "academic",
    subtitle: "Points roll up to the house total automatically.",
    columns: [{ key: "awardedOn", label: "Date", type: "date" }, { key: "clubId", label: "House" }, { key: "studentId", label: "Student" }, { key: "points", label: "Points" }, { key: "reason", label: "Reason" }],
    fields: [rel("club", "clubId", "House / club", { required: true }), rel("student", "studentId", "Student (optional)"), { key: "points", label: "Points (negative to deduct)", type: "number", required: true, default: 5 },
      { key: "reason", label: "Reason", wide: true }, { key: "awardedOn", label: "Date", type: "date", default: today() }],
  },
  dailyLogs: {
    title: "Pre-school Daily Log", singular: "Log", endpoint: "/daily-logs", module: "students",
    subtitle: "Meal, nap, activity and photo shared with guardians.",
    columns: [{ key: "logDate", label: "Date", type: "date" }, { key: "studentId", label: "Child" }, { key: "meal", label: "Meal" }, { key: "nap", label: "Nap" }, { key: "activity", label: "Activity" }, { key: "mood", label: "Mood" }],
    fields: [rel("student", "studentId", "Child", { required: true }), { key: "logDate", label: "Date", type: "date", default: today() }, { key: "meal", label: "Meal" }, { key: "nap", label: "Nap" },
      { key: "mood", label: "Mood", type: "select", options: ["Happy", "Calm", "Tired", "Upset", "Unwell"] }, { key: "activity", label: "Activity", type: "textarea", wide: true }, { key: "photoUrl", label: "Photo URL", wide: true }, { key: "note", label: "Note", wide: true }],
  },
  specialSchedules: {
    title: "Special Schedules (Ramadan etc.)", singular: "Schedule", endpoint: "/special-schedules", module: "routine",
    subtitle: "Separate period timings for Ramadan, exams or winter, active between two dates (v1 AC-10).",
    columns: [{ key: "name", label: "Name" }, { key: "fromDate", label: "From", type: "date" }, { key: "toDate", label: "To", type: "date" }, { key: "shift", label: "Shift" }, { key: "periods", label: "Periods", render: (r) => (r.periods || []).map((p) => `${p.code || ""} ${p.start}-${p.end}`).join(", ") }, { key: "status", label: "Status", type: "badge" }],
    fields: [{ key: "name", label: "Name", required: true, default: "Ramadan schedule" }, { key: "fromDate", label: "From", type: "date", required: true }, { key: "toDate", label: "To", type: "date", required: true }, { key: "shift", label: "Shift" },
      { key: "periods", label: "Periods (JSON)", type: "json", wide: true, default: [{ code: "P1", start: "08:00", end: "08:35" }, { code: "P2", start: "08:35", end: "09:10" }] }, { key: "note", label: "Note", wide: true }, { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" }],
  },
  studentGroupHistory: {
    title: "Group change history", singular: "Change", endpoint: "/student-group-history", module: "students", create: false, edit: false, delete: false,
    subtitle: "Science / Humanities / Business Studies changes are recorded automatically.",
    columns: [{ key: "changedAt", label: "When", type: "datetime" }, { key: "studentId", label: "Student" }, { key: "fromGroup", label: "From" }, { key: "toGroup", label: "To" }], fields: [],
  },
  approvalRules: APPROVAL_RULES,
};

// Shows today's special timing on routine screens.
export function SpecialScheduleBanner() {
  const [active, setActive] = useState([]);
  useEffect(() => { http.get("/x/special-schedules/active").then(setActive).catch(() => {}); }, []);
  if (!active.length) return null;
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <b>{active[0].name}</b> is active today ({formatDate(active[0].fromDate)} – {formatDate(active[0].toDate)}): {(active[0].periods || []).map((p) => `${p.code || ""} ${p.start}–${p.end}`).join(" · ")}
    </div>
  );
}

export { Link2, MessageSquare, ShieldCheck, StatCard };
