"use client";

import { Fragment, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Search, Pencil, Trash2, X, Layers,
  CheckCircle2, ChevronDown, ChevronRight, Users,
  Calendar, AlertCircle, CircleDollarSign,
  Package, Clock, Banknote, Tag, Settings,
} from "lucide-react";
import { feeStructuresApi, academicApi } from "../lib/api";

/* ───── helpers ───── */
const fmt = (n) => "৳" + Number(n).toLocaleString("en-IN");

const freqBadge = (f) => {
  switch (f) {
    case "Monthly":     return "bg-blue-50 text-blue-600 border-blue-100";
    case "Quarterly":   return "bg-purple-50 text-purple-600 border-purple-100";
    case "Half-Yearly": return "bg-amber-50 text-amber-600 border-amber-100";
    case "Annual":      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "Per Exam":    return "bg-rose-50 text-rose-600 border-rose-100";
    case "One-time":    return "bg-slate-100 text-slate-600 border-slate-200";
    default:            return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const frequencyOptions = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "Per Exam", "One-time"];

const emptyForm = () => ({
  name: "",
  className: "All Classes",
  frequency: "Monthly",
  dueDay: 10,
  status: "Active",
  components: [{ name: "", amount: "" }],
});

/* ═══════════════════════════════════════════════════════════
   AddFee Component
   ═══════════════════════════════════════════════════════════ */
export default function AddFee() {
  const [feeStructures, setFeeStructures] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});

  /* ── data loading ── */
  async function loadData() {
    try {
      setLoading(true);
      const [fees, classes] = await Promise.all([
        feeStructuresApi.list(),
        academicApi.classes.list()
      ]);

      const mappedFees = (fees || []).map((f) => {
        const matchingClass = (classes || []).find((c) => c.id === f.classId);
        return {
          ...f,
          className: matchingClass ? matchingClass.name : "All Classes",
        };
      });

      setFeeStructures(mappedFees);
      setClassesList(classes || []);
    } catch (err) {
      console.error("Error loading fee structures & classes:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);



  /* ── computed ── */
  const activeCount = feeStructures.filter((f) => f.status === "Active").length;
  const monthlyRevenue = feeStructures
    .filter((f) => f.status === "Active" && f.frequency === "Monthly")
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const coveredClasses = new Set(
    feeStructures
      .filter((f) => f.status === "Active")
      .flatMap((f) => f.className.split(",").map((c) => c.trim())),
  );

  const filtered = feeStructures.filter((f) => {
    if (filterStatus !== "All" && f.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !f.name.toLowerCase().includes(q) &&
        !f.className.toLowerCase().includes(q) &&
        !f.components.some((c) => c.name.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  const classOptions = ["All Classes", ...classesList.map((c) => c.name)];

  /* ── form helpers ── */
  function openAddModal() {
    setEditingFee(null);
    setFormData(emptyForm());
    setFormErrors({});
    setShowFormModal(true);
  }

  function openEditModal(fee) {
    setEditingFee(fee);
    setFormData({
      name: fee.name,
      className: fee.className,
      frequency: fee.frequency,
      dueDay: fee.dueDay ?? 10,
      status: fee.status,
      components: fee.components.map((c) => ({ ...c })),
    });
    setFormErrors({});
    setShowFormModal(true);
  }

  function addComponent() {
    setFormData((prev) => ({
      ...prev,
      components: [...prev.components, { name: "", amount: "" }],
    }));
  }

  function removeComponent(index) {
    setFormData((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  }

  function updateComponent(index, field, value) {
    setFormData((prev) => ({
      ...prev,
      components: prev.components.map((c, i) =>
        i === index ? { ...c, [field]: field === "amount" ? value : value } : c,
      ),
    }));
  }

  function computeTotal() {
    return formData.components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }

  function validateForm() {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Fee name is required";
    if (!formData.className.trim()) errors.className = "Class is required";
    const validComponents = formData.components.filter((c) => c.name.trim() && Number(c.amount) > 0);
    if (validComponents.length === 0) errors.components = "At least one fee component is required";
    formData.components.forEach((c, i) => {
      if (c.name.trim() && (!c.amount || Number(c.amount) <= 0))
        errors[`comp_${i}`] = "Amount must be greater than 0";
      if (!c.name.trim() && Number(c.amount) > 0)
        errors[`comp_${i}`] = "Component name is required";
    });
    return errors;
  }

  async function handleSubmit() {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const validComponents = formData.components
      .filter((c) => c.name.trim() && Number(c.amount) > 0)
      .map((c) => ({ name: c.name.trim(), amount: Number(c.amount) }));

    const totalAmount = validComponents.reduce((s, c) => s + c.amount, 0);

    const matchedClass = classesList.find((c) => c.name === formData.className);

    const payload = {
      name: formData.name.trim(),
      classId: matchedClass ? matchedClass.id : null,
      amount: totalAmount,
      frequency: formData.frequency,
      dueDay: Number(formData.dueDay) || null,
      status: formData.status,
      components: validComponents,
    };

    try {
      setSubmitting(true);
      if (editingFee) {
        const updated = await feeStructuresApi.update(editingFee.id, payload);
        const mappedUpdated = {
          ...updated,
          className: matchedClass ? matchedClass.name : "All Classes",
        };
        setFeeStructures((prev) =>
          prev.map((f) => (f.id === editingFee.id ? mappedUpdated : f))
        );
      } else {
        const created = await feeStructuresApi.create(payload);
        const mappedCreated = {
          ...created,
          className: matchedClass ? matchedClass.name : "All Classes",
        };
        setFeeStructures((prev) => [mappedCreated, ...prev]);
      }
      setShowFormModal(false);
    } catch (err) {
      console.error("Error saving fee structure:", err);
      alert("Failed to save fee structure: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      setSubmitting(true);
      await feeStructuresApi.remove(id);
      setFeeStructures((prev) => prev.filter((f) => f.id !== id));
      setDeleteId(null);
    } catch (err) {
      console.error("Error deleting fee structure:", err);
      alert("Failed to delete fee structure: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }



  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <CircleDollarSign className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading Fee structures...</p>
        </div>
      </div>
    );
  }

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* ───── Summary Cards ───── */}
      <div className="grid grid-cols-4 gap-6">
        {/* Total Structures */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2863eb] to-[#1d4ed8] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <Layers size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">{feeStructures.length}</div>
            <div className="mt-1 text-sm font-bold text-blue-100">Total Fee Types</div>
            <div className="mt-1 text-[11px] font-medium text-blue-200">All structures defined</div>
          </div>
        </div>

        {/* Active */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00c853] to-[#00a844] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">{activeCount}</div>
            <div className="mt-1 text-sm font-bold text-emerald-100">Active</div>
            <div className="mt-1 text-[11px] font-medium text-emerald-200">Currently collecting</div>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <CircleDollarSign size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">{fmt(monthlyRevenue)}</div>
            <div className="mt-1 text-sm font-bold text-purple-100">Monthly / Student</div>
            <div className="mt-1 text-[11px] font-medium text-purple-200">Sum of monthly fees</div>
          </div>
        </div>

        {/* Classes Covered */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8f00] to-[#f57c00] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <Package size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">{coveredClasses.size}</div>
            <div className="mt-1 text-sm font-bold text-orange-100">Classes Covered</div>
            <div className="mt-1 text-[11px] font-medium text-orange-200">With active fee structures</div>
          </div>
        </div>
      </div>

      {/* ───── Main Panel ───── */}
      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Fee Structures</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">
                Define fee types like Admission Fee, Exam Fee, Sports Fee and assign to students
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus size={18} strokeWidth={2.5} /> Add Fee Structure
            </button>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex h-11 flex-1 max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search fee structures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2">
              {["All", "Active", "Inactive"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`h-10 rounded-xl px-5 text-sm font-bold shadow-sm transition ${
                    filterStatus === status
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/50">
                <th className="py-4 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px] w-8" />
                <th className="py-4 px-3 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Fee Name</th>
                <th className="py-4 px-3 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Class</th>
                <th className="py-4 px-3 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Components</th>
                <th className="py-4 px-3 font-bold text-slate-400 uppercase tracking-wider text-[11px] text-right">Amount</th>
                <th className="py-4 px-3 font-bold text-slate-400 uppercase tracking-wider text-[11px] text-center">Frequency</th>
                <th className="py-4 px-3 font-bold text-slate-400 uppercase tracking-wider text-[11px] text-center">Status</th>
                <th className="py-4 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((fee) => {
                const isExpanded = expandedId === fee.id;
                return (
                  <Fragment key={fee.id}>
                    <tr className="hover:bg-slate-50/50 transition group">
                      <td className="py-4 px-6">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : fee.id)}
                          className="text-slate-400 hover:text-blue-600 transition"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Banknote size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{fee.name}</div>
                            <div className="text-[11px] font-medium text-slate-400 mt-0.5">{fee.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 font-semibold text-slate-500">{fee.className}</td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                            {fee.components ? fee.components.length : 0}
                          </span>
                          <span className="text-xs font-medium text-slate-400">
                            {fee.components && fee.components.length === 1 ? "item" : "items"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-right font-extrabold text-slate-800">{fmt(fee.amount)}</td>
                      <td className="py-4 px-3 text-center">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold ${freqBadge(fee.frequency)}`}>
                          {fee.frequency}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold ${
                            fee.status === "Active"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {fee.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Edit"
                            onClick={() => openEditModal(fee)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => setDeleteId(fee.id)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Components Row */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-0 py-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-slate-50/70 px-20 py-5 border-b border-slate-100">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                  Fee Components
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {fee.components && fee.components.map((comp, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between rounded-xl bg-white border border-slate-100 px-4 py-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                                          <CircleDollarSign size={14} />
                                        </span>
                                        <span className="text-sm font-semibold text-slate-700">{comp.name}</span>
                                      </div>
                                      <span className="text-sm font-extrabold text-slate-800">{fmt(comp.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                                  <span className="text-sm font-bold text-blue-700">Total Amount</span>
                                  <span className="text-base font-black text-blue-700">{fmt(fee.amount)}</span>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Layers size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-400">No fee structures found</p>
              <button onClick={openAddModal} className="mt-3 text-sm font-bold text-blue-600 hover:underline">
                + Create your first fee structure
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-4">
          <div className="text-xs font-bold text-slate-400">
            Showing {filtered.length} of {feeStructures.length} fee structures
          </div>
        </div>
      </div>

      {/* ═══════════ ADD / EDIT MODAL ═══════════ */}
      <AnimatePresence>
        {showFormModal && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5 bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">
                      {editingFee ? "Edit Fee Structure" : "Add Fee Structure"}
                    </h3>
                    <p className="text-sm font-medium text-slate-400 mt-0.5">
                      {editingFee ? "Modify fee components and details" : "Define a new fee type with components"}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFormModal(false)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-8 space-y-6">
                  {/* Fee Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-400" />
                      Fee Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Monthly Tuition Fee, Admission Fee, Sports Fee..."
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className={`w-full h-12 rounded-xl border px-4 text-sm font-semibold text-slate-800 outline-none transition focus:ring-4 ${
                        formErrors.name 
                          ? "border-rose-300 focus:border-rose-500 focus:ring-rose-50" 
                          : "border-slate-200 focus:border-blue-500 focus:ring-blue-50"
                      }`}
                    />
                    {formErrors.name && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.name}</p>}
                  </div>

                  {/* Class + Frequency Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                        <Users size={13} className="text-slate-400" />
                        Target Class
                      </label>
                      <select
                        value={formData.className}
                        onChange={(e) => setFormData((p) => ({ ...p, className: e.target.value }))}
                        className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition"
                      >
                        {classOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        Frequency
                      </label>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData((p) => ({ ...p, frequency: e.target.value }))}
                        className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition"
                      >
                        {frequencyOptions.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Due Day + Status Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.frequency !== "One-time" && formData.frequency !== "Per Exam" ? (
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          Last Date of Payment (Day of month)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="e.g., 10"
                          value={formData.dueDay || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((p) => ({ ...p, dueDay: val === "" ? "" : Number(val) }));
                          }}
                          className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition"
                        />
                      </div>
                    ) : null}
                    <div className={formData.frequency !== "One-time" && formData.frequency !== "Per Exam" ? "" : "col-span-2"}>
                      <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                        <Settings size={13} className="text-slate-400" />
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                        className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  {/* Fee Components */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <Layers size={13} className="text-slate-400" />
                        Fee Components <span className="text-rose-500">*</span>
                      </label>
                      {formErrors.components && (
                        <span className="text-xs font-semibold text-rose-500">{formErrors.components}</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {formData.components.map((comp, i) => (
                        <div key={i} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/80 transition focus-within:border-blue-200 focus-within:bg-slate-50/80">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="Component name (e.g., Tuition Fee)"
                              value={comp.name}
                              onChange={(e) => updateComponent(i, "name", e.target.value)}
                              className={`w-full h-11 rounded-xl border bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition ${
                                formErrors[`comp_${i}`] ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-50" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                              }`}
                            />
                          </div>
                          <div className="w-[140px] relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">৳</span>
                            <input
                              type="number"
                              placeholder="Amount"
                              value={comp.amount}
                              onChange={(e) => updateComponent(i, "amount", e.target.value)}
                              className={`w-full h-11 rounded-xl border bg-white pl-8 pr-3 text-sm font-extrabold text-slate-800 outline-none transition ${
                                formErrors[`comp_${i}`] ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-50" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                              }`}
                            />
                          </div>
                          <button
                            onClick={() => removeComponent(i)}
                            disabled={formData.components.length <= 1}
                            className={`rounded-xl p-2.5 transition border ${
                              formData.components.length <= 1
                                ? "text-slate-200 border-slate-100 cursor-not-allowed"
                                : "text-slate-400 bg-white hover:bg-rose-50 border-slate-200 hover:border-rose-200 hover:text-rose-600"
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addComponent}
                      className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/20 py-3 text-sm font-bold text-blue-600 transition w-full justify-center"
                    >
                      <Plus size={16} /> Add Component
                    </button>
                  </div>

                  {/* Total */}
                  <div className="rounded-2xl bg-gradient-to-r from-[#2863eb] to-[#5138ed] p-5 text-white flex items-center justify-between shadow-md shadow-blue-100/50">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-100 block">Total Amount</span>
                      <span className="text-xs font-medium text-blue-200 mt-0.5 block">Automatically calculated from components</span>
                    </div>
                    <span className="text-3xl font-black">{fmt(computeTotal())}</span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-8 py-5 bg-slate-50/30">
                  <button
                    onClick={() => setShowFormModal(false)}
                    disabled={submitting}
                    className="h-12 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="h-12 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition flex items-center gap-2 disabled:bg-slate-300"
                  >
                    {submitting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    {editingFee ? "Save Changes" : "Create Fee Structure"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════ DELETE CONFIRMATION ═══════════ */}
      <AnimatePresence>
        {deleteId && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div
                className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
                  <AlertCircle size={28} className="text-rose-600" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 mb-1">Delete Fee Structure?</h3>
                <p className="text-sm font-medium text-slate-500 mb-6">
                  This action cannot be undone. All related data will be removed.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDeleteId(null)}
                    disabled={submitting}
                    className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteId)}
                    disabled={submitting}
                    className="h-11 flex-1 rounded-xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 transition disabled:bg-slate-300"
                  >
                    {submitting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
