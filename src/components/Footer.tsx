"use client";

export function Footer() {
  return (
    <footer className="border-t border-mist bg-white px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-3 text-center">
        <p className="text-sm text-stone">
          &copy; {new Date().getFullYear()} Decipher. All rights reserved.
        </p>
        <p className="text-xs text-stone">
          <a href="/privacy" className="text-lilac-deep hover:underline">
            Privacy Policy
          </a>
          <span className="mx-2">·</span>
          <a href="/terms" className="text-lilac-deep hover:underline">
            Terms of Service
          </a>
          <span className="mx-2">·</span>
          <a href="/disclaimer" className="text-lilac-deep hover:underline">
            Health &amp; Safety Disclaimer
          </a>
        </p>
        {/* Footnote — the protective sentences sit beneath the quick links. */}
        <div className="space-y-2 pt-2">
          <p className="legal-notice mx-auto max-w-md">
            Decipher is not a substitute for professional medical or therapeutic
            advice. Users hold themselves responsible for their own actions.
          </p>
          <p className="legal-notice mx-auto max-w-md">
            Not for medical, clinical, therapeutic or legal use, and Savid gives
            no legal advice; no outcome, result or accuracy is guaranteed.
          </p>
        </div>
      </div>
    </footer>
  );
}
