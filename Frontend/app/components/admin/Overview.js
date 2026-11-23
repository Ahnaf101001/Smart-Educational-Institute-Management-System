"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, BookOpenCheck, ClipboardCheck, CreditCard, GraduationCap, IdCard, Package, UserPlus, Users, Wallet } from "lucide-react";
import { http } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Badge, Card, EmptyState, PageHeader, Spinner, StatCard, Table, Tabs, formatDate, money } from "../ui/kit";
import QuickActions from "../ui/QuickActions";

// Each column is full height with the bar anchored at the bottom, so percentage heights have a
// reference (previously the bars collapsed to their 3 px minimum). Labels thin out on long series.
function Bars({ data, valueKey, labelKey, color = "bg-blue-500", format = (v) => v, max }) {
  const top = max || Math.max(1, ...data.map((d) => Number(d[valueKey] || 0)));
  const every = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div className="flex h-48 items-stretch gap-0.5 sm:gap-1.5">
      {data.map((d, i) => (
        <div key={d[labelKey]} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d[labelKey]}: ${format(d[valueKey])}`}>
          <div className="flex w-full flex-1 items-end">
            <div className={`w-full rounded-t-md ${color}`} style={{ height: `${Math.min(100, (Number(d[valueKey] || 0) / top) * 100)}%`, minHeight: Number(d[valueKey]) ? 3 : 0 }} />
          </div>
          <span className={`h-3 w-full truncate text-center text-[10px] leading-3 text-slate-500 ${i % every ? "invisible" : ""}`}>{String(d[labelKey]).slice(-5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview({ onNavigate, initialTab = "overview" }) {
  const { user } = useUser();
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  useEffect(() => { http.get("/dashboard/overview").then(setData).catch(() => setData({})); }, []);
  useEffect(() => { if (tab === "analytics") http.get("/dashboard/analytics").then(setAnalytics).catch(() => setAnalytics({ error: true })); }, [tab]);
  if (!data) return <Spinner />;
  const c = data.counts || {};
  const att = data.attendanceToday || {};
  const pending = (data.pendingApprovals || []).reduce((s, r) => s + r.n, 0);

  return (
    <div>
      <PageHeader title="Institution overview" icon={BarChart3} subtitle={`Today at a glance for ${user?.name || ""}`} />
      {can(user, "reports", "view") && <Tabs value={tab} onChange={setTab} tabs={[{ key: "overview", label: "Today" }, { key: "analytics", label: "Advanced analytics" }]} />}
      {tab === "overview" ? (
        <div className="space-y-5">
          <QuickActions onNavigate={onNavigate} badges={{ Approvals: pending }} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active students" value={c.students ?? 0} hint={`${c.classes ?? 0} classes · ${c.guardians ?? 0} guardians`} icon={GraduationCap} />
            <StatCard label="Teachers & staff" value={(c.teachers ?? 0) + (c.staff ?? 0)} hint={`${data.staffToday?.present ?? 0} present today`} icon={Users} tone="purple" />
            <StatCard label="Attendance today" value={att.marked ? `${Math.round((att.present / att.marked) * 100)}%` : "Not taken"} hint={`${att.absent || 0} absent · ${att.late || 0} late`} icon={ClipboardCheck} tone="green" />
            <StatCard label="Pending approvals" value={pending} hint="Click Approvals to act" icon={AlertTriangle} tone={pending ? "amber" : "green"} />
          </div>
          {data.fees && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Collected today" value={money(data.fees.todayCollection)} icon={Wallet} tone="green" />
              <StatCard label="This month" value={money(data.fees.monthCollection)} icon={CreditCard} tone="blue" />
              <StatCard label="Total due" value={money(data.fees.totalDue)} icon={AlertTriangle} tone="red" />
              <StatCard label="Expense today" value={money(data.fees.todayExpense)} hint={`${data.fees.closingsToday} cash closing(s) · ${data.fees.pendingOnline} online pending`} icon={Wallet} tone="amber" />
            </div>
          )}
          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Attendance trend (30 days)" className="xl:col-span-2">
              {data.attendanceTrend?.length ? <Bars data={data.attendanceTrend} valueKey="rate" labelKey="date" color="bg-emerald-500" max={100} format={(v) => `${v}%`} /> : <EmptyState title="No attendance recorded yet." />}
            </Card>
            <Card title="Needs attention">
              <div className="space-y-2 text-sm">
                {(data.pendingApprovals || []).map((p) => <button key={p.requestType} type="button" onClick={() => onNavigate?.("Approvals")} className="flex w-full justify-between rounded-lg bg-amber-50 px-3 py-2"><span>{p.requestType.replace(/_/g, " ")}</span><b>{p.n}</b></button>)}
                {data.idCards?.studentsWithoutCard > 0 && <button type="button" onClick={() => onNavigate?.("ID Card Center", "Generate & Print")} className="flex w-full items-center justify-between rounded-lg bg-indigo-50 px-3 py-2"><span className="flex items-center gap-2"><IdCard size={14} /> Students without ID card</span><b>{data.idCards.studentsWithoutCard}</b></button>}
                {data.lowStock > 0 && <div className="flex justify-between rounded-lg bg-rose-50 px-3 py-2"><span className="flex items-center gap-2"><Package size={14} /> Low-stock items</span><b>{data.lowStock}</b></div>}
                {data.messages?.failed > 0 && <div className="flex justify-between rounded-lg bg-rose-50 px-3 py-2"><span>Failed messages (7d)</span><b>{data.messages.failed}</b></div>}
                {data.messages?.queued > 0 && <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span>Messages queued</span><b>{data.messages.queued}</b></div>}
              </div>
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            {data.admission && (
              <Card title="Admission" actions={<UserPlus size={18} className="text-blue-500" />}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>Applications <b>{data.admission.applications}</b></p><p>Pending review <b>{data.admission.pending}</b></p>
                  <p>Shortlisted <b>{data.admission.shortlisted}</b></p><p>Selected <b>{data.admission.selected}</b></p>
                  <p>Admitted <b>{data.admission.admitted}</b></p><p>Published seats <b>{data.admission.seats}</b></p>
                </div>
              </Card>
            )}
            {data.exams && (
              <Card title="Exams & results" actions={<BookOpenCheck size={18} className="text-purple-500" />}>
                <div className="space-y-2">{data.exams.map((e) => (
                  <div key={e.id} className="text-sm"><div className="flex justify-between"><b>{e.name}</b><Badge>{e.resultStatus}</Badge></div>
                    {e.total > 0 && <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-purple-500" style={{ width: `${(e.submitted / e.total) * 100}%` }} /></div>}
                    <p className="text-xs text-slate-500">{e.submitted}/{e.total} subjects submitted{e.marksEntryEnd ? ` · closes ${formatDate(e.marksEntryEnd)}` : ""}</p></div>
                ))}</div>
              </Card>
            )}
            <Card title="Latest notices">
              {!data.notices?.length ? <EmptyState title="No notices." /> : <div className="space-y-2">{data.notices.map((n) => <div key={n.id} className="flex justify-between text-sm"><span>{n.title}</span>{n.priority === "Emergency" ? <Badge tone="red">Emergency</Badge> : <span className="text-xs text-slate-500">{formatDate(n.createdAt)}</span>}</div>)}</div>}
            </Card>
          </div>
        </div>
      ) : !analytics ? <Spinner /> : analytics.error ? <EmptyState title="Analytics requires report access." /> : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Fee collection trend (12 months)" subtitle={`Forecast next month ≈ ${money(analytics.collectionForecastNextMonth)} (3-month average)`}>
              {analytics.collectionTrend.length ? <Bars data={analytics.collectionTrend} valueKey="collected" labelKey="month" format={money} /> : <EmptyState title="No collections yet." />}
            </Card>
            <Card title="Admissions trend">
              {analytics.admissionsTrend.length ? <Bars data={analytics.admissionsTrend} valueKey="applications" labelKey="month" color="bg-sky-500" /> : <EmptyState title="No applications yet." />}
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Class performance"><Table dense rows={analytics.classPerformance} rowKey="className" columns={[{ key: "className", label: "Class" }, { key: "students", label: "Results" }, { key: "avgGpa", label: "Avg GPA" }, { key: "passRate", label: "Pass %" }]} /></Card>
            <Card title="Dropout-risk watch list" subtitle="Low attendance (<75%), unpaid dues and failed results combined into a risk score">
              <Table dense rows={analytics.dropoutRisk} columns={[{ key: "name", label: "Student" }, { key: "className", label: "Class" }, { key: "attendanceRate", label: "Att. %" }, { key: "due", label: "Due", render: (r) => money(r.due) }, { key: "lastResult", label: "Result" }, { key: "riskScore", label: "Risk", render: (r) => <Badge tone={r.riskScore >= 80 ? "red" : "amber"}>{r.riskScore}</Badge> }]} />
            </Card>
          </div>
          <Card title="Gender distribution"><div className="flex gap-4">{analytics.genderDistribution.map((g) => <div key={g.gender} className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xl font-extrabold">{g.n}</p><p className="text-xs text-slate-500">{g.gender}</p></div>)}</div></Card>
        </div>
      )}
    </div>
  );
}
