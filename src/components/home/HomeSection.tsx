import Link from "next/link";
import type { Recipe } from "@/lib/types/database";
import RecipeCard from "@/components/recipes/RecipeCard";

type Props = {
  title: string;
  subtitle?: string;
  recipes: Recipe[];
  viewAllHref?: string;
  viewAllLabel?: string;
};

export default function HomeSection({
  title,
  subtitle,
  recipes,
  viewAllHref,
  viewAllLabel = "View all",
}: Props) {
  if (recipes.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="shrink-0 text-sm font-medium text-accent hover:text-accent-dark"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>

      {/* Horizontal scroll row */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="w-44 flex-shrink-0 sm:w-48">
            <RecipeCard recipe={recipe} />
          </div>
        ))}
      </div>
    </section>
  );
}
