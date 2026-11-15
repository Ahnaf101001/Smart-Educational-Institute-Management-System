"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  BadgeDollarSign,
  Edit3,
  Eye,
  GraduationCap,
  Hash,
  Mail,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { teachersApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";

const emptyTeacher = {
  firstName: "",
  lastName: "",
  department: "",
  qualification: "",
  phone: "",
  email: "",
  joinDate: "",
  experience: "0",
  subjects: "",
  salary: "",
  classes: "",
  rating: "4.5",
  status: "Active",
};

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(-2)
    .toUpperCase();
}

function normalizeTeacherForm(form) {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    department: form.department.trim(),
    qualification: form.qualification.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    joinDate: form.joinDate || null,
    experience: Number(form.experience) || 0,
    subjects: form.subjects
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean),
    salary: Number(form.salary) || 0,
    classes: Number(form.classes) || 0,
    rating: Number(form.rating) || 0,
    status: form.status,
  };
}

function teacherToForm(teacher) {
  return {
    firstName: teacher.firstName || "",
    lastName: teacher.lastName || "",
    department: teacher.department || "",
    qualification: teacher.qualification || "",
    phone: teacher.phone || "",
    email: teacher.email || "",
    joinDate: formatDate(teacher.joinDate) === "Not set" ? "" : formatDate(teacher.joinDate),
    experience: String(teacher.experience || 0),
    subjects: (teacher.subjects || []).join(", "),
    salary: teacher.salary || "",
    classes: String(teacher.classes || 0),
    rating: String(teacher.rating || 0),
    status: teacher.status || "Active",
  };
}

function StatusBadge({ status }) {
  const active = status === "Active";
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-bold ${
        active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function formatSalary(salary) {
  const amount = Number(String(salary || "").replace(/,/g, ""));

  if (!amount) return "Not set";

  return `\u09F3${amount.toLocaleString("en-US")}`;
}

function formatDate(date) {
  if (!date) return "Not set";

  return String(date).slice(0, 10);
}

function getAssignedClasses(teacher) {
  return Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses.filter(Boolean) : [];
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

function TeacherCard({ teacher, selected, onOpen, onView, onEdit, onDelete }) {
  function openFromKeyboard(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(teacher);
    }
  }

  return (
    <article
      className={`cursor-pointer rounded-[20px] border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 ${
        selected ? "border-blue-300 shadow-blue-100" : "border-slate-200"
      }`}
      onClick={() => onOpen(teacher)}
      onKeyDown={openFromKeyboard}
      role="button"
      tabIndex={0}
      aria-label={`Open ${teacher.name} profile`}
    >
      <div className="flex gap-4">
        <span className="grid size-15 shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-[#54a2ff] to-[#483ff2] text-xl font-extrabold text-white">
          {getInitials(teacher.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold text-slate-950">{teacher.name}</h3>
              <p className="mt-0.5 text-sm font-medium text-blue-600">{teacher.department}</p>
              <p className="mt-1 text-sm text-slate-500">
                {teacher.id} • {teacher.experience}y exp
              </p>
            </div>
            <StatusBadge status={teacher.status} />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex min-h-8 flex-wrap gap-2">
          {(teacher.subjects || []).map((subject) => (
            <span className="rounded-xl bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700" key={subject}>
              {subject}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
            <Star size={16} fill="currentColor" />
            {Number(teacher.rating).toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Users size={16} />
            {teacher.classes} classes
          </span>
          <div className="flex items-center gap-4">
            <button
              className="text-blue-600 transition hover:text-blue-800"
              onClick={(event) => {
                event.stopPropagation();
                onView(teacher);
              }}
              aria-label={`View ${teacher.name}`}
            >
              <Eye size={18} />
            </button>
            <button
              className="text-slate-500 transition hover:text-slate-800"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(teacher);
              }}
              aria-label={`Edit ${teacher.name}`}
            >
              <Edit3 size={18} />
            </button>
            <button
              className="text-red-500 transition hover:text-red-700"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(teacher.id);
              }}
              aria-label={`Delete ${teacher.name}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Icon size={16} />
        {label}
      </div>
      <p className="mt-2 text-base font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function TeacherProfile({ teacher, onBack }) {
  const assignedClasses = getAssignedClasses(teacher);
  const attendance = teacher.attendanceSummary || { present: 0, absent: 0, leave: 0 };

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
        <h1 className="text-2xl font-extrabold text-slate-950">Teacher Profile</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-[20px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid size-25 place-items-center rounded-[20px] bg-gradient-to-br from-[#54a2ff] to-[#483ff2] text-3xl font-extrabold text-white">
            {getInitials(teacher.name)}
          </span>
          <h2 className="mt-6 text-2xl font-extrabold text-slate-950">{teacher.name}</h2>
          <p className="mt-1 text-lg font-semibold text-blue-600">{teacher.department} Teacher</p>
          <div className="mt-3 flex justify-center">
            <StatusBadge status={teacher.status} />
          </div>

          <div className="mt-6 space-y-4 border-t border-slate-100 pt-6 text-left text-base text-slate-600">
            <p className="flex items-center gap-3">
              <Mail size={18} className="text-blue-500" />
              <span className="min-w-0 truncate">{teacher.email}</span>
            </p>
            <p className="flex items-center gap-3">
              <Phone size={18} className="text-emerald-500" />
              {teacher.phone}
            </p>
            <p className="flex items-center gap-3">
              <GraduationCap size={18} className="text-violet-500" />
              {teacher.qualification}
            </p>
            <p className="flex items-center gap-3">
              <Star size={18} className="text-orange-500" fill="currentColor" />
              {Number(teacher.rating || 0).toFixed(1)} / 5.0 Rating
            </p>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-950">Teaching Details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InfoItem icon={Award} label="Experience" value={`${teacher.experience} Years`} />
              <InfoItem icon={CalendarDays} label="Join Date" value={formatDate(teacher.joinDate)} />
              <InfoItem icon={Hash} label="Employee ID" value={teacher.id} />
              <InfoItem icon={BadgeDollarSign} label="Salary" value={formatSalary(teacher.salary)} />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-extrabold text-slate-950">Subjects</h2>
              <div className="mt-5 flex min-h-12 flex-wrap content-start gap-3">
                {(teacher.subjects?.length ? teacher.subjects : ["Not assigned"]).map((subject) => (
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700" key={subject}>
                    {subject}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-extrabold text-slate-950">Classes Assigned</h2>
              <div className="mt-5 flex min-h-12 flex-wrap content-start gap-3">
                {assignedClasses.length > 0 ? (
                  assignedClasses.map((className) => (
                    <span className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700" key={className}>
                      {className}
                    </span>
                  ))
                ) : (
                  <p className="text-base font-semibold text-slate-400">No classes assigned yet</p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-950">Monthly Attendance Summary</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 px-5 py-5 text-center">
                <p className="text-3xl font-extrabold text-emerald-600">{attendance.present}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Present Days</p>
              </div>
              <div className="rounded-2xl bg-red-50 px-5 py-5 text-center">
                <p className="text-3xl font-extrabold text-red-600">{attendance.absent}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Absent Days</p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-5 py-5 text-center">
                <p className="text-3xl font-extrabold text-amber-600">{attendance.leave}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Leave Days</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TeacherModal({ editingTeacher, onClose, onSave }) {
  const [form, setForm] = useState(editingTeacher ? teacherToForm(editingTeacher) : emptyTeacher);
  const [error, setError] = useState("");

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function submit(event) {
    event.preventDefault();
    const teacher = normalizeTeacherForm(form);

    if (!teacher.firstName || !teacher.lastName || !teacher.department || !teacher.qualification || !teacher.phone || !teacher.email) {
      setError("Please fill all required fields.");
      return;
    }

    onSave(teacher);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-[2px]">
      <form className="w-full max-w-[640px] overflow-hidden rounded-[20px] bg-white shadow-2xl" onSubmit={submit}>
        <div className="flex items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
            <BookOpen size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold">
              {editingTeacher ? "Edit Teacher" : "Add New Teacher"}
            </h2>
            <p className="text-sm text-white/80">
              {editingTeacher ? "Update teacher details" : "Enter teacher details"}
            </p>
          </div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
            onClick={onClose}
            aria-label="Close teacher form"
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
            <Field label="First Name" name="firstName" value={form.firstName} onChange={changeField} placeholder="e.g. Rahim" required />
            <Field label="Last Name" name="lastName" value={form.lastName} onChange={changeField} placeholder="e.g. Ahmed" required />
            <Field label="Department" name="department" value={form.department} onChange={changeField} placeholder="e.g. Science" required />
            <Field label="Qualification" name="qualification" value={form.qualification} onChange={changeField} placeholder="e.g. M.Sc Physics" required />
            <Field label="Phone" name="phone" value={form.phone} onChange={changeField} placeholder="03XX-XXXXXXX" required />
            <Field label="Email" name="email" value={form.email} onChange={changeField} placeholder="name@school.edu" required type="email" />
            <Field label="Join Date" name="joinDate" value={form.joinDate} onChange={changeField} type="date" />
            <Field label="Experience (Years)" name="experience" value={form.experience} onChange={changeField} type="number" />
            <Field label="Subjects" name="subjects" value={form.subjects} onChange={changeField} placeholder="e.g. Physics, Chemistry" />
            <Field label="Monthly Salary (৳)" name="salary" value={form.salary} onChange={changeField} placeholder="e.g. 65000" />
            <Field label="Assigned Classes" name="classes" value={form.classes} onChange={changeField} type="number" />
            <Field label="Status" name="status" value={form.status} onChange={changeField}>
              <option>Active</option>
              <option>On Leave</option>
            </Field>
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
            {editingTeacher ? "Save Changes" : "Add Teacher"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ViewModal({ teacher, onClose }) {
  if (!teacher) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#54a2ff] to-[#483ff2] text-lg font-extrabold text-white">
              {getInitials(teacher.name)}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">{teacher.name}</h2>
              <p className="text-sm font-semibold text-blue-600">{teacher.department}</p>
            </div>
          </div>
          <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close teacher details">
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          {[
            ["Teacher ID", teacher.id],
            ["Qualification", teacher.qualification],
            ["Phone", teacher.phone],
            ["Email", teacher.email],
            ["Join Date", formatDate(teacher.joinDate)],
            ["Experience", `${teacher.experience} years`],
            ["Salary", teacher.salary ? `৳${teacher.salary}` : "Not set"],
            ["Status", teacher.status],
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

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [modalMode, setModalMode] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [profileTeacher, setProfileTeacher] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const departments = useMemo(
    () => Array.from(new Set(teachers.map((teacher) => teacher.department).filter(Boolean))).sort(),
    [teachers],
  );

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const matchesSearch =
        !query ||
        (teacher.name || "").toLowerCase().includes(query) ||
        (teacher.id || "").toLowerCase().includes(query) ||
        (teacher.department || "").toLowerCase().includes(query) ||
        (teacher.subjects || []).some((subject) => subject.toLowerCase().includes(query));
      const matchesDepartment =
        departmentFilter === "All Departments" || teacher.department === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [teachers, search, departmentFilter]);

  async function loadTeachers(isCancelled = () => false) {
    try {
      setLoading(true);
      setError("");
      const rows = await teachersApi.list();
      if (!isCancelled()) {
        setTeachers(rows);
      }
    } catch (loadError) {
      if (!isCancelled()) {
        setError(loadError.message || "Unable to load teachers.");
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      loadTeachers(() => cancelled);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  async function refreshTeachers() {
    await loadTeachers();
  }

  async function saveTeacher(teacher) {
    try {
      if (modalMode?.type === "edit") {
        const updatedTeacher = await teachersApi.update(modalMode.teacher.id, teacher);
        setProfileTeacher((current) => (current?.id === modalMode.teacher.id ? updatedTeacher : current));
      } else {
        await teachersApi.create(teacher);
      }

      await refreshTeachers();
      setModalMode(null);
    } catch (saveError) {
      setError(saveError.message || "Unable to save teacher.");
    }
  }

  async function deleteTeacher(id) {
    try {
      await teachersApi.remove(id);
      setProfileTeacher((current) => (current?.id === id ? null : current));
      await refreshTeachers();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete teacher.");
    }
  }

  if (profileTeacher) {
    return <TeacherProfile teacher={profileTeacher} onBack={() => setProfileTeacher(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Teachers</h1>
          <p className="mt-1 text-base text-slate-500">
            {teachers.length} teachers in {departments.length} departments
          </p>
        </div>
        <button
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 text-base font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
          onClick={() => setModalMode({ type: "add" })}
        >
          <Plus size={20} />
          Add Teacher
        </button>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4">
            <Search size={20} className="text-slate-500" />
            <input
              className="w-full bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Search teachers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base text-slate-700 outline-none"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option>All Departments</option>
            {departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid min-h-[300px] place-items-center rounded-[20px] border border-slate-200 bg-white/70 text-center">
          <p className="text-base font-bold text-slate-500">Loading teachers...</p>
        </div>
      ) : filteredTeachers.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-3">
          {filteredTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              selected={teacher.id === "TCH-1002"}
              onOpen={setProfileTeacher}
              onView={setSelectedTeacher}
              onEdit={(item) => setModalMode({ type: "edit", teacher: item })}
              onDelete={setConfirmDeleteId}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[300px] place-items-center rounded-[20px] border border-dashed border-slate-200 bg-white/70 text-center">
          <div>
            <UserRound className="mx-auto text-slate-300" size={44} />
            <p className="mt-3 text-lg font-bold text-slate-600">No teachers found</p>
            <p className="mt-1 text-sm text-slate-400">Try another search or department.</p>
          </div>
        </div>
      )}

      {modalMode && (
        <TeacherModal
          editingTeacher={modalMode.type === "edit" ? modalMode.teacher : null}
          onClose={() => setModalMode(null)}
          onSave={saveTeacher}
        />
      )}
      <ViewModal teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} />

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Teacher?"
        message="Are you sure you want to permanently delete this teacher record? This action cannot be undone."
        type="danger"
        confirmText="Yes, Delete"
        onConfirm={() => {
          if (confirmDeleteId) {
            deleteTeacher(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
