"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon && <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon size={22} /></span>}
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Button({ variant = "primary", size = "md", loading, icon: Icon, children, className, ...props }) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "text-slate-600 hover:bg-slate-100",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
  };
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-sm" };
  return (
    <button
      type="button"
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60", styles[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className, bodyClass }) {
  return (
    <section className={cx("dashboard-panel", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-700", red: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700", slate: "bg-slate-100 text-slate-700", purple: "bg-purple-50 text-purple-700",
  indigo: "bg-indigo-50 text-indigo-700",
};
const STATUS_TONES = {
  Active: "green", Approved: "green", Paid: "green", Present: "green", Published: "green", Pass: "green", Valid: "green",
  Processed: "green", Delivered: "green", Sent: "green", Success: "green", Ready: "blue", Printed: "green", Admitted: "green",
  Selected: "green", Resolved: "green", Done: "green", Jamaat: "green", Returned: "green", Completed: "green", Closed: "slate",
  Pending: "amber", Due: "amber", Late: "amber", Queued: "amber", Draft: "slate", Partial: "amber", Processing: "blue",
  "Under Review": "amber", Submitted: "blue", Shortlisted: "blue", Waiting: "amber", Clarification: "amber", Open: "amber",
  "Pending Approval": "amber", Reviewed: "blue", "Marks Entry": "blue", Ongoing: "blue", Issued: "blue", "In Progress": "blue",
  Rejected: "red", Failed: "red", Overdue: "red", Absent: "red", Fail: "red", Blocked: "red", Cancelled: "slate", Missed: "red",
  Inactive: "slate", Archived: "slate", Expired: "slate", Replaced: "slate", Leave: "purple", Locked: "slate", Unmatched: "red",
  Lost: "red", Transferred: "slate", Dropped: "red", "Passed Out": "indigo",
};

export function Badge({ children, tone }) {
  const t = tone || STATUS_TONES[children] || "slate";
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", TONES[t])}>{children}</span>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "blue" }) {
  return (
    <div className="dashboard-panel flex items-center gap-4 p-4">
      {Icon && <span className={cx("grid size-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}><Icon size={22} /></span>}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-extrabold text-slate-900">{value}</p>
        {hint && <p className="truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => {
        const key = typeof t === "string" ? t : t.key;
        const label = typeof t === "string" ? t : t.label;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cx("whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition", value === key ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-100")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, width = "max-w-2xl" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx("w-full rounded-2xl bg-white shadow-2xl", width)} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, required, hint, error, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1 block text-xs font-semibold text-slate-600">{label}{required && <span className="text-rose-500"> *</span>}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function Input(props) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}
export function Select({ options = [], placeholder, ...props }) {
  return (
    <select {...props} className={cx(inputClass, props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const value = typeof o === "object" ? o.value : o;
        const label = typeof o === "object" ? o.label : o;
        return <option key={String(value)} value={value}>{label}</option>;
      })}
    </select>
  );
}
export function Textarea(props) {
  return <textarea rows={3} {...props} className={cx("w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100", props.className)} />;
}

export function EmptyState({ title = "No records found.", hint, icon: Icon = Info }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <Icon className="text-slate-400" size={28} />
      <p className="mt-2 text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{label}</div>;
}

export function Table({ columns, rows, empty, rowKey = "id", onRowClick, dense }) {
  if (!rows?.length) return <EmptyState title={empty || "No records found."} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c.key || c.label} className={cx("px-4 py-3 font-semibold", c.className)}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r[rowKey] ?? i} className={cx("bg-white", onRowClick && "cursor-pointer hover:bg-blue-50/40")} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key || c.label} className={cx(dense ? "px-3 py-2" : "px-4 py-3", "align-middle text-slate-700", c.cellClass)}>
                  {c.render ? c.render(r) : r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ toasts
const ToastContext = createContext({ push: () => {} });
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems((cur) => [...cur, { id, message, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[340px] max-w-[90vw] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl", t.tone === "error" ? "bg-rose-600 text-white" : t.tone === "warning" ? "bg-amber-500 text-white" : "bg-slate-900 text-white")}>
            {t.tone === "error" || t.tone === "warning" ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
            <span className="break-words">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const { push } = useContext(ToastContext);
  return {
    success: (m) => push(m, "success"),
    error: (m) => push(m?.message || String(m), "error"),
    warning: (m) => push(m, "warning"),
  };
}

// Prompt dialog for reasons (maker–checker requires reasons for many actions).
export function usePrompt() {
  const [state, setState] = useState(null);
  const ask = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve, value: opts.defaultValue || "" })), []);
  const dialog = state ? (
    <Modal
      open
      title={state.title || "Please confirm"}
      onClose={() => { state.resolve(null); setState(null); }}
      width="max-w-md"
      footer={(
        <>
          <Button variant="secondary" onClick={() => { state.resolve(null); setState(null); }}>Cancel</Button>
          <Button
            variant={state.danger ? "danger" : "primary"}
            disabled={state.required !== false && state.input !== false && !String(state.value).trim()}
            onClick={() => { state.resolve(state.input === false ? true : state.value); setState(null); }}
          >
            {state.confirmLabel || "Confirm"}
          </Button>
        </>
      )}
    >
      {state.message && <p className="mb-3 text-sm text-slate-600">{state.message}</p>}
      {state.input !== false && (
        <Textarea autoFocus placeholder={state.placeholder || "Reason"} value={state.value} onChange={(e) => setState((s) => ({ ...s, value: e.target.value }))} />
      )}
    </Modal>
  ) : null;
  return { ask, dialog };
}

// ------------------------------------------------------------------ export helpers
export function downloadBlob(content, fileName, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportRows(format, { title, columns, rows }) {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => {
    const v = c.exportValue ? c.exportValue(r) : r[c.key];
    return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  }));
  const safe = String(title || "export").replace(/[^\w-]+/g, "_");
  if (format === "csv") {
    const csv = [header, ...body].map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(`﻿${csv}`, `${safe}.csv`, "text/csv;charset=utf-8");
  } else if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${safe}.xlsx`);
  } else if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: header.length > 6 ? "landscape" : "portrait" });
    doc.setFontSize(13);
    doc.text(title || "Report", 14, 14);
    doc.setFontSize(8);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 19);
    autoTable(doc, { head: [header], body, startY: 23, styles: { fontSize: 8 }, headStyles: { fillColor: [34, 63, 145] } });
    doc.save(`${safe}.pdf`);
  }
  // Export / print / bulk download actions are audit-logged (NFX-10).
  import("../../lib/api")
    .then(({ request }) => request("/x/audit/export", { method: "POST", body: JSON.stringify({ resource: title || "export", format, count: rows.length }) }))
    .catch(() => {});
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function money(value) {
  return `৳${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
export function today() {
  return new Date().toISOString().slice(0, 10);
}
