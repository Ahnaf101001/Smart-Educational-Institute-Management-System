"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Save, Send, Star } from "lucide-react";
import { idCardsApi, resource } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Badge, Button, Card, Field, Input, Select, Spinner, Tabs, Textarea, useToast, usePrompt } from "../ui/kit";
import { CardFace } from "./CardRenderer";
import { sampleFor } from "./TemplateGallery";

const STUDENT_FIELDS = [
  ["photo", "Photo"], ["name", "Name"], ["nameBn", "Name (Bangla)"], ["nameAr", "Name (Arabic)"], ["studentId", "Student ID"],
  ["className", "Class"], ["section", "Section"], ["roll", "Roll"], ["session", "Session"], ["shift", "Shift"], ["group", "Group"],
  ["dob", "Date of birth"], ["bloodGroup", "Blood group"], ["guardianPhone", "Guardian phone"], ["validity", "Validity"],
];
const TEACHER_FIELDS = [
  ["photo", "Photo"], ["name", "Name"], ["nameBn", "Name (Bangla)"], ["employeeId", "Employee ID"], ["designation", "Designation"],
  ["department", "Department"], ["bloodGroup", "Blood group"], ["phone", "Phone"], ["email", "Email"], ["joinDate", "Joining date"], ["validity", "Validity"],
];
const MOVABLE = ["institute", "title", "photo", "name", "nameBn", "nameAr", "designation", "details", "qr", "rules", "emergency", "address", "return", "signature"];
const FONTS = ["Inter", "Georgia", "Times New Roman", "Arial", "Verdana", "Trebuchet MS", "Noto Sans Bengali"];
const SIZE_PRESETS = [
  { key: "cr80p", label: "CR80 portrait (53.98 × 85.60)", w: 53.98, h: 85.6, o: "portrait" },
  { key: "cr80l", label: "CR80 landscape (85.60 × 53.98)", w: 85.6, h: 53.98, o: "landscape" },
  { key: "custom", label: "Custom size" },
];

function ColorInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2">
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xs uppercase outline-none" />
      </span>
    </Field>
  );
}

export default function TemplateEditor({ templateId, institute, onBack }) {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [tpl, setTpl] = useState(null);
  const [front, setFront] = useState({});
  const [back, setBack] = useState({});
  const [dims, setDims] = useState({ widthMm: 53.98, heightMm: 85.6, orientation: "portrait" });
  const [meta, setMeta] = useState({ name: "", category: "Modern" });
  const [tab, setTab] = useState("front");
  const [side, setSide] = useState("front");
  const [selected, setSelected] = useState(null);
  const [scale, setScale] = useState(2);
  const [sample, setSample] = useState(null);
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await idCardsApi.template(templateId);
      setTpl(t);
      setFront(t.frontConfig || {});
      setBack(t.backConfig || {});
      setDims({ widthMm: Number(t.widthMm), heightMm: Number(t.heightMm), orientation: t.orientation });
      setMeta({ name: t.name, category: t.category, description: t.description });
      setScale(t.orientation === "landscape" ? 1.7 : 2.1);
      setDirty(false);
    } catch (e) { toast.error(e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!tpl) return;
    const path = tpl.audience === "Student" ? "/students" : "/teachers";
    resource(path).list({ limit: 50, status: "Active" }).then((r) => setStudents(r.data || [])).catch(() => {});
  }, [tpl]);

  const fieldsList = tpl?.audience === "Student" ? STUDENT_FIELDS : TEACHER_FIELDS;
  const working = useMemo(() => (tpl ? { ...tpl, ...dims, frontConfig: front, backConfig: back } : null), [tpl, dims, front, back]);
  const data = useMemo(() => {
    if (!sample) return sampleFor(tpl);
    const s = students.find((x) => x.id === sample);
    if (!s) return sampleFor(tpl);
    return tpl.audience === "Student"
      ? { id: s.id, name: s.name, nameBn: s.nameBn, nameAr: s.nameAr, photoUrl: s.photoUrl, className: String(s.className || "").split("-")[0], section: s.section, roll: s.roll, shift: s.shift, group: s.groupName, dob: s.dateOfBirth, bloodGroup: s.bloodGroup, guardianPhone: s.parentContact, session: "" }
      : { id: s.id, name: s.name, nameBn: s.nameBn, photoUrl: s.photoUrl, designation: s.designation, department: s.department, bloodGroup: s.bloodGroup, phone: s.phone, email: s.email, joinDate: s.joinDate };
  }, [sample, students, tpl]);

  if (!tpl) return <Spinner />;
  const editable = can(user, "idcards", "edit");

  const updFront = (patch) => { setFront((f) => ({ ...f, ...patch })); setDirty(true); };
  const updBack = (patch) => { setBack((b) => ({ ...b, ...patch })); setDirty(true); };
  const cur = side === "front" ? front : back;
  const upd = side === "front" ? updFront : updBack;
  const colors = cur.colors || front.colors || {};
  const fieldStyle = (selected && cur.fieldStyles?.[selected]) || {};

  function onOffset(id, off) {
    upd({ offsets: { ...(cur.offsets || {}), [id]: off } });
  }
  function setFieldStyle(patch) {
    if (!selected) return;
    upd({ fieldStyles: { ...(cur.fieldStyles || {}), [selected]: { ...fieldStyle, ...patch } } });
  }
  function applyPreset(key) {
    const p = SIZE_PRESETS.find((x) => x.key === key);
    if (p?.w) { setDims({ widthMm: p.w, heightMm: p.h, orientation: p.o }); setDirty(true); }
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await idCardsApi.saveDraft(tpl.id, { ...meta, ...dims, frontConfig: front, backConfig: back });
      toast.success("Draft saved. Printing keeps using the last published version until you publish.");
      setDirty(false);
      await load();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  }
  async function publish() {
    setSaving(true);
    try {
      if (dirty) await idCardsApi.saveDraft(tpl.id, { ...meta, ...dims, frontConfig: front, backConfig: back });
      const t = await idCardsApi.publish(tpl.id);
      toast.success(`Published version ${t.version}. Previously printed cards keep their original version.`);
      await load();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  }
  async function reset() {
    const ok = await ask({ title: "Reset to the original design?", message: "Your unpublished changes will be replaced.", input: false, danger: true });
    if (!ok) return;
    try { await idCardsApi.reset(tpl.id); toast.success("Restored original design (draft)"); load(); } catch (e) { toast.error(e); }
  }
  async function makeDefault() {
    try { await idCardsApi.setDefault(tpl.id); toast.success("Set as default"); load(); } catch (e) { toast.error(e); }
  }

  const preset = SIZE_PRESETS.find((p) => p.w && Math.abs(p.w - dims.widthMm) < 0.01 && Math.abs(p.h - dims.heightMm) < 0.01)?.key || "custom";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Gallery</Button>
        <h2 className="text-lg font-extrabold text-slate-900">{meta.name}</h2>
        <Badge>{tpl.status}</Badge><Badge tone="slate">v{tpl.version}</Badge><Badge tone="purple">{tpl.audience}</Badge>
        {dirty && <Badge tone="amber">Unsaved changes</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          {(tpl.isSystem || tpl.baseTemplateId) && editable && <Button variant="secondary" icon={RotateCcw} onClick={reset}>Reset</Button>}
          {editable && <Button variant="secondary" icon={Save} loading={saving} onClick={saveDraft}>Save draft</Button>}
          {editable && <Button icon={Send} loading={saving} onClick={publish}>Publish</Button>}
          {editable && !tpl.isDefault && tpl.status === "Published" && !dirty && <Button variant="success" icon={Star} onClick={makeDefault}>Set default</Button>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card bodyClass="p-4">
          <Tabs tabs={[{ key: "front", label: "Front" }, { key: "back", label: "Back" }, { key: "card", label: "Card & fields" }]} value={tab} onChange={(t) => { setTab(t); if (t !== "card") setSide(t); }} />
          {tab === "card" && (
            <div className="space-y-3">
              <Field label="Template name"><Input value={meta.name} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true); }} /></Field>
              <Field label="Category"><Select value={meta.category} onChange={(e) => { setMeta({ ...meta, category: e.target.value }); setDirty(true); }} options={["Modern", "Classic", "Minimal", "Colorful", "Formal", "School-branded"]} /></Field>
              <Field label="Card size"><Select value={preset} onChange={(e) => applyPreset(e.target.value)} options={SIZE_PRESETS.map((p) => ({ value: p.key, label: p.label }))} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Width mm"><Input type="number" step="0.01" value={dims.widthMm} onChange={(e) => { setDims({ ...dims, widthMm: Number(e.target.value) }); setDirty(true); }} /></Field>
                <Field label="Height mm"><Input type="number" step="0.01" value={dims.heightMm} onChange={(e) => { setDims({ ...dims, heightMm: Number(e.target.value) }); setDirty(true); }} /></Field>
                <Field label="Orientation"><Select value={dims.orientation} onChange={(e) => { setDims({ ...dims, orientation: e.target.value }); setDirty(true); }} options={["portrait", "landscape"]} /></Field>
              </div>
              <p className="text-xs text-slate-500">The layout is designed for its original orientation; changing orientation keeps all fields but may need repositioning.</p>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Fields shown on the card</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {fieldsList.map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                      <input type="checkbox" className="accent-blue-600" checked={front.fields?.[k] ?? false} onChange={(e) => updFront({ fields: { ...(front.fields || {}), [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab !== "card" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <ColorInput label="Primary" value={colors.primary} onChange={(v) => upd({ colors: { ...colors, primary: v } })} />
                <ColorInput label="Secondary" value={colors.secondary} onChange={(v) => upd({ colors: { ...colors, secondary: v } })} />
                <ColorInput label="Accent" value={colors.accent} onChange={(v) => upd({ colors: { ...colors, accent: v } })} />
                <ColorInput label="Text" value={colors.text} onChange={(v) => upd({ colors: { ...colors, text: v } })} />
                <ColorInput label="Background" value={colors.background} onChange={(v) => upd({ colors: { ...colors, background: v } })} />
                {institute?.brandColor && <Button size="sm" variant="secondary" className="mt-5" onClick={() => upd({ colors: { ...colors, primary: institute.brandColor, secondary: institute.accentColor || colors.secondary } })}>Use school colours</Button>}
              </div>
              {side === "front" ? (
                <>
                  <Field label="Card title"><Input value={front.title || ""} onChange={(e) => updFront({ title: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Font"><Select value={front.fontFamily || "Inter"} onChange={(e) => updFront({ fontFamily: e.target.value })} options={FONTS} /></Field>
                    <Field label={`Text size ${Math.round((front.fontScale || 1) * 100)}%`}><input type="range" min="0.8" max="1.25" step="0.05" value={front.fontScale || 1} onChange={(e) => updFront({ fontScale: Number(e.target.value) })} className="mt-3 w-full accent-blue-600" /></Field>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-blue-600" checked={front.showLogo !== false} onChange={(e) => updFront({ showLogo: e.target.checked })} /> School logo</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-blue-600" checked={front.qr !== false} onChange={(e) => updFront({ qr: e.target.checked })} /> QR code</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-blue-600" checked={Boolean(front.barcode)} onChange={(e) => updFront({ barcode: e.target.checked })} /> Barcode</label>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Rules / instructions (one per line)"><Textarea rows={4} value={(back.rules || []).join("\n")} onChange={(e) => updBack({ rules: e.target.value.split("\n") })} /></Field>
                  <Field label="Return instruction"><Input value={back.returnText || ""} onChange={(e) => updBack({ returnText: e.target.value })} /></Field>
                  <Field label="Signature label"><Input value={back.signatureLabel || ""} onChange={(e) => updBack({ signatureLabel: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[["showRules", "Rules"], ["showEmergency", "Emergency contact"], ["showAddress", "Address"], ["showReturn", "Return text"], ["showSignature", "Signature"], ["qr", "QR code"], ["barcode", "Barcode"]].map(([k, l]) => (
                      <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-blue-600" checked={back[k] !== false} onChange={(e) => updBack({ [k]: e.target.checked })} /> {l}</label>
                    ))}
                  </div>
                </>
              )}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600">Selected element: <span className="text-blue-600">{selected || "click / drag an element on the card"}</span></p>
                {selected && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Font size (pt)"><Input type="number" step="0.5" value={fieldStyle.fontSize || ""} placeholder="auto" onChange={(e) => setFieldStyle({ fontSize: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                    <ColorInput label="Colour" value={fieldStyle.color} onChange={(v) => setFieldStyle({ color: v })} />
                    <Field label="Alignment"><Select value={fieldStyle.align || ""} onChange={(e) => setFieldStyle({ align: e.target.value || undefined })} options={["left", "center", "right"]} placeholder="auto" /></Field>
                    <Field label="Letter spacing (pt)"><Input type="number" step="0.1" value={fieldStyle.letterSpacing ?? ""} placeholder="auto" onChange={(e) => setFieldStyle({ letterSpacing: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
                    <Field label="Weight"><Select value={fieldStyle.fontWeight || ""} onChange={(e) => setFieldStyle({ fontWeight: e.target.value || undefined })} options={["400", "600", "700", "800", "900"]} placeholder="auto" /></Field>
                    <div className="flex items-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => onOffset(selected, { x: 0, y: 0 })}>Reset position</Button>
                    </div>
                    <p className="col-span-2 text-xs text-slate-500">Offset: x {cur.offsets?.[selected]?.x || 0} mm, y {cur.offsets?.[selected]?.y || 0} mm</p>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {MOVABLE.map((m) => <button key={m} type="button" onClick={() => setSelected(m)} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${selected === m ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{m}</button>)}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card bodyClass="p-4" title="Live preview" subtitle="Drag elements to reposition (snaps to 0.5 mm). Preview updates instantly; save to keep changes."
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <Select className="!h-9 !w-auto" value={sample || ""} onChange={(e) => setSample(e.target.value || null)} options={students.map((s) => ({ value: s.id, label: s.name }))} placeholder="Sample data" />
              <Tabs tabs={[{ key: "front", label: "Front" }, { key: "back", label: "Back" }]} value={side} onChange={setSide} />
              <input type="range" min="1" max="3.2" step="0.1" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-28 accent-blue-600" title="Zoom" />
            </div>
          )}>
          <div className="flex min-h-[560px] items-start justify-center overflow-auto rounded-xl bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-[length:12px_12px] p-6" onPointerDown={() => setSelected(null)}>
            <CardFace template={working} side={side} data={data} institute={institute} scale={scale} editable={editable} onOffset={onOffset} selected={selected} onSelect={setSelected} />
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">{dims.widthMm} × {dims.heightMm} mm · {dims.orientation} · zoom {Math.round(scale * 100)}%</p>
        </Card>
      </div>
      {dialog}
    </div>
  );
}
