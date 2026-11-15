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
      {!editing && (
        <Tabs value={tab} onChange={setTab} tabs={[
          { key: "gallery", label: "Template Gallery" }, { key: "generate", label: "Generate & Print" },
          { key: "history", label: "Print History" }, { key: "cards", label: "Issued Cards & Replacements" },
        ]} />
      )}
      {editing ? <TemplateEditor templateId={editing} institute={institute} onBack={() => setEditing(null)} />
        : tab === "gallery" ? <TemplateGallery institute={institute} onCustomize={setEditing} />
          : tab === "generate" ? <GenerateCards institute={institute} />
            : tab === "history" ? <PrintHistory institute={institute} />
              : <IssuedCards institute={institute} />}
    </div>
  );
}
