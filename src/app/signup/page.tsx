"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, SavidArt } from "@/components";
import { auth } from "@/lib/api";

// The two questions the API requires before it will create an account. Copy is
// verbatim from the owner-approved safety spec — the age gate is one tap, the
// consent line is one quiet line directly above the button, unticked by default.
const AGE_QUESTION = "Decipher is a space for adults. Are you 18 or older?";
const UNDER_18_MESSAGE =
  "Thank you for being honest. Decipher is built for adults, so it isn't the right space for you just yet. If you're struggling, please talk to an adult you trust — and in the US you can call or text 988 any time.";
// The consent line sits directly above the button: "I'm 18 or older, and I
// agree to the Terms and Privacy Policy." — with the two documents linked.

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isAdult, setIsAdult] = useState<"yes" | "no" | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Never call the API unless both answers are given — the age gate is the
    // first thing the server checks, and a 403 must not be how someone learns
    // that. The button is disabled in the same conditions; this is the guard
    // for the Enter key.
    if (isAdult !== "yes" || !acceptedTerms) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await auth.signup(email, password, name, {
        isAdult: true,
        acceptedTerms: true,
      });
      auth.saveSession(res.token, res.userId, email);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="savid-icon">
            <SavidArt variant="logo" className="mx-auto" />
          </div>
          <h1 className="auth-title">Welcome to Decipher</h1>
          <p className="auth-subtitle">A gentle space for your memories.</p>
        </div>

        <div className="card card-surface text-center mb-6">
          <p className="text-body-small text-graphite">
            🎁 Your first month is 50% off — <strong className="text-lilac-deep">$12.49</strong>
          </p>
          <p className="text-caption text-stone mt-1">Then $24.99/month. Cancel anytime. 7-day free trial.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Display Name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="bg-buttercream rounded-lg p-3 text-body-small text-graphite text-center">
            ✨ No card needed — your 7-day free trial starts right away.
          </div>

          <fieldset className="flex flex-col gap-2 text-left">
            <legend className="input-label mb-1">{AGE_QUESTION}</legend>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={isAdult === "yes"}
                className={`btn btn-sm ${isAdult === "yes" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setIsAdult("yes")}
              >
                Yes, I&apos;m 18 or older
              </button>
              <button
                type="button"
                aria-pressed={isAdult === "no"}
                className={`btn btn-sm ${isAdult === "no" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setIsAdult("no")}
              >
                No
              </button>
            </div>
          </fieldset>

          {isAdult === "no" ? (
            // A no is answered honestly and without an error state: no account
            // is created, and nothing on the page suggests they did something
            // wrong.
            <div className="bg-buttercream rounded-lg p-4 text-left" role="status">
              <p className="text-body text-graphite leading-relaxed">{UNDER_18_MESSAGE}</p>
            </div>
          ) : (
            <>
              {error && <p className="error-message">{error}</p>}

              <label className="flex items-start gap-2 text-body-small text-graphite cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  required
                  className="mt-1 w-4 h-4 rounded border-mist text-lilac-deep focus:ring-lilac flex-shrink-0"
                />
                <span>
                  I&apos;m 18 or older, and I agree to the{" "}
                  <a href="/terms" className="text-lilac-deep underline">Terms</a> and{" "}
                  <a href="/privacy" className="text-lilac-deep underline">Privacy Policy</a>.
                </span>
              </label>

              <Button
                type="submit"
                size="lg"
                isLoading={isLoading}
                disabled={isAdult !== "yes" || !acceptedTerms}
                className="w-full mt-2"
              >
                ✨ Start Your Journey
              </Button>
            </>
          )}
        </form>

        <hr className="auth-divider" />
        <p className="auth-footer">
          By signing up, you agree to our{" "}
          <a href="/terms" className="text-lilac-deep underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-lilac-deep underline">
            Privacy Policy
          </a>
          . See our{" "}
          <a href="/disclaimer" className="text-lilac-deep underline">
            Health &amp; Safety Disclaimer
          </a>
          . Decipher is not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}
