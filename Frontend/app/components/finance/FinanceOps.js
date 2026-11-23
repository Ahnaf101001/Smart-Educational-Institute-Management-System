"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Calculator, CalendarPlus, HandCoins, Landmark, Receipt, Scale, Wallet } from "lucide-react";
import { http, resource } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import ResourceManager from "../ui/ResourceManager";
import { CONFIGS } from "../modules/configs";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Tabs, Textarea, exportRows, formatDate, formatDateTime, money, today, useToast, usePrompt } from "../ui/kit";

function InvoiceTools() {
  const toast = useToast();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [busy, setBusy] = useState("");
  useEffect(() => { resource("/classes").all().then(setClasses); }, []);
  async function run(kind) {
    setBusy(kind);
    try {
      if (kind === "generate") { const d = await http.post("/fees/invoices/generate", { month, classId: classId || null, frequency }); toast.success(`${d.created} invoice(s) created for ${d.students} student(s). Re-running never duplicates.`); }
      if (kind === "fines") { const d = await http.post("/fees/invoices/apply-late-fines"); toast.success(`Late fine applied to ${d.updated} invoice(s)`); }
      if (kind === "remind") { const d = await http.post("/fees/reminders/send", { classId: classId || null, minDue: 1 }); toast.success(`${d.queued} reminder SMS queued`); }
    } catch (e) { toast.error(e); } finally { setBusy(""); }
  }
  return (
    <Card title="Invoices, late fines & reminders" subtitle="Monthly/term invoices auto-generate on the configured day; you can also run them here.">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Billing month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field label="Frequency"><Select value={frequency} onChange={(e) => setFrequency(e.target.value)} options={["Monthly", "Term", "Yearly", "One-time"]} /></Field>
        <Field label="Class"><Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="All classes" /></Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={CalendarPlus} loading={busy === "generate"} onClick={() => run("generate")}>Generate invoices</Button>
        <Button variant="secondary" icon={Scale} loading={busy === "fines"} onClick={() => run("fines")}>Apply late fines</Button>
        <Button variant="secondary" icon={BellRing} loading={busy === "remind"} onClick={() => run("remind")}>Send due reminders</Button>
      </div>
    </Card>
  );
}

function DiscountRequest() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [heads, setHeads] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({ studentId: "", feeHeadId: "", discountType: "Sibling", mode: "Percent", value: 10, reason: "", validFrom: "", validTo: "" });
  useEffect(() => {
    resource("/students").all({ status: "Active" }).then(setStudents);
    resource("/fee-heads").all().then(setHeads);
    http.get("/fees/discounts/sibling-candidates").then(setCandidates).catch(() => {});
  }, []);
  async function submit() {
    try { await http.post("/fees/discounts", form); toast.success("Sent for approval. Applied to open invoices once approved."); setForm({ ...form, reason: "" }); } catch (e) { toast.error(e); }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Request discount / scholarship / waiver" subtitle="Student-specific adjustments go through approval with a mandatory reason.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Student" className="sm:col-span-2"><Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} options={students.map((s) => ({ value: s.id, label: `${s.name} – ${s.id} (${s.className})` }))} placeholder="Select student" /></Field>
          <Field label="Type"><Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} options={["Sibling", "Scholarship", "Waiver", "Staff Child", "Orphan", "Merit", "Need Based", "Lillah", "Freedom Fighter", "Other"]} /></Field>
          <Field label="Fee head"><Select value={form.feeHeadId} onChange={(e) => setForm({ ...form, feeHeadId: e.target.value })} options={heads.map((h) => ({ value: h.id, label: h.name }))} placeholder="All heads" /></Field>
          <Field label="Mode"><Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} options={["Percent", "Fixed"]} /></Field>
          <Field label={form.mode === "Percent" ? "Percent" : "Amount (৳)"}><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
          <Field label="Valid from"><Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></Field>
          <Field label="Valid to"><Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></Field>
          <Field label="Reason (mandatory)" className="sm:col-span-2"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        </div>
        <Button className="mt-3" icon={HandCoins} disabled={!form.studentId || !form.reason} onClick={submit}>Submit for approval</Button>
      </Card>
      <Card title="Eligible siblings" subtitle="Guardians with more than one active student">
        <div className="max-h-[460px] space-y-2 overflow-auto">
          {candidates.map((g) => (
            <div key={g.guardianId} className="rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-semibold">{g.guardianName} <span className="text-xs text-slate-500">{g.mobile}</span></p>
              <div className="mt-1 flex flex-wrap gap-1">{g.students.map((s, i) => (
                <button key={s.id} type="button" onClick={() => setForm({ ...form, studentId: s.id, discountType: "Sibling", reason: `Sibling discount – child ${i + 1} of ${g.guardianName}` })}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${s.hasSiblingDiscount ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-blue-50"}`}>
                  {s.name} ({s.className}){s.hasSiblingDiscount ? " ✓" : ""}
                </button>
              ))}</div>
            </div>
          ))}
          {!candidates.length && <p className="text-sm text-slate-500">No sibling groups found.</p>}
        </div>
      </Card>
    </div>
  );
}

function CashClosing() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ cashCounted: "", handedOver: 0, handedOverTo: "", note: "" });
  const load = useCallback(() => http.get("/fees/cash-closing/preview", { date }).then(setPreview).catch((e) => toast.error(e)), [date, toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  const expected = preview ? Number(preview.openingBalance) + Number(preview.cashCollection) : 0;
  const mismatch = form.cashCounted === "" ? 0 : Number(form.cashCounted) - expected;
  async function close() {
    try { await http.post("/fees/cash-closing", { date, ...form, cashCounted: Number(form.cashCounted), handedOver: Number(form.handedOver) }); toast.success("Cash closed"); load(); } catch (e) { toast.error(e); }
  }
  return (
    <div className="space-y-5">
      <Card title="Daily cashier closing" subtitle="Opening + today's cash collection vs counted cash; handover and mismatch alert.">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <StatCard label="Opening" value={money(preview?.openingBalance)} />
          <StatCard label="System cash" value={money(preview?.cashCollection)} tone="green" />
          <StatCard label="Expected" value={money(expected)} tone="blue" />
          <StatCard label="Mismatch" value={money(mismatch)} tone={Math.abs(mismatch) > 0.009 ? "red" : "green"} />
        </div>
        {preview?.byMethod?.length > 0 && <p className="mt-3 text-sm text-slate-600">By method: {preview.byMethod.map((m) => `${m.paymentMethod} ${money(m.total)} (${m.receipts})`).join(" · ")}</p>}
        {preview?.existing ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Closed at {formatDateTime(preview.existing.createdAt)} · counted {money(preview.existing.cashCounted)} · mismatch {money(preview.existing.mismatch)}</p> : (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Field label="Cash counted (৳)"><Input type="number" value={form.cashCounted} onChange={(e) => setForm({ ...form, cashCounted: e.target.value })} /></Field>
            <Field label="Handed over (৳)"><Input type="number" value={form.handedOver} onChange={(e) => setForm({ ...form, handedOver: e.target.value })} /></Field>
            <Field label="Handed over to"><Input value={form.handedOverTo} onChange={(e) => setForm({ ...form, handedOverTo: e.target.value })} /></Field>
            <Field label="Note"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <div><Button icon={Wallet} disabled={form.cashCounted === ""} onClick={close}>Close cash</Button></div>
          </div>
        )}
      </Card>
      <ResourceManager embedded config={CONFIGS.cashClosings} />
    </div>
  );
}

function ReceiptsAdmin() {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ from: today(), to: today(), status: "" });
  const [receipt, setReceipt] = useState(null);
  const load = useCallback(() => http.get("/fees/payments", filters).then(setRows).catch((e) => toast.error(e)), [filters, toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  async function cancel(p) {
    const reason = await ask({ title: `Cancel receipt ${p.receiptNo}?`, message: "Receipts are never deleted; cancellation reverses the ledger after approval.", placeholder: "Reason", danger: true });
    if (!reason) return;
    try { await http.post(`/fees/payments/${p.id}/cancel-request`, { reason }); toast.success("Cancellation sent for approval"); } catch (e) { toast.error(e); }
  }
  async function refund(p) {
    const amount = await ask({ title: `Refund against ${p.receiptNo}`, placeholder: `Amount (max ${p.amount})` });
    if (!amount) return;
    const reason = await ask({ title: "Refund reason", placeholder: "e.g. admission cancelled / security deposit" });
    if (!reason) return;
    try { await http.post("/fees/refunds", { paymentId: p.id, studentId: p.studentId, amount: Number(amount), reason }); toast.success("Refund sent for approval"); } catch (e) { toast.error(e); }
  }
  const cols = [
    { key: "receiptNo", label: "Receipt" }, { key: "paidAt", label: "Date", render: (r) => formatDateTime(r.paidAt) }, { key: "studentName", label: "Student" },
    { key: "feeHead", label: "Head" }, { key: "amount", label: "Amount", render: (r) => money(r.amount) }, { key: "paymentMethod", label: "Method" },
    { key: "collectorName", label: "Collector" }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
    { key: "a", label: "", render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="secondary" icon={Receipt} onClick={async () => { try { setReceipt(await http.get(`/fees/receipts/${r.receiptNo}`)); } catch (e) { toast.error(e); } }}>View</Button>
        {r.status === "Valid" && can(user, "fees", "edit") && <Button size="sm" variant="ghost" onClick={() => cancel(r)}>Cancel</Button>}
        {r.status === "Valid" && can(user, "fees", "create") && <Button size="sm" variant="ghost" onClick={() => refund(r)}>Refund</Button>}
      </div>
    ) },
  ];
  return (
    <Card title="Money receipts" subtitle="Serial receipts, print / reprint, cancellation and refund through approval">
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={["Valid", "Cancelled"]} placeholder="All" />
        <Button variant="secondary" onClick={() => exportRows("xlsx", { title: "Receipts", columns: cols.slice(0, 8), rows })}>Export</Button>
      </div>
      <Table dense rows={rows} columns={cols} />
      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title={`Money receipt ${receipt?.receiptNo || ""}`} footer={<><Button variant="secondary" onClick={() => setReceipt(null)}>Close</Button><Button onClick={() => window.print()}>Print</Button></>}>
        {receipt && (
          <div id="receipt-print" className="text-sm">
            <div className="flex items-center gap-3 border-b pb-3">
              {receipt.institute?.logoUrl && <img src={receipt.institute.logoUrl} alt="" className="size-12 object-contain" />}
              <div><p className="text-lg font-extrabold">{receipt.institute?.name}</p><p className="text-xs text-slate-500">{receipt.institute?.address}</p></div>
              <div className="ml-auto text-right"><p className="font-bold">{receipt.receiptNo}</p><p className="text-xs">{formatDateTime(receipt.paidAt)}</p>{receipt.status !== "Valid" && <Badge tone="red">CANCELLED</Badge>}</div>
            </div>
            <p className="mt-3">Received from: <b>{receipt.students.map((s) => `${s.name} (${s.className}, roll ${s.roll || "—"})`).join(", ")}</b></p>
            <table className="mt-3 w-full"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th>Receipt</th><th>Fee head</th><th>Month</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{receipt.lines.map((l) => <tr key={l.id} className="border-b border-slate-100"><td>{l.receiptNo}</td><td>{l.feeHead}</td><td>{l.billingMonth ? String(l.billingMonth).slice(0, 7) : ""}</td><td className="text-right">{money(l.amount)}{l.status !== "Valid" ? " (cancelled)" : ""}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={3} className="pt-2 font-bold">Total</td><td className="pt-2 text-right font-bold">{money(receipt.total)}</td></tr></tfoot></table>
            <p className="mt-3 text-xs text-slate-500">Method: {receipt.method} · Collected by {receipt.collector || "—"}</p>
          </div>
        )}
      </Modal>
      {dialog}
    </Card>
  );
}

function CombinedCollect() {
  const toast = useToast();
  const [guardians, setGuardians] = useState([]);
  const [gid, setGid] = useState("");
  const [dues, setDues] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [form, setForm] = useState({ amount: "", paymentMethod: "Cash", referenceNo: "" });
  useEffect(() => { resource("/guardians").all().then(setGuardians); }, []);
  useEffect(() => {
    if (!gid) return;
    http.get(`/fees/guardian/${gid}/dues`).then((d) => { setDues(d); setSel(new Set(d.items.map((i) => i.invoiceId))); }).catch((e) => toast.error(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);
  const selectedTotal = (dues?.items || []).filter((i) => sel.has(i.invoiceId)).reduce((s, i) => s + Number(i.due), 0);
  async function collect() {
    try {
      const studentIds = [...new Set(dues.items.map((i) => i.studentId))];
      const r = await http.post("/fees/collect", { studentIds, invoiceIds: [...sel], amount: Number(form.amount || selectedTotal), paymentMethod: form.paymentMethod, referenceNo: form.referenceNo || null, guardianId: gid });
      toast.success(`Collected. ${r.receipts.length} receipt(s): ${r.receipts.map((x) => x.receiptNo).join(", ")}`);
      setGid(""); setDues(null);
    } catch (e) { toast.error(e); }
  }
  return (
    <Card title="Guardian combined payment" subtitle="One payment for all children; the system splits it student-wise by invoice.">
      <Field label="Guardian" className="max-w-md"><Select value={gid} onChange={(e) => setGid(e.target.value)} options={guardians.map((g) => ({ value: g.id, label: `${g.name} – ${g.mobile}` }))} placeholder="Select guardian" /></Field>
      {dues && (
        <div className="mt-4 space-y-3">
          <Table dense rows={dues.items} rowKey="invoiceId" columns={[
            { key: "x", label: "", render: (r) => <input type="checkbox" className="accent-blue-600" checked={sel.has(r.invoiceId)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.invoiceId); else n.delete(r.invoiceId); setSel(n); }} /> },
            { key: "name", label: "Student" }, { key: "className", label: "Class" }, { key: "feeHead", label: "Head" }, { key: "billingMonth", label: "Month", render: (r) => String(r.billingMonth || "").slice(0, 7) },
            { key: "dueDate", label: "Due date", render: (r) => formatDate(r.dueDate) }, { key: "due", label: "Due", render: (r) => money(r.due) },
          ]} />
          <div className="grid gap-3 md:grid-cols-4">
            <Field label={`Amount (selected ${money(selectedTotal)})`}><Input type="number" value={form.amount} placeholder={String(selectedTotal)} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Method"><Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} options={["Cash", "Cheque", "Bank Transfer", "bKash", "Nagad", "Rocket", "Card"]} /></Field>
            <Field label="Reference / Txn no."><Input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></Field>
            <div className="flex items-end"><Button icon={HandCoins} disabled={!sel.size} onClick={collect}>Collect</Button></div>
          </div>
          <p className="text-xs text-slate-500">Paying more than the selected dues stores the extra as an advance credit used automatically on the next invoices.</p>
        </div>
      )}
    </Card>
  );
}

function CollectionReport() {
  const toast = useToast();
  const [f, setF] = useState({ from: `${today().slice(0, 8)}01`, to: today(), groupBy: "day" });
  const [data, setData] = useState(null);
  useEffect(() => { http.get("/fees/reports/collection", f).then(setData).catch((e) => toast.error(e)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);
  const cols = [{ key: "label", label: f.groupBy }, { key: "receipts", label: "Receipts" }, { key: "total", label: "Collected", render: (r) => money(r.total), exportValue: (r) => r.total }];
  return (
    <Card title="Daily & monthly collection report" actions={data && <Button size="sm" variant="secondary" onClick={() => exportRows("pdf", { title: `Collection ${f.from} to ${f.to}`, columns: cols, rows: data.rows })}>PDF</Button>}>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <Select value={f.groupBy} onChange={(e) => setF({ ...f, groupBy: e.target.value })} options={[{ value: "day", label: "By day" }, { value: "month", label: "By month" }, { value: "head", label: "By fee head" }, { value: "method", label: "By method" }, { value: "collector", label: "By collector" }, { value: "class", label: "By class" }]} />
      </div>
      {!data ? <Spinner /> : <><Table dense rows={data.rows} rowKey="label" columns={cols} /><p className="mt-3 text-right font-bold">Total {money(data.total)}</p></>}
    </Card>
  );
}

export function FeeOperations({ initialTab = "invoices" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <div>
      <PageHeader title="Fee Operations" icon={Calculator} subtitle="Fee heads, invoices, discounts, combined payments, receipts, cash closing, online payments and reports." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "invoices", label: "Invoices & Reminders" }, { key: "heads", label: "Fee Heads" }, { key: "discounts", label: "Discounts & Waivers" },
        { key: "combined", label: "Combined Payment" }, { key: "receipts", label: "Receipts" }, { key: "closing", label: "Cash Closing" },
        { key: "online", label: "Online Payments" }, { key: "report", label: "Collection Report" },
      ]} />
      {tab === "invoices" && <InvoiceTools />}
      {tab === "heads" && <ResourceManager embedded config={CONFIGS.feeHeads} />}
      {tab === "discounts" && <div className="space-y-5"><DiscountRequest /><ResourceManager embedded config={CONFIGS.feeDiscounts} /><ResourceManager embedded config={CONFIGS.refunds} /></div>}
      {tab === "combined" && <CombinedCollect />}
      {tab === "receipts" && <ReceiptsAdmin />}
      {tab === "closing" && <CashClosing />}
      {tab === "online" && <ResourceManager embedded config={CONFIGS.gatewayTransactions} />}
      {tab === "report" && <CollectionReport />}
    </div>
  );
}

// ------------------------------------------------------------------ account books
function useRange() {
  return useState({ from: `${today().slice(0, 4)}-01-01`, to: today() });
}

function CashBook() {
  const toast = useToast();
  const [r, setR] = useRange();
  const [data, setData] = useState(null);
  useEffect(() => { http.get("/accounts/cash-book", r).then(setData).catch((e) => toast.error(e)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);
  const cols = [{ key: "transactionDate", label: "Date", render: (x) => formatDate(x.transactionDate) }, { key: "description", label: "Particulars" }, { key: "category", label: "Head" },
    { key: "debit", label: "Receipt (Dr)", render: (x) => (x.debit ? money(x.debit) : "") }, { key: "credit", label: "Payment (Cr)", render: (x) => (x.credit ? money(x.credit) : "") }, { key: "balance", label: "Balance", render: (x) => money(x.balance) }];
  return (
    <Card title="Cash book" actions={data && <Button size="sm" variant="secondary" onClick={() => exportRows("pdf", { title: "Cash book", columns: cols.map((c) => ({ ...c, exportValue: (x) => (c.key === "transactionDate" ? x.transactionDate : x[c.key]) })), rows: data.entries })}>PDF</Button>}>
      <div className="mb-3 grid max-w-md grid-cols-2 gap-2"><Input type="date" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} /><Input type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} /></div>
      {!data ? <Spinner /> : <><p className="mb-2 text-sm">Opening balance: <b>{money(data.openingBalance)}</b></p><Table dense rows={data.entries} columns={cols} /><p className="mt-2 text-right text-sm">Closing balance: <b>{money(data.closingBalance)}</b></p></>}
    </Card>
  );
}

function TrialBalance() {
  const toast = useToast();
  const [r, setR] = useRange();
  const [data, setData] = useState(null);
  const [ledger, setLedger] = useState(null);
  useEffect(() => {
    http.get("/accounts/trial-balance", r).then(setData).catch((e) => toast.error(e));
    http.get("/accounts/ledger", r).then(setLedger).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Trial balance" actions={data && <Badge tone={data.balanced ? "green" : "red"}>{data.balanced ? "Balanced" : "Not balanced"}</Badge>}>
        <div className="mb-3 grid max-w-md grid-cols-2 gap-2"><Input type="date" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} /><Input type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} /></div>
        {!data ? <Spinner /> : <><Table dense rows={data.lines} rowKey="account" columns={[{ key: "account", label: "Account" }, { key: "debit", label: "Debit", render: (x) => (x.debit ? money(x.debit) : "") }, { key: "credit", label: "Credit", render: (x) => (x.credit ? money(x.credit) : "") }]} />
          <p className="mt-2 text-right text-sm font-bold">Dr {money(data.totalDebit)} · Cr {money(data.totalCredit)}</p></>}
      </Card>
      <Card title="Ledger by head">
        {!ledger ? <Spinner /> : <Table dense rows={ledger.rows} rowKey="head" columns={[{ key: "head", label: "Head" }, { key: "type", label: "Type", render: (x) => <Badge tone={x.type === "Income" ? "green" : "red"}>{x.type}</Badge> }, { key: "fund", label: "Fund" }, { key: "entries", label: "Entries" }, { key: "total", label: "Total", render: (x) => money(x.total) }]} />}
      </Card>
    </div>
  );
}

function IncomeExpense() {
  const toast = useToast();
  const [r, setR] = useRange();
  const [data, setData] = useState(null);
  const [banks, setBanks] = useState([]);
  useEffect(() => {
    http.get("/accounts/income-expense", r).then(setData).catch((e) => toast.error(e));
    http.get("/accounts/bank-summary").then(setBanks).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);
  return (
    <div className="space-y-5">
      <Card title="Monthly income & expense">
        <div className="mb-3 grid max-w-md grid-cols-2 gap-2"><Input type="date" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} /><Input type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} /></div>
        {!data ? <Spinner /> : (
          <div className="grid gap-5 xl:grid-cols-2">
            <Table dense rows={data.monthly} rowKey="month" columns={[{ key: "month", label: "Month" }, { key: "income", label: "Income", render: (x) => money(x.income) }, { key: "expense", label: "Expense", render: (x) => money(x.expense) }, { key: "net", label: "Net", render: (x) => money(Number(x.income) - Number(x.expense)) }]} />
            <div className="space-y-3">
              <Table dense rows={data.byFund} rowKey="fund" columns={[{ key: "fund", label: "Fund" }, { key: "income", label: "Income", render: (x) => money(x.income) }, { key: "expense", label: "Expense", render: (x) => money(x.expense) }]} />
              {data.donations.length > 0 && <Table dense rows={data.donations} rowKey="fund" columns={[{ key: "fund", label: "Donation fund" }, { key: "total", label: "Received", render: (x) => money(x.total) }]} />}
            </div>
          </div>
        )}
      </Card>
      <Card title="Bank balances & reconciliation" subtitle="Book vs reconciled balance">
        <Table dense rows={banks} columns={[{ key: "bankName", label: "Bank" }, { key: "accountName", label: "Account" }, { key: "bookBalance", label: "Book balance", render: (x) => money(x.bookBalance) }, { key: "reconciledBalance", label: "Reconciled", render: (x) => money(x.reconciledBalance) }, { key: "unreconciled", label: "Unreconciled txns" }]} />
      </Card>
    </div>
  );
}

export function AccountBooks({ initialTab = "cashbook" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <div>
      <PageHeader title="Account Books & Financial Reports" icon={Landmark} subtitle="Chart of accounts, vouchers, cash book, ledger, trial balance, income–expense and bank reconciliation." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "cashbook", label: "Cash Book" }, { key: "trial", label: "Ledger & Trial Balance" }, { key: "ie", label: "Income–Expense & Bank" },
        { key: "heads", label: "Chart of Accounts" }, { key: "vouchers", label: "Vouchers" }, { key: "bank", label: "Bank Accounts" },
      ]} />
      {tab === "cashbook" && <CashBook />}
      {tab === "trial" && <TrialBalance />}
      {tab === "ie" && <IncomeExpense />}
      {tab === "heads" && <ResourceManager embedded config={CONFIGS.accountHeads} />}
      {tab === "vouchers" && <ResourceManager embedded config={CONFIGS.vouchers} />}
      {tab === "bank" && <div className="space-y-5"><ResourceManager embedded config={CONFIGS.bankAccounts} /><ResourceManager embedded config={CONFIGS.bankTransactions} /></div>}
    </div>
  );
}
