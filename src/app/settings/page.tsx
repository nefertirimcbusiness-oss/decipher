"use client";

import React, { useState, useEffect } from "react";
import { Button, Input, Card } from "@/components";
import { auth, subscription } from "@/lib/api";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [subStatus, setSubStatus] = useState<{ plan: string; status: string; nextBilling: string; trialEnd: string } | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated()) return;
    subscription.getStatus()
      .then(setSubStatus)
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await subscription.cancel();
      setSubStatus((prev) => prev ? { ...prev, status: "cancelled" } : null);
      setCancelConfirm(false);
    } catch (err: any) {
      alert(err.message || "Failed to cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleLogout = () => {
    auth.logout();
    window.location.href = "/";
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "trialing": return "🟡 Trial";
      case "active": return "🟢 Active";
      case "cancelled": return "🔴 Cancelled";
      case "past_due": return "🟠 Past Due";
      default: return status;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <h1 className="font-heading text-h2 font-bold text-charcoal mb-1">⚙️ Settings</h1>
      <p className="text-body text-graphite mb-8">Manage your account and preferences.</p>
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="font-body text-h4 font-semibold text-charcoal mb-4">📋 Profile</h2>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Input label="Email" type="email" value="" onChange={() => {}} placeholder="your@email.com" />
            <div className="flex justify-end pt-2"><Button type="submit" size="sm" isLoading={isSaving}>Save Changes</Button></div>
          </form>
        </Card>

        <Card>
          <h2 className="font-body text-h4 font-semibold text-charcoal mb-4">💳 Subscription</h2>
          {subLoading ? (
            <p className="text-body-small text-stone">Loading subscription info...</p>
          ) : subStatus ? (
            <>
              <div className="space-y-2 text-body text-graphite mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{statusLabel(subStatus.status)}</span>
                  <span className="text-body-small text-stone">— {subStatus.plan} plan</span>
                </div>
                {subStatus.trialEnd && subStatus.status === "trialing" && (
                  <p className="text-body-small text-stone">
                    🕐 Trial ends: {new Date(subStatus.trialEnd).toLocaleDateString()}
                  </p>
                )}
                {subStatus.nextBilling && subStatus.status === "active" && (
                  <p className="text-body-small text-stone">
                    💳 Next billing: {new Date(subStatus.nextBilling).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {subStatus.status === "active" || subStatus.status === "trialing" ? (
                  cancelConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-body-small text-graphite">Are you sure?</span>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={cancelling}
                        onClick={handleCancelSubscription}
                      >
                        Yes, cancel
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelConfirm(false)}
                      >
                        Never mind
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setCancelConfirm(true)}
                    >
                      Cancel subscription
                    </Button>
                  )
                ) : (
                  <a href="/subscribe">
                    <Button variant="primary" size="sm">
                      🚀 Upgrade to Pro
                    </Button>
                  </a>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-body-small text-stone">No active subscription.</p>
              <a href="/subscribe">
                <Button variant="primary" size="sm">
                  🚀 Start free trial
                </Button>
              </a>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-body text-h4 font-semibold text-charcoal mb-4">🎨 Preferences</h2>
          <div className="flex flex-col gap-3">
            {[
              { label: "🌙 Dark mode (coming soon)", checked: false, disabled: true },
              { label: "🔔 Reminders", checked: true },
              { label: "🔊 Sound effects: Gentle", checked: true },
            ].map((pref) => (
              <label key={pref.label} className="flex items-center justify-between cursor-pointer">
                <span className="text-body text-graphite">{pref.label}</span>
                <input type="checkbox" defaultChecked={pref.checked} disabled={pref.disabled} className="w-4 h-4 rounded border-mist text-lilac-deep focus:ring-lilac" />
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-body text-h4 font-semibold text-charcoal mb-4">🔒 Privacy</h2>
          <p className="text-body-small text-graphite mb-4">🔒 All data is encrypted</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm">📤 Export my data</Button>
            <Button variant="danger" size="sm">🗑️ Delete account</Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-body text-h4 font-semibold text-charcoal mb-4">🦉 About</h2>
          <div className="space-y-2 text-body text-graphite">
            <p>Decipher v1.0.0</p>
            <a href="#" className="text-lilac-deep hover:text-lilac text-body-small">📋 Terms of Service</a><br />
            <a href="#" className="text-lilac-deep hover:text-lilac text-body-small">🔒 Privacy Policy</a>
          </div>
        </Card>
      </div>
    </div>
  );
}