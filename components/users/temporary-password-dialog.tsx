"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import { usersApi, type ManagedUser } from "@/lib/users-api";

// No look-alikes (0/O, 1/l/I): this password gets read out or typed by a person.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 20): string {
  // Rejection sampling keeps every character equally likely (no modulo bias).
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const b of bytes) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "PASSWORD_POLICY_VIOLATION") {
      const violations = (err.details as { violations?: string[] } | null)?.violations;
      if (violations?.length) return violations.join(" ");
    }
    if (err.code === "USER_NOT_ACTIVE") return strings.users.temporaryPassword.notActive;
    if (err.message) return err.message;
  }
  return "Could not set the temporary password.";
}

export function TemporaryPasswordDialog({
  user,
  disabled,
  onDone,
}: {
  user: ManagedUser;
  disabled: boolean;
  onDone: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const s = strings.users.temporaryPassword;
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPassword(generatePassword());
    } else {
      // Never keep a shown password around once the dialog is gone.
      setPassword("");
      if (done) onDone();
    }
    setDone(false);
    setCopied(false);
    setError(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setError("Could not copy automatically — select the password and copy it manually.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await usersApi.setTemporaryPassword(user.id, password, accessToken);
      setDone(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled}>
          {strings.users.setTemporaryPassword}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>
          {done ? s.doneTitle : s.title} — {user.email}
        </DialogTitle>
        <DialogDescription>{done ? s.doneBody : s.description}</DialogDescription>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`temp-password-${user.id}`}>{s.label}</Label>
            <PasswordInput
              id={`temp-password-${user.id}`}
              autoComplete="off"
              required
              minLength={12}
              readOnly={done}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-status-breach-fg">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {done ? null : (
              <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>
                {s.generate}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={copy} disabled={!password}>
              {copied ? s.copied : s.copy}
            </Button>
            {done ? (
              <DialogClose asChild>
                <Button type="button">{s.close}</Button>
              </DialogClose>
            ) : (
              <Button type="submit" disabled={submitting || password.length < 12}>
                {submitting ? s.submitting : s.submit}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
