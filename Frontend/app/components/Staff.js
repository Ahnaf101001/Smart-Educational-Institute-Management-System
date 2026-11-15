"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  BriefcaseBusiness,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { staffApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";

const emptyStaff = {
  firstName: "",
  lastName: "",
  designation: "Office Manager",
  department: "",
  phone: "",
  email: "",
  joinDate: "",
  shift: "Morning",
  salary: "",
  gender: "Male",
  address: "",
  status: "Active",
};

const designationOptions = [
  "Office Manager",
  "Accountant",
  "IT Technician",
  "Security Guard",
  "Cleaner",
  "Data Entry Operator",
  "Librarian",
  "Maintenance Technician",
  "Receptionist",
  "Canteen Manager",
  "Canteen Staff",
];

const shiftColors = {
  Morning: "bg-amber-50 text-amber-700",
  Day: "bg-blue-50 text-blue-700",
  Night: "bg-indigo-50 text-indigo-700",
};

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(-2)
    .toUpperCase();
}

function money(value) {
  return `৳${Number(value || 0).toLocaleString("en-US")}`;
}

function normalizeForm(form) {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    designation: form.designation,
    department: "",
    phone: form.phone.trim(),
    email: form.email.trim(),
    joinDate: form.joinDate,
    shift: form.shift,
    salary: Number(form.salary) || 0,
    gender: form.gender,
    address: form.address.trim(),
    status: form.status,
  };
}

function staffToForm(member) {
  return {
    firstName: member.firstName || "",
    lastName: member.lastName || "",
    designation: member.designation || "Office Manager",
    department: member.department || "",
    phone: member.phone || "",
    email: member.email || "",
    joinDate: member.joinDate || "",
    shift: member.shift || "Morning",
    salary: String(member.salary || ""),
    gender: member.gender || "Male",
    address: member.address || "",
    status: member.status || "Active",
  };
}

function SummaryCard({ value, label, color, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`grid size-13 place-items-center rounded-2xl text-lg font-extrabold text-white ${color}`}>
        {Icon ? <Icon size={22} /> : value}
      </span>
      <div>
        <strong className="block text-xl font-extrabold text-slate-950">{value}</strong>
        <span className="text-base font-semibold text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const classes =
    status === "Active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "Inactive"
        ? "bg-red-100 text-red-600"
        : "bg-amber-100 text-amber-700";

  return (
    <span className={`inline-flex min-w-[76px] justify-center rounded-full px-3 py-1 text-sm font-bold ${classes}`}>
      {status}
    </span>
  );
}

function Field({ label, name, value, onChange, required, type = "text", children, placeholder = "" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      {children ? (
        <select
          className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          name={name}
          value={value}
          onChange={onChange}
        >
          {children}
        </select>
      ) : (
        <input
          className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function StaffModal({ editingMember, onClose, onSave }) {
  const [form, setForm] = useState(editingMember ? staffToForm(editingMember) : emptyStaff);
  const [error, setError] = useState("");

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function submit(event) {
    event.preventDefault();
    const member = normalizeForm(form);

    if (!member.firstName || !member.lastName || !member.designation || !member.phone || !member.joinDate || !member.salary) {
      setError("Please fill all required fields.");
      return;
    }

    onSave(member);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-[2px]">
      <form className="w-full max-w-[640px] overflow-hidden rounded-[20px] bg-white shadow-2xl" onSubmit={submit}>
        <div className="flex items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
            <BriefcaseBusiness size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold">
              {editingMember ? "Edit Staff" : "Add New Staff"}
            </h2>
            <p className="text-sm text-white/80">
              {editingMember ? "Update staff member details" : "Fill in staff member details"}
            </p>
          </div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
            onClick={onClose}
            aria-label="Close staff form"
          >
            <X size={22} />
          </button>
        </div>

        <div className="max-h-[calc(100vh-250px)] overflow-y-auto px-8 py-6">
          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="First Name" name="firstName" value={form.firstName} onChange={changeField} placeholder="e.g. Kabir" required />
            <Field label="Last Name" name="lastName" value={form.lastName} onChange={changeField} placeholder="e.g. Hossain" required />
            <Field label="Designation" name="designation" value={form.designation} onChange={changeField} required>
              {designationOptions.map((designation) => (
                <option key={designation}>{designation}</option>
              ))}
            </Field>
            <Field label="Phone" name="phone" value={form.phone} onChange={changeField} placeholder="01X-XXXXXXX" required />
            <Field label="Email" name="email" value={form.email} onChange={changeField} placeholder="name@school.edu" type="email" />
            <Field label="Join Date" name="joinDate" value={form.joinDate} onChange={changeField} type="date" required />
            <Field label="Shift" name="shift" value={form.shift} onChange={changeField}>
              <option>Morning</option>
              <option>Day</option>
              <option>Night</option>
            </Field>
            <Field label="Salary (৳)" name="salary" value={form.salary} onChange={changeField} placeholder="e.g. 25000" type="number" required />
            <Field label="Gender" name="gender" value={form.gender} onChange={changeField}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </Field>
            <Field label="Status" name="status" value={form.status} onChange={changeField}>
              <option>Active</option>
              <option>On Leave</option>
              <option>Inactive</option>
            </Field>
            <Field label="Address" name="address" value={form.address} onChange={changeField} placeholder="House, Road, Area, City" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button
            type="button"
            className="h-13 rounded-2xl border border-slate-200 bg-white px-6 text-base font-bold text-slate-600 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-13 rounded-2xl bg-blue-600 px-6 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            {editingMember ? "Save Changes" : "Add Staff Member"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ViewModal({ member, onClose }) {
  if (!member) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#54a2ff] to-[#483ff2] text-lg font-extrabold text-white">
              {getInitials(member.name)}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">{member.name}</h2>
              <p className="text-sm font-semibold text-blue-600">{member.designation}</p>
            </div>
          </div>
          <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close staff details">
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          {[
            ["Staff ID", member.id],
            ["Phone", member.phone],
            ["Email", member.email || "Not set"],
            ["Join Date", member.joinDate],
            ["Shift", member.shift],
            ["Salary", money(member.salary)],
            ["Status", member.status],
            ["Address", member.address || "Not set"],
          ].map(([label, value]) => (
            <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3" key={label}>
              <span className="text-slate-500">{label}</span>
              <strong className="text-right text-slate-800">{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [modalMode, setModalMode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const data = await staffApi.list();
      setStaff(data || []);
    } catch (err) {
      console.error("Error loading staff:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStaff();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStaff]);

  const summary = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((member) => member.status === "Active").length,
      leave: staff.filter((member) => member.status === "On Leave").length,
      payroll: staff.reduce((sum, member) => sum + Number(member.salary || 0), 0),
    }),
    [staff],
  );

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.id.toLowerCase().includes(query) ||
        (member.designation && member.designation.toLowerCase().includes(query)) ||
        (member.phone && member.phone.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "All Status" || member.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [staff, search, statusFilter]);

  async function saveStaff(member) {
    try {
      if (modalMode?.type === "edit") {
        await staffApi.update(modalMode.member.id, member);
      } else {
        await staffApi.create(member);
      }
      await loadStaff();
      setModalMode(null);
    } catch (err) {
      console.error("Error saving staff:", err);
      alert("Failed to save staff member: " + err.message);
    }
  }

  async function deleteStaff(id) {
    try {
      await staffApi.remove(id);
      await loadStaff();
      setSelectedMember(null);
    } catch (err) {
      console.error("Error deleting staff:", err);
      alert("Failed to delete staff member: " + err.message);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <Users className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading staff database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Staff Management</h1>
          <p className="mt-1 text-base text-slate-500">
            {staff.length} staff members · Monthly payroll: {money(summary.payroll)}
          </p>
        </div>
        <button
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 text-base font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
          onClick={() => setModalMode({ type: "add" })}
        >
          <Plus size={20} />
          Add Staff Member
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCard value={summary.total} label="Total Staff" color="bg-blue-600" icon={Users} />
        <SummaryCard value={summary.active} label="Active" color="bg-emerald-500" icon={Users} />
        <SummaryCard value={summary.leave} label="On Leave" color="bg-orange-500" icon={Users} />
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_130px]">
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4">
            <Search size={20} className="text-slate-500" />
            <input
              className="w-full bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Search by name, ID, or role..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base text-slate-700 outline-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All Status</option>
            <option>Active</option>
            <option>On Leave</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-4 font-extrabold">Staff Member</th>
                <th className="px-5 py-4 font-extrabold">Designation</th>
                <th className="px-5 py-4 font-extrabold">Contact</th>
                <th className="px-5 py-4 font-extrabold">Shift</th>
                <th className="px-5 py-4 font-extrabold">Salary</th>
                <th className="px-5 py-4 font-extrabold">Status</th>
                <th className="px-5 py-4 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((member) => (
                <tr className="transition hover:bg-slate-50" key={member.id}>
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#54a2ff] to-[#483ff2] text-sm font-extrabold text-white">
                        {getInitials(member.name)}
                      </span>
                      <span className="min-w-0">
                        <strong className="block max-w-[160px] text-base font-extrabold text-slate-950">
                          {member.name}
                        </strong>
                        <small className="text-sm text-slate-500">{member.id}</small>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-5 text-base text-slate-950">{member.designation}</td>
                  <td className="px-5 py-5 text-sm text-slate-600">{member.phone}</td>
                  <td className="px-5 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${shiftColors[member.shift] || "bg-slate-100 text-slate-700"}`}>
                      {member.shift}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-sm font-bold text-slate-700">{money(member.salary)}</td>
                  <td className="px-5 py-5">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex items-center justify-center gap-4">
                      <button className="text-blue-600 transition hover:text-blue-800" onClick={() => setSelectedMember(member)} aria-label={`View ${member.name}`}>
                        <Eye size={18} />
                      </button>
                      <button className="text-slate-500 transition hover:text-slate-800" onClick={() => setModalMode({ type: "edit", member })} aria-label={`Edit ${member.name}`}>
                        <Edit3 size={18} />
                      </button>
                      <button className="text-red-500 transition hover:text-red-700" onClick={() => setConfirmDeleteId(member.id)} aria-label={`Delete ${member.name}`}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStaff.length === 0 && (
          <div className="grid min-h-[260px] place-items-center border-t border-slate-100 text-center">
            <div>
              <BriefcaseBusiness className="mx-auto text-slate-300" size={44} />
              <p className="mt-3 text-lg font-bold text-slate-600">No staff members found</p>
              <p className="mt-1 text-sm text-slate-400">Try another filter or search.</p>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
          Showing {filteredStaff.length} of {staff.length} staff members
        </div>
      </div>

      {modalMode && (
        <StaffModal
          editingMember={modalMode.type === "edit" ? modalMode.member : null}
          onClose={() => setModalMode(null)}
          onSave={saveStaff}
        />
      )}
      <ViewModal member={selectedMember} onClose={() => setSelectedMember(null)} />

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Staff Member?"
        message="Are you sure you want to permanently delete this staff record? This action cannot be undone."
        type="danger"
        confirmText="Yes, Delete"
        onConfirm={() => {
          if (confirmDeleteId) {
            deleteStaff(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
