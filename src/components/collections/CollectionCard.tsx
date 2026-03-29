import Link from "next/link";
import Image from "next/image";
import type { Collection } from "@/lib/types/database";

type Props = {
  collection: Collection & { recipe_count?: number };
};

export default function CollectionCard({ collection }: Props) {
  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-accent-light">
        {collection.cover_image_url ? (
          <Image
            src={collection.cover_image_url}
            alt={collection.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-10 w-10 text-accent/40"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-heading text-sm font-semibold leading-tight">
          {collection.name}
        </h3>
        {collection.description && (
          <p className="mt-0.5 text-xs text-muted line-clamp-1">
            {collection.description}
          </p>
        )}
        {collection.recipe_count !== undefined && (
          <p className="mt-1 text-xs text-muted">
            {collection.recipe_count}{" "}
            {collection.recipe_count === 1 ? "recipe" : "recipes"}
          </p>
        )}
      </div>
    </Link>
  );
}
