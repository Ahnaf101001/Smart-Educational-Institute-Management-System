"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import PublicShell from "../../components/public/PublicShell";
import { Card } from "../../components/ui/kit";

function ResultInner() {
  const params = useSearchParams();
  const ok = params.get("status") === "success";
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="py-6 text-center">
          {ok ? <CheckCircle2 className="mx-auto text-emerald-500" size={52} /> : <XCircle className="mx-auto text-rose-500" size={52} />}
          <h1 className="mt-3 text-2xl font-extrabold">{ok ? "Payment successful" : "Payment not completed"}</h1>
          <p className="mt-2 text-sm text-slate-600">{ok ? "Your receipt is available in the guardian portal and has been sent by SMS." : "No money was deducted, or the payment will be reconciled automatically if the gateway confirms it later."}</p>
          {params.get("txn") && <p className="mt-1 text-xs text-slate-500">Transaction {params.get("txn")}</p>}
          <Link href="/" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Back to portal</Link>
        </div>
      </Card>
    </div>
  );
}

export default function PayResultPage() {
  return (
    <PublicShell title="Payment result">
      <Suspense fallback={null}><ResultInner /></Suspense>
    </PublicShell>
  );
}
