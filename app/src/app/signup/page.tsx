"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components";
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
      auth.saveSession(res.token, res.userId);
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
          <div className="savid-icon">🦉</div>
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
          <div className="input-group">
            <label className="input-label">Card Number</label>
            <input className="input-field" type="text" placeholder="1234 5678 9012 3456" disabled />
          </div>
          <div className="flex gap-3">
            <div className="input-group flex-1"><label className="input-label">MM/YY</label><input className="input-field" type="text" placeholder="MM/YY" disabled /></div>
            <div className="input-group flex-1"><label className="input-label">CVC</label><input className="input-field" type="text" placeholder="CVC" disabled /></div>
            <div className="input-group flex-1"><label className="input-label">ZIP</label><input className="input-field" type="text" placeholder="ZIP" disabled /></div>
          </div>
          {error && <p className="error-message">{error}</p>}
          <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-2">✨ Start Your Journey</Button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-footer">By signing up, you agree to our Terms of Service and Privacy Policy. This is not a substitute for professional medical advice.</p>
      </div>
    </div>
  );
}