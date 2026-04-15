"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navLinks = [
  { href: "/recipes", label: "Recipes" },
  { href: "/browse", label: "Browse" },
  { href: "/collections", label: "Collections" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setQuery("");
  }

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
            const isActive =
              link.href === "/recipes"
                ? pathname === "/recipes"
                : pathname.startsWith(link.href);
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

          {/* Expandable search (hidden on /recipes which has its own search bar) */}
          {pathname !== "/recipes" && <div className="relative ml-1 flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search recipes…"
                  className="w-48 rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  onBlur={() => {
                    // Close if empty after a short delay (allows submit click)
                    setTimeout(() => {
                      if (!query.trim()) {
                        setSearchOpen(false);
                        setQuery("");
                      }
                    }, 150);
                  }}
                />
                <button
                  type="submit"
                  className="rounded-md bg-accent px-2.5 py-1.5 text-white hover:bg-accent-dark"
                  title="Search"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-md p-2 text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
                title="Search"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </button>
            )}
          </div>}
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
