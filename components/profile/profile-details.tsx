"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/date-time";
import { useAuthStore } from "@/lib/auth-store";
import { strings } from "@/lib/strings";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <dt className="w-48 shrink-0 text-fg-tertiary">{label}</dt>
      <dd className="min-w-0 break-all text-fg-primary">{children}</dd>
    </div>
  );
}

export function ProfileDetails() {
  const user = useAuthStore((s) => s.user);
  const s = strings.profile;
  if (!user) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-fg-primary">{s.account}</h2>
      <dl className="mt-4 flex flex-col gap-3 text-sm">
        <Row label={s.email}>{user.email}</Row>
        <Row label={s.role}>
          <Badge variant="accent">{strings.shell.roleLabels[user.role]}</Badge>
        </Row>
        <Row label={s.mfa}>{user.mfaEnrolled ? s.mfaOn : s.mfaOff}</Row>
        <Row label={s.lastSignIn}>{user.lastLoginAt ? <DateTime value={user.lastLoginAt} /> : s.never}</Row>
      </dl>
    </Card>
  );
}
