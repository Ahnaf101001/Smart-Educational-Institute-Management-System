"use client";

import { useEffect, useMemo, useState } from "react";
import PhotoUpload, { PhotoAvatar } from "./ui/PhotoUpload";
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { studentsApi } from "../lib/api";
import ConfirmModal from "./ConfirmModal";

const initialStudents = [];

/*
  { id: "STU-4001", roll: "001", name: "Ali Hassan", gender: "Male", className: "Class 9-A", parentContact: "03XX-1234567", dateOfBirth: "2005-01-01", status: "Inactive" },
  { id: "STU-4002", roll: "002", name: "Fatima Malik", gender: "Female", className: "Class 10-B", parentContact: "03XX-2345678", dateOfBirth: "2006-02-02", status: "Active" },
  { id: "STU-4003", roll: "003", name: "Ahmed Khan", gender: "Male", className: "Class 8-A", parentContact: "03XX-3456789", dateOfBirth: "2007-03-03", status: "Active" },
  { id: "STU-4004", roll: "004", name: "Zainab Noor", gender: "Female", className: "Class 11-C", parentContact: "03XX-4567890", dateOfBirth: "2008-04-04", status: "Active" },
  { id: "STU-4005", roll: "005", name: "Omar Farooq", gender: "Male", className: "Class 7-B", parentContact: "03XX-5678901", dateOfBirth: "2009-05-05", status: "Active" },
  { id: "STU-4006", roll: "006", name: "Ayesha Siddiqui", gender: "Female", className: "Class 12-A", parentContact: "03XX-6789012", dateOfBirth: "2005-06-06", status: "Active" },
  { id: "STU-4007", roll: "007", name: "Bilal Ahmad", gender: "Male", className: "Class 6-A", parentContact: "03XX-7890123", dateOfBirth: "2006-07-07", status: "Active" },
  { id: "STU-4008", roll: "008", name: "Mariam Hussain", gender: "Female", className: "Class 9-B", parentContact: "03XX-8901234", dateOfBirth: "2007-08-08", status: "Inactive" },
  { id: "STU-4009", roll: "009", name: "Hammad Raza", gender: "Male", className: "Class 8-C", parentContact: "03XX-9012345", dateOfBirth: "2008-09-09", status: "Active" },
  { id: "STU-4010", roll: "010", name: "Sana Javed", gender: "Female", className: "Class 10-A", parentContact: "03XX-0123456", dateOfBirth: "2006-10-10", status: "Active" },
  { id: "STU-4011", roll: "011", name: "Usman Tariq", gender: "Male", className: "Class 11-B", parentContact: "03XX-1122334", dateOfBirth: "2005-11-11", status: "Inactive" },
  { id: "STU-4012", roll: "012", name: "Hira Shah", gender: "Female", className: "Class 7-A", parentContact: "03XX-2233445", dateOfBirth: "2009-12-12", status: "Active" },
  { id: "STU-4013", roll: "013", name: "Danish Iqbal", gender: "Male", className: "Class 6-B", parentContact: "03XX-3344556", dateOfBirth: "2010-01-13", status: "Active" },
  { id: "STU-4014", roll: "014", name: "Noor Ul Ain", gender: "Female", className: "Class 12-C", parentContact: "03XX-4455667", dateOfBirth: "2005-02-14", status: "Active" },
  { id: "STU-4015", roll: "015", name: "Saad Karim", gender: "Male", className: "Class 9-C", parentContact: "03XX-5566778", dateOfBirth: "2007-03-15", status: "Inactive" },
  { id: "STU-4016", roll: "016", name: "Iqra Bashir", gender: "Female", className: "Class 8-B", parentContact: "03XX-6677889", dateOfBirth: "2008-04-16", status: "Active" },
  { id: "STU-4017", roll: "017", name: "Rehan Aslam", gender: "Male", className: "Class 10-C", parentContact: "03XX-7788990", dateOfBirth: "2006-05-17", status: "Active" },
  { id: "STU-4018", roll: "018", name: "Mahnoor Ali", gender: "Female", className: "Class 7-C", parentContact: "03XX-8899001", dateOfBirth: "2009-06-18", status: "Active" },
  { id: "STU-4019", roll: "019", name: "Farhan Qureshi", gender: "Male", className: "Class 11-A", parentContact: "03XX-9900112", dateOfBirth: "2005-07-19", status: "Inactive" },
  { id: "STU-4020", roll: "020", name: "Laiba Ahmed", gender: "Female", className: "Class 6-C", parentContact: "03XX-1011121", dateOfBirth: "2010-08-20", status: "Active" },
];
*/

const pageSize = 8;

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const active = status === "Active";
  return (
    <span
      className={`inline-flex min-w-[74px] justify-center rounded-full px-3 py-1 text-sm font-bold ${
        active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function StudentList({ onAddStudent }) {
  const [students, setStudents] = useState(initialStudents);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All Classes");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [genderFilter, setGenderFilter] = useState("All Gender");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function fetchStudents() {
    try {
      const data = await studentsApi.list();
      setStudents(data);
      setLoaded(true);
    } catch (error) {
      console.error("Failed to fetch students:", error);
      setLoaded(true);
    }
  }

  useEffect(() => {
    studentsApi.list()
      .then((data) => {
        setStudents(data);
        setLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to fetch students:", error);
        setLoaded(true);
      });
  }, []);

  const classOptions = useMemo(
    () => ["All Classes", ...Array.from(new Set(students.map((student) => student.className))).sort()],
    [students],
  );

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.id.toLowerCase().includes(query) ||
        student.roll.includes(query) ||
        student.parentContact.toLowerCase().includes(query);
      const matchesClass =
        classFilter === "All Classes" || student.className === classFilter;
      const matchesStatus =
        statusFilter === "All Status" || student.status === statusFilter;
      const matchesGender =
        genderFilter === "All Gender" || student.gender === genderFilter;

      return matchesSearch && matchesClass && matchesStatus && matchesGender;
    });
  }, [students, search, classFilter, statusFilter, genderFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleStudents = filteredStudents.slice(startIndex, startIndex + pageSize);
  const showingStart = filteredStudents.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(startIndex + pageSize, filteredStudents.length);

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function updateFilter(setFilter, value) {
    setFilter(value);
    setPage(1);
  }

  async function deleteStudent(id) {
    try {
      await studentsApi.remove(id);
      await fetchStudents();
    } catch (error) {
      console.error("Failed to delete student:", error);
    } finally {
      setSelectedStudent(null);
      setConfirmDeleteId(null);
    }
  }



  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Student List</h1>
          <p className="mt-1 text-base text-slate-500">
            {students.length} students found
          </p>
        </div>
        <button
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
          onClick={onAddStudent}
        >
          <Plus size={20} />
          Add Student
        </button>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_138px_128px_156px]">
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4">
            <Search size={20} className="shrink-0 text-slate-500" />
            <input
              className="w-full bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
            />
          </label>

          <select
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base text-slate-700 outline-none"
            value={classFilter}
            onChange={(event) => updateFilter(setClassFilter, event.target.value)}
          >
            {classOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base text-slate-700 outline-none"
            value={statusFilter}
            onChange={(event) => updateFilter(setStatusFilter, event.target.value)}
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>

          <button
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-base font-bold transition ${
              showMoreFilters
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setShowMoreFilters((value) => !value)}
          >
            <Filter size={19} />
            More Filters
          </button>
        </div>

        {showMoreFilters && (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[220px_1fr]">
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base text-slate-700 outline-none"
              value={genderFilter}
              onChange={(event) => updateFilter(setGenderFilter, event.target.value)}
            >
              <option>All Gender</option>
              <option>Male</option>
              <option>Female</option>
            </select>
            <button
              className="justify-self-start rounded-2xl px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              onClick={() => {
                setSearch("");
                setClassFilter("All Classes");
                setStatusFilter("All Status");
                setGenderFilter("All Gender");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse text-left">
            <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-6 py-4 font-extrabold">Student</th>
                <th className="px-5 py-4 font-extrabold">ID / Roll</th>
                <th className="px-5 py-4 font-extrabold">Class</th>
                <th className="px-5 py-4 font-extrabold">Parent Contact</th>
                <th className="px-5 py-4 font-extrabold">Date of Birth</th>
                <th className="px-5 py-4 font-extrabold">Status</th>
                <th className="px-5 py-4 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleStudents.map((student) => (
                <tr className="transition hover:bg-blue-50/30" key={student.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <PhotoAvatar src={student.photoUrl} name={student.name} className="size-11" textClass="text-sm" />
                      <span className="min-w-0">
                        <strong className="block truncate text-base font-extrabold text-slate-950">
                          {student.name}
                        </strong>
                        <small className="text-sm text-slate-500">{student.gender}</small>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="block text-base text-slate-950">{student.id}</span>
                    <small className="text-sm text-slate-500">Roll: {student.roll}</small>
                  </td>
                  <td className="px-5 py-4 text-base text-slate-950">{student.className}</td>
                  <td className="px-5 py-4 text-base text-slate-600">{student.parentContact}</td>
                  <td className="px-5 py-4 text-base text-slate-600">{formatDisplayDate(student.dateOfBirth)}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={student.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-4">
                      <button
                        aria-label={`View ${student.name}`}
                        className="text-blue-600 transition hover:text-blue-800"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        aria-label={`Edit ${student.name}`}
                        className="text-slate-500 transition hover:text-slate-800"
                        onClick={() => setEditingStudent({ ...student })}
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        aria-label={`Delete ${student.name}`}
                        className="text-red-500 transition hover:text-red-700"
                        onClick={() => setConfirmDeleteId(student.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleStudents.length === 0 && (
          <div className="grid min-h-[260px] place-items-center border-t border-slate-100 text-center">
            <div>
              <Search className="mx-auto text-slate-300" size={42} />
              <p className="mt-3 text-lg font-bold text-slate-600">No students found</p>
              <p className="mt-1 text-sm text-slate-400">Try changing your filters.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {showingStart}-{showingEnd} of {filteredStudents.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous page"
              className="grid size-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 disabled:opacity-40"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={20} />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                className={`grid size-9 place-items-center rounded-xl text-sm font-bold transition ${
                  safePage === pageNumber
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              aria-label="Next page"
              className="grid size-9 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
              disabled={safePage === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <PhotoAvatar src={selectedStudent.photoUrl} name={selectedStudent.name} className="size-16" rounded="rounded-2xl" textClass="text-lg" />
                <div>
                <h2 className="text-xl font-extrabold text-slate-950">
                  {selectedStudent.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedStudent.id} - Roll {selectedStudent.roll}
                </p>
                </div>
              </div>
              <button
                aria-label="Close student details"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setSelectedStudent(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Class", selectedStudent.className],
                ["Gender", selectedStudent.gender],
                ["Parent Contact", selectedStudent.parentContact],
                ["Date of Birth", formatDisplayDate(selectedStudent.dateOfBirth)],
                ["Status", selectedStudent.status],
              ].map(([label, value]) => (
                <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3" key={label}>
                  <span className="text-slate-500">{label}</span>
                  <strong className="text-right text-slate-800">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <form 
            className="w-full max-w-lg rounded-[24px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await studentsApi.update(editingStudent.id, {
                  ...editingStudent,
                  dateOfBirth: toDateInputValue(editingStudent.dateOfBirth),
                });
                await fetchStudents();
                setEditingStudent(null);
              } catch (error) {
                console.error("Failed to update student:", error);
              }
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold text-slate-950">Edit Student</h2>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                onClick={() => setEditingStudent(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <PhotoUpload
                  label="ID Card Photo"
                  value={editingStudent.photoUrl || ""}
                  onChange={(url) => setEditingStudent((current) => ({ ...current, photoUrl: url }))}
                  ownerType="Student"
                  ownerId={editingStudent.id}
                />
              </div>
              <label className="col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">Name</span>
                <input required className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} />
              </label>
              <label>
                <span className="block text-sm font-medium text-slate-700 mb-1">Roll / ID</span>
                <input required className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={editingStudent.roll} onChange={e => setEditingStudent({...editingStudent, roll: e.target.value})} />
              </label>
              <label>
                <span className="block text-sm font-medium text-slate-700 mb-1">Class</span>
                <input required className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={editingStudent.className} onChange={e => setEditingStudent({...editingStudent, className: e.target.value})} />
              </label>
              <label>
                <span className="block text-sm font-medium text-slate-700 mb-1">Parent Contact</span>
                <input required className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={editingStudent.parentContact} onChange={e => setEditingStudent({...editingStudent, parentContact: e.target.value})} />
              </label>
              <label>
                <span className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</span>
                <input type="date" required className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={toDateInputValue(editingStudent.dateOfBirth)} onChange={e => setEditingStudent({...editingStudent, dateOfBirth: e.target.value})} />
              </label>
              <label>
                <span className="block text-sm font-medium text-slate-700 mb-1">Gender</span>
                <select className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={editingStudent.gender} onChange={e => setEditingStudent({...editingStudent, gender: e.target.value})}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </label>
              <label>
                <span className="block text-sm font-medium text-slate-700 mb-1">Status</span>
                <select className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" value={editingStudent.status} onChange={e => setEditingStudent({...editingStudent, status: e.target.value})}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </label>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingStudent(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition outline-none">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition outline-none">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Student?"
        message="Are you sure you want to permanently delete this student record? This action cannot be undone."
        type="danger"
        confirmText="Yes, Delete"
        onConfirm={() => {
          if (confirmDeleteId) deleteStudent(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
