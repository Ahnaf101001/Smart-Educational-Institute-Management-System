"use client";

import { useEffect, useState } from "react";
import { Download, Printer, CheckCircle2, CheckCircle } from "lucide-react";
import { feesApi, feeInvoicesApi, feeStructuresApi } from "../lib/api";

const formatCurrency = (num) => "৳" + Number(num).toLocaleString("en-IN");

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  const [breakdown, setBreakdown] = useState([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      async function loadReceipts() {
        try {
          if (active) setLoading(true);
          const payLogs = await feesApi.getPayments();

          const mapped = (payLogs || []).map(r => ({
            id: r.id,
            invoiceId: r.invoiceId,
            name: r.studentName,
            date: new Date(r.paidAt).toLocaleDateString(),
            amount: r.amount,
            class: r.className,
            studentId: r.studentId,
            session: "2025-26",
            method: r.paymentMethod
          }));

          if (active) {
            setReceipts(mapped);
            if (mapped.length > 0) {
              setSelectedReceipt(mapped[0]);
            }
          }
        } catch (err) {
          console.error("Error loading receipts:", err);
        } finally {
          if (active) setLoading(false);
        }
      }
      loadReceipts();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedReceipt) {
        if (active) setBreakdown([]);
        return;
      }
      async function loadInvoiceBreakdown() {
        try {
          if (active) setLoadingBreakdown(true);
          const invoice = await feeInvoicesApi.get(selectedReceipt.invoiceId);
          if (invoice && invoice.feeStructureId) {
            const struct = await feeStructuresApi.get(invoice.feeStructureId);
            if (active && struct && struct.components) {
              setBreakdown(struct.components || []);
              return;
            }
          }
          if (active) {
            setBreakdown([{ name: "Tuition / Fee Payment", amount: selectedReceipt.amount }]);
          }
        } catch (err) {
          console.error("Error loading invoice breakdown:", err);
          if (active) {
            setBreakdown([{ name: "Tuition / Fee Payment", amount: selectedReceipt.amount }]);
          }
        } finally {
          if (active) setLoadingBreakdown(false);
        }
      }
      loadInvoiceBreakdown();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedReceipt]);

  function handleDownloadPDF() {
    if (!selectedReceipt) return;
    const element = document.getElementById("receipt-content");
    if (!element) return;
    
    const opt = {
      margin: 5,
      filename: `Receipt_${selectedReceipt.id}.pdf`,
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
  }

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      alert("Print failed. Please use Ctrl+P or open the app in Chrome/Edge.");
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <CheckCircle2 className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading Receipts...</p>
        </div>
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="rounded-[20px] border border-slate-200 bg-white p-12 text-center max-w-xl mx-auto shadow-sm">
        <CheckCircle2 size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-400">No payment receipts found in the system</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 max-w-[1400px] mx-auto pb-10 print:block print:w-full print:m-0">

      {/* Left Panel: List of Receipts */}
      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[600px] sticky top-6 print:hidden">
        <div className="p-6 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Recent Receipts</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {receipts.map(r => {
            const isSelected = selectedReceipt && selectedReceipt.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedReceipt(r)}
                className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition ${isSelected ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent"
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-blue-600 text-white shadow-md" : "bg-emerald-50 text-emerald-500"}`}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${isSelected ? "text-blue-900" : "text-slate-800"}`}>{r.name}</div>
                    <div className="text-[11px] font-medium text-slate-400 mt-0.5">{r.id} · {r.date}</div>
                  </div>
                </div>
                <div className={`text-sm font-black ${isSelected ? "text-blue-700" : "text-emerald-600"}`}>
                  {formatCurrency(r.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel: Receipt Viewer */}
      {selectedReceipt && (
        <div className="flex flex-col gap-4 pr-2 print:block print:w-full print:p-0">

          {/* Action Bar */}
          <div className="flex justify-end gap-3 print:hidden sticky top-0 bg-[#f8fafc] z-10 py-2">
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition">
              <Download size={18} /> PDF
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition">
              <Printer size={18} /> Print Receipt
            </button>
          </div>

          {/* Receipt Document */}
          <div 
            id="receipt-content" 
            className="rounded-[20px] border border-[#bfdbfe] bg-[#ffffff] shadow-md overflow-hidden relative mb-10 print:border-none print:shadow-none print:m-0 print:break-inside-avoid print:max-w-4xl print:mx-auto print:w-full"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            {/* Blue Accent Border Left */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2563eb]"></div>

            {/* Receipt Header */}
            <div className="py-6 text-center text-[#ffffff]" style={{ background: 'linear-gradient(to right, #2863eb, #5138ed)' }}>
              <h3 className="text-xl font-black tracking-tight">EduManage School & College</h3>
              <p className="text-sm font-medium text-[#bfdbfe]">123 Education Road, Dhaka · 01XX-XXXXXXX</p>
              <div className="mt-3 inline-block rounded-full border px-4 py-1 text-xs font-bold backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}>
                Official Fee Receipt
              </div>
            </div>

            <div className="p-8">
              {/* Receipt Info Grid */}
              <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Receipt No.</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.id}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Date</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.date}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Student Name</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.name}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Class</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.class}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Student ID</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.studentId}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Session</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.session}</div>
                </div>
              </div>

              <div className="border-t border-[#f1f5f9] pt-6 space-y-4 mb-8">
                {loadingBreakdown ? (
                  <div className="py-6 flex justify-center items-center gap-3">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                    <span className="text-xs font-semibold text-slate-500">Loading breakdown...</span>
                  </div>
                ) : (
                  breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#64748b]">{item.name}</span>
                      <span className="text-sm font-bold text-[#1e293b]">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-[#f1f5f9] pt-6 flex items-center justify-between mb-8">
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Payment Method</div>
                  <div className="text-sm font-bold text-[#1e293b]">{selectedReceipt.method}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[#94a3b8] mb-1">Total Received</div>
                  <div className="text-3xl font-black text-[#2563eb]">{formatCurrency(selectedReceipt.amount)}</div>
                </div>
              </div>

              <div className="rounded-xl bg-[#ecfdf5] border border-[#d1fae5] p-4 flex items-center gap-3 text-[#059669] font-semibold text-sm">
                <CheckCircle size={18} /> Payment Received Successfully
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
        </div>
      )}
    </div>
  );
}
