"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// Registers the service worker (production builds only, so development is never served
// stale pages) and offers an "Install app" button where the browser supports it.
export default function PwaRegister() {
  const [prompt, setPrompt] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem("eims-install-dismissed") === "1"; } catch { /* ignore */ }
    if (standalone || dismissed) { setHidden(true); return undefined; }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setIosHint(true);
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("eims-install-dismissed", "1"); } catch { /* ignore */ }
  };

  if (hidden || (!prompt && !iosHint)) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-xl print:hidden sm:hidden">
      <div className="flex-1">
        <p className="font-semibold text-slate-800">Install the app</p>
        <p className="text-xs text-slate-500">{prompt ? "Open attendance, results and fees from your home screen." : "Tap Share, then “Add to Home Screen”."}</p>
      </div>
      {prompt && (
        <button type="button" className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white" onClick={async () => { prompt.prompt(); await prompt.userChoice.catch(() => {}); setPrompt(null); dismiss(); }}>
          <Download size={14} /> Install
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={dismiss}><X size={16} /></button>
    </div>
  );
}
