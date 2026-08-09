"use client";

import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <span className="font-heading text-2xl font-bold text-lilac-deep tracking-tight">
          Decipher
        </span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn btn-ghost !text-sm">
            Log in
          </Link>
          <Link href="/signup">
            <button className="btn btn-primary btn-sm">Start Free Trial</button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="flex flex-col items-center text-center px-4 pt-20 sm:pt-28 pb-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-6xl mb-6">🦉</div>
            <h1 className="font-heading text-h1 sm:text-[2.75rem] font-bold text-charcoal leading-tight">
              Your Story,{" "}
              <span className="text-lilac-deep">Beautifully</span> Told
            </h1>
            <p className="text-body-large text-graphite max-w-lg mx-auto leading-relaxed mt-4">
              A gentle space to log your memories, fill in the blanks, and
              watch your story unfold — with{" "}
              <strong>Savid</strong>, your owl mentor, by your side.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Link href="/signup">
                <button className="btn btn-primary btn-lg">Begin Your Journey</button>
              </Link>
              <Link href="/login">
                <button className="btn btn-secondary btn-lg">I have an account</button>
              </Link>
            </div>

            <p className="text-body-small text-stone mt-4">
              7-day free trial · $24.99/month after · Cancel anytime
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 pb-20">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="card">
              <div className="text-2xl mb-3">✏️</div>
              <h3 className="font-body text-h4 font-semibold mb-2">Log Your Story</h3>
              <p className="text-body text-graphite leading-relaxed">
                Write or record entries with evidence — each submission becomes a beautiful scrapbook page.
              </p>
            </div>
            <div className="card">
              <div className="text-2xl mb-3">🦉</div>
              <h3 className="font-body text-h4 font-semibold mb-2">Savid Guides You</h3>
              <p className="text-body text-graphite leading-relaxed">
                A gentle AI owl who asks thoughtful questions and helps jog memories — never judging.
              </p>
            </div>
            <div className="card">
              <div className="text-2xl mb-3">🕐</div>
              <h3 className="font-body text-h4 font-semibold mb-2">Honest Record</h3>
              <p className="text-body text-graphite leading-relaxed">
                Edits are tracked with reasons — your story stays true to you, always.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-mist py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-caption text-stone">&copy; {new Date().getFullYear()} Decipher. All rights reserved.</p>
          <p className="text-caption text-stone text-center max-w-md">
            This app is not a substitute for professional medical or therapeutic advice.
          </p>
        </div>
      </footer>
    </div>
  );
}