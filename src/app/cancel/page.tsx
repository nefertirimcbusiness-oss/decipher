"use client";

import React from "react";
import Link from "next/link";
import { Button, Card } from "@/components";

export default function CancelPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full text-center">
        {/* Header */}
        <div className="mb-8">
          <span className="inline-block text-5xl mb-4">🦉</span>
          <h1 className="font-heading text-h2 font-bold text-charcoal mb-2">
            No rush at all
          </h1>
          <p className="text-body text-graphite max-w-md mx-auto">
            Savid knows that healing moves at its own pace. Your story is safe
            here, whenever you&apos;re ready.
          </p>
        </div>

        <Card>
          <div className="p-2">
            <p className="text-body text-graphite mb-4">
              You&apos;ve paused checkout — that&apos;s completely okay.
            </p>

            <div className="bg-buttercream rounded-lg p-4 mb-6 text-left">
              <ul className="space-y-2 text-body-small text-graphite">
                <li className="flex items-start gap-2">
                  <span className="text-stone mt-0.5">✓</span>
                  <span>Nothing was charged unless you completed checkout.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone mt-0.5">✓</span>
                  <span>Any entries you&apos;ve written are still safe with you.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone mt-0.5">✓</span>
                  <span>Your 7-day free trial is here whenever you want it.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Link href="/subscribe" className="no-underline">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  🚀 Try it free when you&apos;re ready
                </Button>
              </Link>
              <Link href="/dashboard" className="no-underline">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  📖 Back to your story
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
