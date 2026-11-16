"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Save, Send, X } from "lucide-react";
import { academicApi, admissionsApi } from "../lib/api";
import { db } from "../lib/localDb";
import { today } from "./ui/kit";

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  religion: "",
  bloodGroup: "",
  fatherName: "",
  fatherPhone: "",
  motherName: "",
  emergencyContact: "",
  classApplied: "",
  session: "",
  previousSchool: "",
  previousResult: "",
};

const requiredFields = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "gender",
  "fatherName",
  "fatherPhone",
  "classApplied",
  "session",
];

function Field({ label, name, value, onChange, error, type = "text", children, placeholder = "" }) {
  const className = `h-12 w-full rounded-2xl border bg-white px-4 text-sm text-slate-800 outline-none transition appearance-none placeholder:text-slate-400 focus:ring-4 ${
    error
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
  }`;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children ? (
        <select name={name} value={value} onChange={onChange} className={className}>
          {children}
        </select>
      ) : (
        <input name={name} value={value} onChange={onChange} type={type} placeholder={placeholder} className={className} />
      )}
      {error && <span className="mt-1.5 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

function FormSection({ title, children }) {
  return (
    <motion.section
      className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="mb-6 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </motion.section>
  );
}

export default function NewApplication({ onSubmitted }) {
  const [form, setForm] = useState(emptyForm);
  const [academicYears, setAcademicYears] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft = db.drafts.getApplication();
      if (draft && typeof draft === "object") setForm({ ...emptyForm, ...draft });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function saveDraft() {
    db.drafts.saveApplication(form);
    setMessage({ type: "draft", text: "Application draft saved successfully." });
  }

  function validate() {
    const nextErrors = {};
    requiredFields.forEach((field) => {
      if (!form[field].trim()) nextErrors[field] = "This field is required.";
    });
    if (form.fatherPhone && !/^[+0-9][0-9 -]{7,15}$/.test(form.fatherPhone)) {
      nextErrors.fatherPhone = "Enter a valid phone number.";
    }
    if (form.emergencyContact && !/^[+0-9][0-9 -]{7,15}$/.test(form.emergencyContact)) {
      nextErrors.emergencyContact = "Enter a valid phone number.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!validate()) {
      setMessage({ type: "error", text: "Please complete all required fields." });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      await admissionsApi.create({
        initials: `${form.firstName[0]}${form.lastName[0]}`.toUpperCase(),
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        gender: form.gender,
        className: form.classApplied,
        date: today(),
        status: "Pending",
        details: { ...form },
      });

      db.drafts.clearApplication();
      setForm(emptyForm);
      setErrors({});
      setShowSuccessModal(true);
      onSubmitted?.();
    } catch (error) {
      console.error("Failed to submit application:", error);
      setMessage({ type: "error", text: "Failed to submit application to the server." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form className="mx-auto max-w-[1120px] space-y-5" onSubmit={submitApplication} noValidate>
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.type === "error" ? <X size={18} /> : <CheckCircle2 size={18} />}
            <span className="flex-1">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <FormSection title="Student Information">
        <Field label="First Name *" name="firstName" value={form.firstName} onChange={changeField} error={errors.firstName} placeholder="Enter first name" />
        <Field label="Last Name *" name="lastName" value={form.lastName} onChange={changeField} error={errors.lastName} placeholder="Enter last name" />
        <Field label="Date of Birth *" name="dateOfBirth" value={form.dateOfBirth} onChange={changeField} error={errors.dateOfBirth} type="date" />
        <Field label="Gender *" name="gender" value={form.gender} onChange={changeField} error={errors.gender}>
          <option value="">Select gender</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </Field>
        <Field label="Religion" name="religion" value={form.religion} onChange={changeField} placeholder="Enter religion" />
        <Field label="Blood Group" name="bloodGroup" value={form.bloodGroup} onChange={changeField}>
          <option value="">Select blood group</option>
          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => <option key={group}>{group}</option>)}
        </Field>
      </FormSection>

      <FormSection title="Parent / Guardian Info">
        <Field label="Father's Name *" name="fatherName" value={form.fatherName} onChange={changeField} error={errors.fatherName} placeholder="Enter father's name" />
        <Field label="Father's Phone *" name="fatherPhone" value={form.fatherPhone} onChange={changeField} error={errors.fatherPhone} type="tel" placeholder="+880 1XXXXXXXXX" />
        <Field label="Mother's Name" name="motherName" value={form.motherName} onChange={changeField} placeholder="Enter mother's name" />
        <Field label="Emergency Contact" name="emergencyContact" value={form.emergencyContact} onChange={changeField} error={errors.emergencyContact} type="tel" placeholder="+880 1XXXXXXXXX" />
      </FormSection>

      <FormSection title="Academic Details">
        <Field label="Class Applied *" name="classApplied" value={form.classApplied} onChange={changeField} error={errors.classApplied}>
          <option value="">Select class</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1}>{`Class ${index + 1}`}</option>)}
        </Field>
        <Field label="Session *" name="session" value={form.session} onChange={changeField} error={errors.session}>
          <option value="">Select session</option>
          {academicYears.map((year) => (
            <option key={year.id} value={year.name}>{year.name}</option>
          ))}
        </Field>
        <Field label="Previous School" name="previousSchool" value={form.previousSchool} onChange={changeField} placeholder="Enter previous school" />
        <Field label="Previous Result" name="previousResult" value={form.previousResult} onChange={changeField} placeholder="Enter result or GPA" />
      </FormSection>

      <div className="flex flex-col justify-end gap-3 pb-4 sm:flex-row">
        <button
          type="button"
          onClick={saveDraft}
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Save size={18} /> Save Draft
        </button>
        <button
          type="submit"
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
        >
          <Send size={18} /> Submit Application
        </button>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[24px] bg-white p-8 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-2xl font-black text-slate-800">Submitted!</h3>
              <p className="mb-8 text-sm font-medium text-slate-500">
                The admission application has been successfully submitted and is now pending review.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-600 active:scale-95"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </form>
  );
}
