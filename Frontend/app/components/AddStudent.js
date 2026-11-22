"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Upload } from "lucide-react";
import { academicApi, studentsApi, uploadsApi } from "../lib/api";
import PhotoUpload from "./ui/PhotoUpload";
import { useToast } from "./ui/kit";

const steps = ["Personal Info", "Guardian Info", "Academic Info", "Documents"];

const defaultForm = {
  photoUrl: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  religion: "",
  nationality: "",
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
  admissionDate: "",
  previousSchool: "",
  previousClass: "",
  previousGpa: "",
};

// [form key, title, subtitle, student_documents.document_type]
const documentFields = [
  ["birthCertificate", "Birth Certificate", "Birth registration certificate", "Birth Certificate"],
  ["nicForm", "NIC/B-Form", "National ID card copy", "NID (Guardian)"],
  ["previousResults", "Previous Results", "Last class result card", "Previous Result"],
  ["transferCertificate", "Transfer Certificate", "TC from previous school", "Transfer Certificate"],
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
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => onFile(name, event.target.files?.[0] || null)}
      />
    </label>
  );
}

export default function AddStudent({ onCancel, onSaved }) {
  const toast = useToast();
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

  function changeDocument(name, file) {
    setDocuments((current) => ({ ...current, [name]: file }));
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
      const created = await studentsApi.create({
        roll: (form.rollNumber || "").padStart(3, "0"),
        name: fullName || "New Student",
        gender: form.gender,
        className: `${form.admissionClass}-${form.section}`.replace("Class ", "Class "),
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
              <Field label="Name in Bangla" name="nameBn" value={form.nameBn} onChange={changeField} />
              <Field label="Birth Certificate No" name="birthCertNo" value={form.birthCertNo} onChange={changeField} />
              <Field label="Blood Group (optional)" name="bloodGroup" value={form.bloodGroup} onChange={changeField}>
                <option value="">Not known</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g} value={g}>{g}</option>)}
              </Field>
              <Field label="Present Address" name="presentAddress" value={form.presentAddress} onChange={changeField} className="md:col-span-2" />
              <Field label="Division" name="division" value={form.division} onChange={changeField}>
                <option value="">Select division</option>
                {["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"].map((d) => <option key={d} value={d}>{d}</option>)}
              </Field>
              <Field label="District" name="district" value={form.district} onChange={changeField} />
              <Field label="Upazila / Thana" name="upazila" value={form.upazila} onChange={changeField} />
              <Field label="Post Office" name="postOffice" value={form.postOffice} onChange={changeField} />
              <Field label="Allergies (optional)" name="allergies" value={form.allergies} onChange={changeField} />
              <Field label="Special needs (optional)" name="specialNeeds" value={form.specialNeeds} onChange={changeField} />
              <Field label="Medical notes (optional)" name="medicalNotes" value={form.medicalNotes} onChange={changeField} className="md:col-span-2" />
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
