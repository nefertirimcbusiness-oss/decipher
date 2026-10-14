"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, SavidArt } from "@/components";
import { auth } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await auth.signup(email, password, name);
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
          {error && <p className="error-message">{error}</p>}
          <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-2">✨ Start Your Journey</Button>
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