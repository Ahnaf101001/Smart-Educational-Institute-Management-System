"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Lock, Save, Send, Unlock, Upload } from "lucide-react";
import { http, portalApi, resource } from "../../lib/api";
import { useUser } from "../../lib/access";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, Spinner, useToast, usePrompt } from "../ui/kit";

export default function MarksEntryPro() {
  const toast = useToast();
  const { ask, dialog } = usePrompt();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sel, setSel] = useState({ examId: "", classId: "", subjectId: "", section: "" });
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Teachers: their open marks sheets as one-tap shortcuts; a single open sheet is pre-selected
  // and the class list is limited to their own assignments. The server still enforces scope.
  const { user } = useUser();
  const isTeacher = user?.linkedType === "Teacher";
  const [mine, setMine] = useState({ pending: [], classIds: null });
  useEffect(() => {
    resource("/exams").all().then(setExams).catch(() => {});
    resource("/classes").all().then(setClasses).catch(() => {});
    if (!isTeacher) return;
    portalApi.teacherToday().then((d) => {
      const pending = d.marksPending || [];
      const classIds = (d.assignments || []).map((a) => a.classId);
      setMine({ pending, classIds: classIds.length ? new Set(classIds) : null });
      if (pending.length === 1) setSel((s) => (s.examId ? s : { examId: pending[0].examId, classId: pending[0].classId, subjectId: pending[0].subjectId, section: "" }));
    }).catch(() => {});
  }, [isTeacher]);
  const classOptions = mine.classIds ? classes.filter((c) => mine.classIds.has(c.id)) : classes;
  useEffect(() => {
    if (!sel.classId) { setSubjects([]); return; }
    resource("/class-subjects").all({ classId: sel.classId }).then(async (maps) => {
      const all = await resource("/subjects").all();
      const ids = new Set(maps.map((m) => m.subjectId));
      setSubjects(ids.size ? all.filter((s) => ids.has(s.id)) : all);
    }).catch(() => {});
  }, [sel.classId]);

  const load = useCallback(async () => {
    if (!sel.examId || !sel.classId || !sel.subjectId) return;
    setLoading(true);
    try {
      const s = await http.get("/marks/sheet", sel);
      setSheet(s);
      setRows(Object.fromEntries(s.students.map((st) => [st.id, {
        marksObtained: st.marksObtained ?? "", componentMarks: st.componentMarks || {}, isAbsent: Boolean(st.isAbsent), isExempt: Boolean(st.isExempt),
      }])));
    } catch (e) { toast.error(e); setSheet(null); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);
  useEffect(() => { load(); }, [load]);

  const comps = useMemo(() => sheet?.components || [], [sheet]);
  const locked = sheet && ["Submitted", "Locked", "Unlock Requested"].includes(sheet.entryStatus);
  const cls = classes.find((c) => c.id === sel.classId);

  function setCell(id, patch) { setRows((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } })); }
  function totalOf(r) {
    if (r.isAbsent || r.isExempt) return 0;
    if (comps.length) return comps.reduce((s, c) => s + Number(r.componentMarks?.[c.key] || 0), 0);
    return Number(r.marksObtained || 0);
  }
  const errors = useMemo(() => {
    const out = {};
    for (const [id, r] of Object.entries(rows)) {
      if (r.isAbsent || r.isExempt) continue;
      if (comps.length) {
        for (const c of comps) if (Number(r.componentMarks?.[c.key] || 0) > Number(c.fullMarks)) out[id] = `${c.label} > ${c.fullMarks}`;
      } else if (Number(r.marksObtained || 0) > Number(sheet?.fullMarks || 100)) out[id] = `> ${sheet?.fullMarks}`;
    }
    return out;
  }, [rows, comps, sheet]);

  async function save(submit) {
    if (Object.keys(errors).length) { toast.error("Fix marks above full marks first."); return; }
    if (submit) {
      const ok = await ask({ title: "Submit and lock marks?", message: "After submission you cannot edit without Principal approval.", input: false });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const records = Object.entries(rows).map(([studentId, r]) => ({
        studentId, isAbsent: r.isAbsent, isExempt: r.isExempt,
        ...(comps.length ? { componentMarks: r.componentMarks } : { marksObtained: r.marksObtained === "" ? null : Number(r.marksObtained) }),
      }));
      await http.put("/marks/entry", { ...sel, records, submit });
      toast.success(submit ? "Marks submitted and locked" : "Draft saved");
      load();
    } catch (e) {
      toast.error(e.details?.errors ? `${e.message} ${e.details.errors.map((x) => `${x.studentId}: ${x.error}`).join("; ")}` : e);
    } finally { setSaving(false); }
  }
  async function requestUnlock() {
    const reason = await ask({ title: "Request unlock", placeholder: "Why do the marks need to change?" });
    if (!reason) return;
    try { await http.post("/marks/unlock-request", { ...sel, reason }); toast.success("Unlock request sent to the Principal"); load(); } catch (e) { toast.error(e); }
  }
  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const header = ["Student ID", "Roll", "Name", ...(comps.length ? comps.map((c) => `${c.label} (${c.fullMarks})`) : [`Marks (${sheet.fullMarks})`]), "Absent (Y/N)"];
    const data = sheet.students.map((s) => [s.id, s.roll, s.name, ...(comps.length ? comps.map((c) => rows[s.id]?.componentMarks?.[c.key] ?? "") : [rows[s.id]?.marksObtained ?? ""]), rows[s.id]?.isAbsent ? "Y" : ""]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...data]), "Marks");
    XLSX.writeFile(wb, `marks-${sheet.exam.name}-${sheet.subject.code}.xlsx`.replace(/\s+/g, "_"));
  }
  async function uploadExcel(file) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const issues = [];
    const next = { ...rows };
    for (const line of aoa.slice(1)) {
      const [id, , , ...vals] = line;
      if (!id || !next[id]) { if (id) issues.push(`${id}: not in this class`); continue; }
      const absent = String(vals[vals.length - 1] || "").toUpperCase() === "Y";
      if (comps.length) {
        const cm = {};
        comps.forEach((c, i) => { if (vals[i] !== undefined && vals[i] !== "") cm[c.key] = Number(vals[i]); if (Number(vals[i]) > Number(c.fullMarks)) issues.push(`${id}: ${c.label} ${vals[i]} > ${c.fullMarks}`); });
        next[id] = { ...next[id], componentMarks: cm, isAbsent: absent };
      } else {
        if (Number(vals[0]) > Number(sheet.fullMarks)) issues.push(`${id}: ${vals[0]} > ${sheet.fullMarks}`);
        next[id] = { ...next[id], marksObtained: vals[0] ?? "", isAbsent: absent };
      }
    }
    setRows(next);
    if (issues.length) toast.warning(`Validation report: ${issues.slice(0, 6).join("; ")}${issues.length > 6 ? "…" : ""}`);
    else toast.success("Excel loaded – review and save");
  }

  return (
    <div>
      <PageHeader title="Marks Entry" icon={FileSpreadsheet} subtitle="Pick the exam, class and subject, type the marks, save a draft, then submit to lock." />
      {mine.pending.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Your open marks sheets</p>
          <div className="flex flex-wrap gap-2">
            {mine.pending.map((p) => {
              const on = sel.examId === p.examId && sel.classId === p.classId && sel.subjectId === p.subjectId;
              return (
                <button key={`${p.examId}-${p.classId}-${p.subjectId}`} type="button" onClick={() => setSel({ examId: p.examId, classId: p.classId, subjectId: p.subjectId, section: "" })}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${on ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                  <b className="block text-slate-800">{p.subjectName} · {p.className}</b>
                  <span className="text-xs text-slate-500">{p.examName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Field label="Exam"><Select value={sel.examId} onChange={(e) => setSel({ ...sel, examId: e.target.value })} options={exams.map((x) => ({ value: x.id, label: `${x.name} · ${x.resultStatus}` }))} placeholder="Select exam" /></Field>
          <Field label="Class"><Select value={sel.classId} onChange={(e) => setSel({ ...sel, classId: e.target.value, subjectId: "", section: "" })} options={classOptions.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select class" /></Field>
          <Field label="Section"><Select value={sel.section} onChange={(e) => setSel({ ...sel, section: e.target.value })} options={cls?.sections || []} placeholder="All sections" /></Field>
          <Field label="Subject"><Select value={sel.subjectId} onChange={(e) => setSel({ ...sel, subjectId: e.target.value })} options={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} placeholder="Select subject" /></Field>
        </div>
      </Card>
      <div className="mt-5">
        {loading ? <Spinner /> : !sheet ? <EmptyState title="Select exam, class and subject." /> : (
          <Card
            title={`${sheet.subject.name} – ${sheet.exam.name}`}
            subtitle={`Full marks ${sheet.fullMarks} · Pass ${sheet.passMarks}${sheet.exam.marksEntryEnd ? ` · Entry closes ${String(sheet.exam.marksEntryEnd).slice(0, 10)}` : ""}`}
            actions={(
              <>
                <Badge>{sheet.entryStatus}</Badge>
                <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={downloadTemplate}>Excel template</Button>
                {!locked && (
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload size={14} /> Upload Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && uploadExcel(e.target.files[0])} />
                  </label>
                )}
                {locked ? (sheet.entryStatus !== "Unlock Requested" && <Button size="sm" variant="warning" icon={Unlock} onClick={requestUnlock}>Request unlock</Button>) : (
                  <>
                    <Button size="sm" variant="secondary" icon={Save} loading={saving} onClick={() => save(false)}>Save draft</Button>
                    <Button size="sm" icon={Send} loading={saving} onClick={() => save(true)}>Submit & lock</Button>
                  </>
                )}
              </>
            )}>
            {locked && <p className="mb-3 flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-600"><Lock size={16} /> Marks are locked. Changes need Principal approval.</p>}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Roll</th><th className="px-3 py-2 text-left">Student</th>
                    {comps.length ? comps.map((c) => <th key={c.key} className="px-2 py-2">{c.label}<span className="block font-normal normal-case">/{c.fullMarks}{c.passMarks ? ` (pass ${c.passMarks})` : ""}</span></th>) : <th className="px-2 py-2">Marks /{sheet.fullMarks}</th>}
                    <th className="px-2 py-2">Total</th><th className="px-2 py-2">Absent</th><th className="px-2 py-2">Exempt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sheet.students.map((s) => {
                    const r = rows[s.id] || {};
                    const total = totalOf(r);
                    const fail = !r.isAbsent && !r.isExempt && total < Number(sheet.passMarks);
                    return (
                      <tr key={s.id} className={errors[s.id] ? "bg-rose-50" : "bg-white"}>
                        <td className="px-3 py-1.5 font-semibold">{s.roll || "—"}</td>
                        <td className="px-3 py-1.5">{s.name}<span className="block text-xs text-slate-400">{s.id}</span></td>
                        {comps.length ? comps.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 text-center">
                            <input type="number" min="0" max={c.fullMarks} disabled={locked || r.isAbsent || r.isExempt} value={r.componentMarks?.[c.key] ?? ""}
                              onChange={(e) => setCell(s.id, { componentMarks: { ...r.componentMarks, [c.key]: e.target.value === "" ? "" : Number(e.target.value) } })}
                              className={`h-9 w-20 rounded-lg border px-2 text-center ${Number(r.componentMarks?.[c.key] || 0) > Number(c.fullMarks) ? "border-rose-400" : "border-slate-200"}`} />
                          </td>
                        )) : (
                          <td className="px-2 py-1.5 text-center">
                            <input type="number" min="0" max={sheet.fullMarks} disabled={locked || r.isAbsent || r.isExempt} value={r.marksObtained ?? ""} onChange={(e) => setCell(s.id, { marksObtained: e.target.value })} className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-center" />
                          </td>
                        )}
                        <td className={`px-2 py-1.5 text-center font-bold ${fail ? "text-rose-600" : "text-slate-800"}`}>{r.isAbsent ? "AB" : r.isExempt ? "EX" : total}</td>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" className="accent-rose-600" disabled={locked} checked={Boolean(r.isAbsent)} onChange={(e) => setCell(s.id, { isAbsent: e.target.checked, isExempt: false })} /></td>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" className="accent-slate-600" disabled={locked} checked={Boolean(r.isExempt)} onChange={(e) => setCell(s.id, { isExempt: e.target.checked, isAbsent: false })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      {dialog}
    </div>
  );
}
