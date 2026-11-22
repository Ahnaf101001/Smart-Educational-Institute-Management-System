"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileSearch, Send } from "lucide-react";
import { publicApi } from "../lib/api";
import PublicShell from "../components/public/PublicShell";
import PhotoUpload from "../components/ui/PhotoUpload";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, Tabs, Textarea, formatDate, money, useToast } from "../components/ui/kit";

function ApplyForm() {
  const toast = useToast();
  const [circulars, setCirculars] = useState(null);
  const [form, setForm] = useState({ primaryGuardian: "Father", gender: "Male" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { publicApi.circulars().then(setCirculars).catch(() => setCirculars([])); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const circular = circulars?.find((c) => c.id === form.circularId);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, guardianPhone: form.guardianPhone || form.fatherPhone || form.motherPhone };
      const res = await publicApi.apply(payload);
      setDone(res);
    } catch (err) {
      toast.error(err);
    } finally { setBusy(false); }
  }

  if (!circulars) return <Spinner />;
  if (done) {
    return (
      <Card>
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
          <h2 className="mt-3 text-2xl font-extrabold">Application submitted</h2>
          <p className="mt-2 text-slate-600">Your application ID is <b className="text-blue-700">{done.id}</b>. It has also been sent by SMS.</p>
          {done.applicationFee > 0 && <p className="mt-2 text-sm text-amber-700">Application fee {money(done.applicationFee)} – please pay at the office or as instructed in the circular. Status: {done.paymentStatus}.</p>}
          <p className="mt-2 text-sm text-slate-500">Use the “Check status” tab with your ID and guardian mobile number.</p>
        </div>
      </Card>
    );
  }
  if (!circulars.length) return <EmptyState title="Admission is currently closed." hint="No published admission circular is open right now." />;
  return (
    <form onSubmit={submit} className="space-y-5">
      <Card title="Admission circular">
        <div className="grid gap-3 md:grid-cols-2">
          {circulars.map((c) => (
            <label key={c.id} className={`cursor-pointer rounded-2xl border p-4 ${form.circularId === c.id ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}>
              <input type="radio" name="circular" className="hidden" checked={form.circularId === c.id} onChange={() => setForm({ ...form, circularId: c.id })} />
              <p className="font-bold">{c.title}</p>
              <p className="text-sm text-slate-600">{c.className} · {c.sessionName || ""}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs"><Badge tone="blue">{c.seatsAvailable} seats left</Badge><Badge tone="slate">Deadline {formatDate(c.deadline)}</Badge>{Number(c.applicationFee) > 0 && <Badge tone="amber">Fee {money(c.applicationFee)}</Badge>}{c.testRequired && <Badge tone="purple">Admission test {formatDate(c.testDate)}</Badge>}</div>
              {c.requiredDocuments?.length > 0 && <p className="mt-2 text-xs text-slate-500">Documents: {c.requiredDocuments.join(", ")}</p>}
            </label>
          ))}
        </div>
        {circular?.eligibility && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{circular.eligibility}</p>}
      </Card>
      <Card title="Student information">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Uploaded without login; sent as photoUrl and used on the ID card if the student is admitted. */}
          <div className="md:col-span-3">
            <PhotoUpload
              label="Student photo"
              value={form.photoUrl || ""}
              onChange={(url) => setForm((current) => ({ ...current, photoUrl: url }))}
              upload={(file) => publicApi.uploadPhoto(file)}
            />
          </div>
          <Field label="Full name (English)" required><Input required value={form.studentName || ""} onChange={set("studentName")} /></Field>
          <Field label="নাম (বাংলা)"><Input value={form.nameBn || ""} onChange={set("nameBn")} /></Field>
          <Field label="Date of birth" required><Input required type="date" value={form.dateOfBirth || ""} onChange={set("dateOfBirth")} /></Field>
          <Field label="Gender"><Select value={form.gender} onChange={set("gender")} options={["Male", "Female"]} /></Field>
          <Field label="Birth certificate no."><Input value={form.birthCertificateNo || ""} onChange={set("birthCertificateNo")} /></Field>
          <Field label="Blood group"><Select value={form.bloodGroup || ""} onChange={set("bloodGroup")} options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]} placeholder="—" /></Field>
          <Field label="Religion"><Select value={form.religion || ""} onChange={set("religion")} options={["Islam", "Hinduism", "Christianity", "Buddhism", "Other"]} placeholder="—" /></Field>
          <Field label="Previous school"><Input value={form.previousSchool || ""} onChange={set("previousSchool")} /></Field>
          <Field label="Previous result"><Input value={form.previousResult || ""} onChange={set("previousResult")} /></Field>
        </div>
      </Card>
      <Card title="Guardian information">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Father's name"><Input value={form.fatherName || ""} onChange={set("fatherName")} /></Field>
          <Field label="Father's mobile"><Input value={form.fatherPhone || ""} onChange={set("fatherPhone")} placeholder="01XXXXXXXXX" /></Field>
          <Field label="Father's occupation"><Input value={form.fatherOccupation || ""} onChange={set("fatherOccupation")} /></Field>
          <Field label="Mother's name"><Input value={form.motherName || ""} onChange={set("motherName")} /></Field>
          <Field label="Mother's mobile"><Input value={form.motherPhone || ""} onChange={set("motherPhone")} /></Field>
          <Field label="Mother's occupation"><Input value={form.motherOccupation || ""} onChange={set("motherOccupation")} /></Field>
          <Field label="Primary contact"><Select value={form.primaryGuardian} onChange={set("primaryGuardian")} options={["Father", "Mother", "Guardian"]} /></Field>
          <Field label="Other guardian name"><Input value={form.guardianName || ""} onChange={set("guardianName")} /></Field>
          <Field label="Other guardian mobile"><Input value={form.guardianPhone || ""} onChange={set("guardianPhone")} /></Field>
          <Field label="Present address" className="md:col-span-3"><Textarea value={form.presentAddress || ""} onChange={set("presentAddress")} /></Field>
        </div>
      </Card>
      <p className="text-xs text-slate-500">By submitting you agree that the institution may use this information for admission and communication. Your data is not shared with third parties.</p>
      <Button type="submit" size="lg" icon={Send} loading={busy} disabled={!form.circularId}>Submit application</Button>
    </form>
  );
}

function StatusCheck() {
  const toast = useToast();
  const [f, setF] = useState({ applicationId: "", mobile: "" });
  const [res, setRes] = useState(null);
  async function check() {
    try { setRes(await publicApi.status(f.applicationId, f.mobile)); } catch (e) { setRes(null); toast.error(e); }
  }
  return (
    <Card title="Application status">
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <Field label="Application ID"><Input value={f.applicationId} onChange={(e) => setF({ ...f, applicationId: e.target.value })} placeholder="APP-4101" /></Field>
        <Field label="Guardian mobile"><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
      </div>
      <Button className="mt-3" icon={FileSearch} onClick={check}>Check</Button>
      {res && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
          <p className="text-lg font-bold">{res.name} · {res.className}</p>
          <p className="mt-1">Status: <Badge>{res.status}</Badge>{res.meritPosition ? ` · Merit position ${res.meritPosition}` : ""}</p>
          <p className="mt-1">Payment: {res.paymentStatus}{res.admitCardNo ? ` · Admit card ${res.admitCardNo}` : ""}</p>
        </div>
      )}
    </Card>
  );
}

export default function ApplyPage() {
  const [tab, setTab] = useState("apply");
  return (
    <PublicShell title="Online Admission">
      <h1 className="mb-1 text-3xl font-extrabold text-slate-900">Online Admission</h1>
      <p className="mb-5 text-slate-600">Apply online and track your application.</p>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "apply", label: "Apply" }, { key: "status", label: "Check status" }]} />
      {tab === "apply" ? <ApplyForm /> : <StatusCheck />}
    </PublicShell>
  );
}
