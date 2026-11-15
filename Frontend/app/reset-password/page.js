"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { authExtraApi } from "../lib/api";
import PublicShell from "../components/public/PublicShell";
import { Button, Card, Field, Input, useToast } from "../components/ui/kit";

function ResetInner() {
  const params = useSearchParams();
  const toast = useToast();
  const [pw, setPw] = useState({ a: "", b: "" });
  const [done, setDone] = useState(false);
  async function submit() {
    if (pw.a.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (pw.a !== pw.b) { toast.error("Passwords do not match."); return; }
    try { await authExtraApi.reset(params.get("token"), pw.a); setDone(true); } catch (e) { toast.error(e); }
  }
  return (
    <div className="mx-auto max-w-md">
      <Card title="Set a new password">
        {done ? (
          <div className="text-center"><p className="text-sm text-emerald-700">Password updated. You can now sign in.</p><Link href="/" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Sign in</Link></div>
        ) : (
          <div className="space-y-3">
            <Field label="New password"><Input type="password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
            <Field label="Confirm password"><Input type="password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
            <Button icon={KeyRound} disabled={!params.get("token")} onClick={submit}>Update password</Button>
            {!params.get("token") && <p className="text-xs text-rose-600">The reset link is missing its token.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <PublicShell title="Reset password"><Suspense fallback={null}><ResetInner /></Suspense></PublicShell>;
}
