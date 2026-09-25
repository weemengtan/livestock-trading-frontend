"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "@/components/ui/toast";
import { useAuthStore, ApiError } from "@/lib/auth-store";
import { ROLE_HOME } from "@/lib/roles";
import { strings } from "@/lib/strings";


export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [needsMfa, setNeedsMfa] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password, totpCode);
      const role = useAuthStore.getState().user?.role;
      router.replace(role ? ROLE_HOME[role] : "/login");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "MFA_REQUIRED") setNeedsMfa(true);
        const message =
          strings.auth.errors[err.code as keyof typeof strings.auth.errors] ?? strings.auth.login.genericError;
        toast({ title: message, variant: "danger" });
      } else {
        toast({ title: strings.auth.login.genericError, variant: "danger" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-end border-b border-subtle bg-surface px-6 py-4">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-default text-lg font-bold text-accent-fg">
            L
          </div>
          <h1 className="text-xl font-semibold text-fg-primary">Livestock Trade Management</h1>
          <p className="text-sm text-fg-tertiary">Trading Console</p>
        </div>
        <Card className="w-full max-w-sm">
          <h2 className="mb-6 text-lg font-semibold text-fg-primary">{strings.auth.login.title}</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{strings.auth.login.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{strings.auth.login.passwordLabel}</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {needsMfa ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totp">{strings.auth.login.totpLabel}</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
                <p className="text-xs text-fg-tertiary">{strings.auth.login.totpHint}</p>
              </div>
            ) : null}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? strings.auth.login.submitting : strings.auth.login.submit}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
