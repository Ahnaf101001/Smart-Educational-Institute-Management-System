"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Edit3, FileSpreadsheet, FileText, Plus, Printer, RefreshCw, Search, Trash2 } from "lucide-react";
import { resource } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea,
  exportRows, formatDate, formatDateTime, money, useToast, usePrompt, cx,
} from "./kit";

const PAGE_SIZE = 25;

function useLookups(fields, filters) {
  const [lookups, setLookups] = useState({});
  const sources = useMemo(() => {
    const map = new Map();
    for (const f of [...(fields || []), ...(filters || [])]) {
      if (f.relation && !map.has(f.relation.endpoint + JSON.stringify(f.relation.params || {}))) {
        map.set(f.relation.endpoint + JSON.stringify(f.relation.params || {}), f.relation);
      }
    }
    return [...map.entries()];
  }, [fields, filters]);

  useEffect(() => {
    let alive = true;
    Promise.all(sources.map(([key, rel]) => resource(rel.endpoint).all(rel.params || {}).then((rows) => [key, rows]).catch(() => [key, []])))
      .then((entries) => alive && setLookups(Object.fromEntries(entries)));
    return () => { alive = false; };
  }, [sources]);

  const optionsFor = useCallback((f) => {
    const rows = lookups[f.relation.endpoint + JSON.stringify(f.relation.params || {})] || [];
    return rows.map((r) => ({ value: r[f.relation.value || "id"], label: f.relation.label ? f.relation.label(r) : r.name || r.title || r.id }));
  }, [lookups]);

  const labelFor = useCallback((f, value) => {
    if (value === null || value === undefined || value === "") return "—";
    const opt = optionsFor(f).find((o) => String(o.value) === String(value));
    return opt ? opt.label : value;
  }, [optionsFor]);

  return { optionsFor, labelFor };
}

export function renderValue(type, value) {
  if (value === null || value === undefined || value === "") return "—";
  switch (type) {
    case "date": return formatDate(value);
    case "datetime": return formatDateTime(value);
    case "money": return money(value);
    case "checkbox":
    case "boolean": return value ? "Yes" : "No";
    case "badge": return <Badge>{String(value)}</Badge>;
    case "json":
    case "list": return Array.isArray(value) ? value.map((v) => (typeof v === "object" ? v.name || JSON.stringify(v) : v)).join(", ") : JSON.stringify(value);
    case "link": return <a className="font-semibold text-blue-600 hover:underline" href={value} target="_blank" rel="noreferrer">Open</a>;
    default: return String(value);
  }
}

function FormField({ field, value, onChange, optionsFor, form }) {
  if (field.showIf && !field.showIf(form)) return null;
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value), required: field.required, placeholder: field.placeholder };
  let control;
  switch (field.type) {
    case "select":
      control = <Select {...common} options={field.options || []} placeholder={field.required ? "Select…" : "—"} />;
      break;
    case "relation":
      control = <Select {...common} options={optionsFor(field)} placeholder={field.required ? "Select…" : "—"} />;
      break;
    case "multirelation": {
      const current = Array.isArray(value) ? value : [];
      control = (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {optionsFor(field).map((o) => {
            const on = current.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => onChange(on ? current.filter((v) => v !== o.value) : [...current, o.value])}
                className={cx("rounded-lg px-2 py-1 text-xs font-semibold", on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                {o.label}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "textarea":
      control = <Textarea {...common} />;
      break;
    case "checkbox":
      control = (
        <span className="flex h-10 items-center gap-2">
          <input type="checkbox" className="size-4 accent-blue-600" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-slate-600">{field.checkboxLabel || "Yes"}</span>
        </span>
      );
      break;
    case "list":
      control = <Input {...common} value={Array.isArray(value) ? value.join(", ") : value ?? ""} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder={field.placeholder || "Comma separated"} />;
      break;
    case "json":
      control = <Textarea value={typeof value === "string" ? value : JSON.stringify(value ?? field.default ?? [], null, 2)} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" rows={5} />;
      break;
    case "number":
    case "money":
      control = <Input type="number" step="any" {...common} />;
      break;
    case "date":
      control = <Input type="date" {...common} value={value ? String(value).slice(0, 10) : ""} />;
      break;
    case "datetime":
      control = <Input type="datetime-local" {...common} value={value ? String(value).slice(0, 16) : ""} />;
      break;
    case "time":
      control = <Input type="time" {...common} />;
      break;
    default:
      control = <Input type={field.inputType || "text"} {...common} />;
  }
  return <Field label={field.label} required={field.required} hint={field.hint} className={field.wide ? "sm:col-span-2" : ""}>{control}</Field>;
}

export default function ResourceManager({ config, embedded = false, fixedFilters = {}, onChanged }) {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const api = useMemo(() => resource(config.endpoint), [config.endpoint]);
  const { optionsFor, labelFor } = useLookups(config.fields, config.filters);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const module = config.module;
  const allowCreate = config.create !== false && can(user, module, "create");
  const allowEdit = config.edit !== false && can(user, module, "edit");
  const allowDelete = config.delete !== false && can(user, module, "delete");
  const fixedKey = JSON.stringify(fixedFilters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list({ page, limit: PAGE_SIZE, search, ...filters, ...JSON.parse(fixedKey) });
      setRows(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, page, search, filters, fixedKey]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    const defaults = {};
    for (const f of config.fields || []) if (f.default !== undefined) defaults[f.key] = typeof f.default === "function" ? f.default() : f.default;
    setForm({ ...defaults, ...(config.defaults || {}), ...JSON.parse(fixedKey) });
    setEditing("new");
  }
  function openEdit(row) {
    setForm({ ...row });
    setEditing(row);
  }

  async function save() {
    const payload = {};
    for (const f of config.fields || []) {
      if (f.showIf && !f.showIf(form)) continue;
      if (f.readOnlyOnEdit && editing !== "new") continue;
      let v = form[f.key];
      if (f.type === "json" && typeof v === "string") {
        try { v = v.trim() ? JSON.parse(v) : (f.default ?? []); } catch { toast.error(`${f.label}: invalid JSON`); return; }
      }
      if ((f.type === "number" || f.type === "money") && v !== "" && v !== undefined && v !== null) v = Number(v);
      if (v === "" && !f.required) v = null;
      if (v !== undefined) payload[f.key] = v;
    }
    Object.assign(payload, fixedFilters);
    const missing = (config.fields || []).filter((f) => f.required && (!f.showIf || f.showIf(form)) && (payload[f.key] === null || payload[f.key] === undefined || payload[f.key] === ""));
    if (missing.length) { toast.error(`Required: ${missing.map((m) => m.label).join(", ")}`); return; }
    const finalPayload = config.transform ? config.transform(payload, editing) : payload;
    setSaving(true);
    try {
      if (editing === "new") await (config.createFn ? config.createFn(finalPayload) : api.create(finalPayload));
      else await api.update(editing.id, finalPayload);
      toast.success(editing === "new" ? `${config.singular || "Record"} created` : "Changes saved");
      setEditing(null);
      load();
      onChanged?.();
    } catch (err) {
      const detail = err.details?.missing ? ` (${err.details.missing.join(", ")})` : "";
      toast.error(`${err.message}${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row) {
    const ok = await ask({ title: `${config.deleteLabel || "Delete"} ${config.singular || "record"}?`, message: config.deleteMessage || "This action is recorded in the audit log.", input: false, danger: true, confirmLabel: config.deleteLabel || "Delete" });
    if (!ok) return;
    try {
      await api.remove(row.id);
      toast.success(`${config.singular || "Record"} ${config.deleteLabel ? "updated" : "removed"}`);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err);
    }
  }

  const columns = config.columns.map((c) => {
    const field = (config.fields || []).find((f) => f.key === c.key);
    return {
      ...c,
      cell: (r) => {
        if (c.render) return c.render(r, { labelFor, optionsFor });
        if (field?.type === "relation") return labelFor(field, r[c.key]);
        if (field?.type === "multirelation") return (r[c.key] || []).map((v) => labelFor(field, v)).join(", ") || "—";
        return renderValue(c.type || field?.type, r[c.key]);
      },
      exportValue: (r) => {
        if (c.exportValue) return c.exportValue(r);
        if (field?.type === "relation") return labelFor(field, r[c.key]);
        const v = r[c.key];
        return Array.isArray(v) ? v.map((x) => (typeof x === "object" ? x.name || JSON.stringify(x) : x)).join("; ") : v;
      },
    };
  });

  async function doExport(format) {
    try {
      const all = await api.all({ search, ...filters, ...fixedFilters });
      await exportRows(format, { title: config.title, columns, rows: all });
    } catch (err) {
      toast.error(err);
    }
  }

  const canExport = can(user, module, "export") || can(user, module, "view");
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ctx = { reload: load, toast, ask, user };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
        <Search size={16} className="text-slate-400" />
        <input className="w-full bg-transparent text-sm outline-none" placeholder={`Search ${config.title.toLowerCase()}…`} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
      </label>
      {(config.filters || []).map((f) => (
        <Select
          key={f.key}
          className="!h-10 !w-auto min-w-[150px]"
          value={filters[f.key] || ""}
          onChange={(e) => { setPage(1); setFilters((cur) => ({ ...cur, [f.key]: e.target.value })); }}
          options={f.relation ? optionsFor(f) : f.options || []}
          placeholder={`All ${f.label}`}
        />
      ))}
      <Button variant="secondary" icon={RefreshCw} onClick={load} title="Refresh" />
      {canExport && (
        <div className="flex gap-1">
          <Button variant="secondary" size="md" icon={Download} onClick={() => doExport("csv")} title="CSV">CSV</Button>
          <Button variant="secondary" size="md" icon={FileSpreadsheet} onClick={() => doExport("xlsx")} title="Excel">Excel</Button>
          <Button variant="secondary" size="md" icon={FileText} onClick={() => doExport("pdf")} title="PDF">PDF</Button>
          <Button variant="secondary" size="md" icon={Printer} onClick={() => window.print()} title="Print" />
        </div>
      )}
    </div>
  );

  const body = (
    <>
      {toolbar}
      <div className="mt-4">
        {loading ? <Spinner /> : !rows.length ? <EmptyState title={config.emptyTitle || "No records found."} hint={config.emptyHint} /> : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((c) => <th key={c.key || c.label} className="px-4 py-3 font-semibold">{c.label}</th>)}
                  <th className="px-4 py-3 text-right font-semibold print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="bg-white hover:bg-slate-50/60">
                    {columns.map((c) => <td key={c.key || c.label} className={cx("px-4 py-3 align-middle text-slate-700", c.cellClass)}>{c.cell(r)}</td>)}
                    <td className="px-4 py-3 text-right print:hidden">
                      <div className="flex justify-end gap-1">
                        {(config.rowActions ? config.rowActions(r, ctx) : []).filter((a) => a && a.show !== false).map((a) => (
                          <Button key={a.label} size="sm" variant={a.variant || "secondary"} icon={a.icon} onClick={() => a.onClick(r, ctx)} title={a.label}>{a.compact ? null : a.label}</Button>
                        ))}
                        {allowEdit && (!config.canEditRow || config.canEditRow(r)) && <Button size="sm" variant="ghost" icon={Edit3} onClick={() => openEdit(r)} title="Edit" />}
                        {allowDelete && (!config.canDeleteRow || config.canDeleteRow(r)) && <Button size="sm" variant="ghost" icon={Trash2} className="text-rose-600" onClick={() => removeRow(r)} title={config.deleteLabel || "Delete"} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
            <span>{page} / {pages}</span>
            <Button size="sm" variant="secondary" icon={ChevronRight} disabled={page >= pages} onClick={() => setPage((p) => p + 1)} />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={config.title}
          subtitle={config.subtitle}
          icon={config.icon}
          actions={(
            <>
              {config.headerActions?.(ctx)}
              {allowCreate && <Button icon={Plus} onClick={openCreate}>{config.createLabel || `Add ${config.singular || ""}`}</Button>}
            </>
          )}
        />
      )}
      {embedded ? (
        <Card title={config.title} subtitle={config.subtitle} actions={(
          <>
            {config.headerActions?.(ctx)}
            {allowCreate && <Button size="sm" icon={Plus} onClick={openCreate}>{config.createLabel || `Add ${config.singular || ""}`}</Button>}
          </>
        )}>{body}</Card>
      ) : <Card>{body}</Card>}

      <Modal
        open={Boolean(editing)}
        title={editing === "new" ? (config.createLabel || `Add ${config.singular || "record"}`) : `Edit ${config.singular || "record"}`}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={saving} onClick={save}>Save</Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(config.fields || []).filter((f) => !(f.readOnlyOnEdit && editing !== "new")).filter((f) => !Object.prototype.hasOwnProperty.call(fixedFilters, f.key)).map((f) => (
            <FormField key={f.key} field={f} value={form[f.key]} form={form} optionsFor={optionsFor} onChange={(v) => setForm((cur) => ({ ...cur, [f.key]: v }))} />
          ))}
        </div>
        {config.formNote && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-700">{config.formNote}</p>}
      </Modal>
      {dialog}
    </div>
  );
}
