import Link from "next/link";
import Image from "next/image";
import type { Recipe } from "@/lib/types/database";

export default function RecipeListItem({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block py-1 text-sm hover:text-gray-400 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <h3 className="font-heading truncate text-sm font-semibold">
          {recipe.title}
        </h3>
        {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
          <p className="mt-0.5 text-xs text-muted">
            {recipe.prep_time_minutes && `${recipe.prep_time_minutes}m prep`}
            {recipe.prep_time_minutes && recipe.cook_time_minutes && " · "}
            {recipe.cook_time_minutes && `${recipe.cook_time_minutes}m cook`}
          </p>
        )}
      </div>
    </Link>
  );
}
