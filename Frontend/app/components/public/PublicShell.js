"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { School } from "lucide-react";
import { publicApi } from "../../lib/api";

export function usePublicInstitute() {
  const [inst, setInst] = useState(null);
  useEffect(() => { publicApi.institute().then(setInst).catch(() => setInst({})); }, []);
  return inst;
}

export default function PublicShell({ children, title }) {
  const inst = usePublicInstitute();
  useEffect(() => { if (title) document.title = `${title} | ${inst?.name || "Smart Educational Institute"}`; }, [title, inst]);
  return (
      <div className="min-h-screen bg-gradient-to-b from-[#eef3ff] to-[#f7f8fb]">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            {inst?.logoUrl ? <img src={inst.logoUrl} alt="" className="size-11 rounded-xl object-contain" /> : <span className="grid size-11 place-items-center rounded-xl bg-[#223f91] text-white"><School size={22} /></span>}
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold text-slate-900">{inst?.name || "Smart Educational Institute"}</p>
              {inst?.nameBn && <p className="truncate text-sm text-slate-500">{inst.nameBn}</p>}
            </div>
            <nav className="ml-auto hidden gap-1 text-sm font-semibold sm:flex">
              <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" href="/apply">Admission</Link>
              <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" href="/result">Result</Link>
              <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" href="/gallery">Gallery</Link>
              <Link className="rounded-lg bg-[#223f91] px-3 py-2 text-white" href="/">Login</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="pb-8 text-center text-xs text-slate-500">
          {inst?.address}{inst?.phone ? ` · ${inst.phone}` : ""}{inst?.eiin ? ` · EIIN ${inst.eiin}` : ""}
          <span className="mt-1 block"><Link className="font-semibold text-slate-600 hover:underline" href="/privacy">গোপনীয়তা নীতি · Privacy policy</Link></span>
        </footer>
      </div>
  );
}
