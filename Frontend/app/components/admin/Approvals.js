"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, HelpCircle, History, MessageSquareReply, RefreshCw, Undo2, XCircle } from "lucide-react";
import { approvalsApi } from "../../lib/api";
import { useUser } from "../../lib/access";
import ResourceManager from "../ui/ResourceManager";
import { CONFIGS } from "../modules/configs";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Spinner, Tabs, money, formatDateTime, useToast, usePrompt } from "../ui/kit";

function ageLabel(hours) {
  const h = Number(hours || 0);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}

export default function Approvals() {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [status, setStatus] = useState("Pending");
  const [type, setType] = useState("");
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("inbox");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([approvalsApi.list(status, type), approvalsApi.summary()]);
      setRows(list);
      setTypes(summary.types || {});
    } catch (e) { toast.error(e); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type]);
  useEffect(() => { load(); }, [load]);

  async function decide(row, decision) {
    let note = null;
    if (decision !== "Approved") {
      note = await ask({ title: decision === "Rejected" ? "Reason for rejection (mandatory)" : "What clarification is needed?", placeholder: "Reason", danger: decision === "Rejected" });
      if (!note) return;
    } else {
      const ok = await ask({ title: `Approve: ${row.title}?`, message: "The change will be applied immediately and recorded in the audit log.", placeholder: "Optional note", required: false });
      if (ok === null) return;
      note = ok || null;
    }
    try {
      await approvalsApi.decide(row.id, decision, note);
      toast.success(`Request ${decision.toLowerCase()}`);
      setDetail(null);
      load();
    } catch (e) { toast.error(e); }
  }
  async function withdraw(row) {
    const own = row.makerId === user?.id;
    const note = await ask({
      title: `Withdraw ${row.id}?`,
      message: own ? "The request is closed without a decision." : `This request was made by ${row.makerName}; they will be notified.`,
      placeholder: "Optional reason", required: false, danger: true,
    });
    if (note === null) return;
    try {
      await approvalsApi.cancel(row.id, note || null);
      toast.success("Request withdrawn");
      setDetail(null);
      load();
    } catch (e) { toast.error(e); }
  }
  async function resubmit(row) {
    const note = await ask({ title: "Resubmit with clarification", placeholder: "Your response" });
    if (!note) return;
    try { await approvalsApi.resubmit(row.id, note); toast.success("Resubmitted"); load(); } catch (e) { toast.error(e); }
  }

  return (
    <div>
      <PageHeader title="Approvals" icon={ClipboardCheck} subtitle="Maker–checker workflow: a maker cannot approve their own request unless they are a Super Admin. Every decision is audit-logged (§26)." actions={<Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh</Button>} />
      <Tabs tabs={[{ key: "inbox", label: "Requests" }, { key: "delegation", label: "Delegation" }]} value={tab} onChange={setTab} />
      {tab === "delegation" ? <ResourceManager config={CONFIGS.approvalDelegations} embedded /> : (
        <Card>
          <div className="mb-4 flex flex-wrap gap-2">
            <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value)} options={["Pending", "Approved", "Rejected", "Clarification", "Cancelled", "All"]} />
            <Select className="!w-auto" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(types).map(([k, v]) => ({ value: k, label: v.label }))} placeholder="All request types" />
          </div>
          {loading ? <Spinner /> : !rows.length ? <EmptyState title="Nothing waiting for you." icon={CheckCircle2} /> : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetail(r)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="indigo">{r.typeLabel}</Badge>
                      <Badge>{r.status}</Badge>
                      {r.urgency === "High" && <Badge tone="red">Urgent</Badge>}
                      {Number(r.totalLevels) > 1 && <Badge tone="blue">Level {r.level}/{r.totalLevels}{r.levelChain?.[r.level - 1]?.label ? ` · ${r.levelChain[r.level - 1].label}` : ""}</Badge>}
                      <span className="text-xs text-slate-500">{r.id}</span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">By {r.makerName} · {formatDateTime(r.createdAt)} · waiting {ageLabel(r.ageHours)}{r.amount ? ` · ${money(r.amount)}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                    {r.canDecide && (
                      <>
                        <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => decide(r, "Approved")}>Approve</Button>
                        <Button size="sm" variant="danger" icon={XCircle} onClick={() => decide(r, "Rejected")}>Reject</Button>
                        <Button size="sm" variant="secondary" icon={HelpCircle} onClick={() => decide(r, "Clarification")}>Clarify</Button>
                      </>
                    )}
                    {r.canRespond && <Button size="sm" icon={MessageSquareReply} onClick={() => resubmit(r)}>Respond</Button>}
                    {r.canWithdraw && <Button size="sm" variant="secondary" icon={Undo2} onClick={() => withdraw(r)}>Withdraw</Button>}
                    <Button size="sm" variant="ghost" icon={History} onClick={() => setDetail(r)} title="History" aria-label={`History of ${r.id}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title} footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <p><span className="text-slate-500">Type:</span> {detail.typeLabel}</p>
              <p><span className="text-slate-500">Status:</span> <Badge>{detail.status}</Badge></p>
              <p><span className="text-slate-500">Maker:</span> {detail.makerName}</p>
              <p><span className="text-slate-500">Checker:</span> {detail.checkerName || "—"}</p>
              <p><span className="text-slate-500">Reference:</span> {detail.referenceTable} {detail.referenceId}</p>
              {detail.amount && <p><span className="text-slate-500">Amount:</span> {money(detail.amount)}</p>}
            </div>
            <div>
              <p className="mb-1 font-semibold">Request details</p>
              <pre className="max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(detail.payload, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 font-semibold">Decision history</p>
              <ol className="space-y-1">
                {(detail.history || []).map((h, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 px-3 py-2"><b>{h.action}</b> by {h.by} · {formatDateTime(h.at)}{h.note ? ` – “${h.note}”` : ""}{h.selfDecision && <span className="ml-2"><Badge tone="amber">Own request</Badge></span>}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>
      {dialog}
    </div>
  );
}
