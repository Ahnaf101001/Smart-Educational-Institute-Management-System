"use client";

import { useEffect, useState } from "react";
import { BookOpen, CalendarClock, ClipboardCheck, FileSpreadsheet, LogIn, LogOut, Sun } from "lucide-react";
import { http, portalApi } from "../../lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, StatCard, Table, formatDate, money, useToast } from "../ui/kit";

export default function TeacherPortal({ onNavigate }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = () => portalApi.teacherToday().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function checkin(eventType) {
    const send = (location) => http.post("/devices/self-checkin", { eventType, location }).then((r) => { toast.success(r.message); load(); }).catch((e) => toast.error(e));
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => send({ lat: p.coords.latitude, lng: p.coords.longitude }), () => send(null), { timeout: 5000 });
    else send(null);
  }

  if (error) return <EmptyState title="Teacher portal unavailable" hint={`${error} Ask the administrator to link your login to your teacher profile (Users → Linked profile).`} />;
  if (!data) return <Spinner />;
  const t = data.teacher || {};
  return (
    <div>
      <PageHeader title={`Assalamu alaikum, ${t.name || ""}`} icon={Sun} subtitle={`${t.designation || "Teacher"} · ${data.day}`}
        actions={<><Button variant="success" icon={LogIn} onClick={() => checkin("IN")}>Check in</Button><Button variant="secondary" icon={LogOut} onClick={() => checkin("OUT")}>Check out</Button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes today" value={data.routine.length} icon={CalendarClock} />
        <StatCard label="Attendance pending" value={data.attendancePending.length} icon={ClipboardCheck} tone={data.attendancePending.length ? "amber" : "green"} />
        <StatCard label="Marks pending" value={data.marksPending.length} icon={FileSpreadsheet} tone={data.marksPending.length ? "red" : "green"} />
        <StatCard label="Assigned subjects" value={data.assignments.length} icon={BookOpen} tone="purple" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Today's routine">
          {!data.routine.length ? <EmptyState title="No classes scheduled today." /> : (
            <div className="space-y-2">{data.routine.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div><p className="font-semibold">{r.subjectName || r.label}</p><p className="text-xs text-slate-500">{r.className}-{r.section} · Room {r.roomNo || "—"}</p></div>
                <Badge tone="blue">{r.periodCode}{r.startTime ? ` · ${String(r.startTime).slice(0, 5)}` : ""}</Badge>
              </div>
            ))}</div>
          )}
        </Card>
        <Card title="Action items">
          <div className="space-y-2">
            {data.attendancePending.map((a) => (
              <div key={a.className} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm">
                <span>Take attendance – <b>{a.className}</b></span>
                <Button size="sm" onClick={() => onNavigate?.("Attendance", "Student Attendance")}>Open</Button>
              </div>
            ))}
            {data.marksPending.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3 text-sm">
                <span>Marks: <b>{m.subjectName}</b> – {m.className} ({m.examName}){m.marksEntryEnd ? ` · closes ${formatDate(m.marksEntryEnd)}` : ""}</span>
                <Button size="sm" onClick={() => onNavigate?.("Exams & Results", "Marks Entry")}>Enter</Button>
              </div>
            ))}
            {!data.attendancePending.length && !data.marksPending.length && <EmptyState title="All caught up." />}
          </div>
        </Card>
        <Card title="My classes & subjects">
          <Table dense rows={data.assignments} columns={[{ key: "className", label: "Class" }, { key: "section", label: "Section" }, { key: "subjectName", label: "Subject" }, { key: "roomNo", label: "Room" }]} />
          {data.classTeacherOf.length > 0 && <p className="mt-2 text-sm text-slate-600">Class teacher of: <b>{data.classTeacherOf.map((c) => c.name).join(", ")}</b></p>}
        </Card>
        <Card title="My attendance (30 days)">
          <Table dense rows={data.ownAttendance} rowKey="attendanceDate" columns={[{ key: "attendanceDate", label: "Date", render: (r) => formatDate(r.attendanceDate) }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> }, { key: "inTime", label: "In", render: (r) => (r.inTime ? new Date(r.inTime).toLocaleTimeString() : "—") }, { key: "outTime", label: "Out", render: (r) => (r.outTime ? new Date(r.outTime).toLocaleTimeString() : "—") }]} />
        </Card>
        <Card title="My leave requests" actions={<Button size="sm" variant="secondary" onClick={() => onNavigate?.("Attendance", "Leave Requests")}>Apply</Button>}>
          <Table dense rows={data.leaves} columns={[{ key: "leaveType", label: "Type" }, { key: "fromDate", label: "From", render: (r) => formatDate(r.fromDate) }, { key: "toDate", label: "To", render: (r) => formatDate(r.toDate) }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> }]} />
        </Card>
        <Card title="My payslips">
          <Table dense rows={data.payslips} columns={[{ key: "payrollMonth", label: "Month", render: (r) => String(r.payrollMonth).slice(0, 7) }, { key: "netPay", label: "Net pay", render: (r) => money(r.netPay) }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> }]} />
        </Card>
      </div>
    </div>
  );
}
