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
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  );
}
