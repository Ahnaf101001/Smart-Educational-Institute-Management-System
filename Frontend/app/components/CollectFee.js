"use client";

import { useEffect, useState } from "react";
import { 
  Search, ArrowRight, ArrowLeft, AlertCircle, Check, 
  Wallet, Smartphone, Landmark, FileText, CheckCircle2, 
  RotateCcw, Printer, Download 
} from "lucide-react";
import { feesApi, feeInvoicesApi, feeStructuresApi, academicApi } from "../lib/api";

const formatCurrency = (num) => {
  if (num === 0) return "—";
  return "৳" + Number(num).toLocaleString("en-IN");
};

const getInitials = (name) => name ? name.split(" ").map(n => n[0]).join("") : "ST";

const getAvatarColor = (status) => {
  switch (status) {
    case "Due": return "bg-[#ff8f00]";
    case "Overdue": return "bg-[#ff1744]";
    case "Clear": return "bg-[#00c853]";
    default: return "bg-slate-400";
  }
};

const getBadgeStyle = (status) => {
  switch (status) {
    case "Due": return "bg-orange-50 text-orange-600 border border-orange-100";
    case "Overdue": return "bg-rose-50 text-rose-600 border border-rose-100";
    case "Clear": return "bg-emerald-50 text-emerald-600 border border-emerald-100";
    default: return "bg-slate-50 text-slate-600 border border-slate-100";
  }
};

export default function CollectFee() {
  const [step, setStep] = useState("list"); // "list" | "invoice" | "payment" | "success"
  const [students, setStudents] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentInvoices, setStudentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeStatus, setActiveStatus] = useState("All Status");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("All");
  const [isPartial, setIsPartial] = useState(false);
  const [collectAmount, setCollectAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");

  const [lastPaymentResult, setLastPaymentResult] = useState(null);

  /* ── data loading ── */
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      async function loadClasses() {
        try {
          const [cls, fees] = await Promise.all([
            academicApi.classes.list(),
            feeStructuresApi.list()
          ]);
          if (active) {
            setClassesList(cls || []);
            setFeeStructures(fees || []);
          }
        } catch (err) {
          console.error("Error loading structural classes/fees:", err);
        }
      }
      loadClasses();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      async function loadDues() {
        try {
          if (active) setLoading(true);
          const dues = await feesApi.getDues(selectedClass === "All" ? null : selectedClass);
          const mapped = (dues || []).map(d => ({
            id: d.studentId,
            name: d.name,
            roll: d.roll,
            class: d.className,
            total: formatCurrency(d.totalFee),
            paid: formatCurrency(d.paid),
            due: d.due,
            status: d.status,
            lastPaid: d.lastPaid ? new Date(d.lastPaid).toLocaleDateString() : "N/A"
          }));
          if (active) setStudents(mapped);
        } catch (err) {
          console.error("Error loading dues:", err);
        } finally {
          if (active) setLoading(false);
        }
      }
      loadDues();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedClass]);

  const uniqueClasses = ["All"];
  classesList.forEach((c) => {
    let sections = [];
    try {
      sections = typeof c.sections === "string" ? JSON.parse(c.sections) : (c.sections || []);
    } catch {
      sections = [];
    }
    if (sections.length > 0) {
      sections.forEach((sec) => {
        uniqueClasses.push(`${c.name}-${sec}`);
      });
    } else {
      uniqueClasses.push(c.name);
    }
  });

  const dueCount = students.filter(s => s.status === "Due").length;
  const overdueCount = students.filter(s => s.status === "Overdue").length;

  const filteredStudents = students.filter(student => {
    if (activeStatus !== "All Status" && student.status !== activeStatus) return false;
    if (selectedClass !== "All" && student.class !== selectedClass) return false;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      if (!student.name.toLowerCase().includes(query) &&
        !student.id.toLowerCase().includes(query) &&
        (student.roll && !student.roll.toLowerCase().includes(query))) {
        return false;
      }
    }
    return true;
  });

  const handleCollectClick = async (student) => {
    setSelectedStudent(student);
    setCollectAmount(student.due);
    setIsPartial(false);
    setRemarks("");
    setReferenceNo("");
    setStep("invoice");

    try {
      setLoadingInvoices(true);
      const invoices = await feeInvoicesApi.list({ studentId: student.id });
      const unpaid = (invoices || []).filter(inv => inv.status === "Due" || inv.status === "Partial" || inv.status === "Overdue");
      setStudentInvoices(unpaid);
    } catch (err) {
      console.error("Error loading invoices for student:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleProceedToPayment = () => {
    setStep("payment");
  };

  const handleConfirmPayment = async () => {
    if (!selectedStudent || !studentInvoices.length) return;
    try {
      setSubmitting(true);
      let amountLeft = Number(displayAmount);
      
      const sortedInvoices = [...studentInvoices].sort((a, b) => new Date(a.billingMonth) - new Date(b.billingMonth));
      const payments = [];

      for (const invoice of sortedInvoices) {
        if (amountLeft <= 0) break;
        const invoiceDue = Number(invoice.amount) - Number(invoice.discount || 0) - Number(invoice.paidAmount || 0);
        if (invoiceDue <= 0) continue;
        
        const paymentAmount = Math.min(amountLeft, invoiceDue);
        amountLeft -= paymentAmount;

        const payPayload = {
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentMethod: paymentMethod,
          referenceNo: referenceNo || null,
          notes: remarks || `Fee payment towards ${invoice.id}`,
        };
        const paymentRes = await feesApi.collectPayment(payPayload);
        payments.push(paymentRes);
      }

      setLastPaymentResult(payments);
      setStep("success");
    } catch (err) {
      console.error("Error collecting payment:", err);
      alert("Payment collection failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById("receipt-content");
    if (!element) return;
    
    const opt = {
      margin: 5,
      filename: `Receipt_${lastPaymentResult ? lastPaymentResult[0]?.id : "RCP-TEMP"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    const download = () => {
      const originalBorderRadius = element.style.borderRadius;
      const originalBoxShadow = element.style.boxShadow;
      element.style.borderRadius = "0px";
      element.style.boxShadow = "none";

      window.html2pdf().set(opt).from(element).save().then(() => {
        element.style.borderRadius = originalBorderRadius;
        element.style.boxShadow = originalBoxShadow;
      }).catch(err => {
        console.error("PDF Error:", err);
        alert("Failed to download PDF.");
      });
    };

    if (!window.html2pdf) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = download;
      document.body.appendChild(script);
    } else {
      download();
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      alert("Print failed. Please use Ctrl+P or open the app in Chrome/Edge.");
    }
  };

  const getInvoiceName = (invoice) => {
    const struct = feeStructures.find(f => f.id === invoice.feeStructureId);
    return struct ? struct.name : `Fee Invoice ${invoice.id}`;
  };

  const displayAmount = isPartial && collectAmount !== "" ? Number(collectAmount) : Number(selectedStudent?.due || 0);

  if (loading && step === "list") {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <Wallet className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading student dues list...</p>
        </div>
      </div>
    );
  }

  // Render List View
  if (step === "list") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Top Controls Container */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Fee Collection</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Select a student to collect fees</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-50 px-4 py-1.5 text-xs font-bold text-orange-600 border border-orange-100 shadow-sm">
                {dueCount} Due
              </div>
              <div className="rounded-full bg-rose-50 px-4 py-1.5 text-xs font-bold text-rose-600 border border-rose-100 shadow-sm">
                {overdueCount} Overdue
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 max-w-2xl">
              <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Search size={18} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID or roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400"
                />
              </div>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm outline-none w-[150px]"
              >
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {["All Status", "Due", "Overdue", "Clear"].map(status => (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={`h-11 rounded-xl px-5 text-sm font-bold shadow-sm transition ${activeStatus === status ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Student</th>
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Class</th>
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Total Fee</th>
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Paid</th>
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Due</th>
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px] text-center">Status</th>
                  <th className="py-5 px-6 font-bold text-slate-400 uppercase tracking-wider text-[11px] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map((student, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${getAvatarColor(student.status)}`}>
                          {getInitials(student.name)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{student.name}</div>
                          <div className="text-[11px] font-medium text-slate-400 mt-0.5">{student.id} · Roll: {student.roll || "N/A"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-500">{student.class}</td>
                    <td className="py-4 px-6 font-semibold text-slate-400">{student.total}</td>
                    <td className="py-4 px-6 font-extrabold text-emerald-500">{student.paid}</td>
                    <td className={`py-4 px-6 font-extrabold ${student.status === "Overdue" ? "text-rose-600" : student.status === "Due" ? "text-orange-600" : "text-slate-300 font-medium"}`}>
                      {formatCurrency(student.due)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-extrabold ${getBadgeStyle(student.status)}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {student.status === "Clear" ? (
                        <span className="text-xs font-medium text-slate-400">No dues</span>
                      ) : (
                        <button onClick={() => handleCollectClick(student)} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition">
                          Collect <ArrowRight size={12} strokeWidth={3} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="py-12 text-center text-sm font-semibold text-slate-400">
                No students found matching your criteria.
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-4">
            <div className="text-xs font-bold text-slate-400">
              Showing {filteredStudents.length} students
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Invoice View
  if (step === "invoice") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-32">
        <div className="flex items-center text-sm font-semibold text-slate-500 mb-2">
          <button onClick={() => setStep("list")} className="text-blue-600 hover:underline">Fee Collection</button>
          <span className="mx-2">&gt;</span>
          <span className="text-slate-800">Invoice — {selectedStudent.name}</span>
        </div>

        {/* Profile Card */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ${getAvatarColor(selectedStudent.status)}`}>
                {getInitials(selectedStudent.name)}
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-800">{selectedStudent.name}</div>
                <div className="text-sm font-medium text-slate-500 mt-1">{selectedStudent.id} · {selectedStudent.class} · Roll {selectedStudent.roll || "N/A"}</div>
                <div className="text-xs font-medium text-slate-400 mt-1">Last paid: {selectedStudent.lastPaid || "N/A"}</div>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-extrabold ${getBadgeStyle(selectedStudent.status)}`}>
                {selectedStudent.status}
              </span>
            </div>
          </div>
        </div>

        {/* Fee Breakdown Card */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Detailed Invoice Dues</h3>
            <span className="text-xs font-semibold text-slate-400">Total Unpaid Invoices: {studentInvoices.length}</span>
          </div>

          {loadingInvoices ? (
            <div className="py-12 flex justify-center items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              <span className="text-sm font-semibold text-slate-500">Fetching invoices...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {studentInvoices.map((inv) => {
                const dueAmt = Number(inv.amount) - Number(inv.discount || 0) - Number(inv.paidAmount || 0);
                return (
                  <div key={inv.id} className="flex items-center justify-between py-4 border-b border-slate-50">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{getInvoiceName(inv)}</div>
                      <div className="text-xs font-semibold text-slate-400 mt-0.5">
                        Invoice ID: {inv.id} · Billing Month: {inv.billingMonth ? new Date(inv.billingMonth).toLocaleDateString(undefined, {month: 'long', year: 'numeric'}) : "N/A"}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{formatCurrency(dueAmt)}</span>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-4">
                <span className="text-base font-bold text-slate-800">Total Dues</span>
                <span className="text-xl font-black text-blue-600">{formatCurrency(selectedStudent.due)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Collection Form */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Enter Collection Details</h3>

          <div className="grid grid-cols-2 gap-6">
            {/* Payment Type */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Payment Type</label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsPartial(false);
                    setCollectAmount(selectedStudent.due);
                  }}
                  className={`flex-1 h-12 rounded-xl text-sm font-bold transition ${!isPartial ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                >
                  Full Payment
                </button>
                <button
                  onClick={() => setIsPartial(true)}
                  className={`flex-1 h-12 rounded-xl text-sm font-bold transition ${isPartial ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                >
                  Partial Payment
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Collection Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">৳</span>
                <input
                  type="number"
                  disabled={!isPartial}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 pl-8 pr-4 text-sm font-extrabold text-slate-800 outline-none focus:border-blue-500 transition disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Fixed Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 px-8 flex items-center justify-between z-10 lg:pl-64 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <div className="w-full max-w-4xl mx-auto flex items-center gap-4">
            <button onClick={() => setStep("list")} className="h-14 w-32 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleProceedToPayment}
              disabled={displayAmount <= 0 || displayAmount > Number(selectedStudent.due) || loadingInvoices}
              className={`h-14 flex-1 rounded-xl text-[15px] font-bold text-white shadow-md transition flex items-center justify-center gap-2 ${
                displayAmount > 0 && displayAmount <= Number(selectedStudent.due) && !loadingInvoices
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-slate-300 cursor-not-allowed shadow-none"
              }`}
            >
              Proceed to Payment <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Payment View
  if (step === "payment") {
    const paymentMethods = [
      { id: "Cash", icon: <Wallet size={18} /> },
      { id: "Bkash/Rocket", icon: <Smartphone size={18} /> },
      { id: "Bank Transfer", icon: <Landmark size={18} /> },
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto pb-32">
        {/* Left Form Panel */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Select Payment Method</h3>
          <div className="grid grid-cols-1 gap-4">
            {paymentMethods.map((m) => (
              <div
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                className={`relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                  paymentMethod === m.id ? "border-blue-600 bg-blue-50/30" : "border-slate-100 hover:bg-slate-50/50"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${paymentMethod === m.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {m.icon}
                </div>
                <div>
                  <div className={`text-sm font-bold ${paymentMethod === m.id ? "text-blue-700" : "text-slate-700"}`}>{m.id}</div>
                  {paymentMethod === m.id && <div className="text-[11px] font-medium text-blue-500">Selected</div>}
                </div>
                {paymentMethod === m.id && (
                  <div className="absolute right-4 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Reference No. (optional)</label>
              <input 
                type="text" 
                placeholder="Transaction ID / Check number..." 
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Remarks / Notes (optional)</label>
              <input 
                type="text" 
                placeholder="Any additional note..." 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition" 
              />
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Payment Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">Student</span>
              <span className="text-sm font-bold text-slate-800">{selectedStudent.name}</span>
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">Total Dues</span>
              <span className="text-sm font-bold text-slate-800">{formatCurrency(selectedStudent.due)}</span>
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">Payment Method</span>
              <span className="text-sm font-bold text-slate-800">{paymentMethod}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50/40 rounded-xl border border-blue-100/30 mt-2">
              <span className="text-sm font-bold text-blue-900/80">Amount Paying</span>
              <span className="text-xl font-black text-blue-600">{formatCurrency(displayAmount)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Fixed Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 px-8 flex items-center justify-between z-10 lg:pl-64 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <div className="w-full max-w-4xl mx-auto flex items-center gap-4">
            <button onClick={() => setStep("invoice")} disabled={submitting} className="h-14 w-32 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={submitting}
              className="h-14 flex-1 rounded-xl bg-[#00c853] text-[15px] font-bold text-white shadow-md hover:bg-emerald-600 transition flex items-center justify-center gap-2 disabled:bg-slate-300"
            >
              {submitting ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <CheckCircle2 size={20} />
              )}
              Confirm & Collect {formatCurrency(displayAmount)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Success View
  if (step === "success") {
    const mainReceipt = lastPaymentResult ? lastPaymentResult[0] : null;
    const rcpNo = mainReceipt ? mainReceipt.id : "RCP-UNKNOWN";

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-32 print:pb-0 print:block print:w-full print:m-0">
        {/* Success Banner */}
        <div className="rounded-2xl bg-[#00c853] p-10 text-center text-white shadow-md flex flex-col items-center justify-center print:hidden">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-black mb-1">Payment Collected!</h2>
          <p className="text-emerald-100 font-medium mb-6">Receipt {rcpNo} has been generated</p>
          <div className="text-4xl font-black mb-2">{formatCurrency(displayAmount)}</div>
          <p className="text-sm font-semibold text-emerald-100">{selectedStudent.name} · {selectedStudent.class}</p>
        </div>

        {/* Receipt Card */}
        <div 
          id="receipt-content" 
          className="rounded-[20px] border border-[#bfdbfe] bg-[#ffffff] shadow-md overflow-hidden print:border-none print:shadow-none print:m-0 print:break-inside-avoid print:max-w-4xl print:mx-auto print:w-full"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          {/* Receipt Header */}
          <div className="py-6 text-center text-[#ffffff]" style={{ background: 'linear-gradient(to right, #2863eb, #5138ed)' }}>
            <h3 className="text-xl font-black tracking-tight">EduManage School & College</h3>
            <p className="text-sm font-medium text-[#bfdbfe]">Official Fee Receipt</p>
          </div>

          <div className="p-8">
            {/* Receipt Info Grid */}
            <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Receipt No.</div>
                <div className="text-sm font-bold text-[#1e293b]">{rcpNo}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Date</div>
                <div className="text-sm font-bold text-[#1e293b]">{new Date().toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Student</div>
                <div className="text-sm font-bold text-[#1e293b]">{selectedStudent.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Class</div>
                <div className="text-sm font-bold text-[#1e293b]">{selectedStudent.class}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Student ID</div>
                <div className="text-sm font-bold text-[#1e293b]">{selectedStudent.id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-1">Method</div>
                <div className="text-sm font-bold text-[#1e293b]">{paymentMethod}</div>
              </div>
            </div>

            <div className="border-t border-[#f1f5f9] pt-6 space-y-4 mb-8">
              {lastPaymentResult && lastPaymentResult.map((pay, i) => {
                const matchedInv = studentInvoices.find(inv => inv.id === pay.invoiceId);
                const feeName = matchedInv ? getInvoiceName(matchedInv) : `Fee Payment towards ${pay.invoiceId}`;
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#64748b]">{feeName}</span>
                    <span className="text-sm font-bold text-[#1e293b]">{formatCurrency(pay.amount)}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#f1f5f9] pt-6 flex items-center justify-between mb-8">
              <span className="text-base font-extrabold text-[#1e293b]">Total Collected</span>
              <span className="text-2xl font-black text-[#2563eb]">{formatCurrency(displayAmount)}</span>
            </div>

            <div className="rounded-xl bg-[#ecfdf5] border border-[#d1fae5] p-4 flex items-center gap-3 text-[#059669] font-semibold text-sm">
              <CheckCircle2 size={18} /> Payment received & recorded
            </div>
            
            <div className="mt-12 pt-8 flex items-end justify-between border-t border-[#f1f5f9]">
              <div className="text-center w-32">
                <div className="border-t border-[#94a3b8] pt-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Accounts Officer</div>
              </div>
              <div className="text-center w-40">
                <div className="border-t border-[#94a3b8] pt-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Authorized Signature</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Fixed Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 px-8 flex items-center justify-between z-10 lg:pl-64 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] print:hidden">
          <div className="w-full max-w-4xl mx-auto flex items-center gap-4">
            <button onClick={() => setStep("list")} className="h-14 flex-1 rounded-xl bg-slate-50 border border-slate-200 text-[15px] font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <RotateCcw size={18} /> Collect Another
            </button>
            <button onClick={handlePrint} className="h-14 flex-[2] rounded-xl bg-blue-600 text-[15px] font-bold text-white shadow-md hover:bg-blue-700 transition flex items-center justify-center gap-2">
              <Printer size={18} /> Print Receipt
            </button>
            <button onClick={handleDownloadPDF} className="h-14 flex-1 rounded-xl bg-slate-50 border border-slate-200 text-[15px] font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2">
              <Download size={18} /> PDF
            </button>
          </div>
        </div>
      </div>
    );
  }
}
