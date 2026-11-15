"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, BookOpen, Bus, CalendarDays, CreditCard, FileText, Globe2, GraduationCap, Home, LogOut, Moon, Send, Settings as SettingsIcon, Users,
} from "lucide-react";
import { AccountSecurity, GuardianLearning } from "../extensions/Extras";
import { http, portalApi } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Conversations } from "../operations/Hubs";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Textarea, formatDate, formatDateTime, money, today, useToast } from "../ui/kit";

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const STATUS_COLOR = { Present: "bg-emerald-500", Late: "bg-amber-400", Absent: "bg-rose-500", Leave: "bg-purple-500" };

function AttendanceCalendar({ studentId }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [data, setData] = useState(null);
  useEffect(() => { portalApi.attendance(studentId, month).then(setData).catch(() => {}); }, [studentId, month]);
  const first = new Date(`${month}-01`);
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const map = Object.fromEntries((data?.records || []).map((r) => [new Date(r.attendanceDate).getDate(), r]));
  const lead = first.getDay();
  return (
    <Card title="Attendance" subtitle={data?.percentage !== null && data ? `${data.percentage}% this month` : ""} actions={<Input type="month" className="!h-9 !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />}>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1 font-semibold text-slate-400">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => i + 1).map((d) => {
          const r = map[d];
          return (
            <div key={d} title={r ? `${r.status}${r.inTime ? ` · in ${new Date(r.inTime).toLocaleTimeString()}` : ""}` : ""} className={`grid aspect-square place-items-center rounded-lg font-semibold ${r ? `${STATUS_COLOR[r.status]} text-white` : "bg-slate-50 text-slate-500"}`}>{d}</div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">{Object.entries(STATUS_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className={`size-3 rounded ${c}`} />{k}</span>)}</div>
    </Card>
  );
}

function ResultsView({ studentId, child, institute }) {
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    http.get(`/portal/guardian/students/${studentId}/results`).then((d) => setRows(d)).catch((e) => setMessage(e.message));
  }, [studentId]);
  if (message) return <EmptyState title={message} />;
  if (!rows) return <Spinner />;
  return (
    <Card title="Published results">
      {!rows.length ? <EmptyState title="No published results yet." /> : (
        <div className="space-y-2">{rows.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpen(r)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-left hover:border-blue-300">
            <div><p className="font-semibold">{r.examName}</p><p className="text-xs text-slate-500">Published {formatDate(r.publishedAt)} · position {r.classPosition || "—"}{r.version > 1 ? ` · revised v${r.version}` : ""}</p></div>
            <div className="text-right"><p className="text-xl font-extrabold text-slate-900">{r.gpa}</p><Badge tone={r.status === "Pass" ? "green" : "red"}>{r.grade}</Badge></div>
          </button>
        ))}</div>
      )}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={`Report card – ${open?.examName || ""}`} footer={<><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button><Button onClick={() => window.print()}>Print / PDF</Button></>}>
        {open && (
          <div className="text-sm">
            <div className="mb-3 border-b pb-3 text-center"><p className="text-lg font-extrabold">{institute?.name}</p><p className="text-xs text-slate-500">{open.examName} · Report card</p></div>
            <p><b>{child?.name}</b> · {child?.className} · Roll {child?.roll || "—"} · ID {child?.id}</p>
            <table className="mt-3 w-full"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th>Subject</th><th className="text-center">Marks</th><th className="text-center">Grade</th><th className="text-center">Point</th></tr></thead>
              <tbody>{(open.subjects || []).map((s) => <tr key={s.subjectId} className="border-b border-slate-100"><td className="py-1">{s.subjectName}{s.isFourth ? " (4th)" : ""}</td><td className="text-center">{s.absent ? "AB" : `${s.obtained}/${s.fullMarks}`}</td><td className={`text-center font-bold ${s.passed ? "" : "text-rose-600"}`}>{s.grade}</td><td className="text-center">{s.point}</td></tr>)}</tbody></table>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
              <p>Total <b>{Number(open.totalMarks)}/{Number(open.maxMarks)}</b></p><p>GPA <b>{open.gpa}</b></p><p>Grade <b>{open.grade}</b></p><p>Position <b>{open.classPosition || "—"}</b></p>
            </div>
            {open.teacherComment && <p className="mt-2 text-slate-600">Teacher: {open.teacherComment}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

function FeesView({ studentId }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [gateway, setGateway] = useState("");
  const load = useCallback(() => portalApi.fees(studentId).then((d) => { setData(d); setSel(new Set(d.invoices.filter((i) => Number(i.due) > 0).map((i) => i.id))); }).catch((e) => toast.error(e)), [studentId, toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
  if (!data) return <Spinner />;
  const gateways = Object.entries(data.gateways || {}).filter(([k, v]) => v && k !== "cash").map(([k]) => k);
  const total = data.invoices.filter((i) => sel.has(i.id)).reduce((s, i) => s + Number(i.due), 0);
  async function pay() {
    try {
      const r = await http.post("/fees/online/initiate", { invoiceIds: [...sel], gateway: gateway || gateways[0] });
      window.location.href = r.paymentUrl;
    } catch (e) { toast.error(e); }
  }
  return (
    <div className="space-y-5">
      <Card title="Fees due" actions={total > 0 && gateways.length > 0 && (
        <>
          <Select className="!h-9 !w-auto" value={gateway || gateways[0]} onChange={(e) => setGateway(e.target.value)} options={gateways.map((g) => ({ value: g, label: g.toUpperCase() }))} />
          <Button size="sm" icon={CreditCard} onClick={pay}>Pay {money(total)}</Button>
        </>
      )}>
        {total > 0 && !gateways.length && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Online payment is not enabled. Please pay at the school office.</p>}
        <Table dense rows={data.invoices} columns={[
          { key: "x", label: "", render: (i) => Number(i.due) > 0 && <input type="checkbox" className="accent-blue-600" checked={sel.has(i.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(i.id); else n.delete(i.id); setSel(n); }} /> },
          { key: "feeHead", label: "Fee" }, { key: "billingMonth", label: "Month", render: (i) => String(i.billingMonth || "").slice(0, 7) },
          { key: "amount", label: "Amount", render: (i) => money(i.amount) }, { key: "discount", label: "Discount", render: (i) => (Number(i.discount) ? money(i.discount) : "—") },
          { key: "lateFine", label: "Fine", render: (i) => (Number(i.lateFine) ? money(i.lateFine) : "—") }, { key: "due", label: "Due", render: (i) => <b>{money(i.due)}</b> },
          { key: "status", label: "Status", render: (i) => <Badge>{i.status}</Badge> },
        ]} />
      </Card>
      <Card title="Payment history & receipts">
        <Table dense rows={data.payments} columns={[{ key: "receiptNo", label: "Receipt" }, { key: "paidAt", label: "Date", render: (p) => formatDateTime(p.paidAt) }, { key: "amount", label: "Amount", render: (p) => money(p.amount) }, { key: "paymentMethod", label: "Method" }, { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> }]} />
      </Card>
    </div>
  );
}

function AcademicsView({ studentId }) {
  const [d, setD] = useState(null);
  useEffect(() => { portalApi.academics(studentId).then(setD).catch(() => {}); }, [studentId]);
  if (!d) return <Spinner />;
  const byDay = DAYS.map((day) => ({ day, items: d.routine.filter((r) => r.dayOfWeek === day) })).filter((x) => x.items.length);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Homework & assignments">
        {!d.homework.length ? <EmptyState title="No homework." /> : <div className="space-y-2">{d.homework.map((h) => (
          <div key={h.id} className="rounded-xl border border-slate-100 p-3 text-sm"><div className="flex justify-between"><b>{h.title}</b><Badge tone={h.dueDate && new Date(h.dueDate) < new Date() ? "slate" : "amber"}>Due {formatDate(h.dueDate)}</Badge></div>
            <p className="text-xs text-slate-500">{h.subjectName} · {h.kind}</p>{h.description && <p className="mt-1 text-slate-600">{h.description}</p>}
            {h.attachmentUrl && <a href={h.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600">Attachment</a>}</div>
        ))}</div>}
      </Card>
      <Card title="Exam routine">
        <Table dense rows={d.examRoutine} columns={[{ key: "examName", label: "Exam" }, { key: "examDate", label: "Date", render: (r) => formatDate(r.examDate) }, { key: "startTime", label: "Time" }, { key: "subjectName", label: "Subject" }, { key: "room", label: "Room" }]} />
      </Card>
      <Card title="Class routine">
        {!byDay.length ? <EmptyState title="Routine not published." /> : <div className="space-y-2">{byDay.map((x) => (
          <div key={x.day}><p className="text-xs font-bold uppercase text-slate-500">{x.day}</p><div className="mt-1 flex flex-wrap gap-1">{x.items.map((r) => <span key={r.id} className={`rounded-lg px-2 py-1 text-xs ${r.isBreak ? "bg-amber-50 text-amber-700" : "bg-slate-100"}`}>{r.periodCode}: {r.isBreak ? r.label || "Break" : r.subjectName}</span>)}</div></div>
        ))}</div>}
      </Card>
      <Card title="Academic calendar">
        <Table dense rows={d.events} columns={[{ key: "startDate", label: "Date", render: (e) => formatDate(e.startDate) }, { key: "title", label: "Event" }, { key: "type", label: "Type", render: (e) => <Badge>{e.type}</Badge> }, { key: "hijriLabel", label: "Hijri" }]} />
      </Card>
      {(d.resources.length > 0 || d.onlineClasses.length > 0) && (
        <Card title="Notes, resources & online classes">
          <div className="space-y-1 text-sm">
            {d.onlineClasses.map((o) => <p key={o.id}>🎥 <b>{o.title}</b> {formatDateTime(o.scheduledAt)} {o.meetingUrl && <a className="text-blue-600" href={o.meetingUrl} target="_blank" rel="noreferrer">Join</a>} {o.recordingUrl && <a className="text-blue-600" href={o.recordingUrl} target="_blank" rel="noreferrer">Recording</a>}</p>)}
            {d.resources.map((r) => <p key={r.id}>📄 {r.title} ({r.subjectName || r.type}) {r.url && <a className="text-blue-600" href={r.url} target="_blank" rel="noreferrer">Open</a>}</p>)}
          </div>
        </Card>
      )}
    </div>
  );
}

function ExtrasView({ studentId, child }) {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [leave, setLeave] = useState({ fromDate: today(), toDate: today(), reason: "" });
  const load = useCallback(() => portalApi.extras(studentId).then(setD).catch(() => {}), [studentId]);
  useEffect(() => { load(); }, [load]);
  async function applyLeave() {
    try { await http.post("/leave/apply", { applicantType: "Student", applicantId: studentId, ...leave }); toast.success("Leave application sent to the class teacher"); setLeave({ ...leave, reason: "" }); load(); } catch (e) { toast.error(e); }
  }
  if (!d) return <Spinner />;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Leave application">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="From"><Input type="date" value={leave.fromDate} onChange={(e) => setLeave({ ...leave, fromDate: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={leave.toDate} onChange={(e) => setLeave({ ...leave, toDate: e.target.value })} /></Field>
          <Field label="Reason" className="sm:col-span-2"><Textarea value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></Field>
        </div>
        <Button className="mt-2" icon={Send} onClick={applyLeave}>Apply</Button>
        <div className="mt-4"><Table dense rows={d.leaves} columns={[{ key: "fromDate", label: "From", render: (l) => formatDate(l.fromDate) }, { key: "toDate", label: "To", render: (l) => formatDate(l.toDate) }, { key: "reason", label: "Reason" }, { key: "status", label: "Status", render: (l) => <Badge>{l.status}</Badge> }]} /></div>
      </Card>
      <Card title="Teachers">
        <Table dense rows={d.teachers} columns={[{ key: "name", label: "Teacher", render: (t) => <>{t.name}{t.isClassTeacher && <Badge tone="blue">Class teacher</Badge>}</> }, { key: "subjectName", label: "Subject" }, { key: "phone", label: "Phone" }]} />
        <MessageTeacher studentId={studentId} teachers={d.teachers} child={child} />
      </Card>
      {(d.hifz.logs.length > 0 || d.hifz.parasDone > 0) && (
        <Card title="Hifz progress" subtitle={`${d.hifz.parasDone}/30 paras memorised`}>
          <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${(d.hifz.parasDone / 30) * 100}%` }} /></div>
          <Table dense rows={d.hifz.logs} columns={[{ key: "logDate", label: "Date", render: (l) => formatDate(l.logDate) }, { key: "sabakPara", label: "Para" }, { key: "s", label: "Sabak", render: (l) => `${l.sabakFrom || ""}–${l.sabakTo || ""}` }, { key: "mistakes", label: "Mistakes" }, { key: "comment", label: "Ustad's comment" }]} />
        </Card>
      )}
      {d.salah.length > 0 && (
        <Card title="Salah – last 7 days">
          <div className="flex flex-wrap gap-1">{d.salah.map((s, i) => <span key={i} className={`rounded px-2 py-1 text-xs ${s.status === "Missed" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{formatDate(s.attendanceDate).slice(0, 6)} {s.wakt}: {s.status}</span>)}</div>
        </Card>
      )}
      {d.transport && (
        <Card title="School bus">
          <p className="text-sm">{d.transport.routeName} · stop <b>{d.transport.stopName || "—"}</b> · departs {d.transport.morningDeparture || "—"}</p>
          <p className="text-sm text-slate-500">{d.transport.registrationNo} · driver {d.transport.driverName} {d.transport.driverPhone}</p>
          {d.transport.location && <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${d.transport.location.lat}&mlon=${d.transport.location.lng}#map=16/${d.transport.location.lat}/${d.transport.location.lng}`}><Bus size={14} /> Live location ({formatDateTime(d.transport.location.at)})</a>}
        </Card>
      )}
      {d.library.length > 0 && <Card title="Library"><Table dense rows={d.library} columns={[{ key: "title", label: "Book" }, { key: "dueDate", label: "Due", render: (l) => formatDate(l.dueDate) }, { key: "status", label: "Status", render: (l) => <Badge>{l.status}</Badge> }]} /></Card>}
      {d.hostel && <Card title="Hostel"><p className="text-sm">{d.hostel.building} – Room {d.hostel.roomNo}, seat {d.hostel.seatNo || "—"}{d.hostel.isLillah ? " (Lillah)" : ""}</p></Card>}
    </div>
  );
}

function MessageTeacher({ studentId, teachers }) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  async function send() {
    try { await http.post("/conversations", { recipientType: "Teacher", recipientId: to, studentId, body }); toast.success("Message sent"); setBody(""); } catch (e) { toast.error(e); }
  }
  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-600">Message a teacher</p>
      <Select value={to} onChange={(e) => setTo(e.target.value)} options={teachers.map((t) => ({ value: t.id, label: t.name }))} placeholder="Choose teacher" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your message" />
      <Button size="sm" icon={Send} disabled={!to || !body.trim()} onClick={send}>Send</Button>
    </div>
  );
}

function SupportView({ children }) {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ studentId: children[0]?.id || "", category: "General", subject: "", description: "" });
  const load = useCallback(() => {
    portalApi.complaints().then(setComplaints).catch(() => {});
    portalApi.ptmSlots().then(setSlots).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  async function submit() {
    try { await portalApi.complain(form); toast.success("Complaint submitted"); setForm({ ...form, subject: "", description: "" }); load(); } catch (e) { toast.error(e); }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Complaint / feedback">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Child"><Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} options={children.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={["General", "Academic", "Fees", "Transport", "Behaviour", "Facility"]} /></Field>
          <Field label="Subject" className="sm:col-span-2"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="Details" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <Button className="mt-2" icon={Send} disabled={!form.subject} onClick={submit}>Submit</Button>
        <div className="mt-4"><Table dense rows={complaints} columns={[{ key: "subject", label: "Subject" }, { key: "status", label: "Status", render: (c) => <Badge>{c.status}</Badge> }, { key: "response", label: "Response" }]} /></div>
      </Card>
      <Card title="Parent–teacher meeting">
        <Table dense rows={slots} columns={[{ key: "slotDate", label: "Date", render: (s) => formatDate(s.slotDate) }, { key: "t", label: "Time", render: (s) => `${s.startTime}–${s.endTime}` }, { key: "teacherName", label: "Teacher" },
          { key: "a", label: "", render: (s) => (s.status === "Available" ? <Select className="!h-8" value="" onChange={async (e) => { if (!e.target.value) return; try { await portalApi.bookPtm(s.id, e.target.value); toast.success("Booked"); load(); } catch (err) { toast.error(err); } }} options={children.map((c) => ({ value: c.id, label: `Book for ${c.name}` }))} placeholder="Book…" /> : <Badge>{s.status}</Badge>) }]} />
      </Card>
    </div>
  );
}

export default function GuardianPortal({ onLogout }) {
  const { lang, setLang, t } = useI18n();
  const [home, setHome] = useState(null);
  const [childId, setChildId] = useState("all");
  const [tab, setTab] = useState("overview");
  const [notifications, setNotifications] = useState(null);
  const [institute, setInstitute] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    portalApi.guardianHome().then(setHome).catch((e) => setError(e.message));
    http.get("/institute-profile").then(setInstitute).catch(() => {});
  }, []);
  const child = useMemo(() => home?.children.find((c) => c.id === childId), [home, childId]);

  if (error) return <div className="grid min-h-screen place-items-center p-6"><EmptyState title="Guardian portal unavailable" hint={error} /></div>;
  if (!home) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;

  const tabs = [
    ["overview", t("Overview"), Home], ["attendance", t("Attendance"), CalendarDays], ["results", "Results", FileText], ["fees", t("Fees"), CreditCard],
    ["academics", "Routine & Homework", BookOpen], ["learning", "Learning & Progress", GraduationCap], ["more", "Leave, Teachers & More", Moon],
    ["account", "Settings", SettingsIcon],
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {institute.logoUrl ? <img src={institute.logoUrl} alt="" className="size-10 rounded-xl object-contain" /> : <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><Users size={20} /></span>}
          <div className="min-w-0"><p className="truncate font-extrabold text-slate-900">{institute.name || "School"}</p><p className="text-xs text-slate-500">{t("Guardian Portal")} · {home.guardian?.name}</p></div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setLang(lang === "bn" ? "en" : "bn")}><Globe2 size={18} />{lang === "bn" ? "EN" : "বাং"}</button>
            <button type="button" className="relative grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={() => portalApi.notifications().then(setNotifications)}>
              <Bell size={20} />{home.unreadNotifications > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{home.unreadNotifications}</span>}
            </button>
            <button type="button" className="grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={onLogout} title={t("Sign Out")}><LogOut size={20} /></button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          <button type="button" onClick={() => { setChildId("all"); setTab("overview"); }} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${childId === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}><Users size={16} /> All children</button>
          {home.children.map((c) => (
            <button key={c.id} type="button" onClick={() => { setChildId(c.id); if (tab === "overview") setTab("attendance"); }} className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold ${childId === c.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {c.photoUrl ? <img src={c.photoUrl} alt="" className="size-7 rounded-full object-cover" /> : <span className="grid size-7 place-items-center rounded-full bg-white text-xs text-slate-600">{c.name.slice(0, 1)}</span>}{c.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        {childId === "all" ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {home.children.map((c) => (
                <button key={c.id} type="button" onClick={() => { setChildId(c.id); setTab("attendance"); }} className="dashboard-panel p-5 text-left transition hover:shadow-lg">
                  <div className="flex items-center gap-3">
                    {c.photoUrl ? <img src={c.photoUrl} alt="" className="size-14 rounded-2xl object-cover" /> : <span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-xl font-bold text-blue-600">{c.name.slice(0, 1)}</span>}
                    <div><p className="text-lg font-extrabold">{c.name}</p><p className="text-sm text-slate-500">{c.className} · Roll {c.roll || "—"} · {c.id}</p><p className="text-xs text-slate-500">Class teacher: {c.classTeacher || "—"}</p></div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500">Today</p>{c.todayAttendance ? <Badge>{c.todayAttendance}</Badge> : <span className="text-slate-400">Not marked</span>}</div>
                    <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500">Homework</p><b>{c.homeworkCount}</b></div>
                    <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500">Next exam</p><b className="text-xs">{c.nextExam ? `${c.nextExam.subject} ${formatDate(c.nextExam.date)}` : "—"}</b></div>
                    <div className={`rounded-xl p-2 ${Number(c.feeDue) > 0 ? "bg-rose-50" : "bg-emerald-50"}`}><p className="text-xs text-slate-500">Fee due</p><b>{money(c.feeDue)}</b></div>
                  </div>
                </button>
              ))}
            </div>
            {home.children.length > 1 && <Card title="Combined dues"><p className="text-2xl font-extrabold">{money(home.totalDue)}</p><p className="text-sm text-slate-500">Open a child's Fees tab to pay; one payment can cover several invoices.</p></Card>}
            <Card title="Notices">
              {!home.notices.length ? <EmptyState title="No notices." /> : <div className="space-y-2">{home.notices.map((n) => (
                <div key={n.id} className={`rounded-xl p-3 text-sm ${n.priority === "Emergency" ? "bg-rose-50" : "bg-slate-50"}`}><div className="flex justify-between"><b>{n.title}</b><span className="text-xs text-slate-500">{formatDate(n.createdAt)}</span></div><p className="mt-1 text-slate-600">{n.message}</p></div>
              ))}</div>}
            </Card>
            <Conversations />
            <SupportView children={home.children} />
          </div>
        ) : (
          <div>
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
              {tabs.filter(([k]) => k !== "overview").map(([k, label, Icon]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={16} />{label}</button>
              ))}
            </div>
            {tab === "attendance" && <AttendanceCalendar studentId={childId} />}
            {tab === "results" && <ResultsView studentId={childId} child={child} institute={institute} />}
            {tab === "fees" && <FeesView studentId={childId} />}
            {tab === "academics" && <AcademicsView studentId={childId} />}
            {tab === "more" && <ExtrasView studentId={childId} child={child} />}
            {tab === "learning" && <GuardianLearning studentId={childId} />}
            {tab === "account" && <AccountSecurity guardian />}
          </div>
        )}
      </main>
      <Modal open={Boolean(notifications)} onClose={() => { setNotifications(null); setHome({ ...home, unreadNotifications: 0 }); }} title="Notifications">
        {!notifications?.length ? <EmptyState title="No notifications." /> : <div className="space-y-2">{notifications.map((n) => (
          <div key={n.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between"><b>{n.subject || n.eventType}</b><span className="text-xs text-slate-500">{formatDateTime(n.createdAt)}</span></div><p className="text-slate-600">{n.body}</p></div>
        ))}</div>}
      </Modal>
    </div>
  );
}
