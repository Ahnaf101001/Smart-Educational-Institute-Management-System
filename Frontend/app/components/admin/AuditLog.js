"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ScrollText, Search } from "lucide-react";
import { auditApi } from "../../lib/api";
import { Badge, Button, Card, Input, Modal, PageHeader, Spinner, Table, exportRows, formatDateTime, useToast } from "../ui/kit";

export default function AuditLog() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", entity: "", action: "", from: "", to: "" });
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 50 }).filter(([, v]) => v !== ""));
      const res = await auditApi.list(params);
      setRows(res.data);
      setPages(res.pagination.pages || 1);
    } catch (e) { toast.error(e); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: "createdAt", label: "Time", render: (r) => formatDateTime(r.createdAt), exportValue: (r) => r.createdAt },
    { key: "userName", label: "User" },
    { key: "action", label: "Action", render: (r) => <Badge tone={/DELETE|REJECT|CANCEL|FAILED|BLOCK/.test(r.action) ? "red" : /CREATE|APPROVE|LOGIN$/.test(r.action) ? "green" : "blue"}>{r.action}</Badge> },
    { key: "entity", label: "Entity" },
    { key: "entityId", label: "Record" },
    { key: "reason", label: "Reason" },
    { key: "ip", label: "IP" },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" icon={ScrollText} subtitle="Tamper-evident, append-only history of financial, academic, permission and ID card actions with old/new values." />
      <Card>
        <div className="mb-4 grid gap-2 md:grid-cols-6">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 md:col-span-2">
            <Search size={16} className="text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="User, entity, record or reason" value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} />
          </label>
          <Input placeholder="Entity (e.g. fee_payments)" value={filters.entity} onChange={(e) => { setPage(1); setFilters({ ...filters, entity: e.target.value }); }} />
          <Input placeholder="Action (e.g. UPDATE)" value={filters.action} onChange={(e) => { setPage(1); setFilters({ ...filters, action: e.target.value.toUpperCase() }); }} />
          <Input type="date" value={filters.from} onChange={(e) => { setPage(1); setFilters({ ...filters, from: e.target.value }); }} />
          <Input type="date" value={filters.to} onChange={(e) => { setPage(1); setFilters({ ...filters, to: e.target.value }); }} />
        </div>
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="secondary" icon={Download} onClick={() => exportRows("xlsx", { title: "Audit Log", columns, rows })}>Export page</Button>
        </div>
        {loading ? <Spinner /> : <Table rows={rows} columns={columns} onRowClick={setDetail} dense />}
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500">
          <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)} />
          <span>{page} / {pages}</span>
          <Button size="sm" variant="secondary" icon={ChevronRight} disabled={page >= pages} onClick={() => setPage(page + 1)} />
        </div>
      </Card>
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={`${detail?.action} · ${detail?.entity} ${detail?.entityId || ""}`} width="max-w-4xl" footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <div className="grid gap-3 md:grid-cols-2">
            <div><p className="mb-1 text-xs font-bold uppercase text-rose-600">Old value</p><pre className="max-h-96 overflow-auto rounded-xl bg-rose-50/50 p-3 text-xs">{JSON.stringify(detail.oldValue, null, 2) || "—"}</pre></div>
            <div><p className="mb-1 text-xs font-bold uppercase text-emerald-600">New value</p><pre className="max-h-96 overflow-auto rounded-xl bg-emerald-50/50 p-3 text-xs">{JSON.stringify(detail.newValue, null, 2) || "—"}</pre></div>
            <p className="text-xs text-slate-500 md:col-span-2">{detail.userName} · {formatDateTime(detail.createdAt)} · {detail.ip} · {detail.userAgent}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
