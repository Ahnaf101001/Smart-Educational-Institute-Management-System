"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { publicApi } from "../../../lib/api";
import PublicShell from "../../../components/public/PublicShell";
import { Button, Card, Spinner, money, useToast } from "../../../components/ui/kit";

// Development-only payment simulator (the API refuses it outside NODE_ENV=development).
export default function SandboxPayPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { publicApi.sandbox(id).then(setTxn).catch((e) => setError(e.message)); }, [id]);
  async function finish(status) {
    try {
      const r = await publicApi.sandboxComplete(id, status);
      // Payments started from the guardian app return to the app through its deep link.
      const target = await publicApi.paymentReturnTarget(id).catch(() => null);
      if (target?.url) { window.location.href = target.url; return; }
      router.push(`/pay/result?status=${r.status === "Success" ? "success" : "failed"}&txn=${txn.txnId}`);
    } catch (e) { toast.error(e); }
  }
  return (
    <PublicShell title="Payment sandbox">
      <div className="mx-auto max-w-md">
        <Card>
          {error ? <p className="text-sm text-rose-600">{error}</p> : !txn ? <Spinner /> : (
            <div className="text-center">
              <FlaskConical className="mx-auto text-amber-500" size={40} />
              <h1 className="mt-2 text-xl font-extrabold">{txn.gateway.toUpperCase()} sandbox</h1>
              <p className="mt-1 text-sm text-slate-500">Development simulator – no real money moves. Configure merchant credentials for live payments.</p>
              <p className="mt-4 text-3xl font-extrabold">{money(txn.amount)}</p>
              <p className="text-xs text-slate-500">Transaction {txn.txnId} · {txn.status}</p>
              {txn.posted ? <p className="mt-4 text-sm text-emerald-600">Already paid.</p> : (
                <div className="mt-5 flex justify-center gap-2">
                  <Button variant="success" onClick={() => finish("success")}>Simulate success</Button>
                  <Button variant="danger" onClick={() => finish("fail")}>Simulate failure</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </PublicShell>
  );
}
