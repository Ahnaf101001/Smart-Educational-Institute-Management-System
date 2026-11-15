"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { admissionsApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";

export const initialApplicants = [];

/*
const legacyApplicants = [
  { id: "APP-4101", initials: "KM", name: "Khalid Mehmood", gender: "Male", className: "Class 6", date: "2024-12-10", status: "Pending" },
  { id: "APP-4102", initials: "AF", name: "Amina Farooq", gender: "Female", className: "Class 9", date: "2024-12-11", status: "Approved" },
  { id: "APP-4103", initials: "ZA", name: "Zubair Ahmad", gender: "Male", className: "Class 7", date: "2024-12-12", status: "Pending" },
  { id: "APP-4104", initials: "SR", name: "Sobia Raza", gender: "Female", className: "Class 11", date: "2024-12-13", status: "Under Review" },
  { id: "APP-4105", initials: "HS", name: "Hamza Sheikh", gender: "Male", className: "Class 8", date: "2024-12-14", status: "Approved" },
  { id: "APP-4106", initials: "NF", name: "Noor Fatima", gender: "Female", className: "Class 10", date: "2024-12-15", status: "Pending" },
  { id: "APP-4107", initials: "BA", name: "Babar Ali", gender: "Male", className: "Class 6", date: "2024-12-16", status: "Under Review" },
  { id: "APP-4108", initials: "SK", name: "Saira Khan", gender: "Female", className: "Class 9", date: "2024-12-17", status: "Approved" },
  { id: "APP-4109", initials: "FJ", name: "Faisal Javed", gender: "Male", className: "Class 7", date: "2024-12-18", status: "Pending" },
  { id: "APP-4110", initials: "MI", name: "Madiha Iqbal", gender: "Female", className: "Class 12", date: "2024-12-19", status: "Rejected" },
  { id: "APP-4111", initials: "AQ", name: "Arslan Qureshi", gender: "Male", className: "Class 8", date: "2024-12-20", status: "Pending" },
  { id: "APP-4112", initials: "YN", name: "Yasmin Nawaz", gender: "Female", className: "Class 11", date: "2024-12-21", status: "Approved" },
];
*/

const statusStyle = {
  Pending: {
    className: "bg-amber-100 text-amber-700",
    icon: Clock3,
  },
  Approved: {
    className: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  "Under Review": {
    className: "bg-blue-100 text-blue-700",
    icon: Eye,
  },
  Rejected: {
    className: "bg-red-100 text-red-600",
    icon: XCircle,
  },
  // Full admission pipeline (SRS AD-05)
  Draft: { className: "bg-slate-100 text-slate-600", icon: Clock3 },
  Submitted: { className: "bg-sky-100 text-sky-700", icon: Clock3 },
  Shortlisted: { className: "bg-indigo-100 text-indigo-700", icon: Eye },
  Selected: { className: "bg-teal-100 text-teal-700", icon: CheckCircle2 },
  Waiting: { className: "bg-amber-100 text-amber-700", icon: Clock3 },
  Admitted: { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
};
const PENDING_STATUSES = ["Pending", "Under Review", "Draft", "Submitted", "Shortlisted", "Selected", "Waiting"];
const APPROVED_STATUSES = ["Approved", "Admitted"];

function SummaryCard({ label, value, note, icon: Icon, color }) {
  return (
    <motion.div
      className={`rounded-[20px] bg-gradient-to-br ${color} p-6 text-white shadow-sm`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="grid size-13 place-items-center rounded-2xl bg-white/18">
        <Icon size={25} />
      </span>
      <strong className="mt-5 block text-4xl font-extrabold">{value}</strong>
      <p className="mt-1 text-lg">{label}</p>
      <span className="mt-1 block text-sm text-white/75">{note}</span>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const style = statusStyle[status] || { className: "bg-slate-100 text-slate-600", icon: Eye };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.className}`}>
      <Icon size={14} />
      {status}
    </span>
  );
}

export default function AdmissionOverview() {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, status: null, type: "info" });

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

  const counts = useMemo(
    () => ({
      total: applicants.length,
      pending: applicants.filter((item) => PENDING_STATUSES.includes(item.status)).length,
      approved: applicants.filter((item) => APPROVED_STATUSES.includes(item.status)).length,
      rejected: applicants.filter((item) => item.status === "Rejected").length,
    }),
    [applicants],
  );

  async function updateStatus(id, status) {
    try {
      if (status === "Approved") {
        await admissionsApi.approve(id);
      } else {
        await admissionsApi.update(id, { status });
      }
      await fetchApplicants();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard label="Total Applicants" value={counts.total} note="+12 this week" icon={UserPlus} color="from-sky-400 to-blue-500" />
        <SummaryCard label="Pending Approval" value={counts.pending} note="Needs attention" icon={Clock3} color="from-amber-400 to-orange-500" />
        <SummaryCard label="Approved" value={counts.approved} note={`${Math.round((counts.approved / counts.total) * 100)}% rate`} icon={CheckCircle2} color="from-emerald-400 to-teal-500" />
        <SummaryCard label="Rejected" value={counts.rejected} note={`${Math.round((counts.rejected / counts.total) * 100)}% rejection`} icon={XCircle} color="from-rose-400 to-red-500" />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Recent Applications</h2>
          <span className="text-sm text-slate-500">{counts.total} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold">Applicant</th>
                <th className="px-5 py-4 font-bold">Class Applied</th>
                <th className="px-5 py-4 font-bold">Date</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicants.map((applicant) => (
                <tr className="transition hover:bg-blue-50/30" key={applicant.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-xs font-bold text-white">
                        {applicant.initials}
                      </span>
                      <span>
                        <strong className="block text-sm text-slate-900 sm:text-base">{applicant.name}</strong>
                        <small className="text-xs text-slate-500">{applicant.id} - {applicant.gender}</small>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-800 sm:text-base">{applicant.className}</td>
                  <td className="px-5 py-4 text-sm text-slate-500 sm:text-base">{applicant.date}</td>
                  <td className="px-5 py-4"><StatusBadge status={applicant.status} /></td>
                  <td className="px-5 py-4">
                    {applicant.status === "Approved" || applicant.status === "Rejected" ? (
                      <span className="text-sm text-slate-500">{applicant.status}</span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          onClick={() => setConfirmModal({ isOpen: true, id: applicant.id, status: "Approved", type: "success" })}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                          onClick={() => setConfirmModal({ isOpen: true, id: applicant.id, status: "Rejected", type: "danger" })}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.status === "Approved" ? "Approve Application?" : "Reject Application?"}
        message={
          confirmModal.status === "Approved"
            ? "Are you sure you want to approve this application? This will create a new student record automatically."
            : "Are you sure you want to reject this application? This action cannot be undone."
        }
        type={confirmModal.type}
        confirmText={confirmModal.status === "Approved" ? "Yes, Approve" : "Yes, Reject"}
        onConfirm={() => {
          if (confirmModal.id && confirmModal.status) {
            updateStatus(confirmModal.id, confirmModal.status);
          }
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </motion.div>
  );
}
