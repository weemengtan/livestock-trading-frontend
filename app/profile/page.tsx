"use client";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { BuyerBottomNav } from "@/components/buyer/bottom-nav";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { ProfileDetails } from "@/components/profile/profile-details";
import { useAuthStore } from "@/lib/auth-store";
import { ALL_ROLES } from "@/lib/roles";
import { strings } from "@/lib/strings";

function ProfileContent() {
  const user = useAuthStore((s) => s.user);
  const forced = !!user?.mustChangePassword;
  const isBuyer = user?.role === "BUYER";

  return (
    <>
      <AppShell title={forced ? strings.profile.forced.title : strings.profile.title}>
        <div className={isBuyer ? "flex flex-col gap-4" : "mx-auto flex w-full max-w-2xl flex-col gap-4"}>
          {forced ? (
            <div
              role="status"
              className="rounded-lg border border-subtle bg-accent-subtle p-4 text-sm text-fg-primary"
            >
              {strings.profile.forced.body}
            </div>
          ) : null}
          {forced ? null : <ProfileDetails />}
          <ChangePasswordForm forced={forced} />
        </div>
      </AppShell>
      {isBuyer && !forced ? <BuyerBottomNav /> : null}
    </>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard requiredRole={ALL_ROLES}>
      <ProfileContent />
    </AuthGuard>
  );
}
