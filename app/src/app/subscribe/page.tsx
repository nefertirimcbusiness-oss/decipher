"use client";

import React, { useState } from "react";
import { Button, Card } from "@/components";
import { subscription, auth } from "@/lib/api";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStartTrial = async () => {
    setLoading(true);
    setError("");

    try {
      const { checkoutUrl } = await subscription.createCheckout();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full text-center">
        {/* Header */}
        <div className="mb-8">
          <span className="inline-block text-5xl mb-4">🦉</span>
          <h1 className="font-heading text-h2 font-bold text-charcoal mb-2">
            Start Your Journey
          </h1>
          <p className="text-body text-graphite max-w-md mx-auto">
            Decipher helps you log memories, fill in the blanks, and watch your
            story unfold — with Savid, your owl mentor, by your side.
          </p>
        </div>

        {/* Pricing Card */}
        <Card>
          <div className="p-2">
            {/* Plan name */}
            <h2 className="font-body text-h4 font-semibold text-charcoal mb-1">
              Decipher Monthly
            </h2>
            <p className="text-body-small text-stone mb-6">
              Full access to all features
            </p>

            {/* Price */}
            <div className="mb-3">
              <span className="font-heading text-h1 font-bold text-charcoal">
                $24.99
              </span>
              <span className="text-body text-graphite">/month</span>
            </div>

            {/* Discount badge */}
            <div className="inline-block bg-success/10 text-success text-body-small font-semibold px-3 py-1 rounded-full mb-6">
              🎉 First month 50% off — just $12.49
            </div>

            {/* Feature list */}
            <ul className="text-left space-y-3 mb-8 text-body text-graphite">
              <li className="flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                <span>Unlimited memory entries with text &amp; audio</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                <span>Beautiful scrapbook pages for every entry</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                <span>Savid — your AI owl mentor &amp; guide</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                <span>Edit history with logged reasons</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                <span>Evidence uploads for your memories</span>
              </li>
            </ul>

            {/* Trial info */}
            <div className="bg-buttercream rounded-lg p-4 mb-6">
              <p className="text-body-small text-graphite font-semibold">
                🕐 7-day free trial
              </p>
              <p className="text-body-small text-stone mt-1">
                No credit card required to start. Cancel anytime with one
                click.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-danger/10 text-danger text-body-small rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            {/* CTA */}
            <Button
              variant="primary"
              size="lg"
              className="w-full mb-4"
              isLoading={loading}
              onClick={handleStartTrial}
            >
              🚀 Start Free Trial
            </Button>

            <p className="text-body-small text-stone">
              Already subscribed?{" "}
              <a href="/login" className="text-lilac-deep hover:text-lilac underline">
                Log in
              </a>
            </p>
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
