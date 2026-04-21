import Link from "next/link";

const navLinks = [
  { href: "/recipes", label: "Recipes" },
  { href: "/browse", label: "Browse" },
  { href: "/collections", label: "Collections" },
  { href: "/menus", label: "Menus" },
  { href: "/search", label: "Search" },
];

export default function Footer() {
  return (
    <footer className="mt-12 flex min-h-[25vh] flex-col items-center justify-center gap-4 border-t border-border bg-accent-light px-6 py-10 text-center">
      {/* Wordmark + tagline */}
      <div>
        <p className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Recipe Box
        </p>
        <p className="mt-1 text-sm text-muted">
          Your Recipes, Organized
        </p>
      </div>

      {/* Quiet nav */}
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        {navLinks.map((link, i) => (
          <span key={link.href} className="flex items-center gap-x-4">
            <Link
              href={link.href}
              className="text-muted transition-colors hover:text-accent-dark"
            >
              {link.label}
            </Link>
            {i < navLinks.length - 1 && (
              <span className="text-muted/40" aria-hidden="true">
                ·
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Credit */}
      <p className="text-xs text-muted">
        Built by Jessica Eaton ·{" "}
        <a
          href="https://github.com/jeaton027/recipe-box.git"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted underline-offset-2 transition-colors hover:text-accent-dark hover:underline"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
