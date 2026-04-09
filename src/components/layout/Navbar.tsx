"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/recipes", label: "Recipes" },
  { href: "/browse", label: "Browse" },
  { href: "/collections", label: "Collections" },
  { href: "/search", label: "Search" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="hidden border-b border-border bg-white md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-heading text-xl font-bold tracking-tight"
          >
            Recipe Box
          </Link>
          <Link
            href="/recipes/import"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent-light hover:text-accent-dark"
          >
            Add Recipe
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-light text-accent-dark"
                    : "text-muted hover:bg-gray-100 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <Link
          href="/profile"
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            pathname === "/profile"
              ? "bg-accent-light text-accent-dark"
              : "bg-gray-100 text-muted hover:bg-accent-light hover:text-accent-dark"
          }`}
          title="Profile"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
