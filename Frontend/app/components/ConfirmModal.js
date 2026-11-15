import { AlertTriangle, Info, CheckCircle2, X } from "lucide-react";

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel, 
  type = "warning", // warning, danger, success, info
  children
}) {
  if (!isOpen) return null;

  const styles = {
    danger: {
      icon: <AlertTriangle size={24} className="text-rose-500" />,
      iconBg: "bg-rose-100",
      btn: "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500/20"
    },
    warning: {
      icon: <AlertTriangle size={24} className="text-amber-500" />,
      iconBg: "bg-amber-100",
      btn: "bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500/20"
    },
    success: {
      icon: <CheckCircle2 size={24} className="text-emerald-500" />,
      iconBg: "bg-emerald-100",
      btn: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500/20"
    },
    info: {
      icon: <Info size={24} className="text-blue-500" />,
      iconBg: "bg-blue-100",
      btn: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500/20"
    }
  };

  const currentStyle = styles[type] || styles.info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${currentStyle.iconBg} mb-5`}>
            {currentStyle.icon}
          </div>
          
          <h3 className="text-xl font-black text-slate-800 mb-2">
            {title}
          </h3>
          
          <p className="text-sm font-medium text-slate-500 mb-6">
            {message}
          </p>

          {children && (
            <div className="mb-6 text-left">
              {children}
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition outline-none focus:ring-4 focus:ring-slate-500/10"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold shadow-md transition outline-none focus:ring-4 ${currentStyle.btn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
