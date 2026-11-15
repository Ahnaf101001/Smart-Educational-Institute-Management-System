import { X, Check } from "lucide-react";

export default function PayslipModal({ isOpen, onClose, employee }) {
  if (!isOpen || !employee) return null;

  const basic = Number(employee.basicSalary || employee.basic || 0);
  const netPay = Number(employee.netPay || 0);

  const formatCurrency = (num) => "৳" + Math.round(num).toLocaleString();

  const getMonthLabel = (dateStr) => {
    if (!dateStr) return "";
    const parts = String(dateStr).split(/[-T]/);
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const d = new Date(year, month, 1);
      return d.toLocaleString("default", { month: "long", year: "numeric" });
    }
    return dateStr;
  };

  const actualEmpId = employee.employeeId || employee.id || "";
  const idParts = actualEmpId.split("-");
  const displayAccountSuffix = idParts[idParts.length - 1] || "0000";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:bg-transparent print:backdrop-blur-none print:p-0 animate-in fade-in duration-200">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .payslip-modal-container, .payslip-modal-container * {
            visibility: visible;
          }
          .payslip-modal-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            box-shadow: none !important;
            transform: none !important;
            border-radius: 0 !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-text-black {
            color: #000 !important;
          }
          .print-bg-white {
            background-color: #fff !important;
          }
        }
      `}</style>
      
      <div className="payslip-modal-container bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="bg-[#3841e6] p-6 text-white relative print-bg-white print-text-black">
          <button 
            onClick={onClose} 
            className="absolute top-5 right-5 h-8 w-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition print-hide"
          >
            <X size={18} />
          </button>
          
          <div className="text-[10px] font-extrabold tracking-widest uppercase mb-1 text-white/80 print-text-black">Salary Slip</div>
          <h2 className="text-xl font-extrabold mb-0.5">EduManage School & College</h2>
          <p className="text-xs font-semibold text-white/70 mb-5 print-text-black">123 Education Road, Dhaka</p>

          <div className="flex justify-between items-end border-t border-white/10 pt-4">
            <div>
              <div className="text-xs text-white/70 mb-0.5 print-text-black">Pay Period</div>
              <div className="text-sm font-extrabold">{getMonthLabel(employee.payrollMonth || employee.payroll_month)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/70 mb-0.5 print-text-black">Employee ID</div>
              <div className="text-sm font-extrabold">{actualEmpId}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 bg-white print:p-5 space-y-5">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-400 mb-0.5">Employee Name</div>
              <div className="font-extrabold text-slate-800">{employee.employeeName || employee.name}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-400 mb-0.5">Designation</div>
              <div className="font-extrabold text-slate-800">{employee.role}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-400 mb-0.5">Department</div>
              <div className="font-extrabold text-slate-800">{employee.department}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-400 mb-0.5">Bank Account</div>
              <div className="font-extrabold text-slate-800">****-****-{displayAccountSuffix}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-slate-50/50">
              <span className="text-sm font-bold text-slate-600">Basic Salary</span>
              <span className="text-sm font-black text-slate-800">{formatCurrency(basic)}</span>
            </div>
          </div>

          {/* Footer Card */}
          <div className="rounded-2xl bg-[#3841e6] p-5 text-white flex justify-between items-center print-bg-white print-border print-border-slate-200">
            <div>
              <div className="text-xs text-white/80 mb-0.5 print-text-black">Net Salary</div>
              <div className="text-2xl font-black print-text-black">{formatCurrency(netPay)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/80 mb-1 print-text-black">Payment: Bank Transfer</div>
              <div className="flex items-center justify-end gap-1 text-xs font-bold text-emerald-300 print:text-emerald-600">
                Status: <Check size={14} /> {employee.status}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
