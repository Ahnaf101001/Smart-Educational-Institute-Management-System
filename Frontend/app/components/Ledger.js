"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, Calendar, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { transactionsApi } from "../lib/api";
import { today } from "./ui/kit";

export default function Ledger() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return today(d);
  });
  const [toDate, setToDate] = useState(() => {
    return today();
  });

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const res = await transactionsApi.list();
      setTransactions(res || []);
    } catch (err) {
      console.error("Error loading transactions for ledger:", err);
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

  // Calculate balances using useMemo to prevent reassignment of render-scoped variables
  const allEntriesWithBalance = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate));
    const entries = [];
    let balance = 0;
    
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const amt = Number(item.amount);
      let debit = null;
      let credit = null;

      if (item.type === "Income") {
        debit = amt;
        balance += debit;
      } else {
        credit = amt;
        balance -= credit;
      }

      entries.push({
        ...item,
        date: item.transactionDate ? item.transactionDate.split("T")[0] : "",
        debit,
        credit,
        balance
      });
    }
    return entries;
  }, [transactions]);

  // Filter down to only the selected date range
  const dateEntries = allEntriesWithBalance.filter(item => {
    return (!fromDate || item.date >= fromDate) && (!toDate || item.date <= toDate);
  });

  let totalDebit = 0;
  let totalCredit = 0;
  let finalClosingBalance = dateEntries.length > 0 ? dateEntries[dateEntries.length - 1].balance : 0;

  dateEntries.forEach(item => {
    if (item.debit) totalDebit += item.debit;
    if (item.credit) totalCredit += item.credit;
  });

  // Reverse to show newest first
  const displayData = [...dateEntries].reverse();

  const formatCurrency = (num) => {
    if (num === null || num === undefined) return "—";
    return "৳" + num.toLocaleString("en-IN");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("Cash Ledger", 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 30);

    const tableColumn = ["Date", "Description", "Debit (TK)", "Credit (TK)", "Balance (TK)"];
    const tableRows = [];

    displayData.forEach(item => {
      tableRows.push([
        item.date,
        item.description,
        item.debit ? item.debit.toLocaleString() : "—",
        item.credit ? item.credit.toLocaleString() : "—",
        item.balance.toLocaleString()
      ]);
    });

    tableRows.push([
      "CLOSING BALANCE",
      "",
      totalDebit.toLocaleString(),
      totalCredit.toLocaleString(),
      finalClosingBalance.toLocaleString()
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 25 },
        2: { halign: 'right', textColor: [37, 99, 235] }, 
        3: { halign: 'right', textColor: [225, 29, 72] },
        4: { halign: 'right', fontStyle: 'bold', textColor: [30, 41, 59] }
      },
      didParseCell: function (data) {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          if (data.column.index === 0) { data.cell.colSpan = 2; data.cell.styles.textColor = [30, 41, 59]; }
          if (data.column.index === 1) { data.cell.styles.cellWidth = 0; }
          if (data.column.index === 2) data.cell.styles.textColor = [37, 99, 235];
          if (data.column.index === 3) data.cell.styles.textColor = [225, 29, 72];
          if (data.column.index === 4) data.cell.styles.textColor = [29, 78, 216];
        }
      }
    });

    doc.save(`Ledger_Export_${fromDate}_to_${toDate}.pdf`);
  };

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <Calendar className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading ledger history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Ledger</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">View detailed transaction history and balances</p>
        </div>
      </div>

      {/* Ledger Container */}
      <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-b border-slate-100 bg-white">
          <h3 className="text-xl font-bold text-slate-800">
            Cash Ledger
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input 
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none hover:bg-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
              />
              <span className="text-sm font-bold text-slate-400">to</span>
              <input 
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none hover:bg-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
              />
            </div>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm font-extrabold text-slate-500 border-b-2 border-slate-100">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right text-blue-600">Debit (৳)</th>
                <th className="px-6 py-4 text-right text-rose-500">Credit (৳)</th>
                <th className="px-6 py-4 text-right text-slate-800">Balance (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition font-semibold text-slate-600">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-medium">{item.date}</td>
                  <td className="px-6 py-4">{item.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-blue-600 font-bold">
                    {formatCurrency(item.debit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-rose-500 font-bold">
                    {formatCurrency(item.credit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-800 font-black">
                    {formatCurrency(item.balance)}
                  </td>
                </tr>
              ))}
              {displayData.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                    No transactions found in this date range.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Footer / Closing Balance */}
            {displayData.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 font-black text-[15px]">
                <tr>
                  <td colSpan="2" className="px-6 py-5 text-slate-800 uppercase tracking-wide text-sm">
                    Closing Balance
                  </td>
                  <td className="px-6 py-5 text-right text-blue-600 text-base">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="px-6 py-5 text-right text-rose-500 text-base">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td className="px-6 py-5 text-right text-blue-700 text-xl">
                    {formatCurrency(finalClosingBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
