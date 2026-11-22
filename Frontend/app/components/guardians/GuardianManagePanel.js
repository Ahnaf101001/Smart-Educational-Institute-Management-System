"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Link2, Search, ShieldCheck, Trash2, Unlink, Users } from "lucide-react";
import { http } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Badge, Button, EmptyState, Input, Select, Spinner, cx, formatDateTime, usePrompt, useToast } from "../ui/kit";

const RELATIONS = ["Father", "Mother", "Guardian", "Other"];

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className={cx("inline-flex items-center gap-1.5 text-xs font-semibold", disabled ? "opacity-50" : "cursor-pointer")}>
      <input type="checkbox" className="size-4 accent-blue-600" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// Linked students: per-link permissions (can_view_results / can_view_fees), notifications, access and unlink.
function LinkedStudents({ guardian, canEdit, canDelete }) {
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [rows, setRows] = useState(null);
  const load = useCallback(() => http.get(`/guardians/${guardian.id}/students`).then(setRows).catch((e) => toast.error(e)), [guardian.id, toast]);
  useEffect(() => { load(); }, [load]);

  async function update(s, change) {
    try { await http.patch(`/guardians/${guardian.id}/students/${s.id}`, change); load(); } catch (e) { toast.error(e); }
  }
  async function unlink(s) {
    const ok = await ask({ title: `Unlink ${s.name}?`, message: `${guardian.name} will no longer see ${s.name} in the guardian app. The student's records are not changed.`, input: false, danger: true, confirmLabel: "Unlink" });
    if (!ok) return;
    try { await http.del(`/guardians/${guardian.id}/students/${s.id}`); toast.success("Student unlinked"); load(); } catch (e) { toast.error(e); }
  }

  if (!rows) return <Spinner />;
  if (!rows.length) return <EmptyState title="No linked students" hint="Use 'Link a student' to connect this guardian to a child." icon={Users} />;
  return (
    <div className="space-y-2">
      {dialog}
      {rows.map((s) => (
        <div key={s.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{s.name} <span className="text-xs font-normal text-slate-500">· {s.id}</span></p>
              <p className="text-xs text-slate-500">{s.className}{s.roll ? ` · Roll ${s.roll}` : ""} · {s.relation}{s.isPrimary ? " · Primary" : ""}</p>
            </div>
            <Badge tone={s.status === "Active" ? "green" : "amber"}>{s.status}</Badge>
            <Badge tone={s.accessStatus === "Enabled" ? "green" : "red"}>{s.accessStatus === "Enabled" ? "App access on" : "App access off"}</Badge>
            {canDelete && <Button size="sm" variant="ghost" icon={Unlink} className="text-rose-600" onClick={() => unlink(s)}>Unlink</Button>}
          </div>
          {s.disabledReason?.startsWith("student_status:") && (
            <p className="mt-1 text-xs text-amber-700">Access turned off automatically because the student is {s.disabledReason.split(":")[1]}.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-4 border-t border-slate-100 pt-2">
            <Toggle label="Can view results" checked={s.canViewResults} disabled={!canEdit} onChange={(v) => update(s, { canViewResults: v })} />
            <Toggle label="Can view fees" checked={s.canViewFees} disabled={!canEdit} onChange={(v) => update(s, { canViewFees: v })} />
            <Toggle label="Receives notifications" checked={s.receivesNotifications} disabled={!canEdit} onChange={(v) => update(s, { receivesNotifications: v })} />
            <Toggle label="App access" checked={s.accessStatus === "Enabled"} disabled={!canEdit} onChange={(v) => update(s, { accessStatus: v ? "Enabled" : "Disabled" })} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Search student by ID / name → select → assign relationship → link (Workflow §1 Step 3).
function LinkStudent({ guardian, onLinked }) {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null);
  const [picked, setPicked] = useState(null);
  const [relation, setRelation] = useState(guardian.relationDefault || "Father");
  const [primary, setPrimary] = useState(false);
  const [busy, setBusy] = useState(false);

  async function search(e) {
    e?.preventDefault();
    if (term.trim().length < 2) return toast.error("Type at least 2 characters of the student ID or name.");
    try { setResults(await http.get("/students", { search: term.trim(), limit: 10 })); setPicked(null); } catch (err) { toast.error(err); }
  }
  async function link() {
    if (!picked) return;
    setBusy(true);
    try {
      await http.post(`/guardians/${guardian.id}/students`, { studentId: picked.id, relation, isPrimary: primary });
      toast.success(`${picked.name} linked to ${guardian.name}`);
      setPicked(null); setResults(null); setTerm("");
      onLinked();
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={search}>
        <Input placeholder="Student ID or name (e.g. STU-4003 or Tanvir)" value={term} onChange={(e) => setTerm(e.target.value)} />
        <Button type="submit" icon={Search}>Search</Button>
      </form>
      {results && (results.length ? (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {results.map((s) => (
            <button key={s.id} type="button" onClick={() => setPicked(s)}
              className={cx("flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm", picked?.id === s.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50")}>
              <span><b>{s.name}</b> <span className="text-slate-500">· {s.id}</span></span>
              <span className="text-xs text-slate-500">{s.className}{s.roll ? ` · Roll ${s.roll}` : ""} · {s.status}</span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="No students match" />)}
      {picked && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
          <div className="text-sm"><p className="text-xs text-slate-500">Selected</p><b>{picked.name}</b></div>
          <div className="w-40"><p className="mb-1 text-xs text-slate-500">Relationship</p><Select value={relation} onChange={(e) => setRelation(e.target.value)} options={RELATIONS} /></div>
          <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={primary} onChange={(e) => setPrimary(e.target.checked)} /> Primary contact</label>
          <Button icon={Link2} loading={busy} onClick={link}>Link student</Button>
        </div>
      )}
    </div>
  );
}

function NotificationHistory({ guardian }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  useEffect(() => { http.get(`/guardians/${guardian.id}/notification-history`).then(setRows).catch((e) => toast.error(e)); }, [guardian.id, toast]);
  if (!rows) return <Spinner />;
  if (!rows.length) return <EmptyState title="No notifications sent yet" icon={Bell} />;
  return (
    <div className="max-h-[420px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-500">
          <tr><th className="py-2 pr-2">Sent</th><th className="pr-2">Channel</th><th className="pr-2">Student</th><th className="pr-2">Message</th><th>Status</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((m) => (
            <tr key={m.id} className="align-top">
              <td className="whitespace-nowrap py-2 pr-2 text-xs text-slate-500">{formatDateTime(m.createdAt)}</td>
              <td className="pr-2"><Badge>{m.channel}</Badge></td>
              <td className="pr-2 text-xs">{m.studentName || "—"}</td>
              <td className="pr-2"><p className="font-semibold">{m.subject || m.eventType}</p><p className="text-xs text-slate-600">{m.body}</p></td>
              <td className="text-xs">{m.readAt ? "Read" : m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Delete account per policy (Workflow §7): anonymize keeps financial history; delete only without payments.
function AccountTab({ guardian, onRemoved, canDelete }) {
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [account, setAccount] = useState(undefined);
  useEffect(() => { http.get(`/guardians/${guardian.id}/account`).then((d) => setAccount(d.account)).catch((e) => toast.error(e)); }, [guardian.id, toast]);

  async function remove(mode) {
    const reason = await ask({
      title: mode === "delete" ? "Permanently delete this guardian?" : "Anonymize this guardian account?",
      message: mode === "delete"
        ? "Removes the guardian and login completely. Only possible when there is no payment history."
        : "Unlinks all students, erases personal details and disables the login. Fee, attendance and result records stay intact.",
      placeholder: "Reason (recorded in the audit log)", danger: true, confirmLabel: mode === "delete" ? "Delete" : "Anonymize",
    });
    if (!reason) return;
    try { await http.post(`/guardians/${guardian.id}/remove`, { mode, reason }); toast.success("Guardian account removed"); onRemoved(); } catch (e) { toast.error(e); }
  }

  return (
    <div className="space-y-4">
      {dialog}
      {account === undefined ? <Spinner /> : account ? (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Login email:</span> <b>{account.email}</b></p>
          <p><span className="text-slate-500">Status:</span> <b>{account.status}</b>{account.mustChangePassword ? " · temporary password not changed yet" : ""}</p>
          <p><span className="text-slate-500">Last login:</span> {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Never"}</p>
          <p><span className="text-slate-500">Password changed:</span> {account.passwordChangedAt ? formatDateTime(account.passwordChangedAt) : "—"}</p>
        </div>
      ) : <p className="text-sm text-slate-500">No app account yet. Use the &ldquo;App account&rdquo; action to create one.</p>}
      {canDelete && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-bold text-rose-700">Delete account</p>
          <p className="text-xs text-rose-700">Students are unlinked first. Anonymizing is recommended because it keeps financial history.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="danger" icon={ShieldCheck} onClick={() => remove("anonymize")}>Anonymize account</Button>
            <Button size="sm" variant="secondary" icon={Trash2} className="text-rose-700" onClick={() => remove("delete")}>Delete permanently</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuardianManagePanel({ guardian, onClose }) {
  const { user } = useUser();
  const [tab, setTab] = useState("students");
  const [version, setVersion] = useState(0);
  const canEdit = can(user, "guardians", "edit");
  const canDelete = can(user, "guardians", "delete");
  const tabs = [["students", "Linked students"], ...(canEdit ? [["link", "Link a student"]] : []), ["history", "Notification history"], ["account", "Account"]];
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">{guardian.name} · {guardian.mobile} · {guardian.relationDefault}</p>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "students" && <LinkedStudents key={version} guardian={guardian} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "link" && <LinkStudent guardian={guardian} onLinked={() => { setVersion((v) => v + 1); setTab("students"); }} />}
      {tab === "history" && <NotificationHistory guardian={guardian} />}
      {tab === "account" && <AccountTab guardian={guardian} canDelete={canDelete} onRemoved={onClose} />}
    </div>
  );
}
