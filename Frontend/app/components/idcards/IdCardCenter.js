"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CreditCard, IdCard, ImageOff, Printer } from "lucide-react";
import { idCardsApi, instituteProfileApi } from "../../lib/api";
import { PageHeader, StatCard, Tabs } from "../ui/kit";
import TemplateGallery from "./TemplateGallery";
import TemplateEditor from "./TemplateEditor";
import GenerateCards from "./GenerateCards";
import { IssuedCards, PrintHistory } from "./IdCardRecords";

// ID Card Center (SRS §7, Appendix B): gallery, editor, generation, print history, replacements.
export default function IdCardCenter({ initialTab = "gallery" }) {
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(null);
  const [institute, setInstitute] = useState({});
  const [stats, setStats] = useState(null);
  const [generateFor, setGenerateFor] = useState("Student");

  useEffect(() => { setTab(initialTab); setEditing(null); }, [initialTab]);
  useEffect(() => {
    instituteProfileApi.get().then(setInstitute).catch(() => {});
    idCardsApi.stats().then(setStats).catch(() => {});
  }, [tab]);

  const active = (stats?.cards || []).filter((c) => c.status === "Active").reduce((s, c) => s + c.n, 0);
  const pendingJobs = (stats?.jobs || []).filter((j) => ["Queued", "Processing"].includes(j.status)).reduce((s, j) => s + j.n, 0);

  return (
    <div>
      <PageHeader title="ID Card Center" icon={IdCard} subtitle="Choose a ready-made design, brand it with your school's identity, then bulk-generate and print student and teacher ID cards." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active cards" value={active} icon={BadgeCheck} tone="green" />
        <StatCard label="Students without card" value={stats?.students?.withoutCard ?? "—"} icon={CreditCard} tone="amber" />
        <StatCard label="Students missing photo" value={stats?.students?.missingPhoto ?? "—"} icon={ImageOff} tone="red" />
        <StatCard label="Print jobs pending" value={pendingJobs} icon={Printer} tone="blue" />
      </div>
      {stats && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700"><ImageOff size={16} className="text-rose-500" /> Missing ID photos:</span>
          {[["Student", "Students", stats.students], ["Teacher", "Teachers", stats.teachers], ["Staff", "Staff", stats.staff]].map(([type, label, st]) => (
            <button
              key={type}
              type="button"
              onClick={() => { setGenerateFor(type); setEditing(null); setTab("generate"); }}
              className={`rounded-full px-3 py-1 font-semibold transition ${st?.missingPhoto ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
              title={`Open Generate & Print for ${label.toLowerCase()}`}
            >
              {label}: {st?.missingPhoto ?? 0} of {st?.total ?? 0}
            </button>
          ))}
        </div>
      )}
      {!editing && (
        <Tabs value={tab} onChange={setTab} tabs={[
          { key: "gallery", label: "Template Gallery" }, { key: "generate", label: "Generate & Print" },
          { key: "history", label: "Print History" }, { key: "cards", label: "Issued Cards & Replacements" },
        ]} />
      )}
      {editing ? <TemplateEditor templateId={editing} institute={institute} onBack={() => setEditing(null)} />
        : tab === "gallery" ? <TemplateGallery institute={institute} onCustomize={setEditing} />
          : tab === "generate" ? <GenerateCards key={generateFor} institute={institute} initialHolderType={generateFor} />
            : tab === "history" ? <PrintHistory institute={institute} />
              : <IssuedCards institute={institute} />}
    </div>
  );
}
