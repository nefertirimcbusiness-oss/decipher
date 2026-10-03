export function Footer() {
  return (
    <footer className="border-t border-mist bg-white px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-3 text-center">
        <p className="text-sm text-stone">
          &copy; {new Date().getFullYear()} Decipher. All rights reserved.
        </p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-stone">
          <strong>Disclaimer:</strong> Decipher is not a substitute for
          professional medical or therapeutic advice. Users hold themselves
          responsible for their own actions.
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
      </div>
    </footer>
  );
}
