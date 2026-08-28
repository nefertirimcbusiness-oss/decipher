"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* Desktop navigation — hidden on mobile, shown on tablet+ via nav-bottom */
export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const links = [
    { href: "/dashboard", label: "My Story", icon: "📖" },
    { href: "/entries/new", label: "New Entry", icon: "✏️" },
    { href: "/edits", label: "Edits", icon: "🕐" },
    { href: "/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <>
      {/* Desktop top nav */}
      <nav
        className={`hide-mobile sticky top-0 z-sticky w-full transition-all duration-300 ${
          isScrolled ? "bg-white/80 backdrop-blur-md border-b border-mist" : "bg-transparent"
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/dashboard" className="font-heading text-xl font-bold text-lilac-deep tracking-tight no-underline hover:no-underline">
            Decipher
          </Link>

          <div className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-bottom-item !flex-row !gap-1.5 !py-2 !px-3 ${
                  (pathname === link.href || pathname.startsWith(link.href + "/")) ? "active" : ""
                }`}
              >
                <span className="nav-icon">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          <Link
            href="/settings"
            className="w-9 h-9 rounded-full bg-lilac-light flex items-center justify-center text-lilac-deep text-sm font-bold no-underline hover:no-underline"
          >
            Y
          </Link>
        </div>
      </nav>

      {/* Bottom mobile nav */}
      <nav className="nav-bottom hide-desktop hide-tablet">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-bottom-item ${
              (pathname === link.href || pathname.startsWith(link.href + "/")) ? "active" : ""
            }`}
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}