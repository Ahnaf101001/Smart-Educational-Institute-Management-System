"use client";

import { CheckCircle2, CircleDollarSign, Clock, AlertCircle, ArrowUpRight, Check, ArrowRight } from "lucide-react";

export default function FeesOverview() {
  const classCollection = [
    { class: "Class 6", collected: "৳43K", due: "৳11K", progress: 80 },
    { class: "Class 7", collected: "৳41K", due: "৳13K", progress: 77 },
    { class: "Class 8", collected: "৳45K", due: "৳8K", progress: 85 },
    { class: "Class 9", collected: "৳66K", due: "৳17K", progress: 80 },
    { class: "Class 10", collected: "৳70K", due: "৳24K", progress: 74 },
    { class: "Class 11", collected: "৳86K", due: "৳10K", progress: 90 },
    { class: "Class 12", collected: "৳104K", due: "৳6K", progress: 95 },
  ];

  const recentTransactions = [
    { name: "Zainab Noor", details: "RCP-0547 • Class 9-A • Cash", amount: "৳12,500", date: "2024-12-28", status: "success" },
    { name: "Ali Hassan", details: "RCP-0546 • Class 10-B • Bank Transfer", amount: "৳15,000", date: "2024-12-27", status: "success" },
    { name: "Ahmed Khan", details: "RCP-0545 • Class 8-A • Mobile Banking", amount: "৳11,000", date: "2024-12-26", status: "success" },
    { name: "Sara Ijaz", details: "RCP-0544 • Class 11-C • Cash", amount: "৳18,500", date: "2024-12-25", status: "success" },
    { name: "Omar Farooq", details: "RCP-0543 • Class 7-B • Cheque", amount: "৳9,500", date: "2024-12-24", status: "pending" },
    { name: "Fatima Malik", details: "RCP-0542 • Class 10-B • Mobile Banking", amount: "৳12,500", date: "2024-12-23", status: "success" },
  ];

  const monthlyData = [
    { month: "Jul", value: 85 },
    { month: "Aug", value: 88 },
    { month: "Sep", value: 85 },
    { month: "Oct", value: 86 },
    { month: "Nov", value: 85 },
    { month: "Dec", value: 84 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Top Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        {/* Total Fee Card */}
        <div className="relative overflow-hidden rounded-2xl bg-blue-600 p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <CircleDollarSign size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">৳5,84,400</div>
            <div className="mt-1 text-sm font-bold text-blue-100">Total Fee (Dec)</div>
            <div className="mt-1 text-[11px] font-medium text-blue-200">All classes combined</div>
          </div>
        </div>

        {/* Collected Card */}
        <div className="relative overflow-hidden rounded-2xl bg-[#00c853] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">৳4,56,000</div>
            <div className="mt-1 text-sm font-bold text-emerald-100">Collected</div>
            <div className="mt-1 text-[11px] font-medium text-emerald-200">78% collection rate</div>
          </div>
        </div>

        {/* Pending Card */}
        <div className="relative overflow-hidden rounded-2xl bg-[#ff8f00] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <Clock size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">৳87,500</div>
            <div className="mt-1 text-sm font-bold text-orange-100">Pending / Due</div>
            <div className="mt-1 text-[11px] font-medium text-orange-200">15% • 23 students</div>
          </div>
        </div>

        {/* Overdue Card */}
        <div className="relative overflow-hidden rounded-2xl bg-[#ff1744] p-6 text-white shadow-sm">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
          <div className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <AlertCircle size={20} className="text-white" />
          </div>
          <div className="mt-8">
            <div className="text-[28px] font-black tracking-tight">৳40,900</div>
            <div className="mt-1 text-sm font-bold text-rose-100">Overdue (&gt;1 mo)</div>
            <div className="mt-1 text-[11px] font-medium text-rose-200">7% • needs attention</div>
          </div>
        </div>
      </div>

      {/* Middle Section: Charts */}
      <div className="grid grid-cols-[2fr_1fr] gap-6">
        {/* Monthly Collection Bar Chart */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Monthly Collection vs Target</h3>
              <p className="text-sm font-medium text-slate-400">Jul – Dec 2024</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              <ArrowUpRight size={14} />
              +12.4% vs last year
            </div>
          </div>

          <div className="relative h-[220px] w-full flex items-end justify-between px-4 pb-8">
            {/* Y-axis Labels */}
            <div className="absolute left-0 top-0 h-full w-full flex flex-col justify-between pb-8">
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="w-8 text-right">600k</span>
                <div className="flex-1 border-t border-dashed border-slate-200"></div>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="w-8 text-right">450k</span>
                <div className="flex-1 border-t border-dashed border-slate-200"></div>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="w-8 text-right">300k</span>
                <div className="flex-1 border-t border-dashed border-slate-200"></div>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="w-8 text-right">150k</span>
                <div className="flex-1 border-t border-dashed border-slate-200"></div>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="w-8 text-right">0k</span>
                <div className="flex-1 border-t border-dashed border-slate-200"></div>
              </div>
            </div>

            {/* Bars */}
            <div className="relative z-10 flex h-full w-full items-end justify-between pl-14 pr-2">
              {monthlyData.map((d) => (
                <div key={d.month} className="group relative flex h-full flex-col justify-end w-12 cursor-pointer">
                  <div 
                    className="w-full bg-[#2863eb] rounded-t-sm transition-all duration-300 group-hover:bg-blue-500" 
                    style={{ height: `${d.value}%` }}
                  ></div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-semibold text-slate-500">
                    {d.month}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Collection Split Doughnut Chart */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Collection Split</h3>
            <p className="text-sm font-medium text-slate-400">December 2024</p>
          </div>
          
          <div className="flex-1 flex items-center justify-center py-6">
            <div 
              className="relative w-[160px] h-[160px] rounded-full"
              style={{
                background: "conic-gradient(#2863eb 0% 76%, white 76% 78%, #f59e0b 78% 91%, white 91% 93%, #ef4444 93% 98%, white 98% 100%)"
              }}
            >
              <div className="absolute inset-4 rounded-full bg-white shadow-inner"></div>
            </div>
          </div>

          <div className="space-y-3 mt-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#2863eb]"></span>
                <span className="text-sm font-semibold text-slate-600">Collected</span>
              </div>
              <div className="text-sm">
                <span className="font-extrabold text-slate-900 mr-2">78%</span>
                <span className="text-slate-400 font-semibold">৳456K</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#f59e0b]"></span>
                <span className="text-sm font-semibold text-slate-600">Pending</span>
              </div>
              <div className="text-sm">
                <span className="font-extrabold text-slate-900 mr-2">15%</span>
                <span className="text-slate-400 font-semibold">৳88K</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ef4444]"></span>
                <span className="text-sm font-semibold text-slate-600">Overdue</span>
              </div>
              <div className="text-sm">
                <span className="font-extrabold text-slate-900 mr-2">7%</span>
                <span className="text-slate-400 font-semibold">৳41K</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Tables */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-6">
        
        {/* Class-wise Collection */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Class-wise Collection</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-4">Class</th>
                <th className="pb-4 text-right">Collected</th>
                <th className="pb-4 text-right">Due</th>
                <th className="pb-4 pl-8">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {classCollection.map((row) => (
                <tr key={row.class} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 font-bold text-slate-700">{row.class}</td>
                  <td className="py-4 text-right font-extrabold text-emerald-600">{row.collected}</td>
                  <td className="py-4 text-right font-extrabold text-orange-500">{row.due}</td>
                  <td className="py-4 pl-8">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[#2863eb]" 
                          style={{ width: `${row.progress}%` }}
                        ></div>
                      </div>
                      <span className="w-8 text-right text-xs font-bold text-slate-600">{row.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Recent Transactions</h3>
            <button className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700">
              View all <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex flex-col gap-5 flex-1">
            {recentTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tx.status === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-orange-50 text-orange-500'}`}>
                    {tx.status === 'success' ? <Check size={16} strokeWidth={3} /> : <Clock size={16} strokeWidth={3} />}
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-800">{tx.name}</div>
                    <div className="text-xs font-medium text-slate-400 mt-0.5">{tx.details}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-black ${tx.status === 'success' ? 'text-emerald-600' : 'text-orange-500'}`}>{tx.amount}</div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5">{tx.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
