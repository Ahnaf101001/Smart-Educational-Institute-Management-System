"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Search, Filter, ArrowUpRight, Download, MoreVertical, X, Calendar, Hash, Tag, 
  FileSignature, Wallet, AlignLeft, ChevronDown, Building2, Smartphone, Banknote, 
  CreditCard, Globe, Edit, Trash2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { transactionsApi } from "../lib/api";
import { today } from "./ui/kit";

export default function IncomeEntry() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("Cash");

  const [incomeData, setIncomeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const formatCurrency = (num) => "৳" + Number(num).toLocaleString("en-IN");

  const categoryStyles = {
    "Tuition Fee": "bg-blue-50 text-blue-700 border-blue-200",
    "Donation": "bg-purple-50 text-purple-700 border-purple-200",
    "Transport Fee": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Hostel": "bg-orange-50 text-orange-700 border-orange-200",
    "Fine": "bg-rose-50 text-rose-700 border-rose-200",
  };

  const methodIcons = {
    "Bank Transfer": <Building2 size={14} className="text-slate-400" />,
    "Mobile Banking": <Smartphone size={14} className="text-slate-400" />,
    "Cash": <Banknote size={14} className="text-slate-400" />,
    "Cheque": <CreditCard size={14} className="text-slate-400" />,
    "Online": <Globe size={14} className="text-slate-400" />,
  };

  async function loadData() {
    try {
      setLoading(true);
      const res = await transactionsApi.list({ type: "Income" });
      setIncomeData(res || []);
    } catch (err) {
      console.error("Error loading income transactions:", err);
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

  function openAddModal() {
    setEditingItem(null);
    setAmount("");
    setDate(today());
    setReferenceNo("");
    setCategory("");
    setDescription("");
    setSelectedMethod("Cash");
    setNotes("");
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setAmount(String(item.amount));
    setDate(item.transactionDate ? item.transactionDate.split("T")[0] : "");
    setReferenceNo(item.referenceNo || "");
    setCategory(item.category);
    setDescription(item.description);
    setSelectedMethod(item.paymentMethod || "Cash");
    setNotes(item.details?.notes || "");
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (!date) {
      alert("Please select a transaction date.");
      return;
    }
    if (!category || category === "— Select category —") {
      alert("Please select a category.");
      return;
    }
    if (!description.trim()) {
      alert("Please enter a description.");
      return;
    }

    const payload = {
      type: "Income",
      transactionDate: date,
      description: description.trim(),
      category: category,
      paymentMethod: selectedMethod,
      amount: Number(amount),
      status: "Completed",
      referenceNo: referenceNo.trim() || null,
      details: { notes: notes.trim() },
    };

    try {
      setSubmitting(true);
      if (editingItem) {
        const updated = await transactionsApi.update(editingItem.id, payload);
        setIncomeData((prev) => prev.map((item) => (item.id === editingItem.id ? updated : item)));
      } else {
        const created = await transactionsApi.create(payload);
        setIncomeData((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving income transaction:", err);
      alert("Failed to save transaction: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this income transaction?")) return;
    try {
      setSubmitting(true);
      await transactionsApi.remove(id);
      setIncomeData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Error deleting transaction:", err);
      alert("Failed to delete transaction: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredData = incomeData.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <ArrowUpRight className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading income data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Income Entry</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">Manage and record all income transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <Download size={16} /> Export
          </button>
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
          >
            <div className="flex items-center justify-center h-5 w-5 rounded-full border-2 border-white/80"><Plus size={12} strokeWidth={3} /></div>
            Add Income
          </button>
        </div>
      </div>

      {/* Toolbar & Table */}
      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by description or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
            />
          </div>
          <div className="relative w-full sm:w-auto min-w-[180px]">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Tuition Fee">Tuition Fee</option>
              <option value="Donation">Donation</option>
              <option value="Transport Fee">Transport Fee</option>
              <option value="Hostel">Hostel</option>
              <option value="Fine">Fine</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Date & Ref</th>
                <th className="px-6 py-4 font-bold tracking-wider">Description</th>
                <th className="px-6 py-4 font-bold tracking-wider">Category</th>
                <th className="px-6 py-4 font-bold tracking-wider">Method</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((item, index) => (
                <tr key={index} className="hover:bg-blue-50/40 transition group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-slate-800">{item.transactionDate ? new Date(item.transactionDate).toLocaleDateString() : "N/A"}</div>
                    <div className="text-xs font-medium text-slate-400 mt-0.5">{item.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 group-hover:text-blue-700 transition">{item.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold border ${categoryStyles[item.category] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 font-semibold text-slate-600">
                      {methodIcons[item.paymentMethod] || methodIcons["Cash"]}
                      {item.paymentMethod}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="font-extrabold text-blue-600 text-base">+{formatCurrency(item.amount)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => openEditModal(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-500 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 transition" 
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition" 
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                    No income records found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Income Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[24px] bg-white shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#4158f2] to-[#5a32fa] p-6 pb-10 text-white relative flex-shrink-0 overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-32 w-32 rounded-full bg-blue-400/20 blur-xl pointer-events-none"></div>
                
                <button 
                  onClick={() => !submitting && setIsModalOpen(false)}
                  className="absolute top-6 right-6 h-8 w-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition text-white z-50 cursor-pointer animate-none"
                  disabled={submitting}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
                <div className="flex items-center gap-4 relative z-10 pointer-events-none">
                  <div className="h-12 w-12 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
                    <ArrowUpRight size={24} className="text-white drop-shadow-md" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-wide">{editingItem ? "Edit Income" : "Record Income"}</h3>
                    <p className="text-sm font-medium text-blue-100 mt-0.5">{editingItem ? "Update income transaction details" : "Add a new income transaction"}</p>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Body */}
              <div className="p-8 pt-0 -mt-6 relative z-10 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                
                {/* Amount Field Box */}
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-[#f0f7ff] to-[#e0f0ff] p-6 mb-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <ArrowUpRight size={80} />
                  </div>
                  <label className="block text-sm font-bold text-blue-700 mb-2 relative z-10">Amount (৳) *</label>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="text-3xl font-black text-blue-400">৳</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={submitting}
                      className="bg-transparent text-4xl font-black text-blue-700 outline-none w-full placeholder:text-blue-300/70"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                      <Calendar size={14} /> Date *
                    </label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={submitting}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition text-slate-700" 
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                      <Hash size={14} /> Reference No.
                    </label>
                    <input 
                      type="text" 
                      placeholder="INC-006 / Check / Transaction ID" 
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      disabled={submitting}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition placeholder:text-slate-400 text-slate-700" 
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Tag size={14} /> Category *
                  </label>
                  <div className="relative">
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={submitting}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition text-slate-700 cursor-pointer"
                    >
                      <option value="">— Select category —</option>
                      <option value="Tuition Fee">Tuition Fee</option>
                      <option value="Donation">Donation</option>
                      <option value="Transport Fee">Transport Fee</option>
                      <option value="Hostel">Hostel</option>
                      <option value="Fine">Fine</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <FileSignature size={14} /> Description *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Fee collection for January 2025" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition placeholder:text-slate-400 text-slate-700" 
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Wallet size={14} /> Payment Method *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Cash', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Online'].map((method) => (
                      <button 
                        key={method}
                        onClick={() => setSelectedMethod(method)}
                        disabled={submitting}
                        className={`rounded-full px-5 py-2 text-sm font-bold border transition ${selectedMethod === method ? 'border-blue-500 text-blue-700 bg-blue-50 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 bg-white'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {methodIcons[method]} {method}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-2">
                  <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <AlignLeft size={14} /> Notes (optional)
                  </label>
                  <textarea 
                    rows="3" 
                    placeholder="Any additional notes..." 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition resize-none placeholder:text-slate-400 text-slate-700"
                  />
                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="border-t border-slate-100 bg-slate-50 p-6 flex items-center justify-end gap-3 flex-shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition disabled:bg-slate-300"
                >
                  {submitting ? "Saving..." : "Save Income"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
