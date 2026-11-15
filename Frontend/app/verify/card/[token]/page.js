"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { publicApi } from "../../../lib/api";
import PublicShell from "../../../components/public/PublicShell";
import { Card, Spinner, formatDate } from "../../../components/ui/kit";

// Public QR verification: shows only approved, non-sensitive details (§7.4).
export default function VerifyCardPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => { publicApi.verifyCard(token).then(setData).catch(() => setError(true)); }, [token]);
  return (
    <PublicShell title="ID Card Verification">
      <div className="mx-auto max-w-md">
        {!data && !error ? <Spinner /> : error || !data ? (
          <Card><div className="py-6 text-center"><ShieldAlert className="mx-auto text-rose-500" size={48} /><h1 className="mt-3 text-xl font-extrabold">Card not recognised</h1><p className="mt-1 text-sm text-slate-500">This QR code does not belong to a card issued by this institution.</p></div></Card>
        ) : (
          <Card>
            <div className="text-center">
              {data.valid ? <BadgeCheck className="mx-auto text-emerald-500" size={52} /> : <ShieldAlert className="mx-auto text-rose-500" size={52} />}
              <h1 className={`mt-2 text-2xl font-extrabold ${data.valid ? "text-emerald-600" : "text-rose-600"}`}>{data.valid ? "Valid ID card" : `Card ${data.status}`}</h1>
              {data.photoUrl && <img src={data.photoUrl} alt="" className="mx-auto mt-4 size-28 rounded-2xl object-cover" />}
              <p className="mt-3 text-xl font-bold">{data.name}</p>
              <p className="text-sm text-slate-600">{data.holderType}{data.className ? ` · ${data.className}` : ""}{data.designation ? ` · ${data.designation}` : ""}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500">Card no.</p><b>{data.cardNumber}</b></div>
                <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500">Valid until</p><b>{formatDate(data.validUntil)}</b></div>
              </div>
              <p className="mt-4 text-xs text-slate-500">Issued by {data.institute?.name}. Contact {data.institute?.phone || "the institution"} to report misuse.</p>
            </div>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}
