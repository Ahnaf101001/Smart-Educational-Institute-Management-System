"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Edit3,
  GraduationCap,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { academicApi, studentsApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";

const tabs = [
  { id: "classes", label: "Classes & Sections", icon: GraduationCap },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "assign", label: "Class-Teacher Assign", icon: Users },
  { id: "years", label: "Academic Year", icon: CalendarDays },
];

const emptyClass = { name: "", level: "", sections: "", teacherId: "", students: "" };
const emptySubject = { name: "", code: "", type: "Compulsory", classRange: "", teacherId: "", status: "Active" };
const emptyYear = { name: "", startDate: "", endDate: "", status: "Upcoming" };

function SummaryCard({ value, label, note, className }) {
  return (
    <div className={`rounded-[20px] p-6 text-white shadow-sm transition hover:scale-[1.02] duration-300 ${className}`}>
      <strong className="block text-[38px] font-bold leading-none">{value}</strong>
      <p className="mt-2 text-[15px] font-semibold text-white/95">{label}</p>
      <span className="mt-0.5 block text-[13px] font-medium text-white/70">{note}</span>
    </div>
  );
}

function teacherName(teachers, id) {
  return teachers.find((teacher) => teacher.id === id)?.name || "Not assigned";
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(date) {
  if (!date) return "Not set";

  return String(date).slice(0, 10);
}

function dateInputValue(date) {
  return date ? String(date).slice(0, 10) : "";
}

function normalizeClassSection(value) {
  return String(value || "")
    .trim()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isEnrolledStudent(student) {
  return student.status !== "Inactive";
}

function countStudentsForSection(students, className, section) {
  const target = normalizeClassSection(`${className}-${section}`);
  return students.filter((student) =>
    isEnrolledStudent(student) && normalizeClassSection(student.className) === target
  ).length;
}

function countStudentsForClass(students, item) {
  return item.sections.reduce((total, section) =>
    total + countStudentsForSection(students, item.name, section), 0);
}

function ClassCard({ item, index, teachers, studentCount, onEdit, onDelete, onAddSection }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-13 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-extrabold text-white">
          {index + 1}
        </span>
        <div className="flex items-center gap-4">
          <button className="text-slate-500 transition hover:text-slate-800" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}>
            <Edit3 size={18} />
          </button>
          <button className="text-red-500 transition hover:text-red-700" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.name}`}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <h3 className="mt-5 text-xl font-extrabold text-slate-950">{item.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{studentCount} students enrolled</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.sections.map((section) => (
          <span className="rounded-full bg-blue-50 px-4 py-1 text-sm font-bold text-blue-700" key={section}>
            Section {section}
          </span>
        ))}
        <button
          className="rounded-full border border-dashed border-slate-300 px-4 py-1 text-sm font-bold text-slate-400 transition hover:border-blue-300 hover:text-blue-600"
          onClick={() => onAddSection(item)}
        >
          + Section
        </button>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Users size={15} />
          Class Teacher:
        </span>{" "}
        <strong className="text-slate-950">{teacherName(teachers, item.teacherId)}</strong>
      </div>
    </article>
  );
}

function ClassForm({ value, teachers, onChange, onCancel, onSave, editing }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-extrabold text-slate-950">
        {editing ? "Edit Class" : "Add New Class"}
      </h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-600">Class Name *</span>
          <input
            className="h-13 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="name"
            value={value.name}
            onChange={onChange}
            placeholder="e.g. Class 6"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-600">Level *</span>
          <select
            className="h-13 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="level"
            value={value.level}
            onChange={onChange}
          >
            <option value="">-- Select Level --</option>
            <option value="Primary">Primary</option>
            <option value="Secondary">Secondary</option>
            <option value="Higher Secondary">Higher Secondary</option>
            <option value="Madrasa">Madrasa</option>
          </select>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-600">Sections *</span>
          <input
            className="h-13 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="sections"
            value={value.sections}
            onChange={onChange}
            placeholder="e.g. A, B, C"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-600">Class Teacher</span>
          <select
            className="h-13 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="teacherId"
            value={value.teacherId}
            onChange={onChange}
          >
            <option value="">-- Select Teacher --</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button className="h-12 rounded-2xl border border-slate-200 px-6 font-bold text-slate-600" onClick={onCancel}>
          Cancel
        </button>
        <button className="h-12 rounded-2xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700" onClick={onSave}>
          {editing ? "Save Changes" : "Save Class"}
        </button>
      </div>
    </div>
  );
}

function SubjectPanel({ subjects, teachers, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(emptySubject);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveSubject() {
    if (!form.name.trim() || !form.code.trim()) return;
    
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      classRange: form.classRange.trim(),
      teacherId: form.teacherId || null,
      status: form.status || "Active",
    };

    if (editingId) {
      const saved = await onUpdate(editingId, payload);
      if (!saved) return;
    } else {
      const saved = await onCreate(payload);
      if (!saved) return;
    }

    setForm(emptySubject);
    setEditingId(null);
    setShowForm(false);
  }

  function editSubject(subject) {
    const normalized = normalizeSubject(subject);
    setEditingId(subject.id);
    setForm({
      name: normalized.name,
      code: normalized.code,
      type: normalized.type,
      classRange: normalized.classRange,
      teacherId: normalized.teacherId,
      status: normalized.status,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setEditingId(null);
    setForm(emptySubject);
    setShowForm(false);
  }

  function normalizeSubject(subject) {
    return {
      ...subject,
      type: subject.type || "Compulsory",
      classRange: subject.classRange || (Array.isArray(subject.classes) ? subject.classes.join(", ") : ""),
      status: subject.status || "Active",
    };
  }

  function TypeBadge({ type }) {
    const className =
      type === "Elective"
        ? "bg-purple-50 text-purple-600"
        : type === "Optional"
          ? "bg-slate-100 text-slate-600"
          : "bg-blue-50 text-blue-600";

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
        {type}
      </span>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white shadow-sm hover:bg-blue-700 transition duration-150"
          onClick={() => {
            if (showForm && !editingId) {
              setShowForm(false);
            } else {
              setEditingId(null);
              setForm(emptySubject);
              setShowForm(true);
            }
          }}
        >
          <Plus size={20} />
          Add Subject
        </button>
      </div>

      {showForm && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-xl font-extrabold text-slate-950 mb-5">
            {editingId ? "Edit Subject" : "Add New Subject"}
          </h2>
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-650">Subject Name *</span>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="name"
                value={form.name}
                onChange={changeField}
                placeholder="e.g. Mathematics"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-650">Subject Code *</span>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="code"
                value={form.code}
                onChange={changeField}
                placeholder="e.g. MAT-103"
              />
            </label>
            <label className="relative">
              <span className="mb-2 block text-sm font-semibold text-slate-650">Type</span>
              <div className="relative">
                <select
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 px-4 pr-10 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                  name="type"
                  value={form.type}
                  onChange={changeField}
                >
                  <option>Compulsory</option>
                  <option>Elective</option>
                  <option>Optional</option>
                </select>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronDown size={18} />
                </span>
              </div>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-650">Class Range</span>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="classRange"
                value={form.classRange}
                onChange={changeField}
                placeholder="e.g. 6-10"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-650">Assigned Teacher</span>
              <select
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="teacherId"
                value={form.teacherId}
                onChange={changeField}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button className="h-11 rounded-xl border border-slate-200 px-6 font-semibold text-slate-600 hover:bg-slate-50 transition duration-150" onClick={cancelForm}>
              Cancel
            </button>
            <button className="h-11 rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 transition duration-150" onClick={saveSubject}>
              {editingId ? "Save Subject" : "Save Subject"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-sm tracking-wide text-slate-600">
            <tr>
              <th className="px-6 py-4 font-bold text-[13px] text-slate-500 uppercase">Subject</th>
              <th className="px-5 py-4 font-bold text-[13px] text-slate-500 uppercase">Code</th>
              <th className="px-5 py-4 font-bold text-[13px] text-slate-500 uppercase">Type</th>
              <th className="px-5 py-4 font-bold text-[13px] text-slate-500 uppercase">Classes</th>
              <th className="px-5 py-4 font-bold text-[13px] text-slate-500 uppercase">Assigned Teacher</th>
              <th className="px-5 py-4 text-center font-bold text-[13px] text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map((item) => {
              const subject = normalizeSubject(item);
              return (
                <tr className="transition hover:bg-slate-50/50" key={subject.id}>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9.5 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <BookOpen size={18} />
                      </span>
                      <strong className="text-base font-bold text-slate-900">{subject.name}</strong>
                    </div>
                  </td>
                  <td className="px-5 py-4.5 text-sm font-semibold text-slate-500">{subject.code}</td>
                  <td className="px-5 py-4.5"><TypeBadge type={subject.type} /></td>
                  <td className="px-5 py-4.5 text-sm text-slate-600 font-semibold">{subject.classRange}</td>
                  <td className="px-5 py-4.5 text-sm text-slate-600 font-semibold">{teacherName(teachers, subject.teacherId)}</td>
                  <td className="px-5 py-4.5">
                    <div className="flex justify-center items-center gap-4">
                      <button className="text-slate-400 hover:text-slate-700 transition" onClick={() => editSubject(subject)} aria-label="Edit subject">
                        <Edit3 size={18} />
                      </button>
                      <button className="text-red-500 hover:text-red-700 transition" onClick={() => onDelete(subject.id)} aria-label="Delete subject">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssignPanel({ classes, subjects, teachers, assignments, students, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState({ classSection: "", subjectId: "", teacherId: "", roomNo: "" });
  const [editingId, setEditingId] = useState(null);

  const classOptions = useMemo(() => {
    return classes.flatMap((cls) =>
      cls.sections.map((sec) => ({
        value: `${cls.id}|${sec}`,
        label: `${cls.name}-${sec}`,
        classRef: cls,
      }))
    );
  }, [classes]);

  const selectedSubject = subjects.find((subject) => subject.id === form.subjectId);
  const teacherOptions = selectedSubject?.teacherId
    ? teachers.filter((teacher) => teacher.id === selectedSubject.teacherId)
    : [];

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => {
      if (name === "subjectId") {
        const subject = subjects.find((item) => item.id === value);
        return { ...current, subjectId: value, teacherId: subject?.teacherId || "" };
      }

      return { ...current, [name]: value };
    });
  }

  async function saveAssignment() {
    if (!form.classSection || !form.subjectId || !form.teacherId) return;

    const [classId, section] = form.classSection.split("|");
    const cls = classes.find((c) => c.id === classId);
    const students = cls && cls.sections.length > 0 ? Math.floor(cls.students / cls.sections.length) : 0;

    const payload = {
      classId,
      section,
      subjectId: form.subjectId,
      teacherId: form.teacherId,
      roomNo: form.roomNo,
      students,
    };

    const saved = editingId
      ? await onUpdate(editingId, payload)
      : await onCreate(payload);
    if (!saved) return;

    setForm({ classSection: "", subjectId: "", teacherId: "", roomNo: "" });
    setEditingId(null);
  }

  function editAssignment(item) {
    setEditingId(item.id);
    setForm({
      classSection: `${item.classId}|${item.section}`,
      subjectId: item.subjectId,
      teacherId: item.teacherId,
      roomNo: item.roomNo || "",
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-950 mb-5">
          Assign Teacher to Class
        </h2>
        <div className="grid gap-5 md:grid-cols-4 items-end">
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Class *</span>
            <div className="relative">
              <select
                className="h-12 w-full appearance-none rounded-xl border border-slate-200 px-4 pr-10 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                name="classSection"
                value={form.classSection}
                onChange={changeField}
              >
                <option value="">Select Class</option>
                {classOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={18} />
              </span>
            </div>
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Subject *</span>
            <div className="relative">
              <select
                className="h-12 w-full appearance-none rounded-xl border border-slate-200 px-4 pr-10 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                name="subjectId"
                value={form.subjectId}
                onChange={changeField}
              >
                <option value="">Select Subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={18} />
              </span>
            </div>
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Teacher *</span>
            <div className="relative">
              <select
                className="h-12 w-full appearance-none rounded-xl border border-slate-200 px-4 pr-10 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                name="teacherId"
                value={form.teacherId}
                onChange={changeField}
              >
                <option value="">Select Teacher</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={18} />
              </span>
            </div>
            {form.subjectId && !selectedSubject?.teacherId && (
              <p className="mt-2 text-xs font-semibold text-amber-600">
                Assign a teacher to this subject first.
              </p>
            )}
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Room No.</span>
            <input
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="roomNo"
              value={form.roomNo}
              onChange={changeField}
              placeholder="e.g. 401"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-700"
            onClick={saveAssignment}
          >
            {/* The icon in the image is a checkmark for "Save Assignment", but wait, it's just a regular button */}
            <span className="mr-2">✓</span>
            {editingId ? "Save Changes" : "Save Assignment"}
          </button>
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-950 mb-5">
          Current Assignments
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-bold text-[12px] tracking-wider text-slate-500 uppercase">Class</th>
                <th className="px-5 py-4 font-bold text-[12px] tracking-wider text-slate-500 uppercase">Teacher</th>
                <th className="px-5 py-4 font-bold text-[12px] tracking-wider text-slate-500 uppercase">Subject</th>
                <th className="px-5 py-4 font-bold text-[12px] tracking-wider text-slate-500 uppercase text-center">Students</th>
                <th className="px-5 py-4 font-bold text-[12px] tracking-wider text-slate-500 uppercase text-center">Room</th>
                <th className="px-5 py-4 font-bold text-[12px] tracking-wider text-slate-500 uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((item) => {
                const cls = classes.find((c) => c.id === item.classId);
                const className = cls ? `${cls.name}-${item.section}` : "Unknown";
                const teacher = teachers.find((t) => t.id === item.teacherId)?.name || "Unknown";
                const subject = subjects.find((s) => s.id === item.subjectId)?.name || "Unknown";
                const studentCount = cls ? countStudentsForSection(students, cls.name, item.section) : 0;

                return (
                  <tr className="transition hover:bg-slate-50/50" key={item.id}>
                    <td className="px-5 py-4 font-bold text-blue-650">{className}</td>
                    <td className="px-5 py-4 font-bold text-slate-800">{teacher}</td>
                    <td className="px-5 py-4 text-slate-500 font-medium">{subject}</td>
                    <td className="px-5 py-4 text-center font-bold text-slate-700">{studentCount || "-"}</td>
                    <td className="px-5 py-4 text-center text-slate-500 font-medium">{item.roomNo || "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center items-center gap-4">
                        <button className="text-slate-400 hover:text-slate-700 transition" onClick={() => editAssignment(item)}>
                          <Edit3 size={16} />
                        </button>
                        <button className="text-red-400 hover:text-red-600 transition" onClick={() => onDelete(item.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-slate-500">
                    No assignments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function YearPanel({ years, settings, onCreate, onUpdate, onUpdateSettings }) {
  const [showYearForm, setShowYearForm] = useState(false);
  const [form, setForm] = useState(emptyYear);
  const [editingId, setEditingId] = useState(null);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: "", message: "" });
  
  // Settings form state
  const [settingsForm, setSettingsForm] = useState(settings || {});
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (settings) setSettingsForm(settings);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [settings]);

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeSettingsField(event) {
    const { name, value } = event.target;
    setSettingsForm((current) => ({ ...current, [name]: value }));
  }

  async function saveYear() {
    if (!form.name || !form.startDate || !form.endDate) return;
    const payload = { ...form, sessions: Number(form.sessions) || 2 };
    const saved = editingId
      ? await onUpdate(editingId, payload)
      : await onCreate(payload);
    if (!saved) return;
    setForm(emptyYear);
    setEditingId(null);
    setShowYearForm(false);
    setSuccessModal({
      isOpen: true,
      title: editingId ? "Year Updated" : "Year Saved",
      message: editingId
        ? "Academic year has been updated successfully."
        : "Academic year has been created successfully.",
    });
  }

  async function saveSettings() {
    const saved = await onUpdateSettings(settingsForm);
    if (!saved) return;

    setSuccessModal({
      isOpen: true,
      title: "Settings Saved",
      message: "Current year settings have been saved successfully.",
    });
  }

  function openForm(year = null) {
    if (year) {
      setEditingId(year.id);
      setForm({
        ...year,
        startDate: dateInputValue(year.startDate),
        endDate: dateInputValue(year.endDate),
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyYear, sessions: 2, status: "Upcoming" });
    }
    setShowYearForm(true);
  }

  const currentYear = years.find((y) => y.status === "Current") || years[0];

  return (
    <div className="space-y-8">
      {/* Horizontal Scrollable/Wrapped Cards */}
      <div className="flex flex-wrap gap-5">
        {years.map((year) => {
          const isCurrent = year.status === "Current";
          return (
            <div className="flex w-[280px] flex-col rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm relative transition hover:shadow-md" key={year.id}>
              {isCurrent && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-blue-600 tracking-wider">
                  <span className="size-1.5 rounded-full bg-blue-600" />
                  CURRENT YEAR
                </div>
              )}
              <h3 className="text-2xl font-extrabold text-slate-950">{year.name}</h3>
              
              <div className="mt-5 space-y-3 text-[13px] font-medium text-slate-500">
                <div className="flex items-center justify-between gap-4">
                <span>Start Date</span>
                  <span className="text-right font-bold text-slate-900">{formatDate(year.startDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                <span>End Date</span>
                  <span className="text-right font-bold text-slate-900">{formatDate(year.endDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                <span>Sessions</span>
                  <span className="text-right font-bold text-slate-900">{year.sessions || 2}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  isCurrent ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {year.status}
                </span>
                {isCurrent && (
                  <button className="text-[13px] font-bold text-blue-600 hover:text-blue-700 transition" onClick={() => openForm(year)}>
                    Edit &gt;
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button
          className="flex w-[280px] flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-500"
          onClick={() => openForm()}
        >
          <Plus size={28} className="mb-3" />
          <span className="font-bold">Create New Year</span>
        </button>
      </div>

      {showYearForm && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-slate-950 mb-5">
            {editingId ? "Edit Year" : "Create New Year"}
          </h2>
          <div className="grid gap-4 lg:grid-cols-5">
            <input className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="name" value={form.name} onChange={changeField} placeholder="e.g. 2026-27" />
            <input className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="startDate" value={form.startDate} onChange={changeField} type="date" />
            <input className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="endDate" value={form.endDate} onChange={changeField} type="date" />
            <select className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="status" value={form.status} onChange={changeField}>
              <option>Current</option>
              <option>Upcoming</option>
              <option>Completed</option>
            </select>
            <input className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="sessions" value={form.sessions || ""} onChange={changeField} placeholder="Sessions" type="number" />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button className="h-11 rounded-xl border border-slate-200 px-6 font-semibold text-slate-600 hover:bg-slate-50 transition" onClick={() => setShowYearForm(false)}>
              Cancel
            </button>
            <button className="h-11 rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 transition" onClick={saveYear}>
              {editingId ? "Save Changes" : "Save Year"}
            </button>
          </div>
        </div>
      )}

      {/* Current Year Settings */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-950 mb-6">
          Current Year Settings {currentYear && `(${currentYear.name})`}
        </h2>
        <div className="grid gap-6 md:grid-cols-4">
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Working Days/Week</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="workingDays" value={settingsForm.workingDays || ""} onChange={changeSettingsField} placeholder="e.g. 6" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">School Start Time</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="startTime" value={settingsForm.startTime || ""} onChange={changeSettingsField} placeholder="e.g. 08:00 AM" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">School End Time</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="endTime" value={settingsForm.endTime || ""} onChange={changeSettingsField} placeholder="e.g. 02:30 PM" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Periods per Day</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="periodsPerDay" value={settingsForm.periodsPerDay || ""} onChange={changeSettingsField} placeholder="e.g. 8" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Period Duration (min)</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="periodDuration" value={settingsForm.periodDuration || ""} onChange={changeSettingsField} placeholder="e.g. 45" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Grading System</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="gradingSystem" value={settingsForm.gradingSystem || ""} onChange={changeSettingsField} placeholder="e.g. GPA (0-5)" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Pass Marks (%)</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="passMarks" value={settingsForm.passMarks || ""} onChange={changeSettingsField} placeholder="e.g. 33%" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-650">Promotion Policy</span>
            <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name="promotionPolicy" value={settingsForm.promotionPolicy || ""} onChange={changeSettingsField} placeholder="e.g. Annual" />
          </label>
        </div>
        <div className="mt-8 flex justify-end">
          <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-7 font-bold text-white hover:bg-blue-700 transition" onClick={saveSettings}>
            <span className="mr-1">✓</span>
            Save Settings
          </button>
        </div>
      </div>
      <ConfirmModal
        isOpen={successModal.isOpen}
        title={successModal.title}
        message={successModal.message}
        type="success"
        confirmText="OK"
        cancelText="Close"
        onConfirm={() => setSuccessModal({ isOpen: false, title: "", message: "" })}
        onCancel={() => setSuccessModal({ isOpen: false, title: "", message: "" })}
      />
    </div>
  );
}

export default function Academic() {
  const [activeTab, setActiveTab] = useState("classes");
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [settings, setSettings] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClassId, setEditingClassId] = useState(null);
  const [classForm, setClassForm] = useState(emptyClass);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, type: null });

  useEffect(() => {
    academicApi.clearLegacyStorage();
    refreshAcademic();
  }, []);

  const totalSections = classes.reduce((sum, item) => sum + item.sections.length, 0);
  const totalStudents = students.filter(isEnrolledStudent).length;
  const totalLevels = new Set(classes.map((item) => item.level)).size;
  const currentAcademicYear = years.find((year) => year.status === "Current")?.name;

  async function refreshAcademic(showLoader = true) {
    if (showLoader) setIsLoading(true);
    setError("");
    try {
      const [data, studentData] = await Promise.all([
        academicApi.load(),
        studentsApi.list(),
      ]);
      setStudents(studentData);
      setClasses(data.classes);
      setSubjects(data.subjects);
      setYears(data.years);
      setSettings(data.settings);
      setAssignments(data.assignments);
      setTeachers(data.teachers);
    } catch (requestError) {
      setError(requestError.message || "Academic data could not be loaded.");
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }

  async function runMutation(action) {
    setIsSaving(true);
    setError("");
    try {
      await action();
      await refreshAcademic(false);
      return true;
    } catch (requestError) {
      setError(requestError.message || "The academic record could not be saved.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function changeClassForm(event) {
    const { name, value } = event.target;
    setClassForm((current) => ({ ...current, [name]: value }));
  }

  function openClassForm(item) {
    if (item) {
      setEditingClassId(item.id);
      setClassForm({
        name: item.name,
        level: item.level || "",
        sections: item.sections.join(", "),
        teacherId: item.teacherId || "",
        students: String(item.students || 0),
      });
    } else {
      setEditingClassId(null);
      setClassForm(emptyClass);
    }
    setShowClassForm(true);
  }

  async function saveClass() {
    if (!classForm.name.trim() || !classForm.level || !classForm.sections.trim()) return;
    const payload = {
      name: classForm.name.trim(),
      sections: parseCsv(classForm.sections),
      teacherId: classForm.teacherId || null,
      students: Number(classForm.students) || 0,
      level: classForm.level,
    };

    const saved = await runMutation(() =>
      editingClassId
        ? academicApi.classes.update(editingClassId, payload)
        : academicApi.classes.create(payload),
    );
    if (!saved) return;

    setShowClassForm(false);
    setEditingClassId(null);
    setClassForm(emptyClass);
  }

  async function addSection(item) {
    const used = new Set(item.sections);
    const next = ["A", "B", "C", "D", "E"].find((section) => !used.has(section));
    if (!next) return;
    await runMutation(() =>
      academicApi.classes.update(item.id, { sections: [...item.sections, next] }),
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          <span>{error}</span>
          <button
            className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-white"
            onClick={() => refreshAcademic()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCard value={classes.length} label="Total Classes" note={`${totalLevels} levels`} className="bg-[#2b4bf2]" />
        <SummaryCard value={totalSections} label="Total Sections" note="across all classes" className="bg-[#8a00f4]" />
        <SummaryCard value={subjects.length} label="Total Subjects" note="active subjects" className="bg-[#008080]" />
        <SummaryCard
          value={totalStudents}
          label="Total Students"
          note={currentAcademicYear ? `enrolled ${currentAcademicYear}` : "enrolled students"}
          className="bg-[#00a85a]"
        />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={`inline-flex h-16 shrink-0 items-center gap-3 border-b-2 px-6 text-base font-bold transition ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-850"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={19} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-5 p-6">
          {isLoading ? (
            <div className="grid min-h-72 place-items-center text-sm font-semibold text-slate-500">
              Loading academic data from the server...
            </div>
          ) : (
          <>
          {activeTab === "classes" && (
            <>
              <div className="flex justify-end">
                <button className="inline-flex h-13 items-center gap-2 rounded-2xl bg-blue-600 px-7 font-bold text-white" onClick={() => openClassForm(null)}>
                  <Plus size={20} />
                  Add Class
                </button>
              </div>
              {showClassForm && (
                <ClassForm
                  value={classForm}
                  teachers={teachers}
                  onChange={changeClassForm}
                  onCancel={() => setShowClassForm(false)}
                  onSave={saveClass}
                  editing={Boolean(editingClassId)}
                />
              )}
              <div className="grid gap-5 xl:grid-cols-3">
                {classes.map((item, index) => (
                  <ClassCard
                    key={item.id}
                    item={item}
                    index={index}
                    teachers={teachers}
                    studentCount={countStudentsForClass(students, item)}
                    onEdit={openClassForm}
                    onDelete={(id) => setConfirmDelete({ isOpen: true, id, type: 'Class' })}
                    onAddSection={addSection}
                  />
                ))}
              </div>
            </>
          )}

          {activeTab === "subjects" && (
            <SubjectPanel
              subjects={subjects}
              classes={classes}
              teachers={teachers}
              onCreate={(row) => runMutation(() => academicApi.subjects.create(row))}
              onUpdate={(id, row) => runMutation(() => academicApi.subjects.update(id, row))}
              onDelete={(id) => setConfirmDelete({ isOpen: true, id, type: 'Subject' })}
            />
          )}

          {activeTab === "assign" && (
            <AssignPanel
              classes={classes}
              subjects={subjects}
              teachers={teachers}
              assignments={assignments}
              students={students}
              onCreate={(row) => runMutation(() => academicApi.assignments.create(row))}
              onUpdate={(id, row) => runMutation(() => academicApi.assignments.update(id, row))}
              onDelete={(id) => setConfirmDelete({ isOpen: true, id, type: 'Assignment' })}
            />
          )}

          {activeTab === "years" && (
            <YearPanel
              years={years}
              settings={settings}
              onCreate={(row) => runMutation(() => academicApi.years.create(row))}
              onUpdate={(id, row) => runMutation(() => academicApi.years.update(id, row))}
              onDelete={(id) => setConfirmDelete({ isOpen: true, id, type: 'Year' })}
              onUpdateSettings={(newSettings) => runMutation(() => academicApi.settings.update(newSettings))}
            />
          )}
          </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title={`Delete ${confirmDelete.type}?`}
        message={`Are you sure you want to permanently delete this ${confirmDelete.type?.toLowerCase()} record? This action cannot be undone.`}
        type="danger"
        confirmText="Yes, Delete"
        onConfirm={async () => {
          if (confirmDelete.id) {
            const actions = {
              Class: () => academicApi.classes.remove(confirmDelete.id),
              Subject: () => academicApi.subjects.remove(confirmDelete.id),
              Assignment: () => academicApi.assignments.remove(confirmDelete.id),
              Year: () => academicApi.years.remove(confirmDelete.id),
            };
            if (actions[confirmDelete.type]) {
              await runMutation(actions[confirmDelete.type]);
            }
          }
          setConfirmDelete({ isOpen: false, id: null, type: null });
        }}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, type: null })}
      />
      {isSaving && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-xl">
          Saving to database...
        </div>
      )}
    </div>
  );
}
