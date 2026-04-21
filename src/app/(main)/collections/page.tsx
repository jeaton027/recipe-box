import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CollectionCard from "@/components/collections/CollectionCard";

export default async function CollectionsPage() {
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from("collections")
    .select("*")
    .order("created_at", { ascending: false });

  // Get recipe counts for each collection
  const collectionsWithCounts = await Promise.all(
    (collections ?? []).map(async (collection) => {
      const { count } = await supabase
        .from("collection_recipes")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", collection.id);
      return { ...collection, recipe_count: count ?? 0 };
    })
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Collections
        </h1>
        <Link
          href="/collections/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          New collection
        </Link>
      </div>

      {collectionsWithCounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 rounded-full bg-accent-light p-4">
            <svg
              className="h-8 w-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
              />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-semibold">No collections yet</h2>
          <p className="mt-1 text-sm text-muted">
            Group recipes into collections like playlists.
          </p>
          <Link
            href="/collections/new"
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Create your first collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {collectionsWithCounts.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}
