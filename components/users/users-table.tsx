"use client";

import * as React from "react";
import { DateTime } from "@/components/ui/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useAuthStore, type Role } from "@/lib/auth-store";
import { strings } from "@/lib/strings";
import { ApiError } from "@/lib/api-client";
import { usersApi, type ManagedUser } from "@/lib/users-api";

const ROLES: Role[] = ["OWNER", "ACCOUNTANT", "BUYER"];

function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("BUYER");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await usersApi.invite({ email, role }, accessToken);
      toast({ title: `Invited ${email}` });
      setEmail("");
      setOpen(false);
      onInvited();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not send invite", variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{strings.users.invite}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{strings.users.inviteDialogTitle}</DialogTitle>
        <DialogDescription>
          They receive a link, set their own password, and enrol MFA on first login. You never set or see anyone
          else&apos;s password.
        </DialogDescription>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">{strings.users.email}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">{strings.users.role}</Label>
            <select
              id="invite-role"
              className="h-12 w-full rounded-md border border-default bg-surface px-3 text-base text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {strings.shell.roleLabels[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Inviting…" : strings.users.invite}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function statusVariant(status: ManagedUser["invite_status"]) {
  if (status === "ACTIVE") return "pass" as const;
  if (status === "PENDING") return "close" as const;
  return "neutral" as const;
}

export function UsersTable() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setUsers(await usersApi.list(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleRoleChange(user: ManagedUser, role: Role) {
    if (role === user.role) return;
    setBusyId(user.id);
    try {
      await usersApi.changeRole(user.id, role, accessToken);
      await load();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not change role", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(user: ManagedUser) {
    setBusyId(user.id);
    try {
      await usersApi.deactivate(user.id, accessToken);
      await load();
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Could not deactivate user",
        variant: "danger",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(user: ManagedUser) {
    setBusyId(user.id);
    try {
      await usersApi.reactivate(user.id, accessToken);
      await load();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Could not reactivate user", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-fg-tertiary">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <InviteDialog onInvited={load} />
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-xs uppercase tracking-wide text-fg-tertiary">
              <th className="px-4 py-3 font-medium">{strings.users.email}</th>
              <th className="px-4 py-3 font-medium">{strings.users.role}</th>
              <th className="px-4 py-3 font-medium">{strings.users.status}</th>
              <th className="px-4 py-3 font-medium">{strings.users.lastActive}</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">{strings.users.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-subtle last:border-0">
                <td className="px-4 py-3">
                  {user.email}
                  {user.id === currentUserId ? <span className="ml-2 text-xs text-fg-tertiary">(you)</span> : null}
                </td>
                <td className="px-4 py-3">
                  <label htmlFor={`role-${user.id}`} className="sr-only">
                    {strings.users.role} — {user.email}
                  </label>
                  <select
                    id={`role-${user.id}`}
                    className="rounded-md border border-default bg-surface px-2 py-1 text-sm text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
                    value={user.role}
                    disabled={busyId === user.id}
                    onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {strings.shell.roleLabels[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(user.invite_status)}>{user.invite_status}</Badge>
                </td>
                <td className="px-4 py-3 text-fg-secondary">
                  {user.last_login_at ? <DateTime value={user.last_login_at} /> : strings.users.never}
                </td>
                <td className="px-4 py-3 text-right">
                  {user.invite_status === "DEACTIVATED" ? (
                    <Button size="sm" variant="secondary" disabled={busyId === user.id} onClick={() => handleReactivate(user)}>
                      {strings.users.reactivate}
                    </Button>
                  ) : (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="danger" disabled={busyId === user.id}>
                          {strings.users.deactivate}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogTitle>
                          {strings.users.deactivate} {user.email}?
                        </DialogTitle>
                        <DialogDescription>{strings.users.deactivateConfirm}</DialogDescription>
                        <div className="mt-4 flex justify-end gap-2">
                          <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button variant="danger" onClick={() => handleDeactivate(user)}>
                              {strings.users.deactivate}
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
