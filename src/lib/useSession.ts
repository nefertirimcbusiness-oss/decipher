"use client";

/*
 * Client-side session guard for pages that need a signed-in user.
 *
 * Why this exists: every protected page used to do
 *
 *     useEffect(() => { if (!auth.isAuthenticated()) return; ... }, []);
 *
 * and leave its `loading` flag at `true` forever when the check failed. The
 * page therefore rendered an empty shell (three thinking dots, or empty cards)
 * with no way forward — the visitor was never sent to /login and never told
 * anything was wrong. An *expired* token was worse: `isAuthenticated()` only
 * checks that a token string exists, so the page rendered as a signed-in page
 * whose data requests 401'd and were swallowed, showing "You've written 0
 * memories" / "Your scrapbook is empty" instead of the user's real memories.
 *
 * This hook resolves both cases before the page renders any state that claims
 * to be the user's data: an absent or expired token clears the stored session
 * and sends the user to /login (with a `next` back to where they were), and
 * `ready` tells the page whether it may start loading real data.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./api";

function decodeExpMs(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;

  // base64url -> base64, then pad to a multiple of 4 for atob.
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

  try {
    const payload = JSON.parse(atob(padded));
    return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    // Not a JWT we can read: leave the decision to the API (401 handling).
    return null;
  }
}

/** True when the stored token is missing or past its `exp`. */
export function sessionIsValid(token: string | null): boolean {
  if (!token) return false;
  const expMs = decodeExpMs(token);
  if (expMs === null) return true;
  return expMs > Date.now();
}

export function useSessionGuard(): { ready: boolean } {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = auth.getToken();

    if (!sessionIsValid(token)) {
      auth.logout();
      setReady(false);
      const here =
        typeof window === "undefined"
          ? "/dashboard"
          : window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }

    setReady(true);
  }, [router]);

  return { ready };
}
