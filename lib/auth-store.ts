import { create } from "zustand";
import { apiFetch, ApiError, setAuthRefreshHandler } from "./api-client";

export type Role = "OWNER" | "ACCOUNTANT" | "BUYER" | "PLATFORM_ADMIN";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  orgId: string;
  mfaEnrolled: boolean;
  /** True while the account is on an admin-issued temporary password. */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

type MeResponse = {
  id: string;
  email: string;
  role: Role;
  org_id: string;
  mfa_enrolled: boolean;
  must_change_password?: boolean;
  last_login_at?: string | null;
};
type TokenPair = { access_token: string; token_type: string };

type AuthState = {
  accessToken: string | null;
  user: CurrentUser | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Called once on app load: tries the httpOnly refresh cookie before
   * falling back to "unauthenticated" — an access token lives 15 minutes
   * (§14), so a page refresh must not force a fresh login every time. Sets
   * status to "loading" first, which is what AuthGuard shows a splash
   * screen for — correct here, since we don't yet know if there's a page
   * to show at all. */
  hydrate: () => Promise<void>;
  /** Same underlying refresh as hydrate(), but for reviving an
   * already-authenticated session mid-use (e.g. a 401 from an expired
   * access token on some unrelated API call). Deliberately does NOT touch
   * "loading" — AuthGuard treats any non-"authenticated" status as "show a
   * full-page spinner", so flipping it here would blank out whatever the
   * user is looking at for the handful of milliseconds this takes. Status
   * only changes if the refresh actually fails, which correctly signals a
   * dead session and lets AuthGuard redirect to /login. Returns the new
   * access token (or null on failure) so api-client's 401 handler knows
   * whether to retry the original request. */
  refreshToken: () => Promise<string | null>;
  setSession: (accessToken: string) => Promise<void>;
};

function toCurrentUser(me: MeResponse): CurrentUser {
  return {
    id: me.id,
    email: me.email,
    role: me.role,
    orgId: me.org_id,
    mfaEnrolled: me.mfa_enrolled,
    mustChangePassword: me.must_change_password ?? false,
    lastLoginAt: me.last_login_at ?? null,
  };
}

// Reads the access token's own "exp" claim rather than hardcoding the
// 15-minute TTL here too — this is scheduling, not verification, so an
// unreadable/malformed token just means no proactive refresh gets scheduled
// (the reactive 401-retry in api-client.ts still covers it), never a crash.
function decodeExpiryMs(accessToken: string): number | null {
  try {
    const [, payload] = accessToken.split(".");
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

const PROACTIVE_REFRESH_BUFFER_MS = 2 * 60 * 1000;

// Module-private, same reasoning as refreshInFlight below: one timer per
// tab, not per store subscriber.
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

// Called every time a new access token lands (login, hydrate, or a
// mid-session refresh). Fires a silent refresh ~2 minutes before this token
// expires, so a healthy session renews itself before anyone can hit a 401 —
// the retry-on-401 path becomes a fallback for laptop sleep/clock drift
// rather than the normal way tokens get renewed. Each successful refresh
// calls setSession again, which re-arms this for the next cycle.
function scheduleProactiveRefresh(
  accessToken: string,
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
): void {
  clearProactiveRefresh();
  const expiresAt = decodeExpiryMs(accessToken);
  if (expiresAt === null) return;
  const delay = Math.max(expiresAt - Date.now() - PROACTIVE_REFRESH_BUFFER_MS, 1000);
  proactiveRefreshTimer = setTimeout(() => void performRefresh(get, set), delay);
}

// Module-private — deliberately not part of AuthState. Coalesces every
// concurrent caller of performRefresh (hydrate()'s mount-time check, React
// Strict Mode's dev-only double-invoke of it, AND refreshToken()'s
// mid-session 401 recovery) into one /auth/refresh request instead of many,
// since the refresh token rotates on use: two real concurrent calls would
// have the second one replay an already-rotated token and trip reuse
// detection, revoking the whole session. Sharing one guard across both
// entry points matters — a page-load hydrate() racing a mid-session
// refreshToken() is exactly the kind of concurrent pair this must catch.
//
// That guard only protects one tab, though — the refresh token is a single
// cookie shared by every tab of this browser, so two DIFFERENT tabs can
// each read it before either has rotated it and race the exact same way.
// withAuthLock() below extends the same protection across tabs using the
// Web Locks API (a browser-native mutex scoped to the whole origin, not
// just this JS heap) instead of a hand-rolled BroadcastChannel protocol —
// by the time a second tab's callback runs, the first tab's fetch has
// already completed and the cookie jar reflects its rotation, so the
// second tab's own refresh reads the current value and never replays a
// used one. Falls back to running the callback directly on browsers
// without Web Locks (all evergreen browsers have it) — no regression, just
// no cross-tab protection there.
function withAuthLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return fn();
  // lib.dom.d.ts types LockGrantedCallback as returning T synchronously, not
  // modeling the spec's behavior of awaiting a returned promise before
  // resolving — so it infers T as Promise<T> here and types this
  // Promise<Promise<T>>. The runtime behavior is correct (browsers do
  // unwrap it); this cast just corrects the type to match.
  return navigator.locks.request("livestock-auth-refresh", () => fn()) as unknown as Promise<T>;
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = withAuthLock(async () => {
    try {
      const tokens = await apiFetch<TokenPair>("/auth/refresh", { method: "POST" });
      await get().setSession(tokens.access_token);
      return get().accessToken;
    } catch {
      clearProactiveRefresh();
      set({ accessToken: null, user: null, status: "unauthenticated" });
      broadcastLoggedOut();
      return null;
    }
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

type AuthBroadcastMessage = { type: "session"; accessToken: string; user: CurrentUser } | { type: "logged-out" };

// Cross-tab sync, separate from withAuthLock's job of preventing the
// revocation race above. This is a UX layer on top of that correctness
// fix: whichever tab actually refreshes shares the result with every other
// open tab, so siblings very rarely need their own network round trip and
// stay in lockstep — and an explicit sign-out or a genuinely dead session
// (refresh token itself expired/revoked) reaches every tab immediately
// instead of each one discovering it independently, minutes apart, on its
// own next action. `undefined` on browsers without BroadcastChannel (none
// in practice) just means each tab manages its own session as it does
// today — no regression.
const authChannel: BroadcastChannel | undefined =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("livestock-auth") : undefined;

function broadcastSession(accessToken: string, user: CurrentUser): void {
  authChannel?.postMessage({ type: "session", accessToken, user } satisfies AuthBroadcastMessage);
}

function broadcastLoggedOut(): void {
  authChannel?.postMessage({ type: "logged-out" } satisfies AuthBroadcastMessage);
}

// Applies a sibling tab's broadcast directly via setState/getState rather
// than routing through setSession()/logout() — those are what originate a
// broadcast, so looping a received message back through them would echo it
// straight back out to every tab forever.
authChannel?.addEventListener("message", (event) => {
  const message = event.data as AuthBroadcastMessage;
  if (message.type === "session") {
    useAuthStore.setState({ accessToken: message.accessToken, user: message.user, status: "authenticated" });
    scheduleProactiveRefresh(message.accessToken, useAuthStore.getState, useAuthStore.setState);
  } else {
    clearProactiveRefresh();
    useAuthStore.setState({ accessToken: null, user: null, status: "unauthenticated" });
  }
});

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  status: "idle",

  async login(email, password, totpCode) {
    const tokens = await apiFetch<TokenPair>("/auth/login", {
      method: "POST",
      body: { email, password, totp_code: totpCode || undefined },
    });
    await get().setSession(tokens.access_token);
  },

  async logout() {
    clearProactiveRefresh();
    try {
      await apiFetch("/auth/logout", { method: "POST", accessToken: get().accessToken });
    } finally {
      set({ accessToken: null, user: null, status: "unauthenticated" });
      broadcastLoggedOut();
    }
  },

  async hydrate() {
    set({ status: "loading" });
    await performRefresh(get, set);
  },

  async refreshToken() {
    return performRefresh(get, set);
  },

  async setSession(accessToken) {
    try {
      const me = await apiFetch<MeResponse>("/auth/me", { accessToken });
      const user = toCurrentUser(me);
      set({ accessToken, user, status: "authenticated" });
      scheduleProactiveRefresh(accessToken, get, set);
      broadcastSession(accessToken, user);
    } catch (err) {
      clearProactiveRefresh();
      set({ accessToken: null, user: null, status: "unauthenticated" });
      throw err;
    }
  },
}));

setAuthRefreshHandler(() => useAuthStore.getState().refreshToken());

export { ApiError };
