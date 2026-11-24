"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Upload, Users } from "lucide-react";
import { academicApi, http, resource, studentsApi, uploadsApi } from "../lib/api";
import PhotoUpload from "./ui/PhotoUpload";
import { today, useToast } from "./ui/kit";

const steps = ["Student", "Guardian", "Class", "Documents"];

const defaultForm = {
  photoUrl: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  religion: "",
  nationality: "Bangladeshi",
  phone: "",
  email: "",
  presentAddress: "",
  nameBn: "",
  birthCertNo: "",
  bloodGroup: "",
  division: "",
  district: "",
  upazila: "",
  postOffice: "",
  allergies: "",
  specialNeeds: "",
  medicalNotes: "",
  fatherName: "",
  fatherOccupation: "",
  fatherPhone: "",
  fatherNic: "",
  motherName: "",
  motherPhone: "",
  guardianName: "",
  guardianRelation: "",
  admissionClass: "",
  section: "",
  rollNumber: "",
  session: "",
  admissionDate: today(),
  previousSchool: "",
  previousClass: "",
  previousGpa: "",
};

// Only what the school genuinely needs to create the record; everything else is optional.
// Step 2 needs a primary guardian mobile (the guardian account is matched by it) and a name.
const requiredByStep = [
  ["firstName", "lastName", "dateOfBirth", "gender"],
  ["fatherPhone"],
  ["admissionClass", "section", "rollNumber", "session", "admissionDate"],
  [],
];

// [form key, title, subtitle, student_documents.document_type]
const documentFields = [
  ["birthCertificate", "Birth Certificate", "Birth registration certificate", "Birth Certificate"],
  ["nicForm", "NIC/B-Form", "National ID card copy", "NID (Guardian)"],
  ["previousResults", "Previous Results", "Last class result card", "Previous Result"],
  ["transferCertificate", "Transfer Certificate", "TC from previous school", "Transfer Certificate"],
];

const DIVISIONS = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Field({ label, name, value, onChange, onBlur, type = "text", required = false, hint, children, className = "" }) {
  const controlClass =
    "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>}
      </span>
      {children ? (
        <select name={name} value={value} onChange={onChange} required={required} className={controlClass}>
          {children}
        </select>
      ) : (
        <input name={name} value={value} onChange={onChange} onBlur={onBlur} type={type} required={required} className={controlClass} />
      )}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// Optional details stay one click away so the everyday form stays short.
function MoreDetails({ title, children }) {
  return (
    <details className="group md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
        {title}
        <ChevronDown size={18} className="transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-5 border-t border-slate-100 p-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

function Stepper({ currentStep }) {
  return (
    <ol className="grid grid-cols-4 gap-2 rounded-[20px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-8">
      {steps.map((step, index) => {
        const completed = currentStep > index;
        const active = currentStep === index;
        return (
          <li key={step} className="flex min-w-0 flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            <span
              className={`grid size-10 place-items-center rounded-full text-sm font-bold ${
                completed ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {completed ? <Check size={18} /> : index + 1}
            </span>
            <span className={`truncate text-xs font-semibold sm:text-sm ${completed ? "text-emerald-600" : active ? "text-blue-600" : "text-slate-500"}`}>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function UploadBox({ name, title, subtitle, fileName, onFile }) {
  return (
    <label
      className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${
        fileName
          ? "border-blue-400 bg-blue-50/40"
          : "border-slate-200 bg-slate-50/40 hover:border-blue-300 hover:bg-blue-50/30"
      }`}
    >
      <Upload className="text-slate-500" size={24} />
      <strong className="mt-3 text-lg text-slate-950">{title}</strong>
      <span className="mt-1 text-sm text-slate-500">{subtitle}</span>
      <span className="mt-2 text-sm font-medium text-blue-600">
        {fileName || "Click to upload or drag & drop"}
      </span>
      <input
        className="hidden"
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => onFile(name, event.target.files?.[0] || null)}
      />
    </label>
  );
}

const nextFreeRoll = (students) =>
  String(students.reduce((max, s) => Math.max(max, Number.parseInt(s.roll, 10) || 0), 0) + 1);

export default function AddStudent({ onCancel, onSaved }) {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(defaultForm);
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [documents, setDocuments] = useState({});
  const [message, setMessage] = useState("");
  const [rollAuto, setRollAuto] = useState(true);
  const [sibling, setSibling] = useState(null);

  const fullName = useMemo(
    () => `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    [form.firstName, form.lastName],
  );
  // Sections come from the school's own class setup, so madrasa / pre-school lines appear too.
  const sections = useMemo(
    () => classes.find((c) => c.name === form.admissionClass)?.sections || [],
    [classes, form.admissionClass],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([academicApi.years.list(), academicApi.classes.list()])
      .then(([years, classList]) => {
        if (cancelled) return;
        setAcademicYears(years);
        setClasses(classList);
        setForm((current) => {
          if (current.session || !years.length) return current;
          const currentYear = years.find((year) => year.status === "Current") || years[0];
          return { ...current, session: currentYear.name };
        });
      })
      .catch(() => { /* the selects simply stay empty; saving reports the error */ });
    return () => { cancelled = true; };
  }, []);

  // A class has one section → pick it.
  useEffect(() => {
    if (sections.length === 1 && form.section !== sections[0]) {
      setForm((current) => ({ ...current, section: sections[0] }));
    }
  }, [sections, form.section]);

  // Suggest the next free roll for the chosen class/section (the server still rejects duplicates).
  useEffect(() => {
    if (!rollAuto || !form.admissionClass || !form.section) return;
    let cancelled = false;
    resource("/students")
      .all({ class_name: `${form.admissionClass}-${form.section}` })
      .then((rows) => { if (!cancelled) setForm((current) => ({ ...current, rollNumber: nextFreeRoll(rows) })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rollAuto, form.admissionClass, form.section]);

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "admissionClass" ? { section: "" } : {}),
    }));
    if (name === "rollNumber") setRollAuto(false);
    setMessage("");
  }

  async function checkSibling() {
    if (form.fatherPhone.replace(/\D/g, "").length < 11) { setSibling(null); return; }
    try {
      const hint = await http.get("/students/siblings/check", { mobile: form.fatherPhone });
      setSibling(hint?.guardian ? hint : null);
      // Same guardian → reuse their name instead of typing it again.
      if (hint?.guardian && !form.fatherName && !form.guardianName) {
        setForm((current) => ({ ...current, fatherName: hint.guardian.name || current.fatherName }));
      }
    } catch {
      setSibling(null);
    }
  }

  function changeDocument(name, file) {
    setDocuments((current) => ({ ...current, [name]: file }));
  }

  function validateStep() {
    const missing = requiredByStep[currentStep].some((field) => !String(form[field] || "").trim());
    const noGuardianName = currentStep === 1 && !form.fatherName.trim() && !form.guardianName.trim();
    if (missing || noGuardianName) {
      setMessage("Please fill the fields marked * before continuing.");
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1));
  }

  function previousStep() {
    setMessage("");
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  async function saveStudent() {
    try {
      const created = await studentsApi.create({
        roll: (form.rollNumber || "").padStart(3, "0"),
        name: fullName || "New Student",
        gender: form.gender,
        className: `${form.admissionClass}-${form.section}`,
        parentContact: form.fatherPhone,
        guardianName: form.guardianName || form.fatherName || undefined,
        dateOfBirth: form.dateOfBirth,
        nameBn: form.nameBn || undefined,
        birthCertNo: form.birthCertNo || undefined,
        bloodGroup: form.bloodGroup || undefined,
        religion: form.religion || undefined,
        nationality: form.nationality || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.presentAddress || undefined,
        division: form.division || undefined,
        district: form.district || undefined,
        upazila: form.upazila || undefined,
        postOffice: form.postOffice || undefined,
        allergies: form.allergies || undefined,
        specialNeeds: form.specialNeeds || undefined,
        medicalNotes: form.medicalNotes || undefined,
        admissionDate: form.admissionDate || undefined,
        previousSchool: form.previousSchool || undefined,
        section: form.section || undefined,
        status: "Active",
        photoUrl: form.photoUrl || undefined,
        details: { ...form },
      });
      // Upload the chosen documents to the new student's record (PDF or image, private storage).
      const failed = [];
      for (const [key, title, , documentType] of documentFields) {
        const file = documents[key];
        if (!file || !created?.id) continue;
        try {
          await uploadsApi.upload(file, { category: "document", ownerType: "Student", ownerId: created.id, documentType });
        } catch {
          failed.push(title);
        }
      }
      // The student exists now, so always finish (re-saving would create a duplicate) and report any failures.
      if (failed.length) toast.warning(`Student saved, but these documents could not be uploaded: ${failed.join(", ")}. Add them from Student 360.`);
      onSaved?.();
    } catch (error) {
      setMessage(error.message || "Failed to save student.");
    }
  }

  const f = (name) => ({ name, value: form[name], onChange: changeField });

  return (
    <div className="mx-auto max-w-[960px] space-y-5">
      <Stepper currentStep={currentStep} />

      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        {message && (
          <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {message}
          </div>
        )}

        {currentStep === 0 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-950">Student</h1>
            <p className="mb-6 text-sm text-slate-500">Fields marked <span className="text-rose-600">*</span> are required.</p>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="First name" required {...f("firstName")} />
              <Field label="Last name" required {...f("lastName")} />
              <Field label="Date of birth" type="date" required {...f("dateOfBirth")} />
              <Field label="Gender" required {...f("gender")}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Field>
              <Field label="Name in Bangla" {...f("nameBn")} />
              <Field label="Birth certificate no." {...f("birthCertNo")} />
              <MoreDetails title="Contact & address (optional)">
                <Field label="Student phone" {...f("phone")} />
                <Field label="Email" type="email" {...f("email")} />
                <Field label="Present address" className="md:col-span-2" {...f("presentAddress")} />
                <Field label="Division" {...f("division")}>
                  <option value="">Select division</option>
                  {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Field>
                <Field label="District" {...f("district")} />
                <Field label="Upazila / Thana" {...f("upazila")} />
                <Field label="Post office" {...f("postOffice")} />
              </MoreDetails>
              <MoreDetails title="Religion, nationality & health (optional)">
                <Field label="Religion" {...f("religion")} />
                <Field label="Nationality" {...f("nationality")} />
                <Field label="Blood group" {...f("bloodGroup")}>
                  <option value="">Not known</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </Field>
                <Field label="Allergies" {...f("allergies")} />
                <Field label="Special needs" {...f("specialNeeds")} />
                <Field label="Medical notes" className="md:col-span-2" {...f("medicalNotes")} />
              </MoreDetails>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-950">Guardian</h1>
            <p className="mb-6 text-sm text-slate-500">
              The primary mobile is the guardian&apos;s login and SMS number. A mobile that already exists links this student to the same guardian account.
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Primary guardian mobile" required type="tel" onBlur={checkSibling} hint="e.g. 01711000301" {...f("fatherPhone")} />
              <Field label="Father's name" required={!form.guardianName} hint="Or fill “Guardian name” below." {...f("fatherName")} />
              {sibling?.guardian && (
                <div className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <Users size={18} className="mt-0.5 shrink-0" />
                  <span>
                    This mobile belongs to <b>{sibling.guardian.name}</b>
                    {sibling.siblings?.length ? ` (already guardian of ${sibling.siblings.map((s) => s.name).join(", ")})` : ""}.
                    The new student will be linked to the same guardian account – no second account is created.
                  </span>
                </div>
              )}
              <Field label="Mother's name" {...f("motherName")} />
              <Field label="Mother's mobile" type="tel" {...f("motherPhone")} />
              <MoreDetails title="Other guardian & father's details (optional)">
                <Field label="Guardian name (if not the father)" {...f("guardianName")} />
                <Field label="Guardian relation" {...f("guardianRelation")} />
                <Field label="Father's occupation" {...f("fatherOccupation")} />
                <Field label="Father's NID" {...f("fatherNic")} />
              </MoreDetails>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h1 className="mb-6 text-2xl font-bold text-slate-950">Class</h1>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Class" required {...f("admissionClass")}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
              </Field>
              <Field label="Section" required {...f("section")}>
                <option value="">{form.admissionClass ? "Select section" : "Choose a class first"}</option>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </Field>
              <Field label="Roll" required hint={rollAuto && form.rollNumber ? "Next free roll – change it if needed." : undefined} {...f("rollNumber")} />
              <Field label="Session" required {...f("session")}>
                <option value="">Select session</option>
                {academicYears.map((year) => <option key={year.id} value={year.name}>{year.name}</option>)}
              </Field>
              <Field label="Admission date" type="date" required {...f("admissionDate")} />
              <MoreDetails title="Previous school (optional)">
                <Field label="Previous school" {...f("previousSchool")} />
                <Field label="Previous class" {...f("previousClass")} />
                <Field label="GPA (previous)" {...f("previousGpa")} />
              </MoreDetails>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-950">Documents</h1>
            <p className="mb-6 text-sm text-slate-500">All optional – they can also be added later from Student 360.</p>
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <PhotoUpload
                label="Student Photo (ID Card)"
                value={form.photoUrl}
                onChange={(url) => setForm((current) => ({ ...current, photoUrl: url }))}
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {documentFields.map(([name, title, subtitle]) => (
                <UploadBox
                  key={name}
                  name={name}
                  title={title}
                  subtitle={subtitle}
                  fileName={documents[name]?.name}
                  onFile={changeDocument}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-7 text-base font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={currentStep === 0 ? onCancel : previousStep}
          >
            {currentStep === 0 ? "Cancel" : "Back"}
          </button>
          <button
            type="button"
            className="h-12 rounded-2xl bg-blue-600 px-7 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
            onClick={currentStep < steps.length - 1 ? nextStep : saveStudent}
          >
            {currentStep < steps.length - 1 ? "Next" : "Save student"}
          </button>
        </div>
      </div>
    </div>
  );
}
