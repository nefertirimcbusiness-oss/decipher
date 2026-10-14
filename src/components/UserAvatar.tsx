"use client";

import React from "react";

/**
 * Neutral user avatar. The backend only stores email (no display name), so we
 * derive an initial from the stored email when present and otherwise fall back
 * to a neutral person glyph — never a hardcoded letter.
 */
export function UserAvatar({ className = "" }: { className?: string }) {
  const [initial, setInitial] = React.useState<string>("");

  React.useEffect(() => {
    const email = localStorage.getItem("decipher_email") ?? "";
    const first = email.trim().charAt(0);
    setInitial(first ? first.toUpperCase() : "");
  }, []);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center overflow-hidden ${className}`}
    >
      {initial || (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-1/2 w-1/2"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )}
    </span>
  );
}
