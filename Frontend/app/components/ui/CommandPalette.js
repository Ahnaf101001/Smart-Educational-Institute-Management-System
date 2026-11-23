"use client";

// Ctrl+K / header search: jump to any page the user may open, or straight to a student's profile.
// Pages come from the already permission-filtered navigation; student search uses the normal
// /students list endpoint, so the server still decides what each user may see.
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search, UserRound, X } from "lucide-react";
import { resource } from "../../lib/api";

export default function CommandPalette({ open, onClose, items, t, navigateTo, canSearchStudents, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [students, setStudents] = useState([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setQuery(initialQuery); setCursor(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open, initialQuery]);

  const pages = useMemo(() => {
    const all = [];
    for (const item of items) {
      if (item.children) for (const c of item.children) all.push({ parent: item.label, child: c.label, label: `${t(item.label)} › ${t(c.label)}`, raw: `${item.label} ${c.label}` });
      else all.push({ parent: item.label, child: null, label: t(item.label), raw: item.label });
    }
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all.filter((p) => p.label.toLowerCase().includes(q) || p.raw.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query, t]);

  useEffect(() => {
    const q = query.trim();
    if (!open || !canSearchStudents || q.length < 2) { setStudents([]); return undefined; }
    const timer = setTimeout(() => {
      resource("/students").list({ search: q, limit: 6 }).then((r) => setStudents(r.data || [])).catch(() => setStudents([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, canSearchStudents]);

  const results = [
    ...students.map((s) => ({ kind: "student", key: `s-${s.id}`, label: s.name, sub: `${s.id} · ${s.className || ""}${s.roll ? ` · Roll ${s.roll}` : ""}`, go: () => navigateTo("Students", "Student 360", `id=${encodeURIComponent(s.id)}`) })),
    ...pages.map((p) => ({ kind: "page", key: `p-${p.raw}`, label: p.label, go: () => navigateTo(p.parent, p.child) })),
  ];

  function choose(r) { if (!r) return; onClose(); r.go(); }
  function onKey(e) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[cursor]); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label={t("Search")} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setCursor(0); }} onKeyDown={onKey}
            className="h-14 w-full bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400" placeholder={t("Search pages and students…")} />
          <button aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {!results.length && <li className="px-3 py-6 text-center text-sm text-slate-500">{t("No matches.")}</li>}
          {results.map((r, i) => (
            <li key={r.key}>
              <button onMouseEnter={() => setCursor(i)} onClick={() => choose(r)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === cursor ? "bg-blue-50" : ""}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${r.kind === "student" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {r.kind === "student" ? <UserRound size={16} /> : <FileText size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{r.label}</span>
                  {r.sub && <span className="block truncate text-xs text-slate-500">{r.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">↑ ↓ to move · Enter to open · Esc to close · Ctrl+K anywhere</p>
      </div>
    </div>
  );
}
