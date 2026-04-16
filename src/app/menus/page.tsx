import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MenuCard from "@/components/menus/MenuCard";

export default async function MenusPage() {
  const supabase = await createClient();

  const { data: menus } = await supabase
    .from("menus")
    .select("*")
    .order("created_at", { ascending: false });

  // Get recipe counts per menu
  const menuIds = (menus ?? []).map((m) => m.id);
  const { data: counts } = menuIds.length > 0
    ? await supabase
        .from("menu_recipes")
        .select("menu_id")
        .in("menu_id", menuIds)
    : { data: [] };

  const countMap = (counts ?? []).reduce((acc, row) => {
    acc[row.menu_id] = (acc[row.menu_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Menus</h1>
        <Link
          href="/menus/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          New Menu
        </Link>
      </div>

      {(menus ?? []).length === 0 ? (
        <p className="py-12 text-center text-muted">
          No menus yet. Create one to plan your meals.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(menus ?? []).map((menu) => (
            <MenuCard
              key={menu.id}
              id={menu.id}
              name={menu.name}
              coverImageUrl={menu.cover_image_url}
              recipeCount={countMap[menu.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
