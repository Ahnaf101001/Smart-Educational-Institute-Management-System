"use client";

// Fees overview built from live data: student dues (/fees/dues), monthly and per-method
// collection (/fees/reports/collection) and the latest receipts (/fees/payments).
// It previously showed fixed sample figures that did not come from the database.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDollarSign, Clock, RefreshCw } from "lucide-react";
import { http } from "../lib/api";
import { Badge, Button, Card, EmptyState, Spinner, StatCard, formatDate, money, thisMonth, today, useToast } from "./ui/kit";

const MONTHS = 6;

function monthStart(offset) {
  const [y, m] = thisMonth().split("-").map(Number);
  const d = new Date(y, m - 1 - offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

export default function FeesOverview() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, dues: [], monthly: [], methods: [], payments: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const from = `${monthStart(MONTHS - 1)}-01`;
      const [dues, monthly, methods, payments] = await Promise.all([
        http.get("/fees/dues"),
        http.get(`/fees/reports/collection?groupBy=month&from=${from}&to=${today()}`),
        http.get(`/fees/reports/collection?groupBy=method&from=${thisMonth()}-01&to=${today()}`),
        http.get(`/fees/payments?from=${from}`),
      ]);
      setState({ loading: false, dues: dues || [], monthly: monthly?.rows || [], methods: methods?.rows || [], payments: payments || [] });
    } catch (e) {
      toast.error(e);
      setState((s) => ({ ...s, loading: false }));
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const t = { billed: 0, paid: 0, due: 0, overdue: 0, dueStudents: 0, overdueStudents: 0 };
    for (const r of state.dues) {
      t.billed += Number(r.totalFee || 0);
      t.paid += Number(r.paid || 0);
      t.due += Number(r.due || 0);
      if (Number(r.due) > 0) t.dueStudents += 1;
      if (r.status === "Overdue") { t.overdue += Number(r.due || 0); t.overdueStudents += 1; }
    }
    return t;
  }, [state.dues]);

  const byClass = useMemo(() => {
    const map = new Map();
    for (const r of state.dues) {
      const key = r.className || "No class";
      const row = map.get(key) || { className: key, billed: 0, paid: 0, due: 0, students: 0 };
      row.billed += Number(r.totalFee || 0);
      row.paid += Number(r.paid || 0);
      row.due += Number(r.due || 0);
      row.students += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
  }, [state.dues]);

  const months = useMemo(() => {
    const totalsByMonth = Object.fromEntries(state.monthly.map((r) => [r.label, Number(r.total || 0)]));
    return Array.from({ length: MONTHS }, (_, i) => {
      const ym = monthStart(MONTHS - 1 - i);
      return { ym, label: monthLabel(ym), total: totalsByMonth[ym] || 0 };
    });
  }, [state.monthly]);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const methodTotal = state.methods.reduce((s, r) => s + Number(r.total || 0), 0);
  const recent = state.payments.slice(0, 8);
  const rate = totals.billed > 0 ? Math.round((totals.paid / totals.billed) * 100) : 0;

  if (state.loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Fees overview</h2>
          <p className="text-sm text-slate-500">Active students only · amounts include late fines and discounts</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total billed" value={money(totals.billed)} hint={`${plural(state.dues.length, "active student")}`} icon={CircleDollarSign} tone="blue" />
        <StatCard label="Collected" value={money(totals.paid)} hint={`${rate}% of billed`} icon={CheckCircle2} tone="green" />
        <StatCard label="Due" value={money(totals.due)} hint={plural(totals.dueStudents, "student")} icon={Clock} tone="amber" />
        <StatCard label="Overdue" value={money(totals.overdue)} hint={`${plural(totals.overdueStudents, "student")} past due date`} icon={AlertCircle} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Monthly collection" subtitle={`Last ${MONTHS} months · valid receipts`}>
          {months.every((m) => m.total === 0) ? <EmptyState title="No fees collected in this period yet." /> : (
            <div className="flex h-56 items-end gap-3">
              {months.map((m) => (
                <div key={m.ym} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.label}: ${money(m.total)}`}>
                  <span className="text-[11px] font-semibold text-slate-500">{m.total ? money(m.total) : ""}</span>
                  <div className="w-full max-w-12 rounded-t bg-blue-600" style={{ height: `${Math.max(2, (m.total / maxMonth) * 85)}%` }} />
                  <span className="text-xs font-semibold text-slate-500">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="This month by payment method" subtitle={money(methodTotal)}>
          {!state.methods.length ? <EmptyState title="No payments this month yet." /> : (
            <div className="space-y-3">
              {state.methods.map((r) => {
                const pct = methodTotal ? Math.round((Number(r.total) / methodTotal) * 100) : 0;
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700">{r.label || "Other"}</span><span className="text-slate-500">{money(r.total)} · {pct}%</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Class-wise collection">
          {!byClass.length ? <EmptyState title="No active students yet." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Class</th><th className="pb-3 text-right">Collected</th><th className="pb-3 text-right">Due</th><th className="pb-3 pl-6">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {byClass.map((row) => {
                    const pct = row.billed > 0 ? Math.round((row.paid / row.billed) * 100) : 0;
                    return (
                      <tr key={row.className}>
                        <td className="py-3 font-bold text-slate-700">{row.className}<span className="ml-1 text-xs font-medium text-slate-400">({row.students})</span></td>
                        <td className="py-3 text-right font-bold text-emerald-600">{money(row.paid)}</td>
                        <td className="py-3 text-right font-bold text-orange-500">{money(row.due)}</td>
                        <td className="py-3 pl-6">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
                            <span className="w-9 text-right text-xs font-bold text-slate-600">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent receipts">
          {!recent.length ? <EmptyState title="No receipts yet." /> : (
            <div className="space-y-4">
              {recent.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{p.studentName}</p>
                    <p className="truncate text-xs text-slate-400">{[p.receiptNo, p.className, p.paymentMethod].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-slate-800">{money(p.amount)}</p>
                    <p className="text-xs text-slate-400">{formatDate(p.paidAt)} {p.status !== "Valid" && <Badge>{p.status}</Badge>}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
