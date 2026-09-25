"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ROLE_HOME } from "@/lib/roles";
import { strings } from "@/lib/strings";

const MIN_LENGTH = 12;

function messageFor(err: unknown): string {
  const s = strings.profile.password;
  if (err instanceof ApiError) {
    if (err.code === "INVALID_CURRENT_PASSWORD") return s.wrongCurrent;
    if (err.code === "PASSWORD_POLICY_VIOLATION") {
      const violations = (err.details as { violations?: string[] } | null)?.violations;
      if (violations?.length) return violations.join(" ");
    }
    if (err.code === "RATE_LIMITED") return strings.auth.errors.RATE_LIMITED;
    if (err.message) return err.message;
  }
  return s.generic;
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const s = strings.profile.password;

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(s.mismatch);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
        accessToken,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      // The current access token was issued while the account was still on its
      // temporary password, so it keeps being refused. Trade the refresh cookie
      // for a clean one (this also reloads /auth/me, clearing mustChangePassword).
      await refreshToken();
      toast({ title: s.success });
      if (forced && role) router.replace(ROLE_HOME[role]);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-fg-primary">{s.title}</h2>
      <p className="mt-1 text-sm text-fg-secondary">{s.hint}</p>
      <form onSubmit={handleSubmit} className="mt-4 flex max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">{s.current}</Label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">{s.new}</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">{s.confirm}</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-status-breach-fg">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? s.submitting : s.submit}
        </Button>
      </form>
    </Card>
  );
}
