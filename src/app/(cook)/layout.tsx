/**
 * Layout for Cook Mode (and any other full-bleed / chrome-free routes).
 * Deliberately empty — no navbar, footer, or mobile bottom nav. The page
 * itself is responsible for its own header (a sticky bar with a back arrow).
 */
export default function CookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-full">{children}</div>;
}
