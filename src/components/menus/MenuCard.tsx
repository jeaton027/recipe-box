import Link from "next/link";
import Image from "next/image";

type Props = {
  id: string;
  name: string;
  coverImageUrl: string | null;
  recipeCount: number;
};

export default function MenuCard({ id, name, coverImageUrl, recipeCount }: Props) {
  return (
    <Link
      href={`/menus/${id}`}
      className="group overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-accent-light">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-10 w-10 text-accent/30"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-heading truncate text-sm font-semibold">{name}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
        </p>
      </div>
    </Link>
  );
}
