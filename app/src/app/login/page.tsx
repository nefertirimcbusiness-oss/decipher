"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components";
import { auth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await auth.login(email, password);
      auth.saveSession(res.token, res.userId);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="savid-icon">🦉</div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Log in to continue your story</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error-message">{error}</p>}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-caption text-lilac-deep font-medium">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-2">
            Log in
          </Button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-lilac-deep font-semibold">
            Start your free trial
          </Link>
        </p>
        <div className="text-center mt-4">
          <Link href="/" className="text-caption text-stone hover:text-lilac-deep">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}