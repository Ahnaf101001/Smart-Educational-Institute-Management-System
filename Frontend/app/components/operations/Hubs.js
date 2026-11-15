"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bus, CalendarCheck2, ClipboardList, CreditCard, MapPin, MessageSquare, Moon, QrCode, Save, ScanLine, Send,
} from "lucide-react";
import { http, resource } from "../../lib/api";
import { flushItems, isNetworkError, pendingItems, queueItem } from "../../lib/offlineQueue";
import { useUser } from "../../lib/access";
import ResourceManager from "../ui/ResourceManager";
import { CONFIGS } from "../modules/configs";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Tabs, Textarea, exportRows, formatDate, formatDateTime, money, today, useToast } from "../ui/kit";

// ================================================================ ATTENDANCE
function StaffAttendance() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => http.get("/attendance/staff", { date }).then((r) => {
    setRows(r);
    setMarks(Object.fromEntries(r.map((p) => [`${p.employeeType}:${p.employeeId}`, {
      status: p.record?.status || "Present",
      inTime: p.record?.inTime ? new Date(p.record.inTime).toTimeString().slice(0, 5) : "",
      outTime: p.record?.outTime ? new Date(p.record.outTime).toTimeString().slice(0, 5) : "",
      earlyLeave: Boolean(p.record?.earlyLeave),
    }])));
  }).catch((e) => toast.error(e)), [date, toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  async function save() {
    setSaving(true);
    try {
      await http.put("/attendance/staff/bulk", { date, records: rows.map((p) => ({ employeeType: p.employeeType, employeeId: p.employeeId, employeeName: p.employeeName, ...marks[`${p.employeeType}:${p.employeeId}`] })) });
      toast.success("Staff attendance saved");
      load();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  }
  const counts = Object.values(marks).reduce((a, m) => ({ ...a, [m.status]: (a[m.status] || 0) + 1 }), {});
  return (
    <Card title="Teacher & staff attendance" subtitle="In/out time, late and early leave (HR-05, AT-10). Device check-ins appear automatically."
      actions={<><Input type="date" className="!h-9 !w-auto" value={date} onChange={(e) => setDate(e.target.value)} /><Button size="sm" icon={Save} loading={saving} onClick={save}>Save</Button></>}>
      <div className="mb-3 flex flex-wrap gap-2">{Object.entries(counts).map(([k, v]) => <Badge key={k}>{`${k}: ${v}`}</Badge>)}</div>
      <Table dense rowKey="employeeId" rows={rows} columns={[
        { key: "employeeName", label: "Name", render: (p) => <div><b>{p.employeeName}</b><span className="block text-xs text-slate-500">{p.employeeType} · {p.employeeId} · {p.designation || ""}</span></div> },
        { key: "status", label: "Status", render: (p) => {
          const k = `${p.employeeType}:${p.employeeId}`;
          return <div className="flex gap-1">{["Present", "Late", "Absent", "Leave", "Half Day"].map((s) => (
            <button key={s} type="button" onClick={() => setMarks({ ...marks, [k]: { ...marks[k], status: s } })} className={`rounded-lg px-2 py-1 text-xs font-semibold ${marks[k]?.status === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{s}</button>
          ))}</div>;
        } },
        { key: "in", label: "In", render: (p) => { const k = `${p.employeeType}:${p.employeeId}`; return <input type="time" value={marks[k]?.inTime || ""} onChange={(e) => setMarks({ ...marks, [k]: { ...marks[k], inTime: e.target.value } })} className="h-8 rounded-lg border border-slate-200 px-2" />; } },
        { key: "out", label: "Out", render: (p) => { const k = `${p.employeeType}:${p.employeeId}`; return <input type="time" value={marks[k]?.outTime || ""} onChange={(e) => setMarks({ ...marks, [k]: { ...marks[k], outTime: e.target.value } })} className="h-8 rounded-lg border border-slate-200 px-2" />; } },
        { key: "early", label: "Early leave", render: (p) => { const k = `${p.employeeType}:${p.employeeId}`; return <input type="checkbox" className="accent-amber-600" checked={Boolean(marks[k]?.earlyLeave)} onChange={(e) => setMarks({ ...marks, [k]: { ...marks[k], earlyLeave: e.target.checked } })} />; } },
        { key: "src", label: "Source", render: (p) => p.record?.source || "—" },
      ]} />
    </Card>
  );
}

function LeaveApply() {
  const toast = useToast();
  const { user } = useUser();
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ applicantType: user?.linkedType && user.linkedType !== "Guardian" ? user.linkedType : "Student", applicantId: user?.linkedType && user.linkedType !== "Guardian" ? user.linkedId : "", leaveTypeId: "", fromDate: today(), toDate: today(), reason: "" });
  const [balances, setBalances] = useState([]);
  useEffect(() => { resource("/leave-types").all().then(setTypes).catch(() => {}); }, []);
  useEffect(() => {
    if (!form.applicantId) { setBalances([]); return; }
    http.get(`/leave/balances/${form.applicantType}/${form.applicantId}`).then(setBalances).catch(() => setBalances([]));
  }, [form.applicantType, form.applicantId]);
  async function submit() {
    try { await http.post("/leave/apply", form); toast.success("Leave application submitted for approval"); setForm({ ...form, reason: "" }); } catch (e) { toast.error(e); }
  }
  const applies = form.applicantType === "Student" ? "Student" : "Staff";
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Apply for leave" subtitle="Student leave → Class Teacher; staff leave → Principal (AT-06, HR-04). Approved student leave marks attendance as Leave.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Applicant type"><Select value={form.applicantType} onChange={(e) => setForm({ ...form, applicantType: e.target.value, leaveTypeId: "" })} options={["Student", "Teacher", "Staff"]} /></Field>
          <Field label="Applicant ID"><Input value={form.applicantId} onChange={(e) => setForm({ ...form, applicantId: e.target.value.trim() })} placeholder="STU-… / TCH-… / STF-…" /></Field>
          <Field label="Leave type"><Select value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} options={types.filter((t) => t.appliesTo === applies || t.appliesTo === "Both").map((t) => ({ value: t.id, label: t.name }))} placeholder="General" /></Field>
          <div />
          <Field label="From"><Input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></Field>
          <Field label="Reason" className="sm:col-span-2"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        </div>
        <Button className="mt-3" icon={Send} disabled={!form.applicantId} onClick={submit}>Submit</Button>
      </Card>
      <Card title="Leave balance">
        {!balances.length ? <EmptyState title="Enter an applicant ID to see balances." /> : (
          <Table dense rows={balances} columns={[{ key: "name", label: "Leave type" }, { key: "daysPerYear", label: "Entitled", render: (b) => b.daysPerYear || "Unlimited" }, { key: "used", label: "Used" }, { key: "pending", label: "Pending" }, { key: "balance", label: "Balance", render: (b) => (b.balance === null ? "—" : <b>{b.balance}</b>) }]} />
        )}
      </Card>
    </div>
  );
}

function MonthlyRegister() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [sel, setSel] = useState({ className: "", month: today().slice(0, 7) });
  const [data, setData] = useState(null);
  useEffect(() => {
    resource("/classes").all().then((cs) => setClasses(cs.flatMap((c) => ((c.sections || []).length ? c.sections.map((s) => `${c.name}-${s}`) : [c.name]))));
  }, []);
  useEffect(() => {
    if (!sel.className) return;
    http.get("/attendance/report/monthly", sel).then(setData).catch((e) => toast.error(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);
  const days = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];
  const short = { Present: "P", Absent: "A", Late: "L", Leave: "Lv" };
  return (
    <Card title="Monthly attendance register" subtitle="Student-wise daily status and percentage (AT-08)" actions={data && <Button size="sm" variant="secondary" onClick={() => exportRows("xlsx", { title: `Attendance ${sel.className} ${sel.month}`, columns: [{ key: "roll", label: "Roll" }, { key: "name", label: "Name" }, ...days.map((d) => ({ key: `d${d}`, label: String(d), exportValue: (r) => short[r.days[d]] || "" })), { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "percentage", label: "%" }], rows: data.students })}>Excel</Button>}>
      <div className="mb-3 grid max-w-lg grid-cols-2 gap-2">
        <Select value={sel.className} onChange={(e) => setSel({ ...sel, className: e.target.value })} options={classes} placeholder="Select class-section" />
        <Input type="month" value={sel.month} onChange={(e) => setSel({ ...sel, month: e.target.value })} />
      </div>
      {!data ? <EmptyState title="Select a class." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-2 text-left">Roll</th><th className="px-2 py-2 text-left">Name</th>{days.map((d) => <th key={d} className="px-1">{d}</th>)}<th className="px-2">P</th><th className="px-2">A</th><th className="px-2">%</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.students.map((s) => (
              <tr key={s.id}><td className="px-2 py-1">{s.roll}</td><td className="whitespace-nowrap px-2 py-1 font-semibold">{s.name}</td>
                {days.map((d) => <td key={d} className={`px-1 text-center ${s.days[d] === "Absent" ? "font-bold text-rose-600" : s.days[d] === "Late" ? "text-amber-600" : s.days[d] === "Leave" ? "text-purple-600" : "text-emerald-600"}`}>{short[s.days[d]] || ""}</td>)}
                <td className="px-2 text-center">{s.present}</td><td className="px-2 text-center">{s.absent}</td><td className="px-2 text-center font-bold">{s.percentage ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LateAbsent() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [streaks, setStreaks] = useState(null);
  const [classwise, setClasswise] = useState([]);
  useEffect(() => {
    http.get("/attendance/report/late-absent", { date }).then(setRows).catch((e) => toast.error(e));
    http.get("/attendance/report/classwise", { from: date, to: date }).then(setClasswise).catch(() => {});
    http.get("/attendance/alerts/consecutive").then(setStreaks).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  return (
    <div className="space-y-5">
      <Card title="Daily attendance report" actions={<Input type="date" className="!h-9 !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />}>
        <Table dense rows={classwise} rowKey="className" columns={[{ key: "className", label: "Class" }, { key: "total", label: "Marked" }, { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "late", label: "Late" }, { key: "percentage", label: "%" }]} />
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Late arrivals & absences">
          <Table dense rows={rows} columns={[{ key: "className", label: "Class" }, { key: "roll", label: "Roll" }, { key: "studentName", label: "Student" }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> }, { key: "inTime", label: "In", render: (r) => (r.inTime ? new Date(r.inTime).toTimeString().slice(0, 5) : "—") }, { key: "notifiedAt", label: "Guardian notified", render: (r) => (r.notifiedAt ? "Yes" : "No") }]} />
        </Card>
        <Card title={`Consecutive absence alerts (≥ ${streaks?.threshold || 3} days)`} subtitle="Class teacher & Principal are alerted automatically (AT-07)">
          <Table dense rows={streaks?.students || []} rowKey="studentId" empty="No students on alert." columns={[{ key: "name", label: "Student" }, { key: "className", label: "Class" }, { key: "streak", label: "Days" }, { key: "parentContact", label: "Guardian" }]} />
        </Card>
      </div>
    </div>
  );
}

function MobileScan() {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [type, setType] = useState("IN");
  const [log, setLog] = useState([]);
  const [camera, setCamera] = useState(false);
  async function submit(value = code) {
    if (!value) return;
    try {
      const r = await http.post("/devices/scan", { credential: value.split("/").pop(), eventType: type });
      setLog((l) => [{ at: new Date(), value, ...r }, ...l].slice(0, 30));
      if (r.status === "Processed") toast.success(r.message); else toast.warning(r.message);
      setCode("");
    } catch (e) { toast.error(e); }
  }
  useEffect(() => {
    if (!camera || typeof window === "undefined" || !("BarcodeDetector" in window)) return undefined;
    let stream; let active = true;
    const video = document.getElementById("scan-video");
    const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      stream = s; video.srcObject = s; video.play();
      const tick = async () => {
        if (!active) return;
        try { const codes = await detector.detect(video); if (codes[0]) { await submit(codes[0].rawValue); await new Promise((r) => setTimeout(r, 2500)); } } catch { /* ignore */ }
        requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => toast.error("Camera access denied"));
    return () => { active = false; stream?.getTracks().forEach((t) => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;
  return (
    <Card title="Mobile app attendance (QR / RFID)" subtitle="Scan a student's ID card QR with a phone camera or a USB RFID reader (types the card number). Arrival after the cut-off is marked Late automatically.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex gap-2">{["IN", "OUT"].map((t) => <Button key={t} variant={type === t ? "primary" : "secondary"} onClick={() => setType(t)}>{t === "IN" ? "Entry" : "Exit"}</Button>)}</div>
          <Field label="Card number / QR / RFID UID"><Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Scan or type then press Enter" /></Field>
          <div className="flex gap-2">
            <Button icon={ScanLine} onClick={() => submit()}>Record</Button>
            {supported && <Button variant="secondary" icon={QrCode} onClick={() => setCamera((c) => !c)}>{camera ? "Stop camera" : "Use camera"}</Button>}
          </div>
          {camera && <video id="scan-video" className="w-full max-w-sm rounded-xl bg-black" muted playsInline />}
        </div>
        <div className="max-h-80 space-y-1 overflow-auto">
          {log.map((l, i) => <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{l.person ? `${l.person.type} ${l.person.id}` : l.value}</span><span className="flex items-center gap-2"><Badge>{l.status}</Badge><span className="text-xs text-slate-500">{l.at.toLocaleTimeString()}</span></span></div>)}
        </div>
      </div>
    </Card>
  );
}

export function AttendanceHub({ initialTab = "staff" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <div>
      <PageHeader title="Attendance Center" icon={CalendarCheck2} subtitle="Staff attendance, leave, devices (face / fingerprint / RFID / QR / mobile), entry-exit log and reports." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "staff", label: "Staff Attendance" }, { key: "leave", label: "Leave" }, { key: "reports", label: "Daily & Late/Absent" }, { key: "register", label: "Monthly Register" },
        { key: "scan", label: "Mobile / QR Scan" }, { key: "devices", label: "Devices & Credentials" }, { key: "log", label: "Entry / Exit Log" },
      ]} />
      {tab === "staff" && <StaffAttendance />}
      {tab === "leave" && <div className="space-y-5"><LeaveApply /><ResourceManager embedded config={CONFIGS.leaveRequests} /><ResourceManager embedded config={CONFIGS.leaveTypes} /></div>}
      {tab === "reports" && <LateAbsent />}
      {tab === "register" && <MonthlyRegister />}
      {tab === "scan" && <MobileScan />}
      {tab === "devices" && <div className="space-y-5"><ResourceManager embedded config={CONFIGS.devices} /><ResourceManager embedded config={CONFIGS.biometricEnrollments} /></div>}
      {tab === "log" && <ResourceManager embedded config={CONFIGS.deviceEvents} />}
    </div>
  );
}

// ================================================================ HR & PAYROLL
function PayrollRun() {
  const toast = useToast();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [slip, setSlip] = useState(null);
  const load = useCallback(() => resource("/payroll").all({ payrollMonth: `${month}-01` }).then(setRows).catch((e) => toast.error(e)), [month, toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  async function act(kind) {
    try {
      if (kind === "generate") { const d = await http.post("/payroll/generate", { month }); toast.success(`${d.created} payroll record(s) generated`); }
      if (kind === "approve") { await http.post("/payroll/request-approval", { month }); toast.success("Payroll sent for approval"); }
      if (kind === "pay") { await http.post("/payroll/process", { month: `${month}-01` }); toast.success("All pending salaries marked paid and posted to accounts"); }
      load();
    } catch (e) { toast.error(e); }
  }
  const total = rows.reduce((s, r) => s + Number(r.netPay || 0), 0);
  return (
    <Card title="Monthly payroll" subtitle="Generated from salary structures with absence/unpaid-leave and advance deductions (HR-07, HRX-06/07)"
      actions={<><Input type="month" className="!h-9 !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} /><Button size="sm" onClick={() => act("generate")}>Generate</Button><Button size="sm" variant="secondary" onClick={() => act("approve")}>Request approval</Button><Button size="sm" variant="success" onClick={() => act("pay")}>Pay all pending</Button></>}>
      <p className="mb-3 text-sm text-slate-600">{rows.length} employees · net {money(total)}</p>
      <Table dense rows={rows} columns={[
        { key: "employeeName", label: "Employee" }, { key: "employeeType", label: "Type" }, { key: "role", label: "Designation" },
        { key: "basicSalary", label: "Basic", render: (r) => money(r.basicSalary) }, { key: "allowances", label: "Allowances", render: (r) => money(r.allowances) },
        { key: "deductions", label: "Deductions", render: (r) => money(r.deductions) }, { key: "netPay", label: "Net", render: (r) => <b>{money(r.netPay)}</b> },
        { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
        { key: "a", label: "", render: (r) => <Button size="sm" variant="secondary" onClick={async () => { try { setSlip(await http.get(`/payroll/${r.id}/payslip`)); } catch (e) { toast.error(e); } }}>Payslip</Button> },
      ]} />
      <Modal open={Boolean(slip)} onClose={() => setSlip(null)} title="Payslip" footer={<><Button variant="secondary" onClick={() => setSlip(null)}>Close</Button><Button onClick={() => window.print()}>Print</Button></>}>
        {slip && (
          <div className="text-sm">
            <p className="text-lg font-extrabold">{slip.institute?.name}</p>
            <p className="text-xs text-slate-500">{slip.institute?.address}</p>
            <p className="mt-3"><b>{slip.record.employeeName}</b> ({slip.record.employeeId}) · {slip.record.role} · {String(slip.record.payrollMonth).slice(0, 7)}</p>
            <table className="mt-3 w-full"><tbody>
              {[["Basic", slip.record.basicSalary], ["Allowances", slip.record.allowances], ["Deductions", -slip.record.deductions], ["Net pay", slip.record.netPay]].map(([k, v]) => <tr key={k} className="border-b border-slate-100"><td className="py-1">{k}</td><td className="py-1 text-right font-semibold">{money(v)}</td></tr>)}
            </tbody></table>
            {slip.record.details && <p className="mt-2 text-xs text-slate-500">Absent days {slip.record.details.absentDays ?? 0} · advance recovery {money(slip.record.details.advanceCut)} · govt (MPO) portion {money(slip.record.details.govtPortion)}</p>}
            <p className="mt-2"><Badge>{slip.record.status}</Badge></p>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function HrHub({ initialTab = "payroll" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <div>
      <PageHeader title="HR & Payroll" icon={CreditCard} subtitle="Salary structures, payroll, advances, leave types and certificates." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "payroll", label: "Payroll run" }, { key: "structures", label: "Salary structures" }, { key: "advances", label: "Advances & loans" }, { key: "certs", label: "Certificates" }]} />
      {tab === "payroll" && <PayrollRun />}
      {tab === "structures" && <ResourceManager embedded config={CONFIGS.salaryStructures} />}
      {tab === "advances" && <ResourceManager embedded config={CONFIGS.salaryAdvances} />}
      {tab === "certs" && <ResourceManager embedded config={CONFIGS.certificates} />}
    </div>
  );
}

// ================================================================ MADRASA
function HifzEntry() {
  const toast = useToast();
  const [halaqas, setHalaqas] = useState([]);
  const [halaqaId, setHalaqaId] = useState("");
  const [members, setMembers] = useState([]);
  const [students, setStudents] = useState({});
  const [studentId, setStudentId] = useState("");
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({ logType: "Hifz", sabakPara: "", sabakFrom: "", sabakTo: "", sabqi: "", amukhtaPara: "", mistakes: 0, tajweedRating: 4, comment: "", paraCompleted: false });
  useEffect(() => {
    resource("/halaqas").all().then(setHalaqas);
    resource("/students").all({ status: "Active" }).then((rows) => setStudents(Object.fromEntries(rows.map((s) => [s.id, s]))));
  }, []);
  useEffect(() => { if (halaqaId) resource("/halaqa-members").all({ halaqaId }).then(setMembers); }, [halaqaId]);
  const loadSummary = useCallback(() => studentId && http.get(`/ops/madrasa/hifz/${studentId}/summary`).then(setSummary).catch((e) => toast.error(e)), [studentId, toast]);
  useEffect(() => { loadSummary(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
  // Offline hifz entries (v1 QM-13 / NF-38): kept on the device and synced when online.
  const [offlineCount, setOfflineCount] = useState(0);
  useEffect(() => {
    const sync = async () => {
      if (!pendingItems("hifz").length) return;
      const r = await flushItems("hifz", (p) => http.post("/ops/madrasa/hifz/log", p));
      setOfflineCount(r.remaining);
      if (r.synced) toast.success(`${r.synced} offline hifz entr${r.synced === 1 ? "y" : "ies"} synced`);
    };
    setOfflineCount(pendingItems("hifz").length);
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [toast]);
  async function save() {
    const payload = { ...form, logDate: form.logDate || new Date().toISOString().slice(0, 10), studentId, sabakPara: form.sabakPara ? Number(form.sabakPara) : null, mistakes: Number(form.mistakes), tajweedRating: Number(form.tajweedRating) };
    try {
      await http.post("/ops/madrasa/hifz/log", payload);
      toast.success("Saved – guardian can see today's sabak in the portal");
      setForm({ ...form, sabakFrom: "", sabakTo: "", sabqi: "", amukhtaPara: "", mistakes: 0, comment: "", paraCompleted: false });
      loadSummary();
    } catch (e) {
      if (isNetworkError(e)) {
        setOfflineCount(queueItem("hifz", payload));
        toast.success("No connection – entry saved on this device and will sync automatically");
        setForm({ ...form, sabakFrom: "", sabakTo: "", sabqi: "", amukhtaPara: "", mistakes: 0, comment: "", paraCompleted: false });
      } else toast.error(e);
    }
  }
  const colors = { "Not Started": "bg-slate-100 text-slate-400", Ongoing: "bg-amber-100 text-amber-700", Done: "bg-emerald-500 text-white", Revised: "bg-emerald-700 text-white" };
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card title="Daily Hifz / Nazera entry" subtitle={offlineCount ? `${offlineCount} entr${offlineCount === 1 ? "y" : "ies"} waiting to sync (offline)` : "Sabak, Sabqi, Amukhta, mistakes, tajweed, comment (QM-13/14)"}>
        <div className="space-y-3">
          <Field label="Halaqa"><Select value={halaqaId} onChange={(e) => setHalaqaId(e.target.value)} options={halaqas.map((h) => ({ value: h.id, label: h.name }))} placeholder="Select halaqa" /></Field>
          <Field label="Student"><Select value={studentId} onChange={(e) => setStudentId(e.target.value)} options={(halaqaId ? members.map((m) => m.studentId) : Object.keys(students)).map((id) => ({ value: id, label: students[id]?.name ? `${students[id].name} (${id})` : id }))} placeholder="Select student" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type"><Select value={form.logType} onChange={(e) => setForm({ ...form, logType: e.target.value })} options={["Hifz", "Nazera"]} /></Field>
            <Field label="Sabak para (1–30)"><Input type="number" min="1" max="30" value={form.sabakPara} onChange={(e) => setForm({ ...form, sabakPara: e.target.value })} /></Field>
            <Field label="From (page/line)"><Input value={form.sabakFrom} onChange={(e) => setForm({ ...form, sabakFrom: e.target.value })} /></Field>
            <Field label="To (page/line)"><Input value={form.sabakTo} onChange={(e) => setForm({ ...form, sabakTo: e.target.value })} /></Field>
            <Field label="Sabqi (amount)"><Input value={form.sabqi} onChange={(e) => setForm({ ...form, sabqi: e.target.value })} /></Field>
            <Field label="Amukhta (para)"><Input value={form.amukhtaPara} onChange={(e) => setForm({ ...form, amukhtaPara: e.target.value })} /></Field>
            <Field label="Mistakes"><Input type="number" min="0" value={form.mistakes} onChange={(e) => setForm({ ...form, mistakes: e.target.value })} /></Field>
            <Field label="Tajweed (1–5)"><Input type="number" min="1" max="5" value={form.tajweedRating} onChange={(e) => setForm({ ...form, tajweedRating: e.target.value })} /></Field>
          </div>
          <Field label="Ustad comment"><Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald-600" checked={form.paraCompleted} onChange={(e) => setForm({ ...form, paraCompleted: e.target.checked })} /> This para is now memorised (Done)</label>
          <Button icon={Save} disabled={!studentId} onClick={save}>Save entry</Button>
        </div>
      </Card>
      <Card title="Para progress" subtitle={summary ? `${summary.completed}/30 paras (${summary.percentage}%) · last 30 days: ${summary.last30Days?.entries || 0} entries, avg mistakes ${summary.last30Days?.avgMistakes ?? "—"}` : "Select a student"}>
        {!summary ? <EmptyState title="Select a student to see the 30-para progress." icon={Moon} /> : (
          <>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
              {summary.paras.map((p) => <div key={p.paraNo} title={p.status} className={`grid h-12 place-items-center rounded-xl text-sm font-bold ${colors[p.status]}`}>{p.paraNo}</div>)}
            </div>
            <div className="mt-4"><Table dense rows={summary.logs} columns={[{ key: "logDate", label: "Date", render: (l) => formatDate(l.logDate) }, { key: "logType", label: "Type" }, { key: "sabakPara", label: "Para" }, { key: "sabak", label: "Sabak", render: (l) => `${l.sabakFrom || ""}–${l.sabakTo || ""}` }, { key: "sabqi", label: "Sabqi" }, { key: "amukhtaPara", label: "Amukhta" }, { key: "mistakes", label: "Mistakes" }, { key: "tajweedRating", label: "Tajweed" }, { key: "comment", label: "Comment" }]} /></div>
          </>
        )}
      </Card>
    </div>
  );
}

function SalahAttendance() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [wakt, setWakt] = useState("Fajr");
  const [className, setClassName] = useState("");
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [weekly, setWeekly] = useState([]);
  useEffect(() => { resource("/classes").all().then(setClasses); }, []);
  useEffect(() => {
    resource("/students").all({ status: "Active" }).then((rows) => {
      const list = className ? rows.filter((s) => String(s.className || "").startsWith(className)) : rows;
      setStudents(list);
      setMarks(Object.fromEntries(list.map((s) => [s.id, "Jamaat"])));
    });
    http.get("/ops/madrasa/salah/weekly", { className }).then(setWeekly).catch(() => {});
  }, [className]);
  async function save() {
    try { await http.put("/ops/madrasa/salah/bulk", { date, wakt, records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }); toast.success(`${wakt} attendance saved`); } catch (e) { toast.error(e); }
  }
  return (
    <div className="space-y-5">
      <Card title="Salah attendance (5 wakt)" subtitle="Jamaat / alone / missed (QM-06). Guardians see a weekly summary."
        actions={<><Input type="date" className="!h-9 !w-auto" value={date} onChange={(e) => setDate(e.target.value)} /><Select className="!h-9 !w-auto" value={wakt} onChange={(e) => setWakt(e.target.value)} options={["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]} /><Select className="!h-9 !w-auto" value={className} onChange={(e) => setClassName(e.target.value)} options={classes.map((c) => c.name)} placeholder="All classes" /><Button size="sm" icon={Save} onClick={save}>Save</Button></>}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <span className="truncate">{s.name}</span>
              <span className="flex gap-1">{["Jamaat", "Alone", "Missed", "Excused"].map((st) => (
                <button key={st} type="button" onClick={() => setMarks({ ...marks, [s.id]: st })} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${marks[s.id] === st ? (st === "Missed" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white") : "bg-slate-100 text-slate-600"}`}>{st}</button>
              ))}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Last 7 days"><Table dense rows={weekly} rowKey="studentId" columns={[{ key: "name", label: "Student" }, { key: "className", label: "Class" }, { key: "jamaat", label: "Jamaat" }, { key: "alone", label: "Alone" }, { key: "missed", label: "Missed" }, { key: "recorded", label: "of" }]} /></Card>
    </div>
  );
}

export function MadrasaHub({ initialTab = "hifz" }) {
  const [tab, setTab] = useState(initialTab);
  const [report, setReport] = useState([]);
  const [groupBy, setGroupBy] = useState("student");
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { if (tab === "report") http.get("/ops/madrasa/hifz-report", { groupBy }).then(setReport).catch(() => {}); }, [tab, groupBy]);
  return (
    <div>
      <PageHeader title="Madrasa" icon={Moon} subtitle="Halaqa, Hifz & Nazera tracking, Salah attendance, hostel (Darul Iqama), meals (Matbakh) and donation funds." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "hifz", label: "Hifz entry & progress" }, { key: "report", label: "Hifz report" }, { key: "halaqa", label: "Halaqa" }, { key: "salah", label: "Salah" },
        { key: "hostel", label: "Hostel & Meals" }, { key: "donations", label: "Donations" },
      ]} />
      {tab === "hifz" && <HifzEntry />}
      {tab === "report" && (
        <Card title="Hifz report" actions={<Select className="!h-9 !w-auto" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} options={[{ value: "student", label: "Student-wise" }, { value: "halaqa", label: "Halaqa-wise" }, { value: "ustad", label: "Ustad-wise" }]} />}>
          <Table dense rows={report} rowKey={groupBy === "student" ? "studentId" : "name"} columns={groupBy === "student"
            ? [{ key: "name", label: "Student" }, { key: "halaqa", label: "Halaqa" }, { key: "ustad", label: "Ustad" }, { key: "parasDone", label: "Paras" }, { key: "entries30d", label: "Entries (30d)" }, { key: "avgMistakes", label: "Avg mistakes" }]
            : [{ key: "name", label: groupBy === "ustad" ? "Ustad" : "Halaqa" }, { key: "students", label: "Students" }, { key: "parasDone", label: "Total paras" }, { key: "avgParas", label: "Avg paras" }, { key: "entries30d", label: "Entries (30d)" }]} />
        </Card>
      )}
      {tab === "halaqa" && <div className="space-y-5"><ResourceManager embedded config={CONFIGS.halaqas} /><ResourceManager embedded config={CONFIGS.halaqaMembers} /></div>}
      {tab === "salah" && <SalahAttendance />}
      {tab === "hostel" && <div className="space-y-5"><ResourceManager embedded config={CONFIGS.hostelRooms} /><ResourceManager embedded config={CONFIGS.hostelAllocations} /><ResourceManager embedded config={CONFIGS.mealRecords} /></div>}
      {tab === "donations" && <div className="space-y-5"><ResourceManager embedded config={CONFIGS.donations} /><ResourceManager embedded config={CONFIGS.donors} /></div>}
    </div>
  );
}

// ================================================================ TRANSPORT
function LiveBuses() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const load = useCallback(() => http.get("/ops/transport/live").then(setRows).catch((e) => toast.error(e)), [toast]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Card title="Live bus tracking" subtitle="Latest GPS position per vehicle; refreshes every 30 seconds. Trackers post to /api/v1/public/gps.">
      {!rows.length ? <EmptyState title="No vehicles yet." icon={Bus} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => {
            const fresh = v.recordedAt && Date.now() - new Date(v.recordedAt).getTime() < 10 * 60 * 1000;
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><p className="font-bold">{v.registrationNo}</p><Badge tone={fresh ? "green" : "slate"}>{fresh ? "Live" : "Offline"}</Badge></div>
                <p className="text-sm text-slate-500">{v.routeName || "No route"} · {v.driverName || "—"} {v.driverPhone || ""}</p>
                {v.latitude ? (
                  <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600" href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=16/${v.latitude}/${v.longitude}`} target="_blank" rel="noreferrer">
                    <MapPin size={14} /> {Number(v.latitude).toFixed(5)}, {Number(v.longitude).toFixed(5)} · {v.speed ? `${v.speed} km/h` : ""} · {formatDateTime(v.recordedAt)}
                  </a>
                ) : <p className="mt-2 text-sm text-slate-400">No GPS data received.</p>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function TransportHub({ initialTab = "live" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <div>
      <PageHeader title="Transport" icon={Bus} subtitle="School bus management, routes & stops, student assignment with transport fee, and GPS tracking." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "live", label: "Live tracking" }, { key: "vehicles", label: "Vehicles" }, { key: "routes", label: "Routes" }, { key: "assign", label: "Student assignment" }]} />
      {tab === "live" && <LiveBuses />}
      {tab === "vehicles" && <ResourceManager embedded config={CONFIGS.vehicles} />}
      {tab === "routes" && <ResourceManager embedded config={CONFIGS.routes} />}
      {tab === "assign" && <ResourceManager embedded config={CONFIGS.transportAssignments} />}
    </div>
  );
}

// ================================================================ COMMUNICATION
export function Conversations() {
  const toast = useToast();
  const { user } = useUser();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const load = useCallback(() => http.get("/conversations").then(setThreads).catch((e) => toast.error(e)), [toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (active) http.get(`/conversations/${encodeURIComponent(active.threadKey)}`).then(setMessages).catch(() => {}); }, [active]);
  const me = user?.linkedId || user?.id;
  async function send() {
    if (!body.trim() || !active) return;
    const other = active.senderId === me ? { type: active.recipientType, id: active.recipientId } : { type: active.senderType, id: active.senderId };
    try {
      await http.post("/conversations", { recipientType: other.type, recipientId: other.id, studentId: active.studentId, body });
      setBody("");
      setMessages(await http.get(`/conversations/${encodeURIComponent(active.threadKey)}`));
      load();
    } catch (e) { toast.error(e); }
  }
  return (
    <Card title="Guardian–teacher messages" subtitle="Controlled messaging: guardians can only reach their child's teachers (CM-05, COM-04).">
      <div className="grid min-h-[400px] gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-1 border-r border-slate-100 pr-2">
          {!threads.length && <p className="text-sm text-slate-500">No conversations yet.</p>}
          {threads.map((t) => (
            <button key={t.threadKey} type="button" onClick={() => setActive(t)} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${active?.threadKey === t.threadKey ? "bg-blue-50" : "hover:bg-slate-50"}`}>
              <b>{t.senderId === me ? `${t.recipientType} ${t.recipientId}` : t.senderName}</b>{t.unread > 0 && <Badge tone="red">{t.unread}</Badge>}
              <span className="block truncate text-xs text-slate-500">{t.body}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          {!active ? <EmptyState title="Select a conversation." icon={MessageSquare} /> : (
            <>
              <div className="flex-1 space-y-2 overflow-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.senderId === me ? "ml-auto bg-blue-600 text-white" : "bg-slate-100"}`}>
                    {m.body}<span className="mt-0.5 block text-[10px] opacity-70">{formatDateTime(m.createdAt)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2"><Input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message" /><Button icon={Send} onClick={send}>Send</Button></div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CommunicationHub({ initialTab = "logs" }) {
  const [tab, setTab] = useState(initialTab);
  const [stats, setStats] = useState([]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { http.get("/messages/stats").then(setStats).catch(() => {}); }, [tab]);
  const by = (status) => stats.filter((s) => s.status === status).reduce((a, s) => a + s.n, 0);
  return (
    <div>
      <PageHeader title="Communication" icon={MessageSquare} subtitle="Delivery tracking, templates, complaints, parent–teacher meetings and messages." />
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Queued" value={by("Queued")} tone="amber" /><StatCard label="Sent / delivered" value={by("Sent") + by("Delivered") + by("Read")} tone="green" />
        <StatCard label="Failed" value={by("Failed")} tone="red" /><StatCard label="SMS cost (30d)" value={money(stats.filter((s) => s.channel === "SMS").reduce((a, s) => a + Number(s.cost), 0))} tone="blue" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "logs", label: "Delivery log" }, { key: "templates", label: "Templates" }, { key: "messages", label: "Messages" }, { key: "complaints", label: "Complaints" }, { key: "ptm", label: "PTM slots" }]} />
      {tab === "logs" && <ResourceManager embedded config={CONFIGS.messageLogs} />}
      {tab === "templates" && <ResourceManager embedded config={CONFIGS.messageTemplates} />}
      {tab === "messages" && <Conversations />}
      {tab === "complaints" && <ResourceManager embedded config={CONFIGS.complaints} />}
      {tab === "ptm" && <ResourceManager embedded config={CONFIGS.ptmSlots} />}
    </div>
  );
}

export function SimpleTabsPage({ title, subtitle, icon, tabs }) {
  const [tab, setTab] = useState(tabs[0].key);
  const current = useMemo(() => tabs.find((t) => t.key === tab) || tabs[0], [tab, tabs]);
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} icon={icon || ClipboardList} />
      <Tabs value={tab} onChange={setTab} tabs={tabs.map((t) => ({ key: t.key, label: t.label }))} />
      {current.render()}
    </div>
  );
}

