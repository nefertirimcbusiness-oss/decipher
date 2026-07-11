"use client";

import React, { useState, useEffect } from "react";
import { Button, Input, Card } from "@/components";
import { auth, subscription } from "@/lib/api";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [subStatus, setSubStatus] = useState<{ plan: string; status: string; nextBilling: string; trialEnd: string } | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated()) return;
    subscription.getStatus().then(setSubStatus).catch(() => {});
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
  };

  const handleLogout = () => {
    auth.logout();
    window.location.href = "/";
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
          <h2 className="font-body text-h4 font-semibold text-charcoal mb-4">💳 Account</h2>
          <div className="space-y-2 text-body text-graphite">
            <p>📧 {auth.getUserId() ? "Active user" : "Not logged in"}</p>
            {subStatus ? (
              <>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-success" /><span>Subscription: {subStatus.status}</span></div>
                <p className="text-body-small text-stone">Plan: {subStatus.plan}</p>
                <p className="text-body-small text-stone">Next billing: {subStatus.nextBilling}</p>
                <p className="text-body-small text-stone">Trial ends: {subStatus.trialEnd}</p>
              </>
            ) : (
              <p className="text-body-small text-stone">Loading subscription info...</p>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="primary" size="sm">Manage Subscription</Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button>
          </div>
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