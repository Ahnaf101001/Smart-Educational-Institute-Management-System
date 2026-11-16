"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download, Users, ClipboardList, FileText, DollarSign, Calculator, CreditCard, FileDown, Check, X, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { reportsApi, dashboardApi } from "../lib/api";
import { today } from "./ui/kit";

const iconMap = {
  users: Users,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  "dollar-sign": DollarSign,
  calculator: Calculator,
  "credit-card": CreditCard,
};

const getDefaultDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  return {
    from: `${year}-01-01`,
    to: today(now),
  };
};

export default function Reports() {
  const defaultRange = getDefaultDateRange();
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportType, setReportType] = useState("");
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [reportCategories, setReportCategories] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [currentReportData, setCurrentReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportsGeneratedCount, setReportsGeneratedCount] = useState(0);
  const [exportsCount, setExportsCount] = useState(0);
  const [lastGenerated, setLastGenerated] = useState("None");

  useEffect(() => {
    Promise.all([
      reportsApi.catalog(),
      dashboardApi.getSummary().catch(() => null),
    ])
      .then(([catalog, summary]) => {
        const categories = catalog?.categories || [];
        setReportCategories(categories);
        setReportType(catalog?.defaultReport || categories[0]?.reports?.[0] || "");
        if (summary?.bottomStats?.reportsGenerated) {
          setReportsGeneratedCount(summary.bottomStats.reportsGenerated);
        }
      })
      .catch((err) => {
        console.error("Error loading report catalog:", err);
        setError("Report catalog could not be loaded");
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  const fetchReport = async (reportName) => {
    if (!reportName) return;
    try {
      setLoading(true);
      setError(null);
      setCurrentReportData(null);
      const data = await reportsApi.get(reportName, fromDate, toDate);
      setCurrentReportData(data);
      setReportsGeneratedCount((prev) => prev + 1);
      setLastGenerated(reportName);
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError("Reports not found");
    } finally {
      setLoading(false);
    }
  };

  const scrollToReport = () => {
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 100);
  };

  const handleGenerate = () => {
    if (!reportType) return;
    const categoryMatch = reportCategories.find((c) => c.title === reportType);
    const targetReport = categoryMatch ? categoryMatch.reports[0] : reportType;

    setReportType(targetReport);
    setGeneratedReport(targetReport);
    fetchReport(targetReport);
    scrollToReport();
  };

  const handleView = (reportName) => {
    setReportType(reportName);
    setGeneratedReport(reportName);
    fetchReport(reportName);
    scrollToReport();
  };

  const getExportData = async (reportName) => {
    if (!reportName) return null;
    const data = await reportsApi.get(reportName, fromDate, toDate);
    if (!data || !data.rows || data.rows.length === 0) {
      alert("Reports not found");
      return null;
    }
    return data;
  };

  const handleExportPDF = async (reportName) => {
    try {
      const data = await getExportData(reportName);
      if (!data) return;
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(reportName, 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 30);

      const tableRows = data.rows.map((row) => data.columns.map((_, idx) => row[`col${idx}`]));
      if (data.totals?.length) tableRows.push(data.totals);

      autoTable(doc, {
        head: [data.columns],
        body: tableRows,
        startY: 40,
        theme: "grid",
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 4 },
        didParseCell(dataCell) {
          if (data.totals?.length && dataCell.row.index === tableRows.length - 1) {
            dataCell.cell.styles.fontStyle = "bold";
            dataCell.cell.styles.fillColor = [241, 245, 249];
            dataCell.cell.styles.textColor = [30, 41, 59];
          }
        },
      });

      doc.save(`${reportName.replace(/\s+/g, "_")}_Report.pdf`);
      setExportsCount((prev) => prev + 1);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Reports not found");
    }
  };

  const handleExportExcel = async (reportName) => {
    try {
      const data = await getExportData(reportName);
      if (!data) return;
      const wsData = [
        [reportName],
        [`Date Range: ${fromDate} to ${toDate}`],
        [],
        data.columns,
      ];
      data.rows.forEach((row) => {
        wsData.push(data.columns.map((_, idx) => row[`col${idx}`]));
      });
      if (data.totals?.length) wsData.push(data.totals);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${reportName.replace(/\s+/g, "_")}_Report.xlsx`);
      setExportsCount((prev) => prev + 1);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Reports not found");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">Reports</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm text-center">
          <div className="text-4xl font-black text-slate-800 mb-2">{reportsGeneratedCount}</div>
          <div className="text-sm font-medium text-slate-500">Reports Generated</div>
          <div className="text-sm font-bold text-blue-500 mt-1">total active</div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm text-center">
          <div className="text-2xl font-black text-slate-800 mb-2 truncate px-2" title={lastGenerated}>
            {lastGenerated === "None" ? "N/A" : "Just now"}
          </div>
          <div className="text-sm font-medium text-slate-500">Last Generated</div>
          <div className="text-sm font-bold text-blue-500 mt-1">
            {lastGenerated === "None" ? "No report yet" : lastGenerated}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm text-center">
          <div className="text-4xl font-black text-slate-800 mb-2">{exportsCount}</div>
          <div className="text-sm font-medium text-slate-500">Exports (PDF/Excel)</div>
          <div className="text-sm font-bold text-blue-500 mt-1">this session</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {catalogLoading ? (
          <div className="col-span-full rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <span className="mx-auto block animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600 size-10" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Loading report catalog...</p>
          </div>
        ) : (
          reportCategories.map((category, index) => {
            const Icon = iconMap[category.icon] || FileText;
            return (
              <div key={index} className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className={`p-5 text-white flex items-center gap-3 ${category.color}`}>
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-bold">{category.title}</h3>
                </div>
                <div className="p-2 flex-1">
                  <ul className="divide-y divide-slate-50">
                    {category.reports.map((report, idx) => (
                      <li key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition rounded-xl">
                        <span className="text-sm font-bold text-slate-700 w-1/2">{report}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(report)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                          >
                            <BarChart3 size={14} /> View
                          </button>
                          <button
                            onClick={() => handleExportExcel(report)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition"
                          >
                            <Download size={14} /> Export
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Generate Custom Report</h3>
        <div className="flex flex-col lg:flex-row items-end gap-5">
          <div className="w-full lg:flex-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={catalogLoading || reportCategories.length === 0}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none hover:bg-slate-100 focus:border-blue-500 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!reportType && <option value="">Select report</option>}
              {reportCategories.map((cat) => (
                <optgroup key={cat.title} label={cat.title}>
                  {cat.reports.map((rep) => (
                    <option key={rep} value={rep}>{rep}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="w-full lg:flex-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500 outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>
          <div className="w-full lg:flex-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500 outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleGenerate}
              disabled={!reportType || catalogLoading}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <BarChart3 size={16} /> Generate
            </button>
            <button
              onClick={() => handleExportPDF(reportType)}
              disabled={!reportType || catalogLoading}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileDown size={16} /> PDF
            </button>
          </div>
        </div>
      </div>

      {generatedReport && (
        <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 text-slate-800">
              <Check className="text-emerald-500" size={24} strokeWidth={3} />
              <h3 className="text-xl font-bold">{generatedReport}</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleExportExcel(generatedReport)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition"
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button
                onClick={() => handleExportPDF(generatedReport)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
              >
                <FileDown size={16} /> PDF
              </button>
              <button
                onClick={() => setGeneratedReport(null)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition ml-2"
                title="Close Report"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center py-10 bg-white">
                <span className="animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600 size-10" />
                <p className="mt-3 text-sm font-semibold text-slate-500">Loading report details...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-rose-500 font-bold bg-rose-50/50 rounded-2xl border border-rose-100 m-6">
                <div className="text-2xl mb-1">!</div>
                <div>{error}</div>
              </div>
            ) : currentReportData?.rows?.length ? (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-white text-xs font-extrabold uppercase text-slate-500 border-b-2 border-slate-100">
                  <tr>
                    {currentReportData.columns.map((col, idx) => (
                      <th key={idx} className="px-8 py-5 tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentReportData.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition font-medium">
                      {currentReportData.columns.map((_, cIdx) => (
                        <td key={cIdx} className={`px-8 py-4 ${cIdx === 0 ? "text-slate-800 font-bold" : ""}`}>
                          {row[`col${cIdx}`]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {currentReportData.totals?.length > 0 && (
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      {currentReportData.totals.map((total, idx) => (
                        <td key={idx} className={`px-8 py-5 font-black text-slate-800 ${idx === 0 ? "text-base" : ""}`}>
                          {total}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <div className="text-center py-10 text-slate-400 font-bold">
                No data available for this report
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 text-xs font-bold text-slate-400 bg-white">
            Generated on {currentReportData?.generatedAt ? new Date(currentReportData.generatedAt).toLocaleString() : new Date().toLocaleString()} - {currentReportData?.rows?.length || 0} rows
          </div>
        </div>
      )}
    </div>
  );
}
