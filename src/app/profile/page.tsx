import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";
import type { Tag } from "@/lib/types/database";

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: tags }, { count: recipeCount }, { count: collectionCount }, { count: menuCount }] =
    await Promise.all([
      supabase.from("tags").select("*").order("category").order("name"),
      supabase.from("recipes").select("*", { count: "exact", head: true }),
      supabase.from("collections").select("*", { count: "exact", head: true }),
      supabase.from("menus").select("*", { count: "exact", head: true }),
    ]);

  return (
    <ProfileClient
      email={user.email ?? ""}
      recipeCount={recipeCount ?? 0}
      collectionCount={collectionCount ?? 0}
      menuCount={menuCount ?? 0}
      tags={(tags ?? []) as Tag[]}
    />
  );
}
