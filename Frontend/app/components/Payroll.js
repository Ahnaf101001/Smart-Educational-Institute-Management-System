"use client";

import { useState, useEffect, useCallback } from "react";
import PayslipModal from "./PayslipModal";
import { 
  Download, Calendar, Search, CreditCard, ChevronDown, CheckCircle2, Clock, 
  Eye, Printer, Briefcase, AlertCircle, Sparkles, RefreshCw
} from "lucide-react";
import { payrollApi, teachersApi, staffApi } from "../lib/api";

export default function Payroll() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("All Departments");
  const [filterStatus, setFilterStatus] = useState("All");

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Month options (June 2026 downwards for 12 months)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const monthOptions = [];
  const start = new Date(2026, 5); // June 2026
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    monthOptions.push({ label, value });
  }

  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [payslipEmployee, setPayslipEmployee] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await payrollApi.list({ payrollMonth: selectedMonth });
      setEmployees(res || []);
    } catch (err) {
      console.error("Error loading payroll records:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleOpenPayslip = (emp, print = false) => {
    setPayslipEmployee(emp);
    setShowPayslip(true);
    if (print) {
      setTimeout(() => window.print(), 300);
    }
  };

  const handleProcessPayroll = async () => {
    try {
      setProcessing(true);
      await payrollApi.process(selectedMonth);
      setShowProcessModal(false);
      await loadData();
    } catch (err) {
      console.error("Error processing payroll:", err);
      alert("Failed to process payroll: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePaySingle = async (id) => {
    if (!window.confirm("Are you sure you want to disburse salary for this employee?")) return;
    try {
      setProcessing(true);
      await payrollApi.pay(id);
      await loadData();
    } catch (err) {
      console.error("Error paying employee:", err);
      alert("Failed to disburse salary: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateDraft = async () => {
    try {
      setGenerating(true);
      const [tList, sList] = await Promise.all([
        teachersApi.list(),
        staffApi.list()
      ]);

      const allActiveStaff = [
        ...(tList || []).map(t => ({ ...t, employeeType: "Teacher" })),
        ...(sList || []).map(s => ({ ...s, employeeType: "Staff" }))
      ].filter(emp => emp.status === "Active" || !emp.status);

      if (allActiveStaff.length === 0) {
        alert("No active teachers or staff found to generate payroll.");
        return;
      }

      const promises = allActiveStaff.map(emp => {
        const basic = Number(emp.salary || 25000);
        const allowance = 0;
        const deduction = 0;
        const net = basic;
        return payrollApi.create({
          employeeType: emp.employeeType,
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.designation || (emp.employeeType === "Teacher" ? "Teacher" : "Staff"),
          department: emp.department || "General",
          payrollMonth: selectedMonth,
          basicSalary: basic,
          allowances: allowance,
          deductions: deduction,
          netPay: net,
          status: "Pending"
        });
      });

      await Promise.all(promises);
      await loadData();
    } catch (err) {
      console.error("Error generating payroll draft:", err);
      alert("Failed to generate payroll: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const deptColors = {
    "Teaching": "bg-blue-50 text-blue-600",
    "Administration": "bg-purple-50 text-purple-600",
    "Accounts": "bg-emerald-50 text-emerald-600",
    "IT & Library": "bg-slate-100 text-slate-600",
    "Security": "bg-rose-50 text-rose-600",
    "General": "bg-slate-50 text-slate-600"
  };

  const formatCurrency = (num) => "৳" + Number(num).toLocaleString("en-IN");

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDepartment === "All Departments" || emp.department === filterDepartment;
    const matchesStatus = filterStatus === "All" || emp.status === filterStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const totalBasic = filteredEmployees.reduce((sum, emp) => sum + Number(emp.basicSalary || 0), 0);
  const totalNet = filteredEmployees.reduce((sum, emp) => sum + Number(emp.netPay || 0), 0);

  const allTotalNet = employees.reduce((sum, emp) => sum + Number(emp.netPay || 0), 0);
  
  const paidEmployees = employees.filter(e => e.status === "Paid");
  const paidTotal = paidEmployees.reduce((sum, emp) => sum + Number(emp.netPay || 0), 0);
  
  const pendingEmployees = employees.filter(e => e.status === "Pending");
  const pendingTotal = pendingEmployees.reduce((sum, emp) => sum + Number(emp.netPay || 0), 0);

  // Department breakdown calculations
  const deptStats = {};
  employees.forEach(emp => {
    const dept = emp.department || "General";
    if (!deptStats[dept]) {
      deptStats[dept] = { amount: 0, count: 0 };
    }
    deptStats[dept].amount += Number(emp.netPay || 0);
    deptStats[dept].count += 1;
  });

  const formatK = (num) => `৳${Math.round(num / 1000)}K`;

  const selectedMonthLabel = monthOptions.find(o => o.value === selectedMonth)?.label || "";

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <CreditCard className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading payroll database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Top Header */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Payroll Management</h2>
            <p className="text-sm font-medium text-slate-500">{employees.length} employees · {selectedMonthLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 outline-none hover:bg-slate-100 transition cursor-pointer"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <Download size={16} /> Export
          </button>
          {employees.length > 0 ? (
            <button 
              onClick={() => setShowProcessModal(true)}
              disabled={pendingEmployees.length === 0}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <CreditCard size={16} /> Process Payroll
            </button>
          ) : (
            <button 
              onClick={handleGenerateDraft}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:bg-slate-200"
            >
              {generating ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {generating ? "Generating..." : "Generate Payroll"}
            </button>
          )}
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-16 text-center shadow-sm flex flex-col items-center justify-center max-w-xl mx-auto">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
            <Sparkles size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">No Payroll processed for this Month</h3>
          <p className="text-sm font-medium text-slate-400 max-w-sm mb-6 leading-relaxed">
            Click generate to pull all active teachers and staff members to create a new payroll draft sheet.
          </p>
          <button 
            onClick={handleGenerateDraft}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition px-6 py-3 font-bold text-white shadow-md disabled:bg-slate-200"
          >
            {generating ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {generating ? "Generating Draft Sheet..." : "Generate Payroll Sheet"}
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-[20px] bg-gradient-to-br from-[#4158f2] to-[#5a32fa] p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
                <span className="text-lg font-bold">৳</span>
              </div>
              <div className="mt-12">
                <div className="text-3xl font-black mb-1">{formatK(allTotalNet)}</div>
                <div className="text-sm font-medium text-blue-100">Total Payroll</div>
                <div className="text-xs font-semibold text-blue-200 mt-1">{employees.length} employees</div>
              </div>
            </div>
            
            <div className="rounded-[20px] bg-gradient-to-br from-[#10b981] to-[#059669] p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div className="mt-12">
                <div className="text-3xl font-black mb-1">{formatK(paidTotal)}</div>
                <div className="text-sm font-medium text-emerald-100">Paid</div>
                <div className="text-xs font-semibold text-emerald-200 mt-1">{paidEmployees.length} employees</div>
              </div>
            </div>

            <div className="rounded-[20px] bg-gradient-to-br from-[#f97316] to-[#ea580c] p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
                <Clock size={20} />
              </div>
              <div className="mt-12">
                <div className="text-3xl font-black mb-1">{formatK(pendingTotal)}</div>
                <div className="text-sm font-medium text-orange-100">Pending</div>
                <div className="text-xs font-semibold text-orange-200 mt-1">{pendingEmployees.length} employees</div>
              </div>
            </div>
          </div>

          {/* Department Breakdown Section */}
          <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Department Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {Object.keys(deptStats).map(dept => {
                const stat = deptStats[dept];
                const pct = allTotalNet > 0 ? Math.round((stat.amount / allTotalNet) * 100) : 0;
                return (
                  <div key={dept} className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                    <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">{dept}</div>
                    <div className="text-lg font-extrabold text-slate-800">{formatCurrency(stat.amount)}</div>
                    <div className="text-xs font-medium text-slate-500 mt-0.5">{stat.count} active · {pct}% of total</div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Section */}
          <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            {/* Table Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-b border-slate-100 bg-white">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative">
                  <select 
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 py-2.5 text-sm font-bold text-slate-700 outline-none hover:bg-slate-100 transition cursor-pointer"
                  >
                    <option value="All Departments">All Departments</option>
                    {Object.keys(deptStats).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  {['All', 'Paid', 'Pending'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${filterStatus === status ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                
                <div className="text-sm font-medium text-slate-400 ml-2">
                  {filteredEmployees.length} of {employees.length}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/50 text-xs font-extrabold uppercase text-slate-500 border-b border-slate-100 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4 text-center">Department</th>
                    <th className="px-6 py-4 text-right">Basic</th>
                    <th className="px-6 py-4 text-right">Net Pay</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shadow-sm">
                            {emp.employeeName ? emp.employeeName.split(" ").map(n => n[0]).join("").substring(0, 2) : "ST"}
                          </div>
                          <div>
                            <div className="text-[15px] font-bold text-slate-800">{emp.employeeName}</div>
                            <div className="text-xs font-medium text-slate-500">{emp.role} · {emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${deptColors[emp.department] || deptColors["General"]}`}>
                          {emp.department}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right font-bold text-slate-700">
                        {formatCurrency(emp.basicSalary)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right font-black text-blue-600">
                        {formatCurrency(emp.netPay)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${emp.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                          {emp.status === 'Paid' ? <CheckCircle2 size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={3} />}
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-3">
                          {emp.status === 'Pending' && (
                            <button 
                              onClick={() => handlePaySingle(emp.id)}
                              disabled={processing}
                              className="text-emerald-500 hover:text-emerald-700 transition" 
                              title="Pay Salary"
                            >
                              <CreditCard size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleOpenPayslip(emp, false)}
                            className="text-blue-500 hover:text-blue-700 transition" 
                            title="View Payslip"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => handleOpenPayslip(emp, true)}
                            className="text-slate-400 hover:text-slate-700 transition" 
                            title="Print Payslip"
                          >
                            <Printer size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Table Footer */}
                <tfoot className="bg-slate-50/80 border-t border-slate-200">
                  <tr>
                    <td colSpan="2" className="px-6 py-4 font-bold text-slate-800">
                      Total ({filteredEmployees.length} employees)
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                      {formatCurrency(totalBasic)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-blue-600 text-base">
                      {formatCurrency(totalNet)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Process Payroll Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-[#2563eb] to-[#4f46e5] p-8 text-center text-white flex flex-col items-center">
              <div className="h-16 w-16 rounded-[20px] bg-white/20 flex items-center justify-center mb-5 backdrop-blur-md border border-white/20 shadow-inner">
                <CreditCard size={32} />
              </div>
              <h3 className="text-xl font-black mb-1">Process Monthly Payroll</h3>
              <p className="text-sm font-medium text-blue-100">{selectedMonthLabel}</p>
            </div>
            
            <div className="p-6">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-4 mb-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Pending Employees</span>
                  <span className="text-sm font-black text-slate-800">{pendingEmployees.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Amount to Disburse</span>
                  <span className="text-sm font-black text-slate-800">{formatCurrency(pendingTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Payment Method</span>
                  <span className="text-sm font-black text-slate-800">Bank Transfer</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Processing Date</span>
                  <span className="text-sm font-black text-slate-800">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-4 mb-6 flex gap-3">
                <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[13px] font-medium text-amber-600 leading-relaxed">
                  This will process salaries for all pending employees in {selectedMonthLabel}.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowProcessModal(false)}
                  disabled={processing}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm outline-none disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProcessPayroll}
                  disabled={processing}
                  className="flex-[1.5] px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-md outline-none disabled:bg-slate-300"
                >
                  {processing ? "Processing..." : "Confirm & Process"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PayslipModal 
        isOpen={showPayslip} 
        onClose={() => setShowPayslip(false)} 
        employee={payslipEmployee} 
      />
    </div>
  );
}
