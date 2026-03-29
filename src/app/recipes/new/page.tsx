import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import RecipeForm from "@/components/recipes/RecipeForm";

export default async function NewRecipePage() {
  const supabase = await createClient();

  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .order("category")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-2xl font-bold tracking-tight">
        Add Recipe
      </h1>
      <Suspense>
        <RecipeForm tags={tags ?? []} />
      </Suspense>
    </div>
  );
}
