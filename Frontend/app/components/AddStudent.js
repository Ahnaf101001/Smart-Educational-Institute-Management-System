"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Upload } from "lucide-react";
import { academicApi, studentsApi } from "../lib/api";

const steps = ["Personal Info", "Guardian Info", "Academic Info", "Documents"];

const defaultForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  religion: "",
  nationality: "",
  phone: "",
  email: "",
  presentAddress: "",
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
  admissionDate: "",
  previousSchool: "",
  previousClass: "",
  previousGpa: "",
};

const documentFields = [
  ["studentPhoto", "Student Photo", "Student passport photo"],
  ["birthCertificate", "Birth Certificate", "Birth registration certificate"],
  ["nicForm", "NIC/B-Form", "National ID card copy"],
  ["previousResults", "Previous Results", "Last class result card"],
  ["transferCertificate", "Transfer Certificate", "TC from previous school"],
];

function Field({ label, name, value, onChange, type = "text", children, className = "" }) {
  const controlClass =
    "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children ? (
        <select name={name} value={value} onChange={onChange} className={controlClass}>
          {children}
        </select>
      ) : (
        <input name={name} value={value} onChange={onChange} type={type} className={controlClass} />
      )}
    </label>
  );
}

function Stepper({ currentStep }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-8 py-7 shadow-sm">
      <div className="grid grid-cols-4 items-start gap-4">
        {steps.map((step, index) => {
          const number = index + 1;
          const completed = currentStep > index;
          const active = currentStep === index;

          return (
            <div className="grid grid-cols-[auto_1fr] items-center gap-4 last:grid-cols-[auto]" key={step}>
              <div>
                <span
                  className={`grid size-11 place-items-center rounded-full text-base font-bold ${
                    completed
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {completed ? <Check size={20} /> : number}
                </span>
                <p
                  className={`mt-2 whitespace-nowrap text-sm font-medium ${
                    completed
                      ? "text-emerald-600"
                      : active
                        ? "text-blue-600"
                        : "text-slate-500"
                  }`}
                >
                  {step}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mt-5 h-0.5 min-w-12 ${
                    currentStep > index ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
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
        onChange={(event) => onFile(name, event.target.files?.[0]?.name || "")}
      />
    </label>
  );
}

export default function AddStudent({ onCancel, onSaved }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(defaultForm);
  const [academicYears, setAcademicYears] = useState([]);
  const [documents, setDocuments] = useState({});
  const [message, setMessage] = useState("");

  const fullName = useMemo(
    () => `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    [form.firstName, form.lastName],
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const years = await academicApi.years.list();
        if (cancelled) return;

        setAcademicYears(years);
        setForm((current) => {
          if (current.session || !years.length) return current;
          const currentYear = years.find((year) => year.status === "Current") || years[0];
          return { ...current, session: currentYear.name };
        });
      } catch {
        if (!cancelled) setAcademicYears([]);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

  function changeDocument(name, fileName) {
    setDocuments((current) => ({ ...current, [name]: fileName }));
  }

  function validateStep() {
    const requiredByStep = [
      ["firstName", "lastName", "dateOfBirth", "gender", "phone"],
      ["fatherName", "fatherPhone", "motherName"],
      ["admissionClass", "section", "rollNumber", "session", "admissionDate"],
      [],
    ];

    const missing = requiredByStep[currentStep].some((field) => !String(form[field] || "").trim());
    if (missing) {
      setMessage("Please fill all required fields before continuing.");
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
      await studentsApi.create({
        roll: (form.rollNumber || "").padStart(3, "0"),
        name: fullName || "New Student",
        gender: form.gender,
        className: `${form.admissionClass}-${form.section}`.replace("Class ", "Class "),
        parentContact: form.fatherPhone,
        dateOfBirth: form.dateOfBirth,
        status: "Active",
        details: { ...form },
        documents,
      });
      onSaved?.();
    } catch (error) {
      setMessage(error.message || "Failed to save student.");
    }
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-5">
      <Stepper currentStep={currentStep} />

      <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
        {message && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {message}
          </div>
        )}

        {currentStep === 0 && (
          <div>
            <h1 className="mb-6 text-2xl font-bold text-slate-950">Personal Info</h1>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="First Name" name="firstName" value={form.firstName} onChange={changeField} />
              <Field label="Last Name" name="lastName" value={form.lastName} onChange={changeField} />
              <Field label="Date of Birth" name="dateOfBirth" value={form.dateOfBirth} onChange={changeField} type="date" />
              <Field label="Gender" name="gender" value={form.gender} onChange={changeField}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Field>
              <Field label="Religion" name="religion" value={form.religion} onChange={changeField} />
              <Field label="Nationality" name="nationality" value={form.nationality} onChange={changeField} />
              <Field label="Phone" name="phone" value={form.phone} onChange={changeField} />
              <Field label="Email" name="email" value={form.email} onChange={changeField} type="email" />
              <Field label="Present Address" name="presentAddress" value={form.presentAddress} onChange={changeField} className="md:col-span-2" />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <h1 className="mb-6 text-2xl font-bold text-slate-950">Guardian Info</h1>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Father's Name" name="fatherName" value={form.fatherName} onChange={changeField} />
              <Field label="Father's Occupation" name="fatherOccupation" value={form.fatherOccupation} onChange={changeField} />
              <Field label="Father's Phone" name="fatherPhone" value={form.fatherPhone} onChange={changeField} />
              <Field label="Father's NIC" name="fatherNic" value={form.fatherNic} onChange={changeField} />
              <Field label="Mother's Name" name="motherName" value={form.motherName} onChange={changeField} />
              <Field label="Mother's Phone" name="motherPhone" value={form.motherPhone} onChange={changeField} />
              <Field label="Guardian Name (if different)" name="guardianName" value={form.guardianName} onChange={changeField} />
              <Field label="Guardian Relation" name="guardianRelation" value={form.guardianRelation} onChange={changeField} />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h1 className="mb-6 text-2xl font-bold text-slate-950">Academic Info</h1>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Admission Class" name="admissionClass" value={form.admissionClass} onChange={changeField}>
                <option value="">Select class</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={`Class ${index + 1}`}>{`Class ${index + 1}`}</option>
                ))}
              </Field>
              <Field label="Section" name="section" value={form.section} onChange={changeField}>
                <option value="">Select section</option>
                {["A", "B", "C", "D"].map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </Field>
              <Field label="Roll Number" name="rollNumber" value={form.rollNumber} onChange={changeField} />
              <Field label="Session" name="session" value={form.session} onChange={changeField}>
                <option value="">Select session</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.name}>{year.name}</option>
                ))}
              </Field>
              <Field label="Admission Date" name="admissionDate" value={form.admissionDate} onChange={changeField} type="date" />
              <Field label="Previous School" name="previousSchool" value={form.previousSchool} onChange={changeField} />
              <Field label="Previous Class" name="previousClass" value={form.previousClass} onChange={changeField} />
              <Field label="GPA (Previous)" name="previousGpa" value={form.previousGpa} onChange={changeField} />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h1 className="mb-6 text-2xl font-bold text-slate-950">Documents</h1>
            <div className="grid gap-5 md:grid-cols-2">
              {documentFields.map(([name, title, subtitle]) => (
                <UploadBox
                  key={name}
                  name={name}
                  title={title}
                  subtitle={subtitle}
                  fileName={documents[name]}
                  onFile={changeDocument}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          {currentStep === 0 ? (
            <button
              className="h-12 rounded-2xl border border-slate-200 bg-white px-7 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : (
            <button
              className="h-12 rounded-2xl border border-slate-200 bg-white px-7 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              onClick={previousStep}
            >
              Previous
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              className="h-12 rounded-2xl bg-blue-600 px-7 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
              onClick={nextStep}
            >
              Next Step
            </button>
          ) : (
            <button
              className="h-12 rounded-2xl bg-blue-600 px-7 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
              onClick={saveStudent}
            >
              Save Student
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
