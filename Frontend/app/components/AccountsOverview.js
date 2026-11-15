"use client";

import { useState, useEffect } from "react";
import { 
  Plus, ArrowUpCircle, ArrowDownCircle, DollarSign, ArrowUpRight, ArrowDownRight, 
  ArrowRight, Calendar 
} from "lucide-react";
import { transactionsApi } from "../lib/api";

export default function AccountsOverview({ onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const res = await transactionsApi.list();
      setTransactions(res || []);
    } catch (err) {
      console.error("Error loading overview transactions:", err);
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

  const formatCurrency = (num) => "৳" + Number(num).toLocaleString("en-IN");

  // Calculate stats
  const totalIncome = transactions
    .filter((t) => t.type === "Income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "Expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netBalance = totalIncome - totalExpense;

  // Group stats by month for the last 6 months
  const now = new Date();
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("default", { month: "short" });
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    chartData.push({ label, monthKey, income: 0, expense: 0, profit: 0 });
  }

  transactions.forEach((t) => {
    if (!t.transactionDate) return;
    const tDate = new Date(t.transactionDate);
    const tKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, "0")}`;
    const match = chartData.find((m) => m.monthKey === tKey);
    if (match) {
      const amt = Number(t.amount);
      if (t.type === "Income") {
        match.income += amt;
      } else {
        match.expense += amt;
      }
    }
  });

  chartData.forEach((m) => {
    m.profit = m.income - m.expense;
  });

  // Dynamically compute y-axis values for the chart
  const maxVal = Math.max(...chartData.map((d) => Math.max(d.income, d.expense)), 100000);
  const formatScaleValue = (val) => {
    if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const yLabels = [
    formatScaleValue(maxVal),
    formatScaleValue(maxVal * 0.75),
    formatScaleValue(maxVal * 0.5),
    formatScaleValue(maxVal * 0.25),
    "0"
  ];

  // Recent 5 income / expense transactions
  const recentIncome = transactions
    .filter((t) => t.type === "Income")
    .slice(0, 5);

  const recentExpense = transactions
    .filter((t) => t.type === "Expense")
    .slice(0, 5);

  const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative grid size-12 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600" />
            <DollarSign className="text-blue-600 animate-pulse" size={20} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading accounts summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header Section */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Accounts Overview</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">{currentMonthName}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => onNavigate && onNavigate("Income Entry")}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
          >
            <div className="flex items-center justify-center h-5 w-5 rounded-full border-2 border-white/80"><Plus size={12} strokeWidth={3} /></div>
            Add Income
          </button>
          <button 
            onClick={() => onNavigate && onNavigate("Expense Entry")}
            className="flex items-center gap-2 rounded-xl bg-[#ff3b5c] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-rose-600 transition"
          >
            <div className="flex items-center justify-center h-5 w-5 rounded-full border-2 border-white/80"><Plus size={12} strokeWidth={3} /></div>
            Add Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6">
        {/* Income Card */}
        <div className="rounded-[20px] bg-gradient-to-br from-sky-400 to-blue-500 p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
            <ArrowUpCircle size={20} className="text-white" />
          </div>
          <div className="mt-12">
            <div className="text-3xl font-black mb-1">{formatCurrency(totalIncome)}</div>
            <div className="text-sm font-medium text-blue-100">Total Income</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs font-semibold text-blue-200">Total payments collected</div>
              <button 
                onClick={() => onNavigate && onNavigate("Income Entry")}
                className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold hover:bg-white/20 transition flex items-center gap-1"
              >
                + Record <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Expense Card */}
        <div className="rounded-[20px] bg-gradient-to-br from-rose-400 to-red-500 p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
            <ArrowDownCircle size={20} className="text-white" />
          </div>
          <div className="mt-12">
            <div className="text-3xl font-black mb-1">{formatCurrency(totalExpense)}</div>
            <div className="text-sm font-medium text-rose-100">Total Expense</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs font-semibold text-rose-200">Total expenses logged</div>
              <button 
                onClick={() => onNavigate && onNavigate("Expense Entry")}
                className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold hover:bg-white/20 transition flex items-center gap-1"
              >
                + Record <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Net Balance Card */}
        <div className={`rounded-[20px] p-6 text-white shadow-md relative overflow-hidden bg-gradient-to-br ${
          netBalance >= 0 ? "from-emerald-400 to-teal-500" : "from-amber-500 to-rose-500"
        }`}>
          <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
            <DollarSign size={20} className="text-white" />
          </div>
          <div className="mt-12">
            <div className="text-3xl font-black mb-1">{formatCurrency(netBalance)}</div>
            <div className="text-sm font-medium text-emerald-100">Net Balance</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs font-semibold text-emerald-100">
                {netBalance >= 0 ? "Surplus balance" : "Deficit balance"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Profit & Loss</h3>
            <p className="text-sm font-medium text-slate-400 mt-1">Income vs Expense vs Net Profit (Last 6 Months)</p>
          </div>
          <div className="flex gap-2">
            <div 
              onClick={() => onNavigate && onNavigate("Income Entry")}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} strokeWidth={3} /> Income
            </div>
            <div 
              onClick={() => onNavigate && onNavigate("Expense Entry")}
              className="rounded-full bg-[#ff3b5c] px-4 py-1.5 text-xs font-bold text-white shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} strokeWidth={3} /> Expense
            </div>
          </div>
        </div>

        {/* Custom CSS Chart */}
        <div className="relative h-64 w-full mb-6">
          {/* Y Axis & Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {yLabels.map((label, i) => (
              <div key={i} className="flex items-center w-full relative">
                <span className="text-xs font-bold text-slate-400 w-10 -ml-2">{label}</span>
                <div className="h-[1px] w-full bg-slate-100 flex-1"></div>
              </div>
            ))}
          </div>

          {/* Bars container */}
          <div className="absolute inset-0 ml-10 flex items-end justify-around pb-[1px]">
            {chartData.map((data, index) => {
              const heightPct = Math.min(100, (data.income / maxVal) * 100);
              const expHeightPct = Math.min(100, (data.expense / maxVal) * 100);
              return (
                <div key={index} className="group relative flex items-end justify-center gap-1 h-full w-[14%] pt-4 z-10 hover:bg-slate-100/50 transition cursor-pointer rounded-t-lg">
                  {/* Tooltip */}
                  <div className="absolute top-[10%] opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none z-20 flex flex-col items-center drop-shadow-xl">
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-lg w-40 z-30 relative">
                      <div className="text-xs font-bold text-slate-500 mb-2 border-b border-slate-100 pb-2">{data.label}</div>
                      <div className="text-[11px] font-bold text-blue-600 mb-1 flex justify-between"><span>Income:</span> <span>৳{data.income.toLocaleString()}</span></div>
                      <div className="text-[11px] font-bold text-rose-500 mb-1 flex justify-between"><span>Expense:</span> <span>৳{data.expense.toLocaleString()}</span></div>
                      <div className="text-[11px] font-bold text-emerald-500 flex justify-between"><span>Profit:</span> <span>৳{data.profit.toLocaleString()}</span></div>
                    </div>
                  </div>
                  {/* Income Bar */}
                  <div 
                    className="w-4 rounded-t-sm bg-[#10b981] transition-all duration-500 shadow-sm" 
                    style={{ height: `${heightPct}%` }}
                  ></div>
                  {/* Expense Bar */}
                  <div 
                    className="w-4 rounded-t-sm bg-[#ef4444] transition-all duration-500 shadow-sm" 
                    style={{ height: `${expHeightPct}%` }}
                  ></div>
                </div>
              );
            })}
          </div>
          
          {/* X Axis Labels */}
          <div className="absolute -bottom-8 left-10 right-0 flex justify-around">
            {chartData.map((data, i) => (
              <div key={i} className="w-[14%] text-center text-xs font-bold text-slate-500">{data.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Income & Expense Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
        {/* Income Table */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 rounded-full bg-blue-600"></div>
              <h3 className="text-lg font-bold text-slate-800">Recent Income</h3>
            </div>
            <button 
              onClick={() => onNavigate && onNavigate("Income Entry")}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition flex items-center gap-1"
            >
              <Plus size={12} strokeWidth={3} /> Add Income
            </button>
          </div>
          <div className="space-y-4">
            {recentIncome.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                    <ArrowUpRight size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.description}</div>
                    <div className="text-[11px] font-medium text-slate-400 mt-0.5">{item.id} · {item.category} · {item.transactionDate ? new Date(item.transactionDate).toLocaleDateString() : ""}</div>
                  </div>
                </div>
                <div className="text-[15px] font-extrabold text-blue-600">
                  +{formatCurrency(item.amount)}
                </div>
              </div>
            ))}
            {recentIncome.length === 0 && (
              <div className="text-center py-6 text-slate-400 font-semibold text-sm">No recent income transactions found.</div>
            )}
          </div>
        </div>

        {/* Expense Table */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 rounded-full bg-[#ff3b5c]"></div>
              <h3 className="text-lg font-bold text-slate-800">Recent Expenses</h3>
            </div>
            <button 
              onClick={() => onNavigate && onNavigate("Expense Entry")}
              className="rounded-full bg-[#ff3b5c] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-600 transition flex items-center gap-1"
            >
              <Plus size={12} strokeWidth={3} /> Add Expense
            </button>
          </div>
          <div className="space-y-4">
            {recentExpense.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100">
                    <ArrowDownRight size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.description}</div>
                    <div className="text-[11px] font-medium text-slate-400 mt-0.5">{item.id} · {item.category} · {item.transactionDate ? new Date(item.transactionDate).toLocaleDateString() : ""}</div>
                  </div>
                </div>
                <div className="text-[15px] font-extrabold text-rose-600">
                  -{formatCurrency(item.amount)}
                </div>
              </div>
            ))}
            {recentExpense.length === 0 && (
              <div className="text-center py-6 text-slate-400 font-semibold text-sm">No recent expense transactions found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
