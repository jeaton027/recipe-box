import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tag, TagCategory } from "@/lib/types/database";
import { categoryLabels, categoryOrder } from "@/lib/utils/tag-helpers";

export default async function BrowsePage() {
  const supabase = await createClient();

  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .order("name");

  const tagsByCategory = (tags ?? []).reduce(
    (acc: Record<string, Tag[]>, tag: Tag) => {
      if (!acc[tag.category]) acc[tag.category] = [];
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<string, Tag[]>
  );

  const orderedCategories = categoryOrder.filter(
    (cat) => tagsByCategory[cat]?.length > 0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-8 text-2xl font-bold tracking-tight">
        Browse by Tag
      </h1>

      {orderedCategories.length === 0 ? (
        <p className="py-12 text-center text-muted">No tags yet.</p>
      ) : (
        <div className="space-y-10">
          {orderedCategories.map((category) => (
            <section key={category} className="text-center">
              <h2 className="font-heading mb-4 text-lg font-semibold tracking-wide">
                {categoryLabels[category]}
              </h2>
              <div className="mx-auto inline-flex max-w-xl flex-wrap justify-center gap-1.5">
                {tagsByCategory[category].map((tag: Tag) => (
                  <Link
                    key={tag.id}
                    href={`/browse/${tag.id}`}
                    className="rounded-sm bg-accent/5 px-1 py-1 text-sm font-medium text-accent-dark transition-colors hover:bg-accent/70 hover:text-white"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
