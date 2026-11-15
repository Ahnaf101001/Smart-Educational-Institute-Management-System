"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Printer, ShieldCheck, Upload, Users } from "lucide-react";
import { idCardsApi, resource, uploadsApi } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, useToast } from "../ui/kit";
import { CardFace } from "./CardRenderer";
import PrintPreview from "./PrintPreview";

export default function GenerateCards({ institute }) {
  const { user } = useUser();
  const toast = useToast();
  const [holderType, setHolderType] = useState("Student");
  const [filters, setFilters] = useState({ classId: "", section: "", shift: "", status: "Active", rollFrom: "", rollTo: "", search: "" });
  const [classes, setClasses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [holders, setHolders] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [allowPlaceholder, setAllowPlaceholder] = useState(false);
  const [reissue, setReissue] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [printJob, setPrintJob] = useState(null);

  useEffect(() => {
    resource("/classes").all().then(setClasses).catch(() => {});
    resource("/shifts").all().then(setShifts).catch(() => {});
  }, []);
  useEffect(() => {
    idCardsApi.templates({ audience: holderType === "Student" ? "Student" : "Teacher" }).then((t) => {
      const usable = t.filter((x) => x.status === "Published" || Number(x.version) > 1 || x.isSystem);
      setTemplates(usable);
      setTemplateId((usable.find((x) => x.isDefault) || usable[0])?.id || "");
    }).catch(() => {});
    setReport(null);
    setSelected(new Set());
  }, [holderType]);

  const cls = classes.find((c) => c.id === filters.classId);
  const template = templates.find((t) => t.id === templateId);

  const loadHolders = useCallback(async () => {
    setLoading(true);
    setReport(null);
    try {
      const rows = await idCardsApi.holders({ holderType, ...filters });
      setHolders(rows);
      setSelected(new Set(rows.map((r) => r.id)));
    } catch (e) { toast.error(e); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holderType, filters]);
  useEffect(() => { if (holderType !== "Student" || filters.classId) loadHolders(); else setHolders([]); }, [holderType, filters.classId, filters.section, filters.shift, filters.status, loadHolders]);

  const selectedIds = useMemo(() => holders.filter((h) => selected.has(h.id)).map((h) => h.id), [holders, selected]);

  async function validate() {
    if (!selectedIds.length) { toast.warning("Select at least one person."); return; }
    try {
      setReport(await idCardsApi.validate({ holderType, holderIds: selectedIds, templateId }));
    } catch (e) { toast.error(e); }
  }

  async function uploadPhoto(holder, file) {
    try {
      const up = await uploadsApi.upload(file, { category: "photo" });
      const path = holderType === "Student" ? "/students" : holderType === "Teacher" ? "/teachers" : "/staff";
      await resource(path).update(holder.id, { photoUrl: up.url });
      toast.success(`Photo saved for ${holder.name}`);
      await loadHolders();
      setReport(null);
    } catch (e) { toast.error(e); }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await idCardsApi.generate({ holderType, holderIds: selectedIds, templateId, allowPlaceholder, reissue });
      if (!res.cards.length) {
        toast.warning(`No new cards: ${res.skipped.length} already have an active card (enable re-issue to replace them).`);
        return;
      }
      toast.success(`${res.cards.length} card(s) issued${res.skipped.length ? `, ${res.skipped.length} skipped` : ""}. Print job ${res.job.id} created.`);
      const job = await idCardsApi.job(res.job.id);
      setPrintJob(job);
      setReport(null);
      loadHolders();
    } catch (e) {
      if (e.details?.missingPhoto) setReport(e.details);
      toast.error(e);
    } finally { setGenerating(false); }
  }

  const blocking = report && (report.missingFields.length > 0 || (report.missingPhoto.length > 0 && !allowPlaceholder));
  const canOverride = user?.isAdmin || can(user, "idcards", "approve");

  return (
    <div className="space-y-5">
      <Card title="1 · Choose people" subtitle="Filter by session, class, section, shift, status or roll range (IDC-16/17)">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Field label="Card for"><Select value={holderType} onChange={(e) => setHolderType(e.target.value)} options={["Student", "Teacher", "Staff"]} /></Field>
          {holderType === "Student" && (
            <>
              <Field label="Class"><Select value={filters.classId} onChange={(e) => setFilters({ ...filters, classId: e.target.value, section: "" })} options={classes.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select class" /></Field>
              <Field label="Section"><Select value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })} options={cls?.sections || []} placeholder="All" /></Field>
              <Field label="Shift"><Select value={filters.shift} onChange={(e) => setFilters({ ...filters, shift: e.target.value })} options={shifts.map((s) => s.name)} placeholder="All" /></Field>
              <Field label="Roll from"><Input type="number" value={filters.rollFrom} onChange={(e) => setFilters({ ...filters, rollFrom: e.target.value })} /></Field>
              <Field label="Roll to"><Input type="number" value={filters.rollTo} onChange={(e) => setFilters({ ...filters, rollTo: e.target.value })} /></Field>
            </>
          )}
          <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={["Active", "Inactive"]} /></Field>
          <Field label="Search"><Input value={filters.search} placeholder="Name / ID" onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === "Enter" && loadHolders()} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={Users} onClick={loadHolders}>Load list</Button>
          <span className="text-sm text-slate-500">{selectedIds.length} of {holders.length} selected</span>
          {holders.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(holders.map((h) => h.id)))}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(holders.filter((h) => !h.activeCardNumber).map((h) => h.id)))}>Only without card</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </>
          )}
        </div>
        <div className="mt-4">
          {loading ? <Spinner /> : !holders.length ? <EmptyState title={holderType === "Student" && !filters.classId ? "Select a class to load students." : "No matching people."} /> : (
            <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-2"><input type="checkbox" className="accent-blue-600" checked={selected.size === holders.length} onChange={(e) => setSelected(e.target.checked ? new Set(holders.map((h) => h.id)) : new Set())} /></th>
                    <th className="px-3 py-2">Photo</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">ID</th><th className="px-3 py-2">{holderType === "Student" ? "Class / Roll" : "Designation"}</th><th className="px-3 py-2">Active card</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holders.map((h) => (
                    <tr key={h.id} className="bg-white">
                      <td className="px-3 py-2"><input type="checkbox" className="accent-blue-600" checked={selected.has(h.id)} onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(h.id); else next.delete(h.id); setSelected(next); }} /></td>
                      <td className="px-3 py-2">{h.photoUrl ? <img src={h.photoUrl} alt="" className="size-9 rounded-lg object-cover" /> : <span className="inline-grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-500"><ImageIcon size={16} /></span>}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800">{h.name}</td>
                      <td className="px-3 py-2 text-slate-500">{h.id}</td>
                      <td className="px-3 py-2">{holderType === "Student" ? `${h.className || ""} · ${h.roll || "—"}` : h.designation || "—"}</td>
                      <td className="px-3 py-2">{h.activeCardNumber ? <Badge tone="green">{h.activeCardNumber}</Badge> : <Badge tone="slate">None</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card title="2 · Template & validation" subtitle="Missing photos / required fields stop bulk generation – no silent blank cards (IDC-18, §7.4)">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <Field label="Template"><Select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setReport(null); }} options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.category}, v${t.version})${t.isDefault ? " – default" : ""}` }))} /></Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={ShieldCheck} onClick={validate} disabled={!selectedIds.length || !templateId}>Validate selection</Button>
            </div>
            {report && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-2xl font-extrabold text-blue-700">{report.total}</p><p className="text-xs font-semibold text-blue-700">Total cards</p></div>
                  <div className={`rounded-xl p-3 text-center ${report.missingPhoto.length ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}><p className="text-2xl font-extrabold">{report.missingPhoto.length}</p><p className="text-xs font-semibold">Missing photo</p></div>
                  <div className={`rounded-xl p-3 text-center ${report.missingFields.length ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}><p className="text-2xl font-extrabold">{report.missingFields.length}</p><p className="text-xs font-semibold">Missing required field</p></div>
                  <div className={`rounded-xl p-3 text-center ${report.duplicates.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><p className="text-2xl font-extrabold">{report.duplicates.length}</p><p className="text-xs font-semibold">Already have active card</p></div>
                </div>
                {report.missingPhoto.length > 0 && (
                  <div className="rounded-xl border border-rose-100 p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-700"><AlertTriangle size={16} /> Missing photos – upload now or use an authorised placeholder</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {report.missingPhoto.map((m) => (
                        <label key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-rose-50/60 px-3 py-2 text-sm">
                          <span>{m.name} <span className="text-xs text-slate-500">({m.id})</span></span>
                          <span className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-blue-600 shadow-sm"><Upload size={13} /> Upload
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files[0] && uploadPhoto(m, e.target.files[0])} />
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {report.missingFields.length > 0 && (
                  <div className="rounded-xl border border-rose-100 p-3 text-sm">
                    <p className="mb-1 font-bold text-rose-700">Missing required fields (fix in the profile)</p>
                    {report.missingFields.map((m) => <p key={m.id}>{m.name}: <b>{m.missing.join(", ")}</b></p>)}
                  </div>
                )}
                {report.warnings?.length > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-sm text-amber-800">
                    <p className="mb-1 font-bold">Optional fields empty (card shows them blank)</p>
                    {report.warnings.slice(0, 8).map((m) => <p key={m.id}>{m.name}: {m.missing.join(", ")}</p>)}
                    {report.warnings.length > 8 && <p>…and {report.warnings.length - 8} more</p>}
                  </div>
                )}
                {report.duplicates.length > 0 && (
                  <label className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    <input type="checkbox" className="accent-amber-600" checked={reissue} onChange={(e) => setReissue(e.target.checked)} />
                    Re-issue: replace the existing active card for {report.duplicates.length} person(s) (old card becomes “Replaced”). Otherwise they are skipped.
                  </label>
                )}
                {report.missingPhoto.length > 0 && (
                  <label className={`flex items-center gap-2 rounded-xl p-3 text-sm ${canOverride ? "bg-slate-50" : "bg-slate-50 opacity-60"}`}>
                    <input type="checkbox" className="accent-blue-600" disabled={!canOverride} checked={allowPlaceholder} onChange={(e) => setAllowPlaceholder(e.target.checked)} />
                    Admin override: print a placeholder silhouette for missing photos (recorded in the audit log). {!canOverride && "Requires approver permission."}
                  </label>
                )}
                <Button icon={blocking ? AlertTriangle : CheckCircle2} variant={blocking ? "secondary" : "primary"} disabled={blocking || !report.total} loading={generating} onClick={generate}>
                  {blocking ? "Resolve issues to continue" : `Generate ${report.total - (reissue ? 0 : report.duplicates.length)} card(s)`}
                </Button>
              </div>
            )}
          </div>
          {template && (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4">
              <CardFace template={template} side="front" institute={institute} data={(holders.find((h) => selected.has(h.id)) || {}).snapshot || {}} scale={template.orientation === "landscape" ? 1.1 : 1.35} />
              <span className="text-xs text-slate-500">Preview with first selected person</span>
            </div>
          )}
        </div>
      </Card>

      {printJob && (
        <Card title="3 · Print" actions={<Button icon={Printer} onClick={() => setPrintJob({ ...printJob, open: true })}>Open print preview</Button>}>
          <p className="text-sm text-slate-600">Job <b>{printJob.job.id}</b> – {printJob.cards.length} card(s), template {printJob.template?.name} v{printJob.template?.version}. Status: <Badge>{printJob.job.status}</Badge></p>
        </Card>
      )}
      <PrintPreview
        open={Boolean(printJob?.open)}
        onClose={() => setPrintJob((p) => ({ ...p, open: false }))}
        job={printJob?.job}
        template={printJob?.template}
        cards={printJob?.cards || []}
        institute={printJob?.institute || institute}
        onStatusChange={(status) => setPrintJob((p) => ({ ...p, job: { ...p.job, status } }))}
      />
    </div>
  );
}
