import Link from "next/link";

type Props = {
  slug: string;
};

/**
 * Entry point into Cook Mode. Lives alongside Compare on the action row
 * between the recipe description and the thumbnail. Styled to match
 * CompareButton so they sit visually as a pair.
 */
export default function CookModeButton({ slug }: Props) {
  return (
    <Link
      href={`/recipes/${slug}/cook`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent-dark"
      title="Open this recipe in Cook Mode — larger text, screen stays on, distractions hidden"
    >
      {/* Pot-with-lid icon */}
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.6}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 9h18M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M8 9V7a4 4 0 0 1 8 0v2M10 5.5h4"
        />
      </svg>
      Cook Mode
    </Link>
  );
}
