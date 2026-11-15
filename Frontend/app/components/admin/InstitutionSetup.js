"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Database, DownloadCloud, Image as ImageIcon, Play, Save, ShieldCheck, Upload } from "lucide-react";
import { http, instituteProfileApi, setupApi, systemSettingsApi, uploadsApi } from "../../lib/api";
import ResourceManager from "../ui/ResourceManager";
import { CONFIGS } from "../modules/configs";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Textarea, formatDate, formatDateTime, useToast, usePrompt } from "../ui/kit";

const MODULE_TOGGLES = [
  ["madrasa", "Madrasa: Hifz, Salah, Halaqa"], ["hostel", "Hostel / Darul Iqama & Meals"], ["donations", "Donations & Zakat/Lillah funds"],
  ["transport", "Transport & GPS"], ["library", "Library"], ["inventory", "Inventory, assets & visitors"], ["online_classes", "Online classes"],
];
const OPT_IN = ["madrasa", "hostel", "donations"];

function UploadButton({ label, value, onUploaded, category }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50">
        {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="text-slate-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <label className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <Upload size={13} /> {busy ? "Uploading…" : "Upload"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setBusy(true);
            try { const up = await uploadsApi.upload(file, { category }); onUploaded(up.url); } catch (err) { toast.error(err); } finally { setBusy(false); }
          }} />
        </label>
      </div>
    </div>
  );
}

function ProfileTab() {
  const toast = useToast();
  const [p, setP] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { instituteProfileApi.get().then(setP).catch((e) => toast.error(e)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!p) return <Spinner />;
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  async function save(extra = {}) {
    setSaving(true);
    try {
      const keys = ["name", "nameBn", "nameAr", "eiin", "phone", "email", "website", "establishedYear", "capacity", "address", "motto", "principalName", "principalTitle", "brandColor", "accentColor", "board", "emergencyContact", "logoUrl", "signatureUrl", "sealUrl"];
      const payload = Object.fromEntries(keys.map((k) => [k, { ...p, ...extra }[k] ?? ""]));
      setP(await instituteProfileApi.update(payload));
      toast.success("School profile saved – used on login screen, reports, receipts and ID cards");
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card title="School profile" subtitle="Set once; reused on every output (SYS-01, SYS-08)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Institution name (English)" required><Input value={p.name || ""} onChange={set("name")} /></Field>
          <Field label="প্রতিষ্ঠানের নাম (বাংলা)"><Input value={p.nameBn || ""} onChange={set("nameBn")} /></Field>
          <Field label="Name (Arabic, optional)"><Input dir="rtl" value={p.nameAr || ""} onChange={set("nameAr")} /></Field>
          <Field label="EIIN"><Input value={p.eiin || ""} onChange={set("eiin")} /></Field>
          <Field label="Phone"><Input value={p.phone || ""} onChange={set("phone")} /></Field>
          <Field label="Email"><Input value={p.email || ""} onChange={set("email")} /></Field>
          <Field label="Website"><Input value={p.website || ""} onChange={set("website")} /></Field>
          <Field label="Emergency contact"><Input value={p.emergencyContact || ""} onChange={set("emergencyContact")} /></Field>
          <Field label="Education board"><Select value={p.board || ""} onChange={set("board")} options={["Dhaka", "Chattogram", "Rajshahi", "Cumilla", "Jashore", "Barishal", "Sylhet", "Dinajpur", "Mymensingh", "Madrasah (BMEB)", "Technical", "Befaq (Qawmi)", "Cambridge (CAIE)", "Pearson Edexcel"]} placeholder="—" /></Field>
          <Field label="Established"><Input value={p.establishedYear || ""} onChange={set("establishedYear")} /></Field>
          <Field label="Head of institution"><Input value={p.principalName || ""} onChange={set("principalName")} /></Field>
          <Field label="Title (Principal / Head Teacher / Muhtamim / Super)"><Input value={p.principalTitle || ""} onChange={set("principalTitle")} /></Field>
          <Field label="Motto"><Input value={p.motto || ""} onChange={set("motto")} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Brand colour"><Input type="color" value={p.brandColor || "#223f91"} onChange={set("brandColor")} className="!p-1" /></Field>
            <Field label="Accent colour"><Input type="color" value={p.accentColor || "#1673f8"} onChange={set("accentColor")} className="!p-1" /></Field>
          </div>
          <Field label="Address" className="sm:col-span-2"><Textarea value={p.address || ""} onChange={set("address")} /></Field>
        </div>
        <div className="mt-4"><Button icon={Save} loading={saving} onClick={() => save()}>Save profile</Button></div>
      </Card>
      <Card title="Reusable assets" subtitle="Logo, authorised signature and seal (SYS-05)">
        <div className="space-y-3">
          <UploadButton label="School logo" category="logo" value={p.logoUrl} onUploaded={(url) => { setP({ ...p, logoUrl: url }); save({ logoUrl: url }); }} />
          <UploadButton label="Authorised signature" category="signature" value={p.signatureUrl} onUploaded={(url) => { setP({ ...p, signatureUrl: url }); save({ signatureUrl: url }); }} />
          <UploadButton label="Official seal" category="seal" value={p.sealUrl} onUploaded={(url) => { setP({ ...p, sealUrl: url }); save({ sealUrl: url }); }} />
        </div>
      </Card>
    </div>
  );
}

function PresetsTab() {
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setupApi.types().then(setTypes).catch((e) => toast.error(e));
    instituteProfileApi.get().then((p) => { setProfile(p); setSelected(p.institutionTypes || []); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);
  async function apply() {
    setBusy(true);
    try {
      const res = await setupApi.applyPreset(selected);
      toast.success(res.map((r) => `${r.type}: +${r.classesCreated} classes, +${r.subjectsCreated} subjects`).join(" · "));
      load();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  }
  return (
    <Card title="Education line / institution type" subtitle="Run General line (Bangla medium, English version), English medium, Alia or Qawmi madrasa, kindergarten or college – alone or together. Applying creates classes/levels, subjects with marks components, the right grading scale, fee heads and role names. Existing data is kept.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {types.map((t) => {
          const on = selected.includes(t.type);
          const applied = (profile?.institutionTypes || []).includes(t.type);
          return (
            <label key={t.type} className={`cursor-pointer rounded-2xl border p-4 transition ${on ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 accent-blue-600" checked={on} onChange={(e) => setSelected(e.target.checked ? [...selected, t.type] : selected.filter((x) => x !== t.type))} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{t.label}</p>{applied && <Badge tone="green">Applied</Badge>}</div>
                  <p className="mt-1 text-xs text-slate-500">Grading: {t.gradeTemplate}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.classes.length} levels: {t.classes.slice(0, 6).join(", ")}{t.classes.length > 6 ? "…" : ""}</p>
                  <p className="text-xs text-slate-500">{t.subjects} subjects{t.modules.length ? ` · enables ${t.modules.join(", ")}` : ""}</p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button icon={CheckCircle2} loading={busy} disabled={!selected.length} onClick={apply}>Apply selected</Button>
        <span className="text-xs text-slate-500">Primary type: <b>{profile?.primaryType || "—"}</b></span>
      </div>
    </Card>
  );
}

function SessionsTab() {
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [version, setVersion] = useState(0);
  async function act(row, action) {
    const ok = await ask({ title: `${action[0].toUpperCase()}${action.slice(1)} session ${row.name}?`, message: action === "close" ? "Closing makes the session read-only and closes active enrollments. Promote students before closing." : action === "archive" ? "Archived sessions remain readable but cannot be edited." : "This becomes the current session for new admissions, attendance and fees.", input: false, danger: action !== "activate" });
    if (!ok) return;
    try { await setupApi.session(row.id, action); toast.success(`Session ${action}d`); setVersion((v) => v + 1); } catch (e) { toast.error(e); }
  }
  return (
    <div className="space-y-5">
      <ResourceManager key={version} embedded config={{
        title: "Academic sessions", singular: "Session", endpoint: "/academic-years", module: "academic", delete: false,
        subtitle: "Create, activate, close and archive sessions (SYS-02, AC-01). Previous sessions stay intact (ACA-07).",
        columns: [{ key: "name", label: "Session" }, { key: "startDate", label: "Start", type: "date" }, { key: "endDate", label: "End", type: "date" }, { key: "calendarType", label: "Calendar" },
          { key: "isCurrent", label: "Current", type: "boolean" }, { key: "status", label: "Status", type: "badge" }],
        fields: [{ key: "name", label: "Name", required: true, placeholder: "2026 or 2026-27 or 1447-48" }, { key: "calendarType", label: "Calendar", type: "select", options: ["Gregorian", "Hijri", "Bangla"], default: "Gregorian" },
          { key: "startDate", label: "Start date", type: "date", required: true }, { key: "endDate", label: "End date", type: "date", required: true }, { key: "status", label: "Status", type: "select", options: ["Upcoming", "Active"], default: "Upcoming" }],
        rowActions: (r) => [
          { label: "Activate", icon: Play, show: !r.isCurrent && !["Closed", "Archived"].includes(r.status), onClick: () => act(r, "activate") },
          { label: "Close", show: r.status === "Active" || r.isCurrent, onClick: () => act(r, "close") },
          { label: "Archive", show: r.status === "Closed", onClick: () => act(r, "archive") },
        ],
        canEditRow: (r) => r.status !== "Archived",
      }} />
      {dialog}
    </div>
  );
}

function PoliciesTab() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { systemSettingsApi.get().then(setS).catch((e) => toast.error(e)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!s) return <Spinner />;
  const set = (k, v) => setS({ ...s, [k]: v });
  const num = (k) => (e) => set(k, e.target.value === "" ? "" : Number(e.target.value));
  const chk = (k, label) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={Boolean(s[k])} onChange={(e) => set(k, e.target.checked)} /> {label}</label>;
  async function save() {
    setSaving(true);
    try {
      const { id, updatedAt, ...rest } = s;
      void id; void updatedAt;
      setS(await systemSettingsApi.update(rest));
      toast.success("Policies saved");
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  }
  const gw = s.paymentGateways || {};
  const mods = s.enabledModules || [];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Language, calendar & formats" subtitle="Bangla default with English option; BDT; Bangladesh date format (SYS-04, NFR-08)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default language"><Select value={s.language} onChange={(e) => set("language", e.target.value)} options={[{ value: "bn", label: "বাংলা" }, { value: "en", label: "English" }]} /></Field>
          <Field label="Digits"><Select value={s.digitSystem} onChange={(e) => set("digitSystem", e.target.value)} options={[{ value: "en", label: "English 0-9" }, { value: "bn", label: "বাংলা ০-৯" }]} /></Field>
          <Field label="Primary calendar"><Select value={s.calendarType} onChange={(e) => set("calendarType", e.target.value)} options={["Gregorian", "Hijri", "Bangla"]} /></Field>
          <Field label="Date format"><Select value={s.dateFormat} onChange={(e) => set("dateFormat", e.target.value)} options={["DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"]} /></Field>
          <Field label="Timezone"><Input value={s.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
          <Field label="Currency"><Input value={s.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
        </div>
      </Card>
      <Card title="Attendance & notifications" subtitle="Edit window, late cut-off, absence alerts (AT-04/05/07)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Edit window (days)" hint="0 = same day only"><Input type="number" min="0" value={s.attendanceEditWindowDays} onChange={num("attendanceEditWindowDays")} /></Field>
          <Field label="Late after (HH:MM)"><Input type="time" value={s.attendanceCutoffTime} onChange={(e) => set("attendanceCutoffTime", e.target.value)} /></Field>
          <Field label="Consecutive absence alert"><Input type="number" min="1" value={s.consecutiveAbsenceThreshold} onChange={num("consecutiveAbsenceThreshold")} /></Field>
          <Field label="Staff: late days = 1 day deduction" hint="0 = no late deduction (AT-11)"><Input type="number" min="0" value={s.lateDaysPerDeduction} onChange={num("lateDaysPerDeduction")} /></Field>
          <Field label="Staff: half day counts as (day)"><Input type="number" step="0.25" min="0" max="1" value={s.halfDayCountsAs} onChange={num("halfDayCountsAs")} /></Field>
          <Field label="SMS failure fallback channel" hint="Used only when an SMS finally fails (COM-07)"><Select value={s.smsFallbackChannel || ""} onChange={(e) => set("smsFallbackChannel", e.target.value || null)} options={["Portal", "Push", "Email", "WhatsApp"]} placeholder="No fallback" /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" className="accent-blue-600" checked={Boolean(s.teacherQuietHours?.enabled)} onChange={(e) => set("teacherQuietHours", { ...(s.teacherQuietHours || {}), enabled: e.target.checked })} /> Mute guardian messages to teachers outside school hours (v1 CM-05)</label>
          <Field label="Quiet from"><Input type="time" value={s.teacherQuietHours?.start || "18:00"} onChange={(e) => set("teacherQuietHours", { ...(s.teacherQuietHours || {}), start: e.target.value })} /></Field>
          <Field label="Quiet until"><Input type="time" value={s.teacherQuietHours?.end || "08:00"} onChange={(e) => set("teacherQuietHours", { ...(s.teacherQuietHours || {}), end: e.target.value })} /></Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {chk("notifyAbsent", "SMS guardian when absent")}{chk("notifyLate", "SMS guardian when late")}
          {chk("notifyEntryExit", "Entry / exit alerts from devices")}{chk("notifyResult", "Result published notification")}
          {chk("notifyFeeReminder", "Automatic fee reminders")}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="SMS sender ID"><Input value={s.smsSenderId || ""} onChange={(e) => set("smsSenderId", e.target.value)} /></Field>
          <Field label="SMS provider"><Input value={s.smsProvider || ""} onChange={(e) => set("smsProvider", e.target.value)} placeholder="e.g. BulkSMSBD" /></Field>
          <Field label="Cost per SMS part (৳)"><Input type="number" step="0.01" value={s.smsCostPerPart} onChange={num("smsCostPerPart")} /></Field>
        </div>
      </Card>
      <Card title="Fees & accounts" subtitle="Invoice schedule, reminders, approval thresholds (FE-07/14, ACC-03)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Generate monthly invoices on day"><Input type="number" min="1" max="28" value={s.invoiceGenerationDay} onChange={num("invoiceGenerationDay")} /></Field>
          <Field label="Send fee reminders on day"><Input type="number" min="1" max="28" value={s.feeReminderDay} onChange={num("feeReminderDay")} /></Field>
          <Field label="Expense approval above (৳)"><Input type="number" value={s.expenseApprovalThreshold} onChange={num("expenseApprovalThreshold")} /></Field>
          <Field label="Committee approval above (৳)" hint="Edit the full chain in Approvals → Approval rules"><Input type="number" value={s.committeeApprovalThreshold} onChange={num("committeeApprovalThreshold")} /></Field>
          <Field label="Maximum total discount (%)" hint="Cap for scholarship + sibling + waiver (FIN-05)"><Input type="number" min="0" max="100" value={s.maxDiscountPercent} onChange={num("maxDiscountPercent")} /></Field>
          <Field label="Escalate pending approvals after (hours)" hint="Reminder + escalation (v1 RP-18)"><Input type="number" min="1" value={s.approvalEscalationHours} onChange={num("approvalEscalationHours")} /></Field>
        </div>
        <div className="mt-3">{chk("allowDiscountStacking", "Allow several discounts on one invoice (off = only the largest applies) (FE-09)")}</div>
        <p className="mt-3 text-xs font-semibold text-slate-600">Online payment gateways (FE-10)</p>
        <div className="mt-1 flex flex-wrap gap-4">
          {["cash", "bkash", "nagad", "rocket", "sslcommerz"].map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" className="accent-blue-600" checked={Boolean(gw[g])} onChange={(e) => set("paymentGateways", { ...gw, [g]: e.target.checked })} /> {g}</label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Merchant credentials are configured on the server (.env). Without them only the development sandbox is available.</p>
      </Card>
      <Card title="Exams, results & ID cards" subtitle="Admit card / result block on dues, card numbering & approval (EX-05, §7.4)">
        <div className="grid gap-2 sm:grid-cols-2">
          {chk("admitCardBlockOnDue", "Block admit card when fees are due")}{chk("resultHideOnDue", "Hide result from guardians when fees are due")}
          {chk("cardPrintRequiresApproval", "ID card printing requires approval")}{chk("requireNewCardEachSession", "New ID card required each session")}
          {chk("publicAdmissionEnabled", "Public online admission portal")}{chk("publicResultEnabled", "Public online result lookup")}
          {chk("formFillupBlockOnTestFail", "Block board form fill-up when the student failed the test exam (BM-05)")}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Student card prefix"><Input value={s.cardNumberPrefix} onChange={(e) => set("cardNumberPrefix", e.target.value)} /></Field>
          <Field label="Staff card prefix"><Input value={s.staffCardNumberPrefix} onChange={(e) => set("staffCardNumberPrefix", e.target.value)} /></Field>
          <Field label="Card validity (months)"><Input type="number" value={s.cardValidityMonths} onChange={num("cardValidityMonths")} /></Field>
        </div>
      </Card>
      <Card title="Security" subtitle="Session timeout, lockout, maker–checker exception (NFR-13, §26)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Session timeout (minutes)"><Input type="number" value={s.sessionTimeoutMinutes} onChange={num("sessionTimeoutMinutes")} /></Field>
          <Field label="Lock account after failed logins"><Input type="number" value={s.maxLoginAttempts} onChange={num("maxLoginAttempts")} /></Field>
        </div>
        <div className="mt-3">{chk("allowSelfApproval", "Exception policy: allow makers to approve their own requests (not recommended)")}</div>
      </Card>
      <Card title="Optional modules" subtitle="Turn modules on for this institution (v1 PC-04)">
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULE_TOGGLES.map(([k, label]) => {
            const optIn = OPT_IN.includes(k);
            const on = optIn ? mods.includes(k) : !mods.includes(`!${k}`);
            const toggle = (checked) => {
              const rest = mods.filter((m) => m !== k && m !== `!${k}`);
              set("enabledModules", optIn ? (checked ? [...rest, k] : rest) : (checked ? rest : [...rest, `!${k}`]));
            };
            return <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={on} onChange={(e) => toggle(e.target.checked)} /> {label}</label>;
          })}
        </div>
      </Card>
      <div className="xl:col-span-2"><Button icon={Save} loading={saving} onClick={save}>Save all policies</Button></div>
    </div>
  );
}

function BackupTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const load = useCallback(() => http.get("/backups").then(setRows).catch((e) => toast.error(e)), [toast]);
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function backupNow() {
    setBusy(true);
    try { const r = await http.post("/backups"); toast.success(`Backup created: ${r.tables} tables, ${r.rows} rows`); load(); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }
  async function verify(file) {
    try { setReport(await http.post(`/backups/${encodeURIComponent(file)}/verify`)); } catch (e) { toast.error(e); }
  }
  async function download(file) {
    const res = await fetch(`/api/backend/backups/${encodeURIComponent(file)}/download`, { headers: { Authorization: `Bearer ${localStorage.getItem("edumanage-token")}` } });
    if (!res.ok) { toast.error("Download failed"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
  }
  return (
    <div className="space-y-5">
      <Card title="Data backup & restore drill" subtitle="Daily automatic backups (2 AM) with checksum; run a restore drill to verify integrity without touching live data (NFR-05, NFX-03)."
        actions={<Button icon={Database} loading={busy} onClick={backupNow}>Back up now</Button>}>
        <Table rows={rows} rowKey="file" columns={[
          { key: "file", label: "File" }, { key: "createdAt", label: "Created", render: (r) => formatDateTime(r.createdAt) },
          { key: "size", label: "Size", render: (r) => `${(r.size / 1024).toFixed(1)} KB` },
          { key: "a", label: "", render: (r) => <div className="flex justify-end gap-1"><Button size="sm" variant="secondary" icon={ShieldCheck} onClick={() => verify(r.file)}>Restore drill</Button><Button size="sm" variant="ghost" icon={DownloadCloud} onClick={() => download(r.file)} /></div> },
        ]} />
        <p className="mt-3 text-xs text-slate-500">For full disaster recovery also schedule <code>pg_dump</code> of the PostgreSQL database to off-site storage (see README).</p>
      </Card>
      {report && (
        <Card title={`Restore drill: ${report.file}`} subtitle={`Created ${formatDate(report.createdAt)} · ${report.tables} tables · ${report.totalRows} rows`}
          actions={<Badge tone={report.checksumValid ? "green" : "red"}>{report.checksumValid ? "Checksum valid" : "Checksum mismatch"}</Badge>}>
          <Table dense rows={report.report} rowKey="table" columns={[{ key: "table", label: "Table" }, { key: "backupRows", label: "Rows in backup" }, { key: "liveRows", label: "Rows now" }]} />
        </Card>
      )}
    </div>
  );
}

export default function InstitutionSetup() {
  const [tab, setTab] = useState("profile");
  return (
    <div>
      <PageHeader title="Institution Setup" icon={Building2} subtitle="Profile & branding, education lines, sessions, policies, structure, grading and backups." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "profile", label: "Profile & Branding" }, { key: "type", label: "Institution Type" }, { key: "sessions", label: "Sessions" },
        { key: "policies", label: "Policies" }, { key: "structure", label: "Branches, Shifts & Rooms" }, { key: "grading", label: "Grading" }, { key: "backup", label: "Backup" },
      ]} />
      {tab === "profile" && <ProfileTab />}
      {tab === "type" && <PresetsTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "policies" && <PoliciesTab />}
      {tab === "structure" && (
        <div className="space-y-5">
          <ResourceManager embedded config={CONFIGS.branches} />
          <div className="grid gap-5 xl:grid-cols-2">
            <ResourceManager embedded config={CONFIGS.shifts} />
            <ResourceManager embedded config={CONFIGS.studentGroups} />
          </div>
          <ResourceManager embedded config={CONFIGS.rooms} />
        </div>
      )}
      {tab === "grading" && <ResourceManager embedded config={CONFIGS.gradeScales} />}
      {tab === "backup" && <BackupTab />}
    </div>
  );
}
