"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, SavidArt } from "@/components";
import { subscription, auth, type SubscriptionStatus } from "@/lib/api";

function statusLabel(status: string) {
  switch (status) {
    case "trialing":
      return "🟡 Trial";
    case "active":
      return "🟢 Active";
    case "cancelled":
      return "🔴 Cancelled";
    case "canceled":
      return "🔴 Cancelled";
    case "past_due":
      return "🟠 Past Due";
    case "inactive":
      return "⚪ No subscription";
    default:
      return status;
  }
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      setError("not-authenticated");
      setLoading(false);
      return;
    }

    subscription
      .getStatus()
      .then(setSub)
      .catch(() => {
        // Never invent a status. This page is reachable by anyone who types the
        // URL, so synthesising "active" here showed a paid subscription that may
        // not exist. Say we could not confirm it and point at Settings, where the
        // real status is read from the API.
        setError("status-unavailable");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full text-center">
        {/* Header */}
        <div className="mb-8">
          <span className="mb-4 flex justify-center">
            <SavidArt variant="header" />
          </span>
          <h1 className="font-heading text-h2 font-bold text-charcoal mb-2">
            Welcome to Decipher
          </h1>
          <p className="text-body text-graphite max-w-md mx-auto">
            Your story just found its home. Savid is already looking forward to
            walking alongside you.
          </p>
        </div>

        <Card>
          <div className="p-2">
            {/* Success marker. Stripe appends ?session_id=... to the success
                URL, so its absence means someone typed this address instead of
                arriving from checkout — don't claim their checkout completed. */}
            {sessionId && (
              <div className="inline-flex items-center gap-2 bg-success/10 text-success text-body-small font-semibold px-3 py-1.5 rounded-full mb-6">
                ✓ Checkout complete
              </div>
            )}

            {/* Subscription status */}
            {loading ? (
              <p className="text-body-small text-stone mb-6">
                Confirming your subscription…
              </p>
            ) : error === "not-authenticated" ? (
              <div className="text-body text-graphite mb-6">
                <p className="mb-2">
                  You&apos;re not signed in on this device, so we can&apos;t show
                  your subscription here.
                </p>
                <p className="text-body-small text-stone">
                  Log in to see your account details.
                </p>
              </div>
            ) : error === "status-unavailable" ? (
              <div className="text-body text-graphite mb-6">
                <p className="mb-2">
                  We couldn&apos;t confirm your subscription yet — check Settings.
                </p>
                <p className="text-body-small text-stone">
                  If you just paid, your subscription may still be activating.
                </p>
              </div>
            ) : sub ? (
              <div className="space-y-2 text-body text-graphite mb-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold">{statusLabel(sub.status)}</span>
                  <span className="text-body-small text-stone">— {sub.plan}</span>
                </div>
                {sub.trialEnd && sub.status === "trialing" && (
                  <p className="text-body-small text-stone">
                    🕐 Your 7-day free trial ends{" "}
                    {new Date(sub.trialEnd).toLocaleDateString()}
                  </p>
                )}
                {sub.nextBilling && sub.status === "active" && (
                  <p className="text-body-small text-stone">
                    💳 Next billing: {new Date(sub.nextBilling).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : null}

            {/* Session reference (subtle, for support) */}
            {sessionId && (
              <p className="text-caption text-stone mb-6">
                Session {sessionId.slice(0, 12)}…
              </p>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Link href="/dashboard" className="no-underline">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  📖 Go to your dashboard
                </Button>
              </Link>
              <Link href="/settings" className="no-underline">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  ⚙️ Manage subscription
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Footer disclaimer */}
        <p className="text-body-small text-stone mt-6 max-w-sm mx-auto">
          <strong>Disclaimer:</strong> Decipher is not a substitute for
          professional medical or therapeutic advice. Users hold themselves
          responsible for their own actions.
        </p>
      </div>
    </div>
  );
}

function SuccessSkeleton() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full text-center">
        <span className="mb-4 flex justify-center">
          <SavidArt variant="header" />
        </span>
        <h1 className="font-heading text-h2 font-bold text-charcoal mb-2">
          Welcome to Decipher
        </h1>
        <p className="text-body text-graphite">Loading…</p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessContent />
    </Suspense>
  );
}
