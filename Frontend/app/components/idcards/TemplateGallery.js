"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, Palette, Search, Star } from "lucide-react";
import { idCardsApi } from "../../lib/api";
import { can, useUser } from "../../lib/access";
import { Badge, Button, EmptyState, Modal, Select, Spinner, Tabs, useToast, usePrompt } from "../ui/kit";
import { CardFace, SAMPLE_STUDENT, SAMPLE_TEACHER } from "./CardRenderer";

const CATEGORIES = ["Modern", "Classic", "Minimal", "Colorful", "Formal", "School-branded"];

export function sampleFor(template) {
  return template?.audience === "Student" ? SAMPLE_STUDENT : SAMPLE_TEACHER;
}

export default function TemplateGallery({ institute, onCustomize }) {
  const { user } = useUser();
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [audience, setAudience] = useState("Student");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [side, setSide] = useState("front");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await idCardsApi.templates({ audience, category, search }));
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, category, search]);
  useEffect(() => { load(); }, [load]);

  async function makeDefault(t) {
    try {
      await idCardsApi.setDefault(t.id);
      toast.success(`${t.name} is now the default ${t.audience.toLowerCase()} template`);
      load();
    } catch (e) { toast.error(e); }
  }
  async function duplicate(t) {
    const name = await ask({ title: "Create a customised copy", placeholder: "Template name", defaultValue: `${t.name} – ${institute?.name || "Custom"}` });
    if (!name) return;
    try {
      const copy = await idCardsApi.duplicate(t.id, { name });
      toast.success("Copy created – opening editor");
      onCustomize?.(copy.id);
    } catch (e) { toast.error(e); }
  }

  const canEdit = can(user, "idcards", "edit");
  return (
    <div>
      <Tabs tabs={[{ key: "Student", label: "Student templates" }, { key: "Teacher", label: "Teacher / Staff templates" }]} value={audience} onChange={setAudience} />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search size={16} className="text-slate-400" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Select className="!w-auto" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES} placeholder="All categories" />
      </div>
      {loading ? <Spinner /> : !templates.length ? <EmptyState title="No templates found." /> : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {templates.map((t) => {
            const landscape = t.orientation === "landscape";
            const scale = landscape ? 0.62 : 0.78;
            return (
              <div key={t.id} className={`dashboard-panel flex flex-col overflow-hidden ${t.isDefault ? "ring-2 ring-blue-500" : ""}`}>
                <div className="flex min-h-[290px] items-center justify-center gap-3 bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                  <CardFace template={t} side="front" data={sampleFor(t)} institute={institute} scale={scale} />
                  <CardFace template={t} side="back" data={sampleFor(t)} institute={institute} scale={scale * (landscape ? 1 : 0.86)} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{t.name}</h3>
                      <p className="text-xs text-slate-500">{t.description}</p>
                    </div>
                    {t.isDefault && <Badge tone="blue">Default</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="purple">{t.category}</Badge>
                    <Badge tone="slate">{t.orientation}</Badge>
                    <Badge tone="slate">{Number(t.widthMm).toFixed(1)} × {Number(t.heightMm).toFixed(1)} mm</Badge>
                    <Badge>{t.status}</Badge>
                    <Badge tone="slate">v{t.version}</Badge>
                    {t.isSystem && <Badge tone="indigo">Built-in</Badge>}
                    {Number(t.cardsIssued) > 0 && <Badge tone="green">{t.cardsIssued} issued</Badge>}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="secondary" icon={Eye} onClick={() => { setSide("front"); setPreview(t); }}>Preview</Button>
                    {canEdit && <Button size="sm" variant="secondary" icon={Palette} onClick={() => onCustomize?.(t.id)}>Customize</Button>}
                    {can(user, "idcards", "create") && <Button size="sm" variant="secondary" icon={Copy} onClick={() => duplicate(t)}>Duplicate</Button>}
                    {canEdit && !t.isDefault && <Button size="sm" icon={Star} disabled={t.status !== "Published"} title={t.status !== "Published" ? "Publish first" : ""} onClick={() => makeDefault(t)}>Set default</Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} width="max-w-3xl" title={preview ? `${preview.name} – live preview` : ""}
        footer={<Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>}>
        {preview && (
          <div>
            <Tabs tabs={[{ key: "front", label: "Front" }, { key: "back", label: "Back" }, { key: "actual", label: "Actual size" }]} value={side} onChange={setSide} />
            <div className="flex justify-center rounded-xl bg-slate-100 p-6">
              {side === "actual"
                ? <div className="flex gap-4"><CardFace template={preview} side="front" data={sampleFor(preview)} institute={institute} scale={1} /><CardFace template={preview} side="back" data={sampleFor(preview)} institute={institute} scale={1} /></div>
                : <CardFace template={preview} side={side} data={sampleFor(preview)} institute={institute} scale={preview.orientation === "landscape" ? 1.6 : 1.9} />}
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              {side === "actual" ? `Shown at physical size (${preview.widthMm} × ${preview.heightMm} mm) when your screen is at 100% zoom.` : "Preview uses sample data. Your school logo, name and address come from Institution Setup."}
            </p>
          </div>
        )}
      </Modal>
      {dialog}
    </div>
  );
}
