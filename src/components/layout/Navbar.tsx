"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/recipes", label: "Recipes" },
  { href: "/browse", label: "Browse" },
  { href: "/collections", label: "Collections" },
  { href: "/search", label: "Search" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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

        <button
          onClick={handleSignOut}
          className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-gray-100 hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
