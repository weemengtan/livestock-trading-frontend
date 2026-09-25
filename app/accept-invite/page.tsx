"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ROLE_HOME } from "@/lib/roles";
import { strings } from "@/lib/strings";

type AcceptInviteResponse = { access_token: string; mfa_required: boolean; totp_provisioning_uri: string | null };

function AcceptInviteForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const setSession = useAuthStore((s) => s.setSession);

  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [pendingMfa, setPendingMfa] = React.useState<{ accessToken: string; provisioningUri: string } | null>(null);
  const [totpCode, setTotpCode] = React.useState("");

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<AcceptInviteResponse>("/auth/accept-invite", {
        method: "POST",
        body: { invite_token: token, password },
      });
      if (res.mfa_required && res.totp_provisioning_uri) {
        setPendingMfa({ accessToken: res.access_token, provisioningUri: res.totp_provisioning_uri });
      } else {
        await setSession(res.access_token);
        const role = useAuthStore.getState().user?.role;
        router.replace(role ? ROLE_HOME[role] : "/login");
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : strings.auth.login.genericError;
      toast({ title: message, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingMfa) return;
    setSubmitting(true);
    try {
      await apiFetch(`/auth/mfa/confirm?code=${encodeURIComponent(totpCode)}`, {
        method: "POST",
        accessToken: pendingMfa.accessToken,
      });
      await setSession(pendingMfa.accessToken);
      const role = useAuthStore.getState().user?.role;
      router.replace(role ? ROLE_HOME[role] : "/login");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : strings.auth.login.genericError;
      toast({ title: message, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-fg-primary">{strings.auth.acceptInvite.title}</h1>
        <p className="text-sm text-status-danger">{strings.auth.acceptInvite.missingToken}</p>
      </div>
    );
  }

  if (pendingMfa) {
    return (
      <form onSubmit={handleConfirmMfa} className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-fg-primary">{strings.auth.acceptInvite.mfaTitle}</h1>
        <p className="text-sm text-fg-secondary">{strings.auth.acceptInvite.mfaHint}</p>
        <code className="break-all rounded bg-sunken p-3 text-xs text-fg-secondary">
          {pendingMfa.provisioningUri}
        </code>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mfa-code">{strings.auth.acceptInvite.mfaCodeLabel}</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {strings.auth.acceptInvite.mfaSubmit}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleActivate} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg-primary">{strings.auth.acceptInvite.title}</h1>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{strings.auth.acceptInvite.passwordLabel}</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-fg-tertiary">{strings.auth.acceptInvite.passwordHint}</p>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? strings.auth.acceptInvite.submitting : strings.auth.acceptInvite.submit}
      </Button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <Card className="w-full max-w-sm">
        <Suspense fallback={null}>
          <AcceptInviteForm />
        </Suspense>
      </Card>
    </main>
  );
}
