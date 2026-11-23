"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, LogOut, Plus, Save, ShieldCheck, UserCog } from "lucide-react";
import { authExtraApi, http, resource } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import ResourceManager from "../ui/ResourceManager";
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, Tabs, useToast, usePrompt } from "../ui/kit";

const ACTION_LABELS = { view: "View", create: "Create", edit: "Edit", delete: "Delete", approve: "Approve", export: "Export", print: "Print", send: "Send" };

function RoleMatrix() {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [catalog, setCatalog] = useState(null);
  const [roles, setRoles] = useState([]);
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const rolesApi = useMemo(() => resource("/roles"), []);

  const load = useCallback(async () => {
    try {
      const [cat, list] = await Promise.all([authExtraApi.permissionCatalog(), rolesApi.all()]);
      setCatalog(cat);
      setRoles(list);
      const sel = list.find((r) => r.id === current) || list[0];
      if (sel) { setCurrent(sel.id); setDraft(JSON.parse(JSON.stringify(sel))); }
    } catch (e) { toast.error(e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!catalog || !draft) return <Spinner />;
  const isAdminRole = ["super admin", "school admin", "admin"].includes(String(draft.name).toLowerCase());
  const editable = can(user, "users", "edit") && !isAdminRole;
  const matrix = draft.matrix || {};
  const toggle = (mod, action) => {
    const set = new Set(matrix[mod] || []);
    if (set.has(action)) set.delete(action); else set.add(action);
    if (action !== "view" && set.size && !set.has("view")) set.add("view");
    setDraft({ ...draft, matrix: { ...matrix, [mod]: [...set] } });
  };
  const toggleRow = (mod) => {
    const all = (matrix[mod] || []).length === catalog.actions.length;
    setDraft({ ...draft, matrix: { ...matrix, [mod]: all ? [] : [...catalog.actions] } });
  };

  async function save() {
    setSaving(true);
    try {
      await rolesApi.update(draft.id, { matrix: draft.matrix, displayName: draft.displayName, description: draft.description, canViewSensitive: draft.canViewSensitive, status: draft.status, allowedIps: draft.allowedIps || [] });
      toast.success("Permissions saved (recorded in the audit log)");
      load();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  }
  async function createRole(base) {
    const name = await ask({ title: base ? `Clone “${base.name}”` : "New role", placeholder: "Role name" });
    if (!name) return;
    try {
      const r = await rolesApi.create({ name, matrix: base?.matrix || {}, description: base ? `Cloned from ${base.name}` : "", color: base?.color || "bg-slate-100 text-slate-700" });
      setCurrent(r.id);
      toast.success("Role created");
      load();
    } catch (e) { toast.error(e); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <Card title="Roles" actions={can(user, "users", "create") && <Button size="sm" icon={Plus} onClick={() => createRole(null)}>New</Button>} bodyClass="p-2">
        <div className="space-y-1">
          {roles.map((r) => (
            <button key={r.id} type="button" onClick={() => { setCurrent(r.id); setDraft(JSON.parse(JSON.stringify(r))); }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${current === r.id ? "bg-blue-50 font-bold text-blue-700" : "hover:bg-slate-50"}`}>
              <span>{r.displayName || r.name}{r.displayName && <span className="block text-[11px] font-normal text-slate-500">{r.name}</span>}</span>
              <span className="flex gap-1">{r.isSystem && <Badge tone="indigo">system</Badge>}{r.status === "Inactive" && <Badge tone="slate">off</Badge>}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title={`${draft.displayName || draft.name} – permission matrix`} subtitle="Module × Action. Server enforces every permission. Users with several roles get the union."
        actions={(
          <>
            {can(user, "users", "create") && <Button size="sm" variant="secondary" icon={Copy} onClick={() => createRole(draft)}>Clone</Button>}
            {editable && <Button size="sm" icon={Save} loading={saving} onClick={save}>Save</Button>}
          </>
        )}>
        {isAdminRole && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Administrator role always has every permission.</p>}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Field label="Display name (e.g. Muhtamim, Head Teacher)"><Input disabled={!editable} value={draft.displayName || ""} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></Field>
          <Field label="Description" className="md:col-span-2"><Input disabled={!editable} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" disabled={!editable} checked={Boolean(draft.canViewSensitive)} onChange={(e) => setDraft({ ...draft, canViewSensitive: e.target.checked })} /> Can see sensitive fields (guardian phone, NID, salary) unmasked</label>
          <Field label="Allowed networks / IPs (optional)" hint="Comma separated, e.g. 192.168.1.*, 103.20.10.5 or 10.0.0.0/24. Users whose every role is restricted can sign in only from these addresses (v1 RP-11)." className="md:col-span-2">
            <Input disabled={!editable} value={(draft.allowedIps || []).join(", ")} onChange={(e) => setDraft({ ...draft, allowedIps: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="Leave empty for no restriction" />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" disabled={!editable} checked={draft.status !== "Inactive"} onChange={(e) => setDraft({ ...draft, status: e.target.checked ? "Active" : "Inactive" })} /> Role active</label>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2 text-left">Module</th>{catalog.actions.map((a) => <th key={a} className="px-2 py-2">{ACTION_LABELS[a]}</th>)}<th className="px-2 py-2">All</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalog.modules.map((m) => (
                <tr key={m.key} className="bg-white hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-semibold text-slate-700">{m.label}</td>
                  {catalog.actions.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      <input type="checkbox" className="size-4 accent-blue-600" disabled={!editable} checked={isAdminRole || (matrix[m.key] || []).includes(a)} onChange={() => toggle(m.key, a)} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center"><input type="checkbox" className="size-4 accent-emerald-600" disabled={!editable} checked={isAdminRole || (matrix[m.key] || []).length === catalog.actions.length} onChange={() => toggleRow(m.key)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {dialog}
    </div>
  );
}

function usersConfig(roleNames) {
  return {
    title: "Users", singular: "User", endpoint: "/users", module: "users", icon: UserCog,
    subtitle: "Login accounts. Assign one or more roles, link to a teacher/staff/guardian profile and limit class scope. Deactivating ends all sessions.",
    columns: [{ key: "name", label: "Name" }, { key: "email", label: "Email / login" }, { key: "phone", label: "Mobile" },
      { key: "role", label: "Primary role", type: "badge" }, { key: "roles", label: "Roles", type: "list" }, { key: "linkedId", label: "Linked profile", render: (r) => (r.linkedId ? `${r.linkedType}: ${r.linkedId}` : "—") },
      { key: "twoFactorEnabled", label: "2FA", type: "boolean" }, { key: "lastLoginAt", label: "Last login", type: "datetime" }, { key: "status", label: "Status", type: "badge" }],
    filters: [{ key: "status", label: "Status", options: ["Active", "Inactive"] }, { key: "linkedType", label: "Profile", options: ["Teacher", "Staff", "Guardian"] }],
    fields: [
      { key: "name", label: "Full name", required: true }, { key: "email", label: "Email (login)", required: true, inputType: "email" },
      { key: "phone", label: "Mobile (OTP login)" },
      { key: "passwordHash", label: "Password (min 8 chars)", inputType: "password", hint: "Leave blank when editing to keep the current password." },
      { key: "role", label: "Primary role", type: "select", options: roleNames, required: true },
      { key: "roles", label: "Additional roles", type: "list", placeholder: "e.g. Class Teacher, Exam Controller", hint: `Available: ${roleNames.join(", ")}` },
      { key: "linkedType", label: "Linked profile type", type: "select", options: ["Teacher", "Staff", "Guardian"] },
      { key: "linkedId", label: "Linked profile ID", hint: "e.g. TCH-1001 – enables teacher portal, own payslip and own leave" },
      { key: "scope", label: "Data scope (JSON)", type: "json", default: {}, wide: true, hint: '{"classIds":["CLS-001"],"classNames":["Class 9"]} – leave {} for full access' },
      { key: "twoFactorEnabled", label: "Require OTP (2FA) at login", type: "checkbox" },
      { key: "genderScope", label: "Campus / gender data scope", type: "select", options: ["All", "Male", "Female"], default: "All", hint: "Female-campus staff see only female students and staff (v1 RP-10)" },
      { key: "isSupport", label: "Support / vendor account (every request is logged)", type: "checkbox" },
      { key: "accessExpiresAt", label: "Access expires at", type: "datetime", hint: "Time-limited access for support or temporary staff (v1 RP-13)" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], default: "Active" },
    ],
    transform: (p, editing) => {
      const out = { ...p };
      if (editing !== "new" && !out.passwordHash) delete out.passwordHash;
      if (out.roles && out.role && !out.roles.includes(out.role)) out.roles = [out.role, ...out.roles];
      if (!out.roles && out.role) out.roles = [out.role];
      return out;
    },
    canDeleteRow: (r) => r.id !== "USR-1",
  };
}

function MySecurity() {
  const toast = useToast();
  const { user } = useUser();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [twoFa, setTwoFa] = useState(Boolean(user?.twoFactorEnabled));
  async function change() {
    if (form.newPassword !== form.confirm) { toast.error("Passwords do not match"); return; }
    try {
      await authExtraApi.changePassword(form.currentPassword, form.newPassword);
      toast.success("Password changed. Please sign in again.");
      setTimeout(() => window.dispatchEvent(new CustomEvent("edumanage:session-expired")), 1200);
    } catch (e) { toast.error(e); }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Change password" subtitle="All other sessions are signed out after a change.">
        <div className="space-y-3">
          <Field label="Current password"><Input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
          <Field label="New password (min 8)"><Input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
          <Field label="Confirm new password"><Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
          <Button icon={KeyRound} onClick={change}>Update password</Button>
        </div>
      </Card>
      <Card title="Sign-in security">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-blue-600" checked={twoFa} onChange={async (e) => {
            try { await authExtraApi.preferences({ twoFactorEnabled: e.target.checked }); setTwoFa(e.target.checked); toast.success("Saved"); } catch (err) { toast.error(err); }
          }} /> Require a one-time SMS code at login (2FA)
        </label>
        <p className="mt-2 text-xs text-slate-500">Requires a mobile number on your account and a configured SMS provider.</p>
        <Button className="mt-4" variant="secondary" icon={LogOut} onClick={async () => { try { await authExtraApi.logoutAll(); window.dispatchEvent(new CustomEvent("edumanage:session-expired")); } catch (e) { toast.error(e); } }}>Sign out of all devices</Button>
      </Card>
    </div>
  );
}

export default function RolesPermissions({ initialTab = "roles" }) {
  const { user } = useUser();
  const [tab, setTab] = useState(initialTab);
  const [roleNames, setRoleNames] = useState([]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { http.get("/roles", { limit: 200 }).then((r) => setRoleNames(r.map((x) => x.name))).catch(() => {}); }, []);
  const tabs = [
    ...(can(user, "users", "view") ? [{ key: "roles", label: "Roles & Permission Matrix" }, { key: "users", label: "Users" }] : []),
    { key: "me", label: "My Security" },
  ];
  return (
    <div>
      <PageHeader title="Roles & Permissions" icon={ShieldCheck} subtitle="Role-based access control with module × action permissions, data scope and sensitive-field masking (§4)." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "roles" && <RoleMatrix />}
      {tab === "users" && roleNames.length > 0 && <ResourceManager embedded config={usersConfig(roleNames)} />}
      {tab === "me" && <MySecurity />}
    </div>
  );
}

