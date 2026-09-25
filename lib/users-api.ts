import { apiFetch } from "./api-client";
import type { Role } from "./auth-store";

function auth(accessToken: string | null) {
  return { accessToken };
}

export type InviteStatus = "PENDING" | "ACTIVE" | "DEACTIVATED";

export type ManagedUser = {
  id: string;
  email: string;
  role: Role;
  org_id: string;
  invite_status: InviteStatus;
  mfa_enrolled: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
};

export const usersApi = {
  list: (accessToken: string | null) => apiFetch<ManagedUser[]>("/users", auth(accessToken)),
  invite: (body: { email: string; role: Role }, accessToken: string | null) =>
    apiFetch<ManagedUser>("/users/invite", { method: "POST", body, ...auth(accessToken) }),
  changeRole: (id: string, role: Role, accessToken: string | null) =>
    apiFetch<ManagedUser>(`/users/${id}/role`, { method: "PATCH", body: { role }, ...auth(accessToken) }),
  deactivate: (id: string, accessToken: string | null) =>
    apiFetch<ManagedUser>(`/users/${id}/deactivate`, { method: "POST", ...auth(accessToken) }),
  reactivate: (id: string, accessToken: string | null) =>
    apiFetch<ManagedUser>(`/users/${id}/reactivate`, { method: "POST", ...auth(accessToken) }),
  setTemporaryPassword: (id: string, temporaryPassword: string, accessToken: string | null) =>
    apiFetch<ManagedUser>(`/users/${id}/temporary-password`, {
      method: "POST",
      body: { temporary_password: temporaryPassword },
      ...auth(accessToken),
    }),
};
