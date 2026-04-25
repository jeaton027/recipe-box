import Link from "next/link";

type Props = {
  slug: string;
};

/**
 * Primary CTA above the ingredients section. Full-width tinted card so it
 * reads as the page's "I'm about to make this" action without competing as
 * loudly as a solid accent button. Compare / Save / etc. stay quiet outline
 * chips up top; this is the verb.
 */
export default function CookModeButton({ slug }: Props) {
  return (
    <Link
      href={`/recipes/${slug}/cook`}
      className="group mb-6 flex w-full items-center gap-3 rounded-lg bg-accent-soft px-4 py-2.5 text-accent-dark transition-colors hover:bg-accent hover:text-white"
      title="Larger text, screen stays awake, distractions hidden"
    >
      {/* Pot-with-lid icon */}
      <svg
        className="h-6 w-6 shrink-0"
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
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-semibold">Start Cooking</span>
        
      </span>
      <svg
        className="h-5 w-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
        />
      </svg>
    </Link>
  );
}
