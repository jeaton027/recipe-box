import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import Footer from "@/components/layout/Footer";

/**
 * Layout for the normal app experience: top navbar, footer, and mobile
 * bottom nav. All standard routes (home, recipes, collections, menus,
 * browse, search, profile, auth) live under this group.
 *
 * Cook Mode lives under the (cook) route group with its own minimal
 * layout so it doesn't inherit this chrome.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // pb-16 on the outer container (not just <main>) so the Footer also
  // clears the fixed mobile bottom-nav. MobileNav itself is fixed, so
  // this padding just reserves viewport space for it.
  return (
    <div className="flex min-h-full flex-col pb-16 md:pb-0">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  );
}
