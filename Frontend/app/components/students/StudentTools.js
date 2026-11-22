"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpCircle, FileUp, IdCard, ListOrdered, Search, Star, Unlink, Upload, UserCircle2, Users } from "lucide-react";
import { http, resource, uploadsApi } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { TranscriptCard } from "../extensions/Extras";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatCard, Table, Tabs, formatDate, money, useToast, usePrompt } from "../ui/kit";

const CERTS = ["Transfer Certificate", "Testimonial", "Character Certificate", "Study Certificate", "Sanad", "Hifz Sanad"];
const DOC_TYPES = ["Birth Certificate", "Previous Result", "Transfer Certificate", "Photo", "NID (Guardian)", "Medical", "Other"];

export function Student360() {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [profile, setProfile] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ name: "", mobile: "", relation: "Mother", isPrimary: false, createPortal: false });
  const [siblingHint, setSiblingHint] = useState(null);

  async function search() {
    try { setMatches((await resource("/students").list({ search: query, limit: 20, includeArchived: true })).data); } catch (e) { toast.error(e); }
  }
  const load = useCallback(async (id = studentId) => {
    if (!id) return;
    try { setProfile(await http.get(`/students/${id}/profile`)); } catch (e) { toast.error(e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(status) {
    const reason = await ask({ title: `Change status to ${status}`, placeholder: "Reason (kept in status history)" });
    if (!reason) return;
    try { await http.post(`/students/${studentId}/status`, { status, reason }); toast.success("Status updated"); load(); } catch (e) { toast.error(e); }
  }
  async function requestCert(type) {
    try { await http.post(`/students/${studentId}/certificates`, { certificateType: type, content: {} }); toast.success(`${type} requested – waiting for approval`); load(); } catch (e) { toast.error(e); }
  }
  async function checkSibling(mobile) {
    if (mobile.replace(/\D/g, "").length < 11) { setSiblingHint(null); return; }
    try { setSiblingHint(await http.get("/students/siblings/check", { mobile, excludeId: studentId })); } catch { setSiblingHint(null); }
  }
  async function saveLink() {
    try {
      await http.post(`/students/${studentId}/guardians`, link);
      toast.success("Guardian linked");
      setLinkOpen(false);
      load();
    } catch (e) { toast.error(e); }
  }
  async function upload(file, documentType) {
    try {
      await uploadsApi.upload(file, { category: documentType === "Photo" ? "photo" : "document", ownerType: "Student", ownerId: studentId, documentType });
      toast.success("Document uploaded");
      load();
    } catch (e) { toast.error(e); }
  }
  async function setPhoto(file) {
    try {
      const up = await uploadsApi.upload(file, { category: "photo" });
      await resource("/students").update(studentId, { photoUrl: up.url });
      toast.success("Photo updated");
      load();
    } catch (e) { toast.error(e); }
  }

  const s = profile?.student;
  const att = profile?.attendance;
  return (
    <div>
      <PageHeader title="Student 360°" icon={UserCircle2} subtitle="Profile, enrollment history, guardians & siblings, attendance, dues, results, ID cards, documents, certificates and status history." />
      <Card>
        <div className="flex flex-wrap gap-2">
          <label className="flex h-10 min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Search by name, ID, roll, guardian phone or birth certificate" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          </label>
          <Button icon={Search} onClick={search}>Search</Button>
        </div>
        {matches.length > 0 && !profile && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((m) => (
              <button key={m.id} type="button" onClick={() => { setStudentId(m.id); setMatches([]); }} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-400">
                {m.photoUrl ? <img src={m.photoUrl} alt="" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-xs font-bold">{m.name.slice(0, 2)}</span>}
                <span><b className="block text-sm">{m.name}</b><span className="text-xs text-slate-500">{m.id} · {m.className} · Roll {m.roll || "—"}</span></span>
                <span className="ml-auto"><Badge>{m.status}</Badge></span>
              </button>
            ))}
          </div>
        )}
      </Card>
      {profile && s && (
        <div className="mt-5 space-y-5">
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <label className="relative cursor-pointer">
                {s.photoUrl ? <img src={s.photoUrl} alt="" className="size-24 rounded-2xl object-cover" /> : <span className="grid size-24 place-items-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-400">{s.name.slice(0, 2)}</span>}
                {can(user, "students", "edit") && <span className="absolute -bottom-1 -right-1 rounded-lg bg-blue-600 p-1 text-white"><Upload size={14} /></span>}
                {can(user, "students", "edit") && <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && setPhoto(e.target.files[0])} />}
              </label>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-extrabold">{s.name}</h2>{s.nameBn && <span className="text-slate-500">{s.nameBn}</span>}<Badge>{s.status}</Badge></div>
                <p className="text-sm text-slate-600">{s.id} · {s.className} · Roll {s.roll || "—"} · {s.shift || ""} {s.groupName ? `· ${s.groupName}` : ""}</p>
                <p className="text-sm text-slate-500">DOB {formatDate(s.dateOfBirth)} · Blood {s.bloodGroup || "—"} · Birth cert. {s.birthCertNo || "—"} · Guardian {s.guardianName || "—"} ({s.parentContact || "—"})</p>
              </div>
              {can(user, "students", "edit") && (
                <div className="flex flex-wrap gap-2">
                  <Select className="!w-auto" value="" onChange={(e) => e.target.value && changeStatus(e.target.value)} options={["Active", "Inactive", "Transferred", "Dropped", "Passed Out"].filter((x) => x !== s.status)} placeholder="Change status…" />
                  {can(user, "certificates", "create") && <Select className="!w-auto" value="" onChange={(e) => e.target.value && requestCert(e.target.value)} options={CERTS} placeholder="Request certificate…" />}
                </div>
              )}
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Attendance" value={att?.total ? `${Math.round((att.present / att.total) * 100)}%` : "—"} hint={`${att?.present || 0}/${att?.total || 0} days · ${att?.absent || 0} absent`} tone="green" />
            <StatCard label="Fee due" value={money(profile.dues?.due)} hint={`${profile.dues?.openInvoices || 0} open invoice(s)`} tone="amber" />
            <StatCard label="Results" value={profile.results.length} hint={profile.results[0] ? `Latest GPA ${profile.results[0].gpa} (${profile.results[0].grade})` : "—"} tone="blue" />
            <StatCard label="ID card" value={profile.cards.find((c) => c.status === "Active")?.cardNumber || "None"} icon={IdCard} tone="indigo" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Guardians & siblings" actions={can(user, "guardians", "create") && <Button size="sm" icon={Users} onClick={() => { setLink({ name: "", mobile: "", relation: "Mother", isPrimary: false, createPortal: false }); setSiblingHint(null); setLinkOpen(true); }}>Link guardian</Button>}>
              <Table dense rows={profile.guardians} columns={[
                { key: "name", label: "Name" }, { key: "relation", label: "Relation" }, { key: "mobile", label: "Mobile" },
                { key: "isPrimary", label: "Primary", render: (g) => (g.isPrimary ? <Badge tone="green">Primary</Badge> : can(user, "guardians", "edit") ? <Button size="sm" variant="ghost" icon={Star} onClick={async () => { try { await http.post(`/students/${studentId}/guardians/${g.linkId}/primary`); load(); } catch (e) { toast.error(e); } }}>Make primary</Button> : "—") },
                { key: "portalAccess", label: "Portal", render: (g) => (g.portalAccess ? "Yes" : "No") },
                // Per-link permissions (Spec §4 can_view_results / can_view_fees) and unlink (Workflow §7).
                { key: "access", label: "App can see", render: (g) => (
                  <div className="flex flex-col gap-1 text-xs">
                    {[["canViewResults", "Results"], ["canViewFees", "Fees"]].map(([k, label]) => (
                      <label key={k} className="inline-flex items-center gap-1.5">
                        <input type="checkbox" className="accent-blue-600" checked={g[k] !== false} disabled={!can(user, "guardians", "edit")}
                          onChange={async (e) => { try { await http.patch(`/guardians/${g.id}/students/${studentId}`, { [k]: e.target.checked }); load(); } catch (err) { toast.error(err); } }} />
                        {label}
                      </label>
                    ))}
                  </div>
                ) },
                { key: "unlink", label: "", render: (g) => (can(user, "guardians", "delete") ? (
                  <Button size="sm" variant="ghost" icon={Unlink} className="text-rose-600" onClick={async () => {
                    const ok = await ask({ title: `Unlink ${g.name}?`, message: "This guardian will no longer see the student in the guardian app. Records are not changed.", input: false, danger: true, confirmLabel: "Unlink" });
                    if (!ok) return;
                    try { await http.del(`/guardians/${g.id}/students/${studentId}`); toast.success("Guardian unlinked"); load(); } catch (err) { toast.error(err); }
                  }}>Unlink</Button>
                ) : null) },
              ]} />
              {profile.siblings.length > 0 && (
                <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><b>Siblings:</b> {profile.siblings.map((x) => `${x.name} (${x.className})`).join(", ")}</div>
              )}
            </Card>
            <Card title="Enrollment history" subtitle="Each session keeps its own class, roll and result (ACA-07)">
              <Table dense rows={profile.enrollments} columns={[{ key: "sessionName", label: "Session" }, { key: "className", label: "Class" }, { key: "section", label: "Sec." }, { key: "roll", label: "Roll" }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> }, { key: "effectiveDate", label: "From", render: (r) => formatDate(r.effectiveDate) }]} />
            </Card>
            <Card title="Results">
              <Table dense rows={profile.results} columns={[{ key: "examName", label: "Exam" }, { key: "totalMarks", label: "Total" }, { key: "gpa", label: "GPA" }, { key: "grade", label: "Grade" }, { key: "classPosition", label: "Pos" }, { key: "published", label: "Published", render: (r) => (r.published ? "Yes" : "No") }]} />
            </Card>
            {can(user, "results", "view") && <TranscriptCard key={studentId} studentId={studentId} />}
            <Card title="Documents" actions={can(user, "students", "edit") && (
              <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white">
                <FileUp size={14} /> Upload
                <select className="ml-1 rounded bg-blue-500 text-xs" defaultValue="" onChange={(e) => { const t = e.target.value; e.target.value = ""; if (!t) return; const input = document.createElement("input"); input.type = "file"; input.accept = "image/*,application/pdf"; input.onchange = () => input.files[0] && upload(input.files[0], t); input.click(); }}>
                  <option value="">type…</option>{DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}>
              <Table dense rows={profile.documents} columns={[{ key: "documentType", label: "Type" }, { key: "fileName", label: "File" }, { key: "createdAt", label: "Uploaded", render: (r) => formatDate(r.createdAt) },
                { key: "fileUrl", label: "", render: (r) => <button type="button" className="text-xs font-semibold text-blue-600" onClick={async () => {
                  const res = await fetch(r.fileUrl, { headers: { Authorization: `Bearer ${localStorage.getItem("edumanage-token")}` } });
                  if (!res.ok) { toast.error("Cannot open file"); return; }
                  window.open(URL.createObjectURL(await res.blob()), "_blank");
                }}>Open</button> }]} />
            </Card>
            <Card title="Certificates"><Table dense rows={profile.certificates} columns={[{ key: "id", label: "Serial" }, { key: "certificateType", label: "Type" }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> }, { key: "issuedAt", label: "Issued", render: (r) => formatDate(r.issuedAt) }]} /></Card>
            <Card title="Status history"><Table dense rows={profile.statusHistory} columns={[{ key: "createdAt", label: "When", render: (r) => formatDate(r.createdAt) }, { key: "fromStatus", label: "From" }, { key: "toStatus", label: "To" }, { key: "reason", label: "Reason" }, { key: "changedBy", label: "By" }]} /></Card>
          </div>
          <Button variant="secondary" onClick={() => { setProfile(null); setStudentId(null); }}>Back to search</Button>
        </div>
      )}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Link guardian" width="max-w-lg" footer={<><Button variant="secondary" onClick={() => setLinkOpen(false)}>Cancel</Button><Button onClick={saveLink}>Link</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mobile" required><Input value={link.mobile} onChange={(e) => { setLink({ ...link, mobile: e.target.value }); checkSibling(e.target.value); }} placeholder="01XXXXXXXXX" /></Field>
          <Field label="Relation"><Select value={link.relation} onChange={(e) => setLink({ ...link, relation: e.target.value })} options={["Father", "Mother", "Guardian", "Other"]} /></Field>
          <Field label="Name" className="sm:col-span-2"><Input value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })} placeholder={siblingHint?.guardian ? siblingHint.guardian.name : ""} /></Field>
          {siblingHint?.guardian && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
              This guardian already has {siblingHint.siblings.length} student(s): {siblingHint.siblings.map((x) => x.name).join(", ")}. Linking will connect them as siblings (sibling discount can then apply).
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={link.isPrimary} onChange={(e) => setLink({ ...link, isPrimary: e.target.checked })} /> Primary guardian</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={link.createPortal} onChange={(e) => setLink({ ...link, createPortal: e.target.checked })} /> Create portal login</label>
        </div>
      </Modal>
      {dialog}
    </div>
  );
}

function Promotion() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [years, setYears] = useState([]);
  const [sel, setSel] = useState({ classId: "", examId: "", targetYearId: "" });
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    resource("/classes").all().then(setClasses);
    resource("/exams").all().then(setExams);
    resource("/academic-years").all().then(setYears);
  }, []);
  async function load() {
    try { setPreview(await http.get("/students/promotion/preview", { classId: sel.classId, examId: sel.examId })); } catch (e) { toast.error(e); }
  }
  function setRow(id, patch) { setPreview((p) => ({ ...p, students: p.students.map((s) => (s.id === id ? { ...s, ...patch } : s)) })); }
  async function submit() {
    try {
      const promotions = preview.students.filter((s) => s.decision !== "Skip").map((s) => ({ studentId: s.id, decision: s.decision, nextClassId: s.nextClassId, section: s.section, roll: s.newRoll || null, result: { gpa: s.gpa, grade: s.grade, status: s.resultStatus } }));
      await http.post("/students/promotion", { promotions, targetYearId: sel.targetYearId || null, title: `Promotion: ${classes.find((c) => c.id === sel.classId)?.name} (${promotions.length})` });
      toast.success("Promotion submitted for Principal approval");
      setPreview(null);
    } catch (e) { toast.error(e); }
  }
  return (
    <Card title="Session promotion" subtitle="Preview pass/fail decision, next class, new roll and section, then submit for approval (ST-07, ACA-06). Previous session history stays intact.">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Current class"><Select value={sel.classId} onChange={(e) => setSel({ ...sel, classId: e.target.value })} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select" /></Field>
        <Field label="Based on exam result"><Select value={sel.examId} onChange={(e) => setSel({ ...sel, examId: e.target.value })} options={exams.map((x) => ({ value: x.id, label: x.name }))} placeholder="(no result rule)" /></Field>
        <Field label="Promote into session"><Select value={sel.targetYearId} onChange={(e) => setSel({ ...sel, targetYearId: e.target.value })} options={years.map((y) => ({ value: y.id, label: y.name }))} placeholder="Current" /></Field>
        <div className="flex items-end"><Button icon={ArrowUpCircle} disabled={!sel.classId} onClick={load}>Preview</Button></div>
      </div>
      {preview && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-slate-600">Next class: <b>{preview.nextClass?.name || "— (final class → Pass Out)"}</b></p>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Student</th><th>Result</th><th>GPA</th><th>Decision</th><th>Next class</th><th>Section</th><th>New roll</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{preview.students.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{s.name}<span className="block text-xs text-slate-400">{s.id} · roll {s.roll}</span></td>
                  <td className="text-center">{s.resultStatus ? <Badge>{s.resultStatus}</Badge> : "—"}</td>
                  <td className="text-center">{s.gpa ?? "—"}</td>
                  <td className="px-2"><Select className="!h-8" value={s.decision} onChange={(e) => setRow(s.id, { decision: e.target.value })} options={["Promote", "Detain", "Pass Out", "Skip"]} /></td>
                  <td className="px-2"><Select className="!h-8" value={s.nextClassId || ""} disabled={s.decision !== "Promote"} onChange={(e) => setRow(s.id, { nextClassId: e.target.value })} options={classes.map((c) => ({ value: c.id, label: c.name }))} /></td>
                  <td className="px-2"><Input className="!h-8 !w-20" value={s.section || ""} onChange={(e) => setRow(s.id, { section: e.target.value })} /></td>
                  <td className="px-2"><Input className="!h-8 !w-20" value={s.newRoll || ""} onChange={(e) => setRow(s.id, { newRoll: e.target.value })} placeholder="auto" /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <Button className="mt-3" onClick={submit}>Submit for approval</Button>
        </div>
      )}
    </Card>
  );
}

function RollAssign() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [sel, setSel] = useState({ classId: "", section: "", method: "alphabetical", examId: "", startFrom: 1 });
  useEffect(() => { resource("/classes").all().then(setClasses); resource("/exams").all().then(setExams); }, []);
  const cls = classes.find((c) => c.id === sel.classId);
  async function run() {
    try { const d = await http.post("/students/assign-rolls", sel); toast.success(`${d.assigned} roll numbers assigned without duplicates`); } catch (e) { toast.error(e); }
  }
  return (
    <Card title="Roll assignment" subtitle="Manual, merit-based (by exam position) or alphabetical; duplicate rolls are prevented (ST-04).">
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="Class"><Select value={sel.classId} onChange={(e) => setSel({ ...sel, classId: e.target.value })} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select" /></Field>
        <Field label="Section"><Select value={sel.section} onChange={(e) => setSel({ ...sel, section: e.target.value })} options={cls?.sections || []} placeholder="All" /></Field>
        <Field label="Method"><Select value={sel.method} onChange={(e) => setSel({ ...sel, method: e.target.value })} options={[{ value: "alphabetical", label: "Alphabetical" }, { value: "merit", label: "Merit (exam position)" }]} /></Field>
        {sel.method === "merit" && <Field label="Exam"><Select value={sel.examId} onChange={(e) => setSel({ ...sel, examId: e.target.value })} options={exams.map((x) => ({ value: x.id, label: x.name }))} placeholder="Select" /></Field>}
        <Field label="Start from"><Input type="number" value={sel.startFrom} onChange={(e) => setSel({ ...sel, startFrom: Number(e.target.value) })} /></Field>
      </div>
      <Button className="mt-3" icon={ListOrdered} disabled={!sel.classId} onClick={run}>Assign rolls</Button>
    </Card>
  );
}

function Importer() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  async function readFile(file) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
    setRows(data);
    setReport(null);
    try { setReport(await http.post("/students/import", { rows: data, commit: false })); } catch (e) { toast.error(e); }
  }
  async function commit() {
    setBusy(true);
    try {
      const r = await http.post("/students/import", { rows, commit: true, mode: "valid-only" });
      toast.success(`Imported ${r.imported} students (${r.skipped} skipped)`);
      setRows([]); setReport(null);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  }
  async function template() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name", "Name BN", "Gender", "Class", "Section", "Roll", "DOB", "Blood Group", "Birth Certificate", "Guardian Name", "Guardian Mobile", "Relation", "Religion", "Shift", "Group", "Address"], ["Rahim Uddin", "রহিম উদ্দিন", "Male", "Class 6", "A", "1", "2014-02-10", "B+", "20140000000001", "Karim Uddin", "01711000000", "Father", "Islam", "Morning", "", "Dhaka"]]), "Students");
    XLSX.writeFile(wb, "student-import-template.xlsx");
  }
  return (
    <Card title="Excel / CSV import" subtitle="Preview with validation, duplicate detection and row-level error report before anything is saved (SYS-06, NFX-09)."
      actions={<Button size="sm" variant="secondary" onClick={template}>Download template</Button>}>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center hover:border-blue-400">
        <FileUp className="text-blue-500" />
        <span className="text-sm font-semibold text-slate-700">Choose .xlsx or .csv file</span>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
      </label>
      {report && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Badge tone="blue">{report.total} rows</Badge><Badge tone="green">{report.valid} valid</Badge><Badge tone="red">{report.invalid} invalid</Badge>
          </div>
          <Table dense rows={report.report.filter((r) => !r.valid).slice(0, 100)} rowKey="row" empty="All rows are valid." columns={[{ key: "row", label: "Row" }, { key: "name", label: "Name", render: (r) => r.data.name }, { key: "errors", label: "Errors", render: (r) => <span className="text-rose-600">{r.errors.join("; ")}</span> }]} />
          <Button loading={busy} disabled={!report.valid} onClick={commit}>Import {report.valid} valid rows</Button>
        </div>
      )}
    </Card>
  );
}

export default function StudentTools({ initialTab = "promotion" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <div>
      <PageHeader title="Promotion, Rolls & Import" icon={ArrowUpCircle} subtitle="Session rollover, roll numbers and bulk data import." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "promotion", label: "Promotion" }, { key: "rolls", label: "Roll assignment" }, { key: "import", label: "Import" }]} />
      {tab === "promotion" && <Promotion />}
      {tab === "rolls" && <RollAssign />}
      {tab === "import" && <Importer />}
    </div>
  );
}
