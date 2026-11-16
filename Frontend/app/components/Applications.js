"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileDown,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { initialApplicants } from "./AdmissionOverview";
import { academicApi, admissionsApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";
import { today } from "./ui/kit";

const initialDetails = {
  "APP-4101": { parent: "Mohammad Mehmood", contact: "03XX-2859886" },
  "APP-4102": { parent: "Farooq Ahmed", contact: "03XX-3717401" },
  "APP-4103": { parent: "Ahmad Zubair", contact: "03XX-6472648" },
  "APP-4104": { parent: "Raza Ali", contact: "03XX-6809521" },
  "APP-4105": { parent: "Sheikh Hassan", contact: "03XX-5418226" },
  "APP-4106": { parent: "Fatima Bibi", contact: "03XX-1008312" },
  "APP-4107": { parent: "Ali Babar", contact: "03XX-5074152" },
  "APP-4108": { parent: "Khan Saira", contact: "03XX-5782335" },
  "APP-4109": { parent: "Javed Faisal", contact: "03XX-1165003" },
  "APP-4110": { parent: "Iqbal Rashid", contact: "03XX-7919652" },
  "APP-4111": { parent: "Qureshi Tariq", contact: "03XX-3389063" },
  "APP-4112": { parent: "Nawaz Yasmin", contact: "03XX-5608960" },
};

const statusFilters = ["All", "Pending", "Submitted", "Under Review", "Shortlisted", "Selected", "Waiting", "Approved", "Admitted", "Rejected"];
const ACTIONABLE = ["Pending", "Under Review", "Submitted", "Shortlisted", "Selected", "Waiting"];

const statusConfig = {
  Pending: { bg: "bg-orange-50 text-orange-600 border-orange-200", dot: "bg-orange-500", icon: Clock3 },
  Approved: { bg: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
  "Under Review": { bg: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500", icon: Eye },
  Rejected: { bg: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500", icon: XCircle },
  Draft: { bg: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400", icon: Clock3 },
  Submitted: { bg: "bg-sky-50 text-sky-600 border-sky-200", dot: "bg-sky-500", icon: Clock3 },
  Shortlisted: { bg: "bg-indigo-50 text-indigo-600 border-indigo-200", dot: "bg-indigo-500", icon: Eye },
  Selected: { bg: "bg-teal-50 text-teal-600 border-teal-200", dot: "bg-teal-500", icon: CheckCircle2 },
  Waiting: { bg: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500", icon: Clock3 },
  Admitted: { bg: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
};

const avatarColors = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

function getAvatarColor(index) {
  return avatarColors[index % avatarColors.length];
}

function getParentName(applicant) {
  if (applicant.details?.fatherName) return applicant.details.fatherName;
  return initialDetails[applicant.id]?.parent || "—";
}

function getContact(applicant) {
  if (applicant.details?.fatherPhone) return applicant.details.fatherPhone;
  return initialDetails[applicant.id]?.contact || "—";
}

function getAppliedClassName(applicant) {
  return applicant.details?.classApplied || applicant.className || "";
}

function normalizeClassName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/-([A-Z])$/i, "")
    .toLowerCase();
}

function getClassNumber(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function resolveSectionsForClass(applicant, classRows) {
  const appliedClass = getAppliedClassName(applicant || {});
  const normalizedAppliedClass = normalizeClassName(appliedClass);
  const appliedClassNumber = getClassNumber(appliedClass);
  const classRow = classRows.find((item) => normalizeClassName(item.name) === normalizedAppliedClass)
    || classRows.find((item) => appliedClassNumber && getClassNumber(item.name) === appliedClassNumber);

  return classRow?.sections?.length ? classRow.sections : [];
}

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.Pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.bg}`}>
      <Icon size={13} />
      {status}
    </span>
  );
}

function ApplicantCard({ applicant, index, onOpen, onApprove, onReject, onDelete }) {
  const showActions = ACTIONABLE.includes(applicant.status);

  return (
    <article
      className="flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
      onClick={() => onOpen(applicant)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(applicant);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View ${applicant.name} application details`}
    >
      {/* Card Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${getAvatarColor(index)}`}
        >
          {applicant.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-slate-900">{applicant.name}</h3>
          <p className="text-xs text-slate-500">{applicant.id}</p>
        </div>
        <StatusBadge status={applicant.status} />
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100" />

      {/* Card Body */}
      <div className="flex-1 space-y-2.5 px-5 py-4 text-sm">
        <div className="flex justify-between">
          <span className="font-medium text-slate-600">Applied For:</span>
          <span className="font-bold text-slate-900">{applicant.className}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium text-slate-600">Parent:</span>
          <span className="font-bold text-slate-900">{getParentName(applicant)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium text-slate-600">Contact:</span>
          <span className="font-bold text-slate-900">{getContact(applicant)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium text-slate-600">Date:</span>
          <span className="font-bold text-slate-900">{applicant.date}</span>
        </div>
      </div>

      <div className="mx-5 border-t border-slate-100" />
      <div className="flex gap-3 px-5 py-4">
        {showActions ? (
          <>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              onClick={(event) => {
                event.stopPropagation();
                onApprove(applicant.id);
              }}
            >
              <Check size={15} /> Approve
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              onClick={(event) => {
                event.stopPropagation();
                onReject(applicant.id);
              }}
            >
              <X size={15} /> Reject
            </button>
          </>
        ) : null}
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(applicant.id);
          }}
        >
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </article>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900">{value || "Not set"}</p>
    </div>
  );
}

function ApplicationDetails({ applicant, onBack, onApprove, onReject, onDelete }) {
  const details = applicant.details || {};
  const showActions = ACTIONABLE.includes(applicant.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          className="inline-flex h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
          Back to List
        </button>
        <h1 className="text-2xl font-extrabold text-slate-950">Application Details</h1>
      </div>

      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-extrabold text-white">
              {applicant.initials}
            </span>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950">{applicant.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{applicant.id}</p>
            </div>
          </div>
          <StatusBadge status={applicant.status} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="Applied For" value={applicant.className} />
          <DetailRow label="Session" value={details.session} />
          <DetailRow label="Application Date" value={applicant.date} />
          <DetailRow label="Date of Birth" value={details.dateOfBirth} />
          <DetailRow label="Gender" value={applicant.gender || details.gender} />
          <DetailRow label="Religion" value={details.religion} />
          <DetailRow label="Blood Group" value={details.bloodGroup} />
          <DetailRow label="Father's Name" value={details.fatherName || getParentName(applicant)} />
          <DetailRow label="Father's Phone" value={details.fatherPhone || getContact(applicant)} />
          <DetailRow label="Mother's Name" value={details.motherName} />
          <DetailRow label="Emergency Contact" value={details.emergencyContact} />
          <DetailRow label="Previous School" value={details.previousSchool} />
          <DetailRow label="Previous Result" value={details.previousResult} />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          {showActions && (
            <>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                onClick={() => onApprove(applicant.id)}
              >
                <Check size={16} /> Approve
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-bold text-red-600 transition hover:bg-red-100"
                onClick={() => onReject(applicant.id)}
              >
                <X size={16} /> Reject
              </button>
            </>
          )}
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-bold text-red-600 transition hover:bg-red-50"
            onClick={() => onDelete(applicant.id)}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Applications({ onViewStudents }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, status: null, type: "info" });
  const [deleteId, setDeleteId] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [classes, setClasses] = useState([]);
  const [approveModal, setApproveModal] = useState({
    isOpen: false,
    id: null,
    section: "",
    sections: [],
    className: "",
  });
  const [studentCreatedModal, setStudentCreatedModal] = useState({
    isOpen: false,
    studentName: "",
    className: "",
  });

  async function fetchApplicants() {
    try {
      const data = await admissionsApi.list();
      setApplicants(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchApplicants();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const rows = await academicApi.classes.list();
        if (!cancelled) setClasses(rows);
      } catch {
        if (!cancelled) setClasses([]);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  function getApplicantById(id) {
    const applicant = applicants.find((item) => item.id === id) || selectedApplicant;
    return applicant?.id === id ? applicant : null;
  }

  async function openApproveModal(id) {
    const applicant = getApplicantById(id);
    let classRows = classes;

    try {
      classRows = await academicApi.classes.list();
      setClasses(classRows);
    } catch {
      classRows = classes;
    }

    const sections = resolveSectionsForClass(applicant, classRows);
    setApproveModal({
      isOpen: true,
      id,
      section: sections[0] || "",
      sections,
      className: getAppliedClassName(applicant || {}),
    });
  }

  async function updateStatus(id, status, section = "") {
    const current = applicants.find((item) => item.id === id);
    if (!current) return;

    try {
      await admissionsApi.update(id, {
        status: status === "Approved" ? (current.status === "Approved" ? "Under Review" : current.status) : status, // the backend approve endpoint will set it to Approved
        details: { ...(current.details || {}), section },
      });

      let createdStudent = null;
      if (status === "Approved") {
        createdStudent = await admissionsApi.approve(id);
      }

      await fetchApplicants();
      setSelectedApplicant((currentApplicant) =>
        currentApplicant?.id === id
          ? { ...currentApplicant, status, details: { ...(currentApplicant.details || {}), section } }
          : currentApplicant,
      );

      if (createdStudent) {
        setStudentCreatedModal({
          isOpen: true,
          studentName: createdStudent.name,
          className: createdStudent.className,
        });
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  async function deleteApplication(id) {
    try {
      await admissionsApi.remove(id);
      await fetchApplicants();
      setSelectedApplicant((current) => (current?.id === id ? null : current));
    } catch (error) {
      console.error("Failed to delete application:", error);
    }
  }

  const filtered = useMemo(() => {
    let list = applicants;

    if (activeFilter !== "All") {
      list = list.filter((item) => item.status === activeFilter);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query) ||
          item.className.toLowerCase().includes(query),
      );
    }

    return list;
  }, [applicants, activeFilter, search]);

  function downloadPDF() {
    const lines = [
      "APPLICATION LIST REPORT",
      "=" .repeat(60),
      `Generated: ${new Date().toLocaleString()}`,
      `Filter: ${activeFilter} | Total: ${filtered.length}`,
      "=" .repeat(60),
      "",
      ...filtered.map(
        (a, i) =>
          `${i + 1}. ${a.name} (${a.id})\n   Class: ${a.className} | Status: ${a.status} | Date: ${a.date}\n   Parent: ${getParentName(a)} | Contact: ${getContact(a)}\n`,
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications_${activeFilter.toLowerCase().replace(/\s+/g, "_")}_${today()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative space-y-5">
      {selectedApplicant ? (
        <ApplicationDetails
          applicant={selectedApplicant}
          onBack={() => setSelectedApplicant(null)}
          onApprove={openApproveModal}
          onReject={(id) => setConfirmModal({ isOpen: true, id, status: "Rejected", type: "danger" })}
          onDelete={setDeleteId}
        />
      ) : (
        <>
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
        <label className="flex h-12 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4">
          <Search size={20} className="shrink-0 text-slate-400" />
          <input
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Search applicants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeFilter === filter
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((applicant, index) => (
              <ApplicantCard
                key={applicant.id}
                applicant={applicant}
                index={index}
                onOpen={setSelectedApplicant}
                onApprove={openApproveModal}
                onReject={(id) => setConfirmModal({ isOpen: true, id, status: "Rejected", type: "danger" })}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-20"
          >
            <Search size={48} className="text-slate-300" />
            <p className="mt-4 text-lg font-semibold text-slate-500">No applications found</p>
            <p className="mt-1 text-sm text-slate-400">
              {search ? "Try a different search term" : "No applications match this filter"}
            </p>
          </div>
        )}

      {/* PDF Download FAB */}
      <button
        onClick={downloadPDF}
        className="fixed bottom-8 right-8 z-20 grid size-14 place-items-center rounded-full bg-white text-blue-600 shadow-lg shadow-slate-300/50 border border-slate-200 transition hover:bg-blue-50 hover:shadow-xl"
        title="Download Report"
      >
        <FileDown size={22} />
      </button>
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Reject Application?"
        message="Are you sure you want to reject this application? This action cannot be undone."
        type={confirmModal.type}
        confirmText="Yes, Reject"
        onConfirm={() => {
          if (confirmModal.id && confirmModal.status) {
            updateStatus(confirmModal.id, confirmModal.status);
          }
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
      <ConfirmModal
        isOpen={approveModal.isOpen}
        title="Approve Application?"
        message="Select the section for this student's applied class, then approve the application."
        type="success"
        confirmText="Approve Student"
        onConfirm={() => {
          if (approveModal.id && approveModal.section) {
            updateStatus(approveModal.id, "Approved", approveModal.section);
            setApproveModal({ isOpen: false, id: null, section: "", sections: [], className: "" });
          }
        }}
        onCancel={() => setApproveModal({ isOpen: false, id: null, section: "", sections: [], className: "" })}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-600">Section</span>
          <select
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            value={approveModal.section}
            onChange={(event) => setApproveModal((current) => ({ ...current, section: event.target.value }))}
          >
            {approveModal.sections.length > 0 ? (
              approveModal.sections.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))
            ) : (
              <option value="">No sections found for this class</option>
            )}
          </select>
          <span className="mt-2 block text-xs font-semibold text-slate-400">
            Applied class: {approveModal.className || "Not set"}
          </span>
        </label>
      </ConfirmModal>
      <ConfirmModal
        isOpen={studentCreatedModal.isOpen}
        title="Student Created"
        message={`${studentCreatedModal.studentName} has been admitted to ${studentCreatedModal.className}.`}
        type="success"
        cancelText="Stay Here"
        confirmText="View Student List"
        onConfirm={() => {
          setStudentCreatedModal({ isOpen: false, studentName: "", className: "" });
          onViewStudents?.();
        }}
        onCancel={() => setStudentCreatedModal({ isOpen: false, studentName: "", className: "" })}
      />
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Application?"
        message="Are you sure you want to permanently delete this application record? If it created a linked student record, that will be removed too."
        type="danger"
        confirmText="Yes, Delete"
        onConfirm={() => {
          if (deleteId) deleteApplication(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
